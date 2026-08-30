import {
  applyBid,
  closeAuction,
  createAuctionState,
  extendAuction,
  formatOMR,
  pauseAuction,
  resumeParticipant,
  resumeAuction,
  setAllowedIncrements,
  settleAuction,
  tickAuction,
  withdrawParticipant,
} from './auction-engine.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const session = {
  get(key, fallback = null) {
    try { return sessionStorage.getItem(key) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { sessionStorage.setItem(key, value); } catch { /* Session convenience is optional. */ }
  },
  remove(key) {
    try { sessionStorage.removeItem(key); } catch { /* Session convenience is optional. */ }
  },
};

const roleMeta = {
  bidder: {
    label: 'حساب مزايد',
    profile: 'حمد',
    fullName: 'حمد المسقطي',
    avatar: 'ح',
    icon: '👆',
    start: 'bidder-home',
    profileCopy: 'مزايد · مستوى التحقق مكتمل',
    nav: [
      { screen: 'bidder-home', label: 'لك', icon: '⌂' },
      { screen: 'explore', label: 'المعروضات', icon: '▦' },
      { screen: 'live', label: 'مباشر', icon: '●', prominent: true },
      { screen: 'wins', label: 'فوزي', icon: '◇' },
      { screen: 'profile', label: 'حسابي', icon: '○' },
    ],
  },
  partner: {
    label: 'دار الوقت · منظّم',
    profile: 'عبدالله',
    fullName: 'عبدالله · دار الوقت',
    avatar: 'ع',
    icon: '🎥',
    start: 'partner-home',
    profileCopy: 'مالك مساحة · خطة استوديو نشطة',
    nav: [
      { screen: 'partner-home', label: 'اليوم', icon: '⌂' },
      { screen: 'partner-auctions', label: 'مزاداتي', icon: '▣' },
      { screen: 'partner-control', label: 'غرفة التحكم', icon: '●', prominent: true },
      { screen: 'partner-catalog', label: 'المخزون', icon: '▦' },
      { screen: 'partner-team', label: 'مساحتي', icon: '◎' },
    ],
  },
  owner: {
    label: 'مالك منصة MAZQAT',
    profile: 'عبدالله',
    fullName: 'عبدالله · مالك المنصة',
    avatar: 'م',
    icon: '◆',
    start: 'owner-home',
    profileCopy: 'مالك المنصة · وصول خاص ومدقّق',
    nav: [
      { screen: 'owner-home', label: 'نظرة عامة', icon: '⌂' },
      { screen: 'owner-partners', label: 'المنظّمون', icon: '◫' },
      { screen: 'owner-plans', label: 'الخطط', icon: '▣' },
      { screen: 'owner-audit', label: 'التدقيق', icon: '◉' },
      { screen: 'profile', label: 'الحساب', icon: '○' },
    ],
  },
};

