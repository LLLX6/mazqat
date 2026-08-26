import {
  applyBid,
  createAuctionState,
  formatOMR,
  resumeParticipant,
  settleAuction,
  tickAuction,
  withdrawParticipant,
} from './auction-engine.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const storage = {
  get(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Device preferences are optional. */ }
  },
};

const viewer = {
  id: storage.get('mazqat-demo-participant', crypto.randomUUID()),
  nickname: storage.get('mazqat-demo-nickname', 'حمد_مسقط'),
};
storage.set('mazqat-demo-participant', viewer.id);

let auction = createAuctionState();
let timerHandle = null;
let timerStarted = false;
let closingHandle = null;
let remoteMode = false;
let remoteChecked = false;
let networkOnline = navigator.onLine;
let activeCategory = 'all';
let activeModal = null;
let lastFocused = null;
let cameraStream = null;
let uploadedVideoUrl = null;
let toastHandle = null;
let pendingBidIncrement = null;

const ui = {
  connectionBar: $('#connectionBar'),
  connectionText: $('#connectionText'),
  bidButtons: $$('.hold-bid'),
  currentPriceCard: $('#currentPriceCard'),
  timerCard: $('#timerCard'),
  leaderStatus: $('#leaderStatus'),
  leaderboard: $('#leaderboardList'),
  leaveButton: $('#leaveAuctionButton'),
  toast: $('#toast'),
  toastText: $('#toastText'),
};

function arabicInitial(value) {
  return [...String(value || 'م')][0] || 'م';
}

