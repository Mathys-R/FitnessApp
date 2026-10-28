// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'FitCouple Tracker',
  description: 'Suivi Musculation, Nutrition et Poids',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FitTracker',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-black text-white antialiased min-h-dvh">
        <div vaul-drawer-wrapper="" className="min-h-dvh bg-black">
          {children}
        </div>
        <Toaster position="top-center" theme="dark" richColors />
      </body>
    </html>
  );
}