const products = [
  { id: 'watch-001', category: 'watches', title: 'أوميغا سيماستر — ٢٠٢٢', organizer: 'دار الوقت', price: 860, interest: 128, date: 'مباشر الآن', status: 'live', image: './og.png' },
  { id: 'car-001', category: 'cars', title: 'بورشه 911 كاريرا — ٢٠١٨', organizer: 'سيارات مسقط', price: 12400, interest: 164, date: 'السبت · ٦:٠٠', status: 'soon', image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=84' },
  { id: 'jewel-001', category: 'jewelry', title: 'سوار ذهب عيار ٢١', organizer: 'بيت الجوهرة', price: 195, interest: 92, date: 'غدًا · ٩:٠٠', status: 'soon', image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=84' },
  { id: 'camera-001', category: 'electronics', title: 'كاميرا لايكا M6 كلاسيكية', organizer: 'عدسة', price: 720, interest: 84, date: 'اليوم · ٨:٣٠', status: 'soon', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=84' },
  { id: 'laptop-001', category: 'electronics', title: 'ماك بوك برو M3 — شبه جديد', organizer: 'تقنية عُمان', price: 610, interest: 69, date: 'الأحد · ٧:٣٠', status: 'verified', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=84' },
  { id: 'antique-001', category: 'antiques', title: 'خنجر عُماني فضة — موثّق', organizer: 'تراث عُمان', price: 420, interest: 58, date: 'الاثنين · ٨:٠٠', status: 'verified', image: '' },
];

const partnerLots = [
  { title: 'أوميغا سيماستر ٢٠٢٢', state: 'جاهزة · موثّقة', warning: false, image: products[0].image },
  { title: 'كاميرا لايكا M6', state: 'جاهزة · ٦ صور', warning: false, image: products[3].image },
  { title: 'سوار ذهب عيار ٢١', state: 'يحتاج تقرير الوزن', warning: true, image: products[2].image },
  { title: 'بورشه 911 كاريرا', state: 'يحتاج صور العيوب', warning: true, image: products[1].image },
  { title: 'ماك بوك برو M3', state: 'جاهزة · فحص البطارية', warning: false, image: products[4].image },
  { title: 'خنجر فضة عُماني', state: 'بانتظار الاعتماد', warning: true, image: '' },
];

const studioLots = [
  { id: 'watch-001', code: 'MSQ-1042', title: 'أوميغا سيماستر — ٢٠٢٢', openingBaisa: 820000, image: products[0].image, state: 'live' },
  { id: 'camera-001', code: 'MSQ-1043', title: 'كاميرا لايكا M6 كلاسيكية', openingBaisa: 720000, image: products[3].image, state: 'ready' },
  { id: 'jewel-001', code: 'MSQ-1044', title: 'سوار ذهب عيار ٢١', openingBaisa: 195000, image: products[2].image, state: 'ready' },
  { id: 'antique-001', code: 'MSQ-1045', title: 'خنجر عُماني فضة — موثّق', openingBaisa: 420000, image: '', state: 'review' },
];

let activeRole = null;
let activeCategory = 'all';
let auction = createAuctionState();
let timerHandle = null;
let settleHandle = null;
let toastHandle = null;
let pendingBid = null;
let cameraStream = null;
let planRequest = 10;
let networkOnline = navigator.onLine;
let studioLotIndex = 0;
let studioTab = 'live';
let ownerPartnerSuspended = false;
const favoriteIds = new Set();
const studioActivity = [
  { title: 'عرض جديد من نورس_٧', detail: '٨٦٠٫٠٠٠ ر.ع. · ثُبّت في سجل الجولة', tone: 'mint' },
  { title: 'دخل ١٢ مزايدًا', detail: '٢٤ مزايدًا مؤهلًا الآن', tone: 'blue' },
  { title: 'اجتاز البث فحص الجودة', detail: 'الصورة والصوت والاتصال مستقرّة', tone: 'gold' },
];

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function formatRials(value) {
  return new Intl.NumberFormat('ar-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value);
}

function secondsLabel(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`;
}

function toast(message, kind = 'success') {
  clearTimeout(toastHandle);
  const root = $('#toast');
  $('#toastIcon').textContent = kind === 'error' ? '!' : kind === 'info' ? 'i' : '✓';
  $('#toastText').textContent = message;
  root.classList.toggle('error', kind === 'error');
  root.hidden = false;
  toastHandle = setTimeout(() => { root.hidden = true; }, 3600);
}

function closeOpenDialogs() {
  $$('dialog[open]').forEach((dialog) => dialog.close());
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog || typeof dialog.showModal !== 'function') return;
  closeOpenDialogs();
  dialog.showModal();
  requestAnimationFrame(() => $('input,select,button:not(.dialog-close)', dialog)?.focus());
}

function openGateway() {
  closeOpenDialogs();
  stopAuctionClock();
  activeRole = null;
  session.remove('mazqat-v2-role');
  $('#appShell').hidden = true;
  $('#entryGateway').hidden = false;
  document.body.className = '';
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function enterRole(role) {
  if (!roleMeta[role]) return;
  activeRole = role;
  session.set('mazqat-v2-role', role);
  $('#entryGateway').hidden = true;
  $('#appShell').hidden = false;
  document.body.className = `in-app role-${role}`;
  $('#contextIcon').textContent = roleMeta[role].icon;
  $('#contextLabel').textContent = roleMeta[role].label;
  $('#profileShortLabel').textContent = roleMeta[role].profile;
  $('#profileTitle').textContent = roleMeta[role].fullName;
  $('.profile-avatar').textContent = roleMeta[role].avatar;
  $('#profileRoleLabel').textContent = roleMeta[role].profileCopy;
  renderNavigation();
  showScreen(roleMeta[role].start);
  closeOpenDialogs();
}

function renderNavigation() {
  const items = roleMeta[activeRole]?.nav ?? [];
  ['desktopNav', 'mobileNav'].forEach((targetId) => {
    const root = document.getElementById(targetId);
    root.replaceChildren(...items.map((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `nav-button${item.prominent ? ' live-nav' : ''}`;
      if (item.screen) button.dataset.navTarget = item.screen;
      if (item.dialog) button.dataset.openDialog = item.dialog;
      const icon = document.createElement('i');
      icon.className = 'nav-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = item.icon;
      const label = document.createElement('span');
      label.textContent = item.label;
      button.append(icon, label);
      return button;
    }));
  });
}

function showScreen(screen) {
  const target = $(`[data-screen="${screen}"]`);
  if (!target) return;
  $$('.app-screen').forEach((panel) => { panel.hidden = panel !== target; });
  $$('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.navTarget === screen));
  document.body.classList.toggle('screen-live', screen === 'live');
  history.replaceState(null, '', `#${screen}`);
  closeOpenDialogs();
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (screen === 'live' || screen === 'partner-control') startAuctionClock();
  else stopAuctionClock(false);
}

function productCard(product) {
  const image = product.image
    ? `<img src="${product.image}" alt="${escapeHtml(product.title)}" loading="lazy">`
    : '<div class="antique-story" style="width:100%;height:100%;background-position:center;background-size:cover" role="img" aria-label="خنجر عُماني فضة"></div>';
  const status = product.status === 'live' ? 'مباشر' : product.status === 'verified' ? 'موثّقة' : product.date;
  return `<article class="product-card" data-product-id="${product.id}" data-category="${product.category}" data-title="${escapeHtml(product.title)}" data-interest="${product.interest}" data-price="${product.price}">
    <div class="product-media">${image}<span class="product-status ${product.status === 'live' ? 'live' : ''}">${status}</span><button class="product-favorite ${favoriteIds.has(product.id) ? 'is-favorite' : ''}" type="button" data-favorite-id="${product.id}" aria-label="حفظ ${escapeHtml(product.title)}">${favoriteIds.has(product.id) ? '♥' : '♡'}</button></div>
    <div class="product-body"><small>${escapeHtml(product.organizer)} · منظّم معتمد</small><h3>${escapeHtml(product.title)}</h3><div class="product-meta"><span><small>${product.status === 'live' ? 'السعر الحالي' : 'سعر البداية'}</small><b>${formatRials(product.price)} ر.ع.</b></span><span><small>الاهتمام</small><b>👁 ${product.interest}</b></span></div><button class="product-open" type="button" data-product-open="${product.id}">${product.status === 'live' ? 'ادخل المزاد' : 'عرض القطعة'} <span aria-hidden="true">←</span></button></div>
  </article>`;
}

function renderProducts() {
  $('#homeProductRow').innerHTML = products.slice(1, 5).map((product) => productCard(product)).join('');
  renderCatalog();
  $('#partnerCatalogGrid').innerHTML = partnerLots.map((lot, index) => `<article class="partner-lot-card"><div class="product-media">${lot.image ? `<img src="${lot.image}" alt="${escapeHtml(lot.title)}" loading="lazy">` : '<div class="antique-story" style="width:100%;height:100%;background-size:cover" role="img" aria-label="خنجر عُماني"></div>'}<span class="product-status ${lot.warning ? '' : 'ready'}">${lot.warning ? 'تحتاج مراجعة' : 'جاهزة'}</span></div><div class="partner-lot-copy"><small>#MZ-${String(421 + index).padStart(3, '0')}</small><b>${escapeHtml(lot.title)}</b><em class="${lot.warning ? 'warning' : ''}">${lot.warning ? '!' : '✓'} ${escapeHtml(lot.state)}</em></div></article>`).join('');
}

function openProduct(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  if (product.status === 'live') return showScreen('live');
  const dialog = $('#lotDialog');
  $('#lotDialogTitle').textContent = product.title;
  const photo = $('.detail-photo img', dialog);
  if (product.image) {
    photo.src = product.image;
    photo.alt = `تفاصيل ${product.title}`;
    photo.hidden = false;
  } else {
    photo.hidden = true;
  }
  $('.detail-dialog .dialog-note').textContent = `معاينة تجريبية لقطعة من ${product.organizer}. تقرير الحالة والصور والتحقق النهائي مسؤولية المنظّم قبل فتح المزايدة.`;
  openDialog('lotDialog');
}

function renderCatalog() {
  const query = ($('#catalogSearch')?.value || '').trim().toLowerCase();
  const sort = $('#catalogSort')?.value || 'soon';
  let visible = products.filter((product) => (activeCategory === 'all' || product.category === activeCategory) && (!query || `${product.title} ${product.organizer}`.toLowerCase().includes(query)));
  visible = [...visible].sort((a, b) => {
    if (sort === 'interest') return b.interest - a.interest;
    if (sort === 'price-low') return a.price - b.price;
    return a.status === 'live' ? -1 : b.status === 'live' ? 1 : 0;
  });
  $('#catalogGrid').innerHTML = visible.map((product) => productCard(product)).join('');
  $('#catalogCount').textContent = new Intl.NumberFormat('ar-OM').format(visible.length);
  $('#catalogEmpty').hidden = visible.length > 0;
  $('#catalogGrid').hidden = visible.length === 0;
}

function renderSeatBlocks() {
  $('#seatBlocks').replaceChildren(...Array.from({ length: 10 }, (_, index) => {
    const block = document.createElement('i');
    if (index < 6) block.className = 'used';
    else if (index < 8) block.className = 'pending';
    block.title = index < 6 ? 'مقعد مستخدم' : index < 8 ? 'دعوة معلّقة' : 'مقعد متاح';
    return block;
  }));
}

function addStudioActivity(title, detail, tone = 'mint') {
  studioActivity.unshift({ title, detail, tone });
  studioActivity.splice(8);
  renderStudioActivity();
}

function renderStudioActivity() {
  const root = $('#studioActivity');
  if (!root) return;
  root.innerHTML = studioActivity.map((item) => `<article><i class="${item.tone}"></i><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.detail)}</small></span><time>الآن</time></article>`).join('');
}

function renderStudio() {
  const root = $('[data-screen="partner-control"]');
  if (!root) return;
  const lot = studioLots[studioLotIndex];
  const statusCopy = {
    live: ['مباشر · المزايدة مفتوحة', 'live'],
    paused: ['المزايدة متوقفة مؤقتًا', 'paused'],
    closing: ['جارٍ تثبيت النتيجة', 'closing'],
    sold: ['تم بيع القطعة', 'sold'],
    unsold: ['أُغلقت دون بيع', 'unsold'],
  }[auction.status] || ['قيد التجهيز', 'paused'];

  $('#studioStatusText').textContent = statusCopy[0];
  $('#studioStatus').className = `studio-status ${statusCopy[1]}`;
  $('#studioLotTitle').textContent = lot.title;
  $('#studioLotCode').textContent = `#${lot.code} · القطعة ${studioLotIndex + 1} من ${studioLots.length}`;
  $('#studioPrice').textContent = `${formatOMR(auction.currentBaisa)} ر.ع.`;
  $('#studioTimer').textContent = secondsLabel(auction.remainingSeconds);
  $('#studioLeader').textContent = auction.leader || 'لا يوجد بعد';
  $('#studioBidCount').textContent = new Intl.NumberFormat('ar-OM').format(auction.bids.length);
  $('#studioViewerCount').textContent = auction.status === 'live' ? '١٢٨' : '١١٩';
  const image = $('#studioLotImage');
  if (lot.image) {
    image.src = lot.image;
    image.alt = `معاينة ${lot.title}`;
    image.hidden = false;
    $('#studioAntiqueFallback').hidden = true;
  } else {
    image.hidden = true;
    $('#studioAntiqueFallback').hidden = false;
  }

  const startPause = $('#studioStartPauseButton');
  startPause.textContent = auction.status === 'live' ? 'إيقاف المزايدة مؤقتًا' : auction.status === 'paused' ? 'استئناف المزايدة' : auction.status === 'sold' || auction.status === 'unsold' ? 'الجولة مغلقة' : 'جارٍ التثبيت…';
  startPause.disabled = !['live', 'paused'].includes(auction.status);
  $('#studioExtendButton').disabled = !['live', 'paused'].includes(auction.status);
  $('#studioCloseButton').disabled = !['live', 'paused'].includes(auction.status);
  $('#studioNextLotButton').disabled = studioLotIndex >= studioLots.length - 1 || !['sold', 'unsold'].includes(auction.status);

  $$('[data-studio-increment]').forEach((input) => { input.checked = auction.allowedIncrements.includes(Number(input.value)); });
  $$('.bid-choice').forEach((button) => { button.hidden = !auction.allowedIncrements.includes(Number(button.dataset.bid)); });
  $('.bid-choice-grid').style.gridTemplateColumns = `repeat(${auction.allowedIncrements.length}, minmax(0, 1fr))`;

  $('#studioQueue').innerHTML = studioLots.map((item, index) => {
    const state = index < studioLotIndex ? 'تمت' : index === studioLotIndex ? 'الحالية' : item.state === 'review' ? 'مراجعة' : 'جاهزة';
    return `<button class="studio-queue-item ${index === studioLotIndex ? 'active' : ''} ${item.state === 'review' ? 'warning' : ''}" type="button" data-studio-lot="${index}" ${index > studioLotIndex + 1 ? 'disabled' : ''}><span>${String(index + 1).padStart(2, '0')}</span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.code)} · ${state}</small></span><em>${index === studioLotIndex ? 'على الهواء' : index < studioLotIndex ? 'مباعة' : item.state === 'review' ? '!' : '←'}</em></button>`;
  }).join('');

  const leaders = [];
  const seen = new Set();
  auction.bids.forEach((bid) => {
    if (!seen.has(bid.nickname) && leaders.length < 5) { seen.add(bid.nickname); leaders.push(bid); }
  });
  $('#studioLeaderboard').innerHTML = leaders.map((bid, index) => `<li><i>${index + 1}</i><span><b>${escapeHtml(bid.nickname)}</b><small>${bid.at}</small></span><strong>${formatOMR(bid.amountBaisa)} ر.ع.</strong></li>`).join('') || '<li class="empty">لا توجد عروض بعد</li>';

  $$('[data-studio-tab]').forEach((button) => {
    const active = button.dataset.studioTab === studioTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  $$('[data-studio-panel]').forEach((panel) => { panel.hidden = panel.dataset.studioPanel !== studioTab; });
  renderStudioActivity();
}

function renderAuction() {
  $$('[data-current-price]').forEach((node) => { node.textContent = formatOMR(auction.currentBaisa); });
  $$('[data-leader]').forEach((node) => { node.textContent = auction.leader || 'لا يوجد'; });
  $$('[data-timer]').forEach((node) => {
    node.textContent = auction.status === 'sold' ? 'تم البيع' : auction.status === 'unsold' ? 'لم تُبع' : auction.status === 'closing' ? 'تثبيت…' : auction.status === 'paused' ? 'متوقف' : secondsLabel(auction.remainingSeconds);
  });
  $$('[data-result-price]').forEach((node) => { node.textContent = formatOMR(auction.currentBaisa + Number(node.dataset.resultPrice)); });
  const viewerLeads = auction.leader === 'حمد_مسقط';
  $('#leaderStatus').innerHTML = viewerLeads ? '<b>أنت المتصدر الآن</b>' : `المتصدر الآن <b>${escapeHtml(auction.leader || 'لا يوجد')}</b>`;
  $('#currentPriceCard').classList.toggle('viewer-leading', viewerLeads);
  $('#timerCard').classList.toggle('urgent', auction.status === 'live' && auction.remainingSeconds <= 10);
  const disabled = !networkOnline || auction.status !== 'live' || auction.withdrawn;
  $$('.bid-choice').forEach((button) => { button.disabled = disabled; });
  $('#leaveAuctionButton').textContent = auction.withdrawn ? 'العودة إلى المزايدة' : 'متابعة كمشاهد';
  $('#leaveAuctionButton').setAttribute('aria-pressed', String(auction.withdrawn));
  const leaders = [];
  const seen = new Set();
  auction.bids.forEach((bid) => {
    if (!seen.has(bid.nickname) && leaders.length < 3) { seen.add(bid.nickname); leaders.push(bid); }
  });
  $('#leaderboardList').innerHTML = leaders.map((bid, index) => `<li class="${bid.nickname === 'حمد_مسقط' ? 'me' : ''}"><i>${index + 1}</i><b>${escapeHtml(bid.nickname)}</b><span>${formatOMR(bid.amountBaisa)} ر.ع.</span></li>`).join('');
  const rank = leaders.findIndex((bid) => bid.nickname === 'حمد_مسقط');
  $('#yourRank').textContent = rank >= 0 ? `ترتيبك: ${rank + 1}` : 'ترتيبك: —';
  renderStudio();
}

function settleCurrentAuction(delay = 650) {
  clearTimeout(settleHandle);
  settleHandle = setTimeout(() => {
    auction = settleAuction(auction);
    renderAuction();
    addStudioActivity(auction.winner ? 'ثُبّتت نتيجة الجولة' : 'أُغلقت الجولة دون بيع', auction.winner ? `${auction.winner} · ${formatOMR(auction.currentBaisa)} ر.ع.` : 'لا يوجد عرض فائز', 'gold');
    if (activeRole === 'bidder' && auction.winner === 'حمد_مسقط') openDialog('winnerDialog');
    else toast(auction.winner ? `انتهت الجولة لصالح ${auction.winner}.` : 'انتهت الجولة دون فائز.', 'info');
  }, delay);
}

function startAuctionClock() {
  if (timerHandle || auction.status !== 'live') return;
  timerHandle = setInterval(() => {
    auction = tickAuction(auction);
    renderAuction();
    if (auction.status === 'closing') {
      stopAuctionClock(false);
      settleCurrentAuction(950);
    }
  }, 1000);
}

function stopAuctionClock(clearSettlement = true) {
  clearInterval(timerHandle);
  timerHandle = null;
  if (clearSettlement) { clearTimeout(settleHandle); settleHandle = null; }
}

function openBidConfirmation(incrementBaisa) {
  if (!networkOnline) return toast('الاتصال منقطع؛ لم نرسل أي عرض.', 'error');
  if (auction.withdrawn) return toast('أنت تتابع كمشاهد. عد إلى المزايدة أولًا.', 'info');
  if (auction.status !== 'live') return toast('الجولة ليست مفتوحة الآن.', 'error');
  pendingBid = incrementBaisa;
  $('#confirmIncrement').textContent = `+${incrementBaisa / 1000} ر.ع.`;
  $('#confirmPrice').textContent = `${formatOMR(auction.currentBaisa + incrementBaisa)} ر.ع.`;
  openDialog('bidDialog');
}

function confirmBid() {
  if (!pendingBid) return;
  const result = applyBid(auction, { incrementBaisa: pendingBid, nickname: 'حمد_مسقط', idempotencyKey: crypto.randomUUID() });
  if (!result.ok) {
    toast('لم يُقبل العرض. راجع حالة الجولة.', 'error');
    return;
  }
  auction = result.state;
  pendingBid = null;
  $('#bidDialog').close();
  renderAuction();
  addStudioActivity('عرض جديد من حمد_مسقط', `${formatOMR(auction.currentBaisa)} ر.ع. · إصدار الجولة ${auction.version}`, 'mint');
  $('#currentPriceCard').classList.remove('flash');
  requestAnimationFrame(() => $('#currentPriceCard').classList.add('flash'));
  if (navigator.vibrate) navigator.vibrate([30, 25, 55]);
  toast(result.extended ? 'تم العرض، ومُدّدت الجولة ١٠ ثوانٍ لمنع الخطف.' : 'تم تثبيت عرضك في معاينة هذا الجهاز.');
}

function updateConnectivity() {
  networkOnline = navigator.onLine;
  const notice = $('#connectionNotice');
  notice.dataset.state = networkOnline ? 'local' : 'offline';
  $('span', notice).textContent = networkOnline ? 'معاينة هذا الجهاز · العروض ليست بيعًا حقيقيًا' : 'الاتصال منقطع · المزايدة متوقفة ولن تُرسل لاحقًا';
  renderAuction();
}

function addAuditEvent(title, detail) {
  const article = document.createElement('article');
  const dot = document.createElement('i');
  dot.className = 'mint-dot';
  const copy = document.createElement('span');
  const heading = document.createElement('b');
  heading.textContent = title;
  const small = document.createElement('small');
  small.textContent = detail;
  copy.append(heading, small);
  const time = document.createElement('time');
  time.textContent = 'الآن';
  article.append(dot, copy, time);
  $('#auditTimeline').prepend(article);
}

function handleApproval(button, accepted) {
  const id = button.dataset.approvePartner || button.dataset.rejectPartner;
  const row = $(`[data-approval="${id}"]`);
  if (!row || row.classList.contains('resolved')) return;
  row.classList.add('resolved');
  $$('button', row).forEach((action) => { action.hidden = true; });
  const count = Math.max(0, Number($('#ownerDecisionCount').textContent) - 1);
  $('#ownerDecisionCount').textContent = new Intl.NumberFormat('ar-OM').format(count);
  const name = $('b', row)?.textContent || 'المنظّم';
  addAuditEvent(accepted ? 'تم اعتماد منظّم' : 'تم رفض طلب منظّم', `${name} · قرار تجريبي بواسطة مالك المنصة`);
  toast(accepted ? `تم اعتماد ${name} في هذه المعاينة.` : `تم رفض طلب ${name} في هذه المعاينة.`, accepted ? 'success' : 'info');
}

function toggleStudioAuction() {
  if (auction.status === 'live') {
    auction = pauseAuction(auction);
    stopAuctionClock(false);
    addStudioActivity('أوقف المضيف المزايدة مؤقتًا', 'السعر والعروض المقبولة بقيت محفوظة', 'coral');
    toast('توقفت المزايدة للجميع، وبقيت العروض المقبولة محفوظة.', 'info');
  } else if (auction.status === 'paused') {
    auction = resumeAuction(auction);
    addStudioActivity('استؤنفت المزايدة', `${secondsLabel(auction.remainingSeconds)} متبقية`, 'mint');
    startAuctionClock();
    toast('عادت المزايدة للناس الآن.');
  }
  renderAuction();
}

function extendStudioAuction() {
  if (!['live', 'paused'].includes(auction.status)) return;
  auction = extendAuction(auction, 30);
  addStudioActivity('أضاف المضيف ٣٠ ثانية', `الوقت الجديد ${secondsLabel(auction.remainingSeconds)}`, 'blue');
  renderAuction();
  toast('أُضيفت ٣٠ ثانية وظهر الوقت الجديد للمزايدين.');
}

function closeStudioAuction() {
  if (!['live', 'paused'].includes(auction.status)) return;
  auction = closeAuction(auction);
  stopAuctionClock(false);
  addStudioActivity('طلب المضيف إغلاق الجولة', 'جارٍ تثبيت أعلى عرض عبر مسار واحد', 'gold');
  renderAuction();
  settleCurrentAuction();
}

function chooseStudioLot(index) {
  if (!Number.isInteger(index) || index < 0 || index >= studioLots.length || index > studioLotIndex + 1) return;
  if (index === studioLotIndex) return;
  if (!['sold', 'unsold'].includes(auction.status)) return toast('أغلق الجولة الحالية أولًا قبل الانتقال للقطعة التالية.', 'error');
  studioLotIndex = index;
  const lot = studioLots[index];
  auction = createAuctionState({
    lotId: lot.id,
    currentBaisa: lot.openingBaisa,
    leader: null,
    remainingSeconds: 45,
    status: 'paused',
    bids: [],
    seenKeys: [],
    version: auction.version + 1,
  });
  $('#liveTitle').textContent = lot.title;
  $('.stage-lot-card b').textContent = lot.title;
  const publicImage = $('#liveStageImage');
  if (lot.image) publicImage.src = lot.image;
  addStudioActivity('جُهزت القطعة التالية', `${lot.code} · تنتظر فتح المزايدة`, 'blue');
  renderAuction();
  toast('القطعة التالية جاهزة. راجع السعر ثم افتح المزايدة.', 'info');
}

function toggleOwnerPartnerStatus() {
  ownerPartnerSuspended = !ownerPartnerSuspended;
  $('#ownerPartnerStatus').textContent = ownerPartnerSuspended ? 'معلّق' : 'نشط';
  $('#ownerPartnerStatus').className = `status-chip ${ownerPartnerSuspended ? 'warning' : 'success'}`;
  const button = $('[data-owner-account-action="suspend"]');
  button.textContent = ownerPartnerSuspended ? 'إعادة تفعيل الحساب' : 'تعليق الحساب';
  addAuditEvent(ownerPartnerSuspended ? 'تم تعليق حساب منظّم' : 'أُعيد تفعيل حساب منظّم', `دار الوقت للمزادات · قرار تجريبي بواسطة مالك المنصة`);
  toast(ownerPartnerSuspended ? 'عُلّق الحساب في هذه المعاينة، ولن يفتح غرفًا جديدة.' : 'أُعيد تفعيل الحساب في هذه المعاينة.', 'info');
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) return toast('الكاميرا غير متاحة في هذا المتصفح.', 'error');
  try {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
      $$('[data-camera-video]').forEach((video) => { video.srcObject = null; });
      $$('[data-camera-placeholder]').forEach((placeholder) => { placeholder.hidden = false; });
      $$('[data-camera-toggle]').forEach((button) => { button.textContent = 'تشغيل الكاميرا'; });
      return;
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    $$('[data-camera-video]').forEach((video) => { video.srcObject = cameraStream; });
    $$('[data-camera-placeholder]').forEach((placeholder) => { placeholder.hidden = true; });
    $$('[data-camera-toggle]').forEach((button) => { button.textContent = 'إيقاف الكاميرا'; });
    addStudioActivity('شغّل المضيف معاينة الكاميرا', 'المعاينة على هذا الجهاز فقط', 'mint');
    toast('الكاميرا تعمل للمعاينة على جهازك فقط.');
  } catch {
    toast('لم يسمح المتصفح بالكاميرا. يمكنك متابعة بقية الاستوديو.', 'error');
  }
}

function stopCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  $$('[data-camera-video]').forEach((video) => { video.srcObject = null; });
  $$('[data-camera-placeholder]').forEach((placeholder) => { placeholder.hidden = false; });
  $$('[data-camera-toggle]').forEach((button) => { button.textContent = 'تشغيل الكاميرا'; });
}

function wireEvents() {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('button,[data-nav-target],[data-favorite]');
    if (!target) return;

    if (target.matches('[data-open-gateway]')) return openGateway();
    if (target.matches('[data-enter-role]')) {
      const role = target.dataset.enterRole;
      if (role === 'partner') return openDialog('partnerAccessDialog');
      return enterRole(role);
    }
    if (target.matches('[data-partner-demo]')) return enterRole('partner');
    if (target.dataset.navTarget) return showScreen(target.dataset.navTarget);
    if (target.dataset.openDialog) return openDialog(target.dataset.openDialog);
    if (target.matches('[data-close-dialog]')) return target.closest('dialog')?.close();
    if (target.dataset.toast) return toast(target.dataset.toast, 'info');
    if (target.dataset.bid) return openBidConfirmation(Number(target.dataset.bid));
    if (target.dataset.productOpen) return openProduct(target.dataset.productOpen);
    if (target.dataset.studioTab) {
      studioTab = target.dataset.studioTab;
      return renderStudio();
    }
    if (target.dataset.studioLot !== undefined) return chooseStudioLot(Number(target.dataset.studioLot));
    if (target.matches('[data-studio-pause]')) return toggleStudioAuction();
    if (target.matches('[data-studio-extend]')) return extendStudioAuction();
    if (target.matches('[data-studio-close]')) return openDialog('closeLotDialog');
    if (target.matches('[data-studio-next]')) return chooseStudioLot(studioLotIndex + 1);
    if (target.matches('[data-camera-toggle]')) return startCamera();
    if (target.dataset.ownerAccountAction === 'suspend') return toggleOwnerPartnerStatus();
    if (target.dataset.ownerPartner) return openDialog('partnerProfileDialog');
    if (target.matches('[data-favorite],[data-favorite-id]')) {
      const id = target.dataset.favoriteId || 'watch-001';
      if (favoriteIds.has(id)) favoriteIds.delete(id); else favoriteIds.add(id);
      target.classList.toggle('is-favorite', favoriteIds.has(id));
      target.textContent = favoriteIds.has(id) ? '♥' : '♡';
      toast(favoriteIds.has(id) ? 'حفظنا القطعة في متابعتك.' : 'أزلنا القطعة من متابعتك.', 'info');
      return;
    }
    if (target.dataset.categoryJump) {
      activeCategory = target.dataset.categoryJump;
      $$('#categoryFilters button').forEach((button) => button.classList.toggle('active', button.dataset.category === activeCategory));
      renderCatalog();
      return showScreen('explore');
    }
    if (target.dataset.category) {
      activeCategory = target.dataset.category;
      $$('#categoryFilters button').forEach((button) => button.classList.toggle('active', button === target));
      return renderCatalog();
    }
    if (target.dataset.approvePartner) return handleApproval(target, true);
    if (target.dataset.rejectPartner) return handleApproval(target, false);
    if (target.dataset.planChoice) {
      planRequest = Number(target.dataset.planChoice);
      $$('[data-plan-choice]').forEach((button) => button.classList.toggle('active', button === target));
      return;
    }
  });

  $('#confirmBidButton').addEventListener('click', confirmBid);
  $('#leaveAuctionButton').addEventListener('click', () => {
    auction = auction.withdrawn ? resumeParticipant(auction) : withdrawParticipant(auction);
    renderAuction();
    toast(auction.withdrawn ? 'ستبقى مشاهدًا ولن تقبل الأزرار عروضًا جديدة.' : 'عدت إلى المزايدة.', 'info');
  });
  $('#catalogSearch').addEventListener('input', renderCatalog);
  $('#catalogSort').addEventListener('change', renderCatalog);
  $('#clearCatalog').addEventListener('click', () => {
    $('#catalogSearch').value = '';
    activeCategory = 'all';
    $$('#categoryFilters button').forEach((button) => button.classList.toggle('active', button.dataset.category === 'all'));
    renderCatalog();
  });
  $('#requestPlanButton').addEventListener('click', () => toast(`أرسلنا طلب خطة ${planRequest} مقعدًا إلى المالك في هذه المعاينة.`));
  $('#cameraDialog').addEventListener('close', stopCamera);
  $$('.filter-row [data-filter]').forEach((button) => button.addEventListener('click', () => {
    $$('.filter-row [data-filter]').forEach((item) => item.classList.toggle('active', item === button));
    $$('[data-camera-video]').forEach((video) => { video.style.filter = button.dataset.filter; });
    $('#filterLabel').textContent = button.dataset.filterLabel;
  }));

  $$('[data-studio-increment]').forEach((input) => input.addEventListener('change', () => {
    const selected = $$('[data-studio-increment]:checked').map((item) => Number(item.value));
    if (!selected.length) {
      input.checked = true;
      return toast('يجب إبقاء زيادة واحدة على الأقل للمزايدين.', 'error');
    }
    auction = setAllowedIncrements(auction, selected);
    addStudioActivity('غيّر المضيف زيادات المزايدة', selected.map((value) => `+${value / 1000}`).join('، ') + ' ر.ع.', 'blue');
    renderAuction();
    toast('تغيّرت الأزرار التي يراها المزايدون.');
  }));
  $('#confirmCloseLotButton').addEventListener('click', () => {
    $('#closeLotDialog').close();
    closeStudioAuction();
  });

  $('#partnerAccessForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get('activation')?.toString().trim().toUpperCase();
    if (code !== 'MZ-STUDIO') return toast('الرمز غير معروف. استخدم تجربة الحساب الجاهز في المعاينة.', 'error');
    enterRole('partner');
  });
  $('#partnerApplicationForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = data.get('business')?.toString().trim();
    closeOpenDialogs();
    event.currentTarget.reset();
    toast(`أُرسل طلب ${name || 'النشاط'} للمراجعة التجريبية. لا يوجد تفعيل تلقائي.`);
  });
  $('#createAuctionForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = data.get('title')?.toString().trim() || 'مزاد جديد';
    const current = Number($('#draftCount').textContent) || 1;
    $('#draftCount').textContent = new Intl.NumberFormat('ar-OM').format(current + 1);
    closeOpenDialogs();
    event.currentTarget.reset();
    toast(`حُفظ «${title}» كمسودة. لم يُنشر للناس.`);
  });
  $('#inviteForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = data.get('name')?.toString().trim() || 'عضو جديد';
    closeOpenDialogs();
    event.currentTarget.reset();
    toast(`أُنشئت دعوة تجريبية لـ${name}. سيُحجز المقعد بعد القبول.`);
  });
  $('#newPartnerForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = data.get('business')?.toString().trim() || 'منظّم جديد';
    addAuditEvent('إنشاء حساب منظّم تجريبي', `${name} · لم يُفعّل للبيع الحقيقي`);
    closeOpenDialogs();
    event.currentTarget.reset();
    toast(`أُنشئ حساب ${name} التجريبي مع الحالة المختارة.`);
  });
  $('#ownerPartnerControlForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const plan = data.get('ownerPlan')?.toString() || 'الخطة الحالية';
    addAuditEvent('عدّل المالك إعدادات منظّم', `دار الوقت للمزادات · ${plan}`);
    closeOpenDialogs();
    toast('حُفظت إعدادات حساب المنظّم وسُجل القرار في التدقيق.');
  });
  $('#addLotForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = data.get('lotName')?.toString().trim() || 'قطعة جديدة';
    closeOpenDialogs();
    event.currentTarget.reset();
    toast(`حُفظت «${name}» كمسودة وتحتاج صورًا وتقرير حالة.`);
  });

  window.addEventListener('online', updateConnectivity);
  window.addEventListener('offline', updateConnectivity);
  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && activeRole === 'bidder') {
      event.preventDefault();
      showScreen('explore');
      setTimeout(() => $('#catalogSearch').focus(), 50);
    }
  });
}

function initialize() {
  renderProducts();
  renderSeatBlocks();
  renderAuction();
  wireEvents();
  updateConnectivity();

  const viewRole = { bidder: 'bidder', organizer: 'partner', owner: 'owner' }[new URLSearchParams(location.search).get('view')];
  const storedRole = session.get('mazqat-v2-role');
  const initialRole = viewRole || (storedRole && roleMeta[storedRole] ? storedRole : null);
  if (initialRole) {
    const requestedScreen = location.hash.slice(1);
    enterRole(initialRole);
    const allowedScreens = new Set(roleMeta[initialRole].nav.map((item) => item.screen).filter(Boolean));
    if (requestedScreen && allowedScreens.has(requestedScreen)) showScreen(requestedScreen);
  } else openGateway();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}

initialize();