function secondsLabel(seconds) {
  if (!Number.isFinite(seconds)) return '00:00';
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = Math.max(0, seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function toast(message, kind = 'success') {
  clearTimeout(toastHandle);
  ui.toastText.textContent = message;
  $('i', ui.toast).textContent = kind === 'error' ? '!' : kind === 'info' ? 'i' : '✓';
  ui.toast.hidden = false;
  toastHandle = setTimeout(() => { ui.toast.hidden = true; }, 3800);
}

function setConnection(message, status = 'local') {
  ui.connectionText.textContent = message;
  ui.connectionBar.dataset.status = status;
}

function updateConnectivity() {
  networkOnline = navigator.onLine;
  if (!networkOnline) {
    setConnection('الاتصال منقطع — المزايدة متوقفة ولن تُرسل لاحقًا', 'offline');
    ui.bidButtons.forEach((button) => { button.disabled = true; });
    return;
  }
  if (remoteMode) setConnection('متصل بخادم المعاينة — السعر يُؤكَّد قبل ظهوره', 'remote');
  else setConnection('وضع المعاينة المحلية — المزايدات محفوظة على هذا الجهاز فقط', 'local');
  renderAuction();
}

function uniqueLeaders(bids) {
  const seen = new Set();
  return bids.filter((bid) => {
    if (seen.has(bid.nickname)) return false;
    seen.add(bid.nickname);
    return true;
  }).slice(0, 3);
}

function renderAuction() {
  $$('[data-current-price]').forEach((node) => { node.textContent = formatOMR(auction.currentBaisa); });
  $$('[data-leader]').forEach((node) => { node.textContent = auction.leader || 'لا يوجد بعد'; });
  $$('#leaderAvatar').forEach((node) => { node.textContent = arabicInitial(auction.leader); });
  $$('[data-timer]').forEach((node) => {
    node.textContent = auction.status === 'sold' ? 'تم البيع' : auction.status === 'unsold' ? 'لم تُبع' : auction.status === 'closing' ? 'تثبيت…' : secondsLabel(auction.remainingSeconds);
  });
  $$('[data-result-price]').forEach((node) => {
    const increment = Number(node.dataset.resultPrice);
    node.textContent = formatOMR(auction.currentBaisa + increment);
  });
  const viewerLeads = auction.leader === viewer.nickname;
  ui.leaderStatus.innerHTML = viewerLeads ? '<b>أنت المتصدر الآن</b> — سيظهر اسمك للمتابعين' : `المتصدر الآن <b>${escapeHtml(auction.leader || 'لا يوجد')}</b>`;
  ui.currentPriceCard.classList.toggle('viewer-leading', viewerLeads);
  ui.timerCard.classList.toggle('urgent', auction.status === 'live' && auction.remainingSeconds <= 10);
  const bidDisabled = !networkOnline || auction.status !== 'live' || auction.withdrawn;
  ui.bidButtons.forEach((button) => { button.disabled = bidDisabled; });
  ui.leaveButton.textContent = auction.withdrawn ? 'العودة إلى المزايدة' : 'اكتفيت — متابعة كمشاهد';
  ui.leaveButton.setAttribute('aria-pressed', String(auction.withdrawn));
  ui.leaderboard.innerHTML = uniqueLeaders(auction.bids).map((bid, index) => `
    <li class="${bid.nickname === viewer.nickname ? 'me' : ''}">
      <i>${index + 1}</i><b>${escapeHtml(bid.nickname)}</b><span>${formatOMR(bid.amountBaisa)} ر.ع.</span>
    </li>`).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function checkRemoteSnapshot() {
  if (remoteChecked || !networkOnline) return;
  remoteChecked = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const response = await fetch('/api/auction', { headers: { accept: 'application/json' }, cache: 'no-store', signal: controller.signal });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('preview-api-unavailable');
    const payload = await response.json();
    if (payload?.mode === 'shared-preview' && payload?.snapshot) {
      auction = { ...auction, ...payload.snapshot, seenKeys: auction.seenKeys, bids: payload.snapshot.bids?.length ? payload.snapshot.bids : auction.bids };
      remoteMode = true;
      setConnection('متصل بخادم المعاينة — السعر يُؤكَّد قبل ظهوره', 'remote');
      renderAuction();
    } else {
      remoteMode = false;
      setConnection('وضع المعاينة المحلية — المزايدات محفوظة على هذا الجهاز فقط', 'local');
    }
  } catch {
    remoteMode = false;
    setConnection('وضع المعاينة المحلية — المزايدات محفوظة على هذا الجهاز فقط', 'local');
  } finally {
    clearTimeout(timeout);
  }
}

async function commitBid(incrementBaisa) {
  if (!networkOnline) {
    toast('الاتصال منقطع. لم نرسل مزايدة، ولن نضعها في قائمة انتظار.', 'error');
    return;
  }
  if (auction.withdrawn) {
    toast('أنت تتابع كمشاهد. عد إلى المزايدة أولًا.', 'info');
    return;
  }
  if (auction.status !== 'live') {
    toast('الجولة ليست مفتوحة للمزايدة الآن.', 'error');
    return;
  }
  const idempotencyKey = crypto.randomUUID();
  if (remoteMode) {
    try {
      const response = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ lotId: auction.lotId, incrementBaisa, participantId: viewer.id, nickname: viewer.nickname, expectedVersion: auction.version, idempotencyKey }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.snapshot) {
        if (payload.code === 'STALE_VERSION' && payload.snapshot) auction = { ...auction, ...payload.snapshot };
        throw new Error(payload.message || 'تعذّر قبول العرض');
      }
      auction = { ...auction, ...payload.snapshot, seenKeys: [...auction.seenKeys, idempotencyKey] };
      afterAcceptedBid(Boolean(payload.extended), 'تم تثبيت مزايدتك من الخادم.');
      return;
    } catch (error) {
      remoteMode = false;
      setConnection('تعذّر اتصال الخادم — عدنا إلى معاينة هذا الجهاز', 'local');
      toast(error?.message || 'تعذّر الاتصال. لم نكرر المزايدة تلقائيًا.', 'error');
      return;
    }
  }
  const result = applyBid(auction, { incrementBaisa, nickname: viewer.nickname, idempotencyKey });
  if (!result.ok) {
    const messages = { AUCTION_NOT_LIVE: 'الجولة مغلقة الآن.', PARTICIPANT_WITHDRAWN: 'عد إلى المزايدة أولًا.', INVALID_INCREMENT: 'هذه الزيادة غير متاحة في الجولة.' };
    toast(messages[result.code] || 'لم يُقبل العرض.', 'error');
    return;
  }
  auction = result.state;
  afterAcceptedBid(result.extended, 'تم تثبيت مزايدتك في معاينة هذا الجهاز.');
}

