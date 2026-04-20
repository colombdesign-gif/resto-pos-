'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { Building2, Plus, MapPin, Phone, Mail, Pencil, Loader2 } from 'lucide-react';

interface Branch { id: string; name: string; address?: string; city?: string; phone?: string; email?: string; is_active: boolean; }

export default function BranchesPage() {
  const { tenant } = useAuthStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '', city: '', phone: '', email: '', tax_office: '', tax_number: '' });

  const fetch = async () => {
    try { const res: any = await api.get('/branches'); setBranches(res.data || res); }
    catch { setBranches(DEMO_BRANCHES); } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleSave = async () => {
    if (!form.name) { toast.error('Şube adı zorunludur'); return; }
    try {
      if (editing) { await api.patch(`/branches/${editing.id}`, form); toast.success('Şube güncellendi'); }
      else { await api.post('/branches', form); toast.success('Şube eklendi'); }
      setShowModal(false); setEditing(null);
      setForm({ name: '', address: '', city: '', phone: '', email: '', tax_office: '', tax_number: '' });
      fetch();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Şube Yönetimi</h1>
          <p className="text-slate-400 text-sm mt-0.5">{tenant?.name} · {branches.length} şube</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary py-2.5"><Plus className="w-4 h-4" />Şube Ekle</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(b => (
            <div key={b.id} className="card hover:border-orange-500/20 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-orange-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${b.is_active ? 'badge-ready' : 'badge-cancelled'}`}>{b.is_active ? 'Aktif' : 'Pasif'}</span>
                  <button onClick={() => { setEditing(b); setForm({ name: b.name, address: b.address || '', city: b.city || '', phone: b.phone || '', email: b.email || '', tax_office: '', tax_number: '' }); setShowModal(true); }} className="p-1.5 rounded-lg hover:bg-slate-600 text-slate-400 hover:text-white">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-white text-lg mb-3">{b.name}</h3>
              <div className="space-y-2">
                {(b.address || b.city) && <div className="flex items-center gap-2 text-sm text-slate-400"><MapPin className="w-4 h-4 flex-shrink-0" /><span className="truncate">{[b.address, b.city].filter(Boolean).join(', ')}</span></div>}
                {b.phone && <div className="flex items-center gap-2 text-sm text-slate-400"><Phone className="w-4 h-4" />{b.phone}</div>}
                {b.email && <div className="flex items-center gap-2 text-sm text-slate-400"><Mail className="w-4 h-4" />{b.email}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 animate-slide-in">
            <h2 className="text-lg font-bold text-white mb-5">{editing ? 'Şube Düzenle' : 'Yeni Şube'}</h2>
            <div className="space-y-4">
              <div><label className="text-sm text-slate-300 block mb-1.5">Şube Adı *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Merkez Şube" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm text-slate-300 block mb-1.5">Şehir</label><input className="input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="İstanbul" /></div>
                <div><label className="text-sm text-slate-300 block mb-1.5">Telefon</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div><label className="text-sm text-slate-300 block mb-1.5">Adres</label><textarea className="input resize-none" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><label className="text-sm text-slate-300 block mb-1.5">E-posta</label><input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm text-slate-300 block mb-1.5">Vergi Dairesi</label><input className="input" value={form.tax_office} onChange={e => setForm(f => ({ ...f, tax_office: e.target.value }))} /></div>
                <div><label className="text-sm text-slate-300 block mb-1.5">Vergi No</label><input className="input" value={form.tax_number} onChange={e => setForm(f => ({ ...f, tax_number: e.target.value }))} /></div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="btn-secondary flex-1">İptal</button>
              <button onClick={handleSave} className="btn-primary flex-1">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DEMO_BRANCHES = [
  { id: 'b1', name: 'Merkez Şube', address: 'Bağdat Caddesi No:42', city: 'İstanbul', phone: '0216 555 00 11', email: 'merkez@restoran.com', is_active: true },
  { id: 'b2', name: 'Kadıköy Şube', address: 'Moda Caddesi No:18', city: 'İstanbul', phone: '0216 444 00 22', is_active: true },
];
