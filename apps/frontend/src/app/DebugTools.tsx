'use client';

import { useEffect, useState } from 'react';

export default function DebugTools() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
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
    </>
  );
}
