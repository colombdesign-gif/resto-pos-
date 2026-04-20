'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { ChefHat, Loader2, Check } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [form, setForm] = useState({
    businessName: '',
    name: '',
    email: '',
    password: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(form);
      toast.success('İşletmeniz oluşturuldu! 🎉');
      router.push('/pos/tables');
    } catch (err: any) {
      toast.error(err.message || 'Kayıt başarısız');
    }
  };

  const features = [
    'Ücretsiz 14 günlük deneme',
    'Kredi kartı gerekmez',
    'Sınırsız masa & sipariş',
    'Gerçek zamanlı mutfak ekranı',
  ];

  return (
    <div className="min-h-screen flex" style={{
      background: 'radial-gradient(ellipse at top right, #1e1b4b 0%, #0f172a 50%, #0c1222 100%)'
    }}>
      {/* Sol panel */}
      <div className="hidden lg:flex flex-col justify-center w-1/2 p-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-brand mb-6 shadow-lg shadow-orange-500/30">
          <ChefHat className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
          Restoranınızı<br />
          <span className="gradient-text">Dijitalleştirin</span>
        </h1>
        <p className="text-slate-400 text-lg mb-10 leading-relaxed">
          Tek platformda sipariş, mutfak, ödeme ve raporlama. Bulut tabanlı, her cihazdan erişilebilir.
        </p>
        <div className="space-y-4">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-3.5 h-3.5 text-orange-400" />
              </div>
              <span className="text-slate-300">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sağ panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-brand mb-3">
              <ChefHat className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">RestoPOS</h1>
          </div>

          <div className="glass-card p-8">
            <h2 className="text-xl font-semibold text-white mb-6">Ücretsiz Hesap Oluştur</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">İşletme Adı *</label>
                <input
                  className="input"
                  placeholder="Örn: Lezzet Durağı"
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Ad Soyad *</label>
                <input
                  className="input"
                  placeholder="Ahmet Yılmaz"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">E-posta *</label>
                <input
                  type="email"
                  className="input"
                  placeholder="ahmet@restoranadi.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Şifre *</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Min. 6 karakter"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Telefon</label>
                  <input
                    className="input"
                    placeholder="0532 xxx xx xx"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3 text-base mt-2"
              >
                {isLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Hesap oluşturuluyor...</>
                ) : (
                  'Ücretsiz Başla →'
                )}
              </button>
            </form>

            <p className="text-center text-slate-400 text-sm mt-6">
              Zaten hesabınız var mı?{' '}
              <Link href="/login" className="text-orange-400 hover:text-orange-300 font-medium">
                Giriş Yapın
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
