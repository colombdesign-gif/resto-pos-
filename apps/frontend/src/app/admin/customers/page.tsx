'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Search, Phone, Mail, MapPin, Star, Loader2, ShoppingBag } from 'lucide-react';

interface Customer { id: string; name: string; phone?: string; email?: string; address?: string; loyalty_points: number; total_spent: number; total_orders: number; notes?: string; created_at: string; }

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });

  const fetch = async (q?: string) => {
    try {
      const res: any = await api.get('/customers', { params: { search: q } });
      setCustomers(res.data || res);
    } catch { setCustomers(DEMO_CUSTOMERS); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);
  useEffect(() => { const t = setTimeout(() => fetch(search), 400); return () => clearTimeout(t); }, [search]);

  const handleSave = async () => {
    if (!form.name) { toast.error('Ad zorunludur'); return; }
    try {
      await api.post('/customers', form);
      toast.success('Müşteri eklendi');
      setShowModal(false);
      setForm({ name: '', phone: '', email: '', address: '', notes: '' });
      fetch();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Müşteriler (CRM)</h1>
          <p className="text-slate-400 text-sm mt-0.5">{customers.length} müşteri</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary py-2.5"><Plus className="w-4 h-4" />Müşteri Ekle</button>
      </div>

      <div className="relative max-w-xs mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className="input pl-10 py-2 text-sm" placeholder="İsim, telefon veya e-posta..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 py-16 text-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" /></div>
        ) : customers.map(c => (
          <div
            key={c.id}
            onClick={() => setSelected(c)}
            className="card cursor-pointer hover:border-orange-500/30 hover:bg-orange-500/5 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex items-center gap-1 bg-yellow-500/10 rounded-lg px-2 py-1">
                <Star className="w-3 h-3 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400">{c.loyalty_points} puan</span>
              </div>
            </div>
            <h3 className="font-semibold text-white mb-2">{c.name}</h3>
            <div className="space-y-1.5">
              {c.phone && <div className="flex items-center gap-2 text-xs text-slate-400"><Phone className="w-3.5 h-3.5" />{c.phone}</div>}
              {c.email && <div className="flex items-center gap-2 text-xs text-slate-400 truncate"><Mail className="w-3.5 h-3.5" />{c.email}</div>}
              {c.address && <div className="flex items-center gap-2 text-xs text-slate-400 truncate"><MapPin className="w-3.5 h-3.5" />{c.address}</div>}
            </div>
            <div className="flex gap-3 mt-3 pt-3 border-t border-slate-700/50">
              <div className="flex-1 text-center">
                <div className="text-sm font-bold text-orange-400">₺{Number(c.total_spent).toLocaleString('tr-TR')}</div>
                <div className="text-xs text-slate-500">Toplam</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-sm font-bold text-white">{c.total_orders}</div>
                <div className="text-xs text-slate-500">Sipariş</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Müşteri Detay */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="glass-card w-full max-w-md p-6 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-2xl">
                {selected.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                <div className="flex items-center gap-1 text-yellow-400 text-sm mt-0.5">
                  <Star className="w-4 h-4" />{selected.loyalty_points} puan
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="card p-3 text-center">
                <div className="text-lg font-bold text-orange-400">₺{Number(selected.total_spent).toLocaleString('tr-TR')}</div>
                <div className="text-xs text-slate-400">Toplam Harcama</div>
              </div>
              <div className="card p-3 text-center">
                <div className="text-lg font-bold text-white flex items-center justify-center gap-1"><ShoppingBag className="w-4 h-4" />{selected.total_orders}</div>
                <div className="text-xs text-slate-400">Toplam Sipariş</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {selected.phone && <div className="flex gap-2"><Phone className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" /><span className="text-slate-300">{selected.phone}</span></div>}
              {selected.email && <div className="flex gap-2"><Mail className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" /><span className="text-slate-300">{selected.email}</span></div>}
              {selected.address && <div className="flex gap-2"><MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" /><span className="text-slate-300">{selected.address}</span></div>}
              {selected.notes && <div className="mt-3 p-3 rounded-xl bg-slate-700/50 text-slate-300 text-sm">📝 {selected.notes}</div>}
            </div>
            <button onClick={() => setSelected(null)} className="btn-secondary w-full mt-5">Kapat</button>
          </div>
        </div>
      )}

      {/* Ekle Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 animate-slide-in">
            <h2 className="text-lg font-bold text-white mb-5">Yeni Müşteri</h2>
            <div className="space-y-3">
              <div><label className="text-sm text-slate-300 block mb-1.5">Ad Soyad *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm text-slate-300 block mb-1.5">Telefon</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><label className="text-sm text-slate-300 block mb-1.5">E-posta</label><input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div><label className="text-sm text-slate-300 block mb-1.5">Adres</label><input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><label className="text-sm text-slate-300 block mb-1.5">Not</label><textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">İptal</button>
              <button onClick={handleSave} className="btn-primary flex-1">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DEMO_CUSTOMERS = [
  { id: 'c1', name: 'Ahmet Yılmaz', phone: '0532 111 22 33', email: 'ahmet@mail.com', address: 'Kadıköy, İstanbul', loyalty_points: 450, total_spent: 3200, total_orders: 18, created_at: '' },
  { id: 'c2', name: 'Fatma Demir', phone: '0545 444 55 66', loyalty_points: 120, total_spent: 850, total_orders: 5, created_at: '' },
  { id: 'c3', name: 'Mehmet Ay', email: 'mehmet@mail.com', address: 'Beşiktaş, İstanbul', loyalty_points: 780, total_spent: 5600, total_orders: 31, notes: 'VIP müşteri', created_at: '' },
];