function afterAcceptedBid(extended, message) {
  renderAuction();
  ui.currentPriceCard.classList.remove('flash');
  requestAnimationFrame(() => ui.currentPriceCard.classList.add('flash'));
  if (navigator.vibrate) navigator.vibrate([35, 25, 50]);
  toast(extended ? `${message} مُدّدت الجولة ١٠ ثوانٍ لمنع الخطف.` : message);
}

function openBidConfirmation(incrementBaisa) {
  pendingBidIncrement = incrementBaisa;
  $('#bidConfirmIncrement').textContent = `+${incrementBaisa / 1000} ر.ع.`;
  $('#bidConfirmPrice').textContent = `${formatOMR(auction.currentBaisa + incrementBaisa)} ر.ع.`;
  openModal('bidConfirmModal');
}

function startAuctionClock() {
  if (timerHandle || auction.status !== 'live') return;
  timerStarted = true;
  timerHandle = setInterval(() => {
    if (document.hidden || auction.status !== 'live') return;
    auction = tickAuction(auction, 1);
    renderAuction();
    if (auction.status === 'closing') beginSettlement();
  }, 1000);
}

function beginSettlement() {
  clearInterval(timerHandle);
  timerHandle = null;
  ui.bidButtons.forEach((button) => { button.disabled = true; });
  toast('انتهى الوقت. نثبّت النتيجة الآن…', 'info');
  clearTimeout(closingHandle);
  closingHandle = setTimeout(() => {
    auction = settleAuction(auction);
    renderAuction();
    if (auction.status === 'sold') {
      if (auction.winner === viewer.nickname) announceWinner();
      else toast(`فاز ${auction.winner} بسعر ${formatOMR(auction.currentBaisa)} ر.ع.`, 'info');
    }
  }, 1200);
}

function announceWinner() {
  $('#winnerPrice').textContent = formatOMR(auction.currentBaisa);
  addWinnerMessage();
  openModal('winnerModal');
  $('#notificationDot').hidden = false;
  $('#mobileNotificationDot').hidden = false;
}

function addWinnerMessage() {
  const slot = $('#winnerMessageSlot');
  slot.innerHTML = `<button class="message-item winner-message active" type="button"><span class="message-icon">✦</span><span><b>مبروك — فزت بأوميغا سيماستر</b><small>اختر طريقة الاستلام في رسالة الطلب الخاصة.</small></span><time>الآن</time></button>`;
  $('.winner-message', slot).addEventListener('click', renderWinnerMessageDetail);
}

function renderWinnerMessageDetail() {
  $('#messageDetail').innerHTML = `<div class="winner-message-detail">
    <p class="eyebrow">نتيجة المزاد · رسالة نظام خاصة</p>
    <h2>مبروك، تم تثبيت القطعة لك</h2>
    <p class="lot-description">هذه نتيجة معاينة فقط. في المنتج الحقيقي تُنشأ الرسالة والطلب بعد تثبيت النتيجة في قاعدة البيانات.</p>
    <div class="winner-banner"><div class="watch-photo"></div><span><small>#MSQ-1042</small><b>أوميغا سيماستر — ٢٠٢٢</b><em>السعر النهائي: ${formatOMR(auction.currentBaisa)} ر.ع.</em></span></div>
    <h3>كيف تفضّل الاستلام؟</h3>
    <div class="delivery-options"><button type="button" data-delivery="pickup"><b>استلام من صالة مسقط</b><small>اختر موعدًا وتستلم برمز تحقق</small></button><button type="button" data-delivery="delivery"><b>توصيل إلى موقعك</b><small>أدخل الموقع بعد تأكيد الدفع</small></button></div>
  </div>`;
  $$('.delivery-options button').forEach((button) => button.addEventListener('click', () => toast(button.dataset.delivery === 'pickup' ? 'تم اختيار الاستلام من الصالة في المعاينة.' : 'تم اختيار التوصيل في المعاينة.')));
  $$('.message-item').forEach((item) => item.classList.remove('active'));
  $('.winner-message')?.classList.add('active');
}

