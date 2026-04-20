'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Settings, User, Shield, Bell, Palette, Save, ChefHat } from 'lucide-react';

export default function SettingsPage() {
  const { user, tenant } = useAuthStore();
  const [activeSection, setActiveSection] = useState('profile');
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', phone: '' });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [tenantForm, setTenantForm] = useState({ name: tenant?.name || '' });

  const sections = [
    { id: 'profile', icon: User, label: 'Profil' },
    { id: 'security', icon: Shield, label: 'Güvenlik' },
    { id: 'business', icon: ChefHat, label: 'İşletme' },
    { id: 'notifications', icon: Bell, label: 'Bildirimler' },
  ];

  const handleSaveProfile = async () => {
    try {
      await api.patch(`/users/${user?.id}`, profileForm);
      toast.success('Profil güncellendi');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleChangePassword = async () => {
    if (passForm.newPassword !== passForm.confirmPassword) { toast.error('Şifreler eşleşmiyor'); return; }
    if (passForm.newPassword.length < 6) { toast.error('Şifre en az 6 karakter olmalı'); return; }
    try {
      await api.patch(`/users/${user?.id}`, { password: passForm.newPassword });
      toast.success('Şifre değiştirildi');
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Ayarlar</h1>
        <p className="text-slate-400 text-sm mt-0.5">Hesap ve işletme ayarlarınızı yönetin</p>
      </div>

      <div className="flex gap-6">
        {/* Sol nav */}
        <div className="w-48 flex-shrink-0">
          <div className="space-y-1">
            {sections.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSection === s.id ? 'bg-orange-500/15 text-orange-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                <s.icon className="w-4 h-4" />{s.label}
              </button>
            ))}
          </div>
        </div>

        {/* İçerik */}
        <div className="flex-1 max-w-xl">
          {activeSection === 'profile' && (
            <div className="card">
              <h2 className="font-semibold text-white mb-5">Profil Bilgileri</h2>
              <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-slate-700/50">
                <div className="w-14 h-14 rounded-2xl gradient-brand flex items-center justify-center text-white text-2xl font-bold">
                  {user?.name?.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-white">{user?.name}</div>
                  <div className="text-sm text-slate-400">{user?.email}</div>
                  <div className="badge badge-pending mt-1 capitalize">{user?.role}</div>
                </div>
              </div>
              <div className="space-y-4">
                <div><label className="text-sm text-slate-300 block mb-1.5">Ad Soyad</label><input className="input" value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="text-sm text-slate-300 block mb-1.5">Telefon</label><input className="input" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><label className="text-sm text-slate-300 block mb-1.5">E-posta</label><input className="input" value={user?.email} disabled /></div>
              </div>
              <button onClick={handleSaveProfile} className="btn-primary mt-5"><Save className="w-4 h-4" />Kaydet</button>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="card">
              <h2 className="font-semibold text-white mb-5">Şifre Değiştir</h2>
              <div className="space-y-4">
                <div><label className="text-sm text-slate-300 block mb-1.5">Mevcut Şifre</label><input type="password" className="input" value={passForm.currentPassword} onChange={e => setPassForm(f => ({ ...f, currentPassword: e.target.value }))} /></div>
                <div><label className="text-sm text-slate-300 block mb-1.5">Yeni Şifre</label><input type="password" className="input" value={passForm.newPassword} onChange={e => setPassForm(f => ({ ...f, newPassword: e.target.value }))} /></div>
                <div><label className="text-sm text-slate-300 block mb-1.5">Yeni Şifre Tekrar</label><input type="password" className="input" value={passForm.confirmPassword} onChange={e => setPassForm(f => ({ ...f, confirmPassword: e.target.value }))} /></div>
              </div>
              <button onClick={handleChangePassword} className="btn-primary mt-5"><Shield className="w-4 h-4" />Şifreyi Değiştir</button>
            </div>
          )}

          {activeSection === 'business' && (
            <div className="card">
              <h2 className="font-semibold text-white mb-5">İşletme Bilgileri</h2>
              <div className="space-y-4">
                <div><label className="text-sm text-slate-300 block mb-1.5">İşletme Adı</label><input className="input" value={tenantForm.name} onChange={e => setTenantForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="text-sm text-slate-300 block mb-1.5">Plan</label><input className="input" value={tenant?.plan || ''} disabled /></div>
                <div><label className="text-sm text-slate-300 block mb-1.5">Slug (URL)</label><input className="input" value={tenant?.slug || ''} disabled /></div>
              </div>
              <button onClick={async () => { await api.patch('/tenants/me', tenantForm); toast.success('İşletme güncellendi'); }} className="btn-primary mt-5"><Save className="w-4 h-4" />Kaydet</button>

              {/* API Anahtarları */}
              <div className="mt-6 pt-6 border-t border-slate-700">
                <h3 className="font-medium text-white mb-4">Entegrasyon API Anahtarları</h3>
                <div className="space-y-3">
                  {['Iyzico', 'Yemeksepeti', 'Getir', 'Trendyol'].map(name => (
                    <div key={name} className="flex items-center gap-3">
                      <label className="text-sm text-slate-400 w-28 flex-shrink-0">{name}</label>
                      <input className="input flex-1 py-2 text-sm" placeholder={`${name} API Key...`} type="password" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-3">🔒 API anahtarları şifrelenmiş olarak saklanır. Değiştirmek için yeni değer girin.</p>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="card">
              <h2 className="font-semibold text-white mb-5">Bildirim Ayarları</h2>
              <div className="space-y-4">
                {[
                  { label: 'Yeni sipariş bildirimi', key: 'newOrder', default: true },
                  { label: 'Kritik stok uyarısı', key: 'stockAlert', default: true },
                  { label: 'Ödeme bildirimi', key: 'payment', default: false },
                  { label: 'Sipariş hazır bildirimi', key: 'orderReady', default: true },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-slate-700/30">
                    <span className="text-sm text-slate-300">{item.label}</span>
                    <button className={`relative w-11 h-6 rounded-full transition-colors ${item.default ? 'bg-orange-500' : 'bg-slate-600'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${item.default ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
