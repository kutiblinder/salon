import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Salon platforma',
  description: 'Zakazivanje termina u salonima',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