function resetAuction() {
  clearInterval(timerHandle);
  clearTimeout(closingHandle);
  timerHandle = null;
  timerStarted = true;
  auction = createAuctionState({ remainingSeconds: 31 });
  renderAuction();
  startAuctionClock();
  toast('بدأت جولة تجريبية جديدة.');
}

function setupHoldButtons() {
  ui.bidButtons.forEach((button) => {
    let progressHandle = null;
    let commitHandle = null;
    let startedAt = 0;
    let committed = false;
    const cancel = () => {
      clearInterval(progressHandle);
      clearTimeout(commitHandle);
      progressHandle = null;
      commitHandle = null;
      button.style.setProperty('--hold', '0%');
      button.classList.remove('holding');
    };
    button.addEventListener('pointerdown', (event) => {
      if (button.disabled || event.button !== 0) return;
      committed = false;
      startedAt = performance.now();
      button.classList.add('holding');
      button.setPointerCapture?.(event.pointerId);
      progressHandle = setInterval(() => {
        const progress = Math.min(100, ((performance.now() - startedAt) / 720) * 100);
        button.style.setProperty('--hold', `${progress}%`);
      }, 30);
      commitHandle = setTimeout(async () => {
        committed = true;
        cancel();
        await commitBid(Number(button.dataset.increment));
      }, 720);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => button.addEventListener(eventName, cancel));
    button.addEventListener('click', async (event) => {
      if (committed) { event.preventDefault(); committed = false; return; }
      if (!button.disabled) {
        const increment = Number(button.dataset.increment);
        openBidConfirmation(increment);
      }
    });
  });
}

function showView(name, options = {}) {
  const panel = $(`[data-view-panel="${name}"]`);
  if (!panel) return;
  $$('[data-view-panel]').forEach((section) => {
    const active = section === panel;
    section.hidden = !active;
    section.classList.toggle('active', active);
  });
  $$('.desktop-nav [data-view], .mobile-nav [data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  if (!options.keepScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  history.replaceState(null, '', `#${name}`);
  if (name === 'live') {
    checkRemoteSnapshot();
    if (!timerStarted) startAuctionClock();
  }
  if (activeModal) closeModal(activeModal.id);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  lastFocused = document.activeElement;
  activeModal = modal;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => $('.modal-close, button, input, select', modal)?.focus());
}

function closeModal(id) {
  const modal = typeof id === 'string' ? document.getElementById(id) : id;
  if (!modal) return;
  if (modal.id === 'cameraStudio') stopCamera();
  modal.hidden = true;
  document.body.style.overflow = '';
  activeModal = null;
  lastFocused?.focus?.();
}

function trapModalFocus(event) {
  if (!activeModal || event.key !== 'Tab') return;
  const focusable = $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])', activeModal).filter((node) => !node.hidden);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function applyCatalogFilters() {
  const query = $('#catalogSearch').value.trim().toLocaleLowerCase('ar');
  const cards = $$('.lot-card');
  const sort = $('#catalogSort').value;
  cards.sort((a, b) => {
    if (sort === 'low') return Number(a.dataset.price) - Number(b.dataset.price);
    if (sort === 'interest') return Number(b.dataset.interest) - Number(a.dataset.interest);
    return 0;
  }).forEach((card) => $('#lotGrid').append(card));
  let visibleCount = 0;
  cards.forEach((card) => {
    const categoryMatch = activeCategory === 'all' || card.dataset.category === activeCategory;
    const queryMatch = !query || card.dataset.title.toLocaleLowerCase('ar').includes(query);
    card.hidden = !(categoryMatch && queryMatch);
    if (!card.hidden) visibleCount += 1;
  });
  $('#catalogEmpty').hidden = visibleCount !== 0;
  $('#lotGrid').hidden = visibleCount === 0;
}

