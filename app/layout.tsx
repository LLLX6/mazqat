import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'مزاد مسقط | المزاد الحي بطابع عُماني',
  description: 'مزادات حية موثوقة للقطع المختارة في مسقط — شاهد، زايد، واستلم بثقة.',
  applicationName: 'MAZQAT',
  openGraph: {
    locale: 'ar_OM',
    type: 'website',
    title: 'مزاد مسقط | MAZQAT',
    description: 'شاهد. زايد. اكسب. تجربة مزاد حي بطابع عُماني.',
    images: [{ url: '/og.png', width: 1747, height: 909, alt: 'مزاد مسقط — ساعة فاخرة على منصة المزاد' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'مزاد مسقط | MAZQAT',
    description: 'شاهد. زايد. اكسب. تجربة مزاد حي بطابع عُماني.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar-OM" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
