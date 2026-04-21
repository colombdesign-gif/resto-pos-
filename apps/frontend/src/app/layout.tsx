import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hesap Getir — Profesyonel Restoran POS Sistemi',
  description: 'Bulut tabanlı multi-tenant restoran ve kafe yönetim sistemi',
  keywords: 'restoran pos, kafe yönetim, adisyon sistemi, restoran yazılımı',
  manifest: '/manifest.json',
  themeColor: '#f97316',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Hesap Getir',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#f97316" />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              borderRadius: '12px',
            },
            success: {
              iconTheme: { primary: '#22c55e', secondary: '#f1f5f9' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' },
            },
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('[PWA] Service Worker kayıtlı:', reg.scope);
                    
                    // Yeni versiyon gelirse otomatik sayfayı yenile
                    reg.onupdatefound = () => {
                      const installingWorker = reg.installing;
                      installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                          console.log('[PWA] Yeni içerik mevcut, yenileniyor...');
                          window.location.reload();
                        }
                      };
                    };
                  }).catch(function(err) {
                    console.warn('[PWA] SW kayıt hatası:', err);
                  });
                });
              }
            `,
          }}
        />
        {/* Sürüm Göstergesi (FIX: Cache durumunu anlamak için) */}
        <div id="app-version" style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          fontSize: '10px',
          color: '#475569',
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: 0.5
        }}>
          v1.0.3-stable
        </div>
      </body>
    </html>
  );
}