async function startCamera() {
  const video = $('#cameraVideo');
  const placeholder = $('#cameraPlaceholder');
  try {
    stopCamera(false);
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = cameraStream;
    video.src = '';
    await video.play();
    placeholder.hidden = true;
    $('#goLiveButton').disabled = false;
    $('#startCameraButton').textContent = 'إعادة تشغيل الكاميرا';
    toast('الكاميرا تعمل محليًا. لا تُرسل الصورة خارج جهازك.');
  } catch {
    placeholder.hidden = false;
    $('#goLiveButton').disabled = true;
    toast('لم نتمكن من فتح الكاميرا. تحقق من الإذن أو اختر فيديو تجريبيًا.', 'error');
  }
}

function stopCamera(resetVideo = true) {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  const video = $('#cameraVideo');
  if (resetVideo && video) {
    video.pause();
    video.srcObject = null;
    if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
    uploadedVideoUrl = null;
    video.removeAttribute('src');
    video.load();
    $('#cameraPlaceholder').hidden = false;
    $('#goLiveButton').disabled = true;
  }
}

function wireEvents() {
  $$('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
  $$('[data-category-link]').forEach((button) => button.addEventListener('click', () => {
    activeCategory = button.dataset.categoryLink || 'all';
    $$('.category-scroller button').forEach((item) => item.classList.toggle('active', item.dataset.category === activeCategory));
    showView('lots');
    applyCatalogFilters();
  }));
  $$('[data-open-modal]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.openModal)));
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.closest('.modal'))));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeModal && activeModal.id !== 'winnerModal') closeModal(activeModal);
    trapModalFocus(event);
  });
  window.addEventListener('online', updateConnectivity);
  window.addEventListener('offline', updateConnectivity);
  $('#leaveAuctionButton').addEventListener('click', () => {
    auction = auction.withdrawn ? resumeParticipant(auction) : withdrawParticipant(auction);
    renderAuction();
    toast(auction.withdrawn ? 'ستبقى متابعًا، ولن تُلغى عروضك المقبولة.' : 'عدت إلى المزايدة.');
  });
  $('#resetAuctionButton').addEventListener('click', resetAuction);
  $('#favoriteButton').addEventListener('click', (event) => {
    const pressed = event.currentTarget.getAttribute('aria-pressed') === 'true';
    event.currentTarget.setAttribute('aria-pressed', String(!pressed));
    event.currentTarget.textContent = pressed ? '♡' : '♥';
    toast(pressed ? 'أزلنا القطعة من المحفوظات.' : 'حفظنا القطعة على هذا الجهاز.');
  });
  $$('.category-scroller button').forEach((button) => button.addEventListener('click', () => {
    activeCategory = button.dataset.category;
    $$('.category-scroller button').forEach((item) => item.classList.toggle('active', item === button));
    applyCatalogFilters();
  }));
  $('#catalogSearch').addEventListener('input', applyCatalogFilters);
  $('#catalogSort').addEventListener('change', applyCatalogFilters);
  $('#clearCatalogFilters').addEventListener('click', () => {
    activeCategory = 'all';
    $('#catalogSearch').value = '';
    $$('.category-scroller button').forEach((item) => item.classList.toggle('active', item.dataset.category === 'all'));
    applyCatalogFilters();
  });
  $('#profileForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const nickname = $('#nicknameInput').value.trim();
    if (nickname.length < 3) { $('#profileStatus').textContent = 'اختر اسمًا ظاهرًا من ٣ أحرف على الأقل.'; return; }
    viewer.nickname = nickname;
    storage.set('mazqat-demo-nickname', nickname);
    $('#headerNickname').textContent = nickname;
    $('#profileNicknamePreview').textContent = nickname;
    $('#profileStatus').textContent = 'حُفظت تفضيلات المعاينة على هذا الجهاز.';
    toast('حفظنا تفضيلات حساب المعاينة.');
    renderAuction();
  });
  $('#welcomeMessage').addEventListener('click', () => {
    $$('.message-item').forEach((item) => item.classList.remove('active'));
    $('#welcomeMessage').classList.add('active');
    $('#messageDetail').innerHTML = '<div class="empty-message"><span>م</span><h2>أهلًا بك في مزاد مسقط</h2><p>أكمل الهاتف والاسم الظاهر ومنطقة الاستلام قبل أول مزايدة حقيقية. في هذه المعاينة لا نرسل رمزًا ولا نجمع بيانات.</p><button type="button" id="goAccountFromMessage">راجع حسابك</button></div>';
    $('#goAccountFromMessage').addEventListener('click', () => showView('account'));
  });
  $('#openWinnerMessage').addEventListener('click', () => { closeModal('winnerModal'); showView('orders'); renderWinnerMessageDetail(); });
  $('#dismissWinner').addEventListener('click', () => closeModal('winnerModal'));
  $('#confirmBidButton').addEventListener('click', async () => {
    const increment = pendingBidIncrement;
    pendingBidIncrement = null;
    closeModal('bidConfirmModal');
    if (increment) await commitBid(increment);
  });
  $('#startCameraButton').addEventListener('click', startCamera);
  $('#videoUpload').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    stopCamera(false);
    const video = $('#cameraVideo');
    uploadedVideoUrl = URL.createObjectURL(file);
    video.srcObject = null;
    video.src = uploadedVideoUrl;
    video.loop = true;
    video.play().then(() => {
      $('#cameraPlaceholder').hidden = true;
      $('#goLiveButton').disabled = false;
      toast('الفيديو جاهز للمعاينة المحلية.');
    }).catch(() => toast('تعذّر تشغيل هذا الملف.', 'error'));
  });
  $$('.filter-pills button').forEach((button) => button.addEventListener('click', () => {
    $$('.filter-pills button').forEach((item) => item.classList.toggle('active', item === button));
    $('#cameraVideo').style.filter = button.dataset.filter;
    $('#cameraFilterLabel').textContent = button.dataset.label;
  }));
  $('#goLiveButton').addEventListener('click', () => toast('البث التجريبي جاهز. في الإنتاج نطلب توثيق المضيف قبل النشر.'));
  $('#createAuctionForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const increments = new FormData(event.currentTarget).getAll('increments');
    if (!increments.length) { $('#createStatus').textContent = 'اختر زيادة واحدة على الأقل.'; return; }
    $('#createStatus').textContent = 'حُفظت المسودة التجريبية. لم يتم نشر أي مزاد.';
    toast('حفظنا مسودة المزاد داخل المعاينة.');
  });
  $('#savePermissions').addEventListener('click', () => { toast('حُفظت صلاحيات المعاينة على هذا الجهاز.'); closeModal('teamModal'); });
}

function boot() {
  $('#headerNickname').textContent = viewer.nickname;
  $('#profileNicknamePreview').textContent = viewer.nickname;
  $('#nicknameInput').value = viewer.nickname;
  $('#notificationDot').hidden = true;
  $('#mobileNotificationDot').hidden = true;
  renderAuction();
  setupHoldButtons();
  wireEvents();
  applyCatalogFilters();
  updateConnectivity();
  const requestedView = location.hash.replace('#', '');
  showView($(`[data-view-panel="${requestedView}"]`) ? requestedView : 'discover', { keepScroll: true });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
}

boot();
