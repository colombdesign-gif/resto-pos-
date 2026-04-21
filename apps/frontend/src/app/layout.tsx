import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f97316',
};

export const metadata: Metadata = {
  title: 'Hesap Getir — Profesyonel Restoran POS Sistemi',
  description: 'Bulut tabanlı multi-tenant restoran ve kafe yönetim sistemi',
  keywords: 'restoran pos, kafe yönetim, adisyon sistemi, restoran yazılımı',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Hesap Getir',
  },
};

export const dynamic = 'force-dynamic';

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
        <div id="app-root-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#f97316',
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold',
          textAlign: 'center',
          padding: '4px',
          zIndex: 99999,
          pointerEvents: 'none'
        }}>
          SİSTEM GÜNCELLENDİ (v1.0.4-RELOADED) — Eğer bu barı görüyorsanız kurulum başarılıdır.
        </div>
        <button 
          onClick={() => {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(regs => {
                regs.forEach(r => r.unregister());
                window.location.reload();
              });
            }
          }}
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            backgroundColor: '#ef4444',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            zIndex: 99999,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}
        >
          Hafızayı Sıfırla (Cache Clear)
        </button>
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
