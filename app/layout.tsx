import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'مزاد مسقط | شبكة المزادات الحية',
  description: 'شبكة مزادات للمزايدين ومنظّمي المزادات المعتمدين، مع غرف تشغيل وخطط فرق وتحكم للمالك.',
  applicationName: 'MAZQAT',
  openGraph: {
    locale: 'ar_OM',
    type: 'website',
    title: 'مزاد مسقط | MAZQAT',
    description: 'زايد، نظّم، وأدر شبكة المزادات من تجارب مستقلة وواضحة.',
    images: [{ url: '/og.png', width: 1747, height: 909, alt: 'مزاد مسقط — ساعة فاخرة على منصة المزاد' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'مزاد مسقط | MAZQAT',
    description: 'زايد، نظّم، وأدر شبكة المزادات من تجارب مستقلة وواضحة.',
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
