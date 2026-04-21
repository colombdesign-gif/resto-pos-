'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ChefHat, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Hoş geldiniz! 🎉');
      router.push('/pos/tables');
    } catch (err: any) {
      toast.error(err.message || 'Giriş başarısız');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at top left, #1e1b4b 0%, #0f172a 50%, #0c1222 100%)' }}>

      {/* Arka plan efekti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-500 rounded-full opacity-10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600 rounded-full opacity-10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-brand mb-4 shadow-lg shadow-orange-500/30">
            <ChefHat className="w-8 h-8 text-white" />
          </div>
            <h1 className="text-2xl font-bold text-gray-900">Hesap Getir</h1>
            <p className="text-sm text-gray-500">Restoran Yönetim Paneli</p>
        </div>

        {/* Kart */}
        <div className="glass-card p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Hesabınıza Giriş Yapın</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">E-posta</label>
              <input
                type="email"
                className="input"
                placeholder="ornek@restoran.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Şifre</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-12"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-base mt-2"
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Giriş yapılıyor...</>
              ) : (
                'Giriş Yap'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              Hesabınız yok mu?{' '}
              <Link href="/register" className="text-orange-400 hover:text-orange-300 font-medium">
                Ücretsiz Deneyin
              </Link>
            </p>
          </div>

          {/* Demo hesaplar */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-xs text-slate-500 text-center mb-3">Demo hesaplar</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Admin', email: 'admin@demo.com', pass: 'demo123' },
                { label: 'Garson', email: 'garson@demo.com', pass: 'demo123' },
              ].map((demo) => (
                <button
                  key={demo.label}
                  type="button"
                  onClick={() => { setEmail(demo.email); setPassword(demo.pass); }}
                  className="text-xs px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  {demo.label}: {demo.email}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © 2024 RestoPOS · Tüm hakları saklıdır
        </p>
      </div>
    </div>
  );
}
