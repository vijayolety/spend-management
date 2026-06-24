import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spend Management',
  description: 'Internal SaaS & API Spend Management Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
