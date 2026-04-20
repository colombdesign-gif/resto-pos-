'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Plus, Pencil, Trash2, AlertTriangle, Search, Package, BookOpen, Loader2 } from 'lucide-react';

interface Ingredient {
  id: string; name: string; unit: string;
  current_stock: number; critical_stock: number; cost_per_unit: number; supplier?: string;
}

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [alerts, setAlerts] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState({ name: '', unit: 'gram', current_stock: '', critical_stock: '', cost_per_unit: '', supplier: '' });
  const [adjustModal, setAdjustModal] = useState<Ingredient | null>(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'in', quantity: '', note: '' });

  const fetch = async () => {
    try {
      const [ingRes, alertRes]: any = await Promise.all([
        api.get('/inventory/ingredients'),
        api.get('/inventory/ingredients/alerts'),
      ]);
      setIngredients(ingRes.data || ingRes);
      setAlerts(alertRes.data || alertRes);
    } catch {
      setIngredients(DEMO_INGREDIENTS);
      setAlerts(DEMO_INGREDIENTS.filter(i => i.current_stock <= i.critical_stock));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const filtered = ingredients.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async () => {
    if (!form.name) { toast.error('Ad zorunludur'); return; }
    try {
      const data = { ...form, current_stock: parseFloat(form.current_stock) || 0, critical_stock: parseFloat(form.critical_stock) || 0, cost_per_unit: parseFloat(form.cost_per_unit) || 0 };
      if (editing) {
        await api.patch(`/inventory/ingredients/${editing.id}`, data);
        toast.success('Malzeme güncellendi');
      } else {
        await api.post('/inventory/ingredients', data);
        toast.success('Malzeme eklendi');
      }
      setShowModal(false); setEditing(null);
      setForm({ name: '', unit: 'gram', current_stock: '', critical_stock: '', cost_per_unit: '', supplier: '' });
      fetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAdjust = async () => {
    if (!adjustModal || !adjustForm.quantity) { toast.error('Miktar giriniz'); return; }
    try {
      await api.post('/inventory/transactions', { ingredient_id: adjustModal.id, type: adjustForm.type, quantity: parseFloat(adjustForm.quantity), note: adjustForm.note });
      toast.success('Stok hareketi kaydedildi');
      setAdjustModal(null);
      setAdjustForm({ type: 'in', quantity: '', note: '' });
      fetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Malzemeyi silmek istiyor musunuz?')) return;
    try { await api.delete(`/inventory/ingredients/${id}`); setIngredients(p => p.filter(i => i.id !== id)); toast.success('Silindi'); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Stok & Reçete Yönetimi</h1>
          <p className="text-slate-400 text-sm mt-0.5">{ingredients.length} malzeme · {alerts.length} kritik uyarı</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary py-2.5">
          <Plus className="w-4 h-4" />Malzeme Ekle
        </button>
      </div>

      {/* Kritik uyarılar */}
      {alerts.length > 0 && (
        <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="font-semibold text-red-400">Kritik Stok Uyarısı — {alerts.length} Malzeme</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map(a => (
              <span key={a.id} className="badge bg-red-500/20 text-red-300 text-xs">
                {a.name}: {a.current_stock} {a.unit} (min: {a.critical_stock})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Arama */}
      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className="input pl-10 py-2 text-sm" placeholder="Malzeme ara..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Tablo */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              {['Malzeme', 'Birim', 'Mevcut Stok', 'Kritik Stok', 'Birim Maliyet', 'Durum', 'İşlem'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" /></td></tr>
            ) : filtered.map(ing => {
              const isCritical = ing.current_stock <= ing.critical_stock;
              const pct = ing.critical_stock > 0 ? Math.min(100, (ing.current_stock / (ing.critical_stock * 3)) * 100) : 50;
              return (
                <tr key={ing.id} className={clsx('hover:bg-slate-700/10 transition-colors', isCritical && 'bg-red-500/5')}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{ing.name}</div>
                    {ing.supplier && <div className="text-xs text-slate-500">{ing.supplier}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{ing.unit}</td>
                  <td className="px-4 py-3">
                    <div className={clsx('font-bold', isCritical ? 'text-red-400' : 'text-green-400')}>
                      {Number(ing.current_stock).toFixed(0)}
                    </div>
                    <div className="w-20 h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                      <div className={clsx('h-full rounded-full', isCritical ? 'bg-red-500' : 'bg-green-500')} style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{Number(ing.critical_stock).toFixed(0)}</td>
                  <td className="px-4 py-3 text-slate-300">₺{Number(ing.cost_per_unit).toFixed(4)}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('badge', isCritical ? 'badge-cancelled' : 'badge-ready')}>
                      {isCritical ? '⚠️ Kritik' : '✅ Normal'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => { setAdjustModal(ing); }} className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium transition-colors" title="Stok Hareketi">±</button>
                      <button onClick={() => { setEditing(ing); setForm({ name: ing.name, unit: ing.unit, current_stock: String(ing.current_stock), critical_stock: String(ing.critical_stock), cost_per_unit: String(ing.cost_per_unit), supplier: ing.supplier || '' }); setShowModal(true); }} className="p-1.5 rounded-lg hover:bg-slate-600 text-slate-400 hover:text-white transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(ing.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Malzeme Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 animate-slide-in">
            <h2 className="text-lg font-bold text-white mb-5">{editing ? 'Malzeme Düzenle' : 'Malzeme Ekle'}</h2>
            <div className="space-y-4">
              <div><label className="text-sm text-slate-300 block mb-1.5">Ad *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Un, Domates, ..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm text-slate-300 block mb-1.5">Birim</label>
                  <select className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {['gram', 'kg', 'ml', 'lt', 'adet', 'kutu'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div><label className="text-sm text-slate-300 block mb-1.5">Birim Maliyet (₺)</label><input type="number" className="input" value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))} step="0.0001" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm text-slate-300 block mb-1.5">Mevcut Stok</label><input type="number" className="input" value={form.current_stock} onChange={e => setForm(f => ({ ...f, current_stock: e.target.value }))} /></div>
                <div><label className="text-sm text-slate-300 block mb-1.5">Kritik Stok</label><input type="number" className="input" value={form.critical_stock} onChange={e => setForm(f => ({ ...f, critical_stock: e.target.value }))} /></div>
              </div>
              <div><label className="text-sm text-slate-300 block mb-1.5">Tedarikçi</label><input className="input" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Tedarikçi adı" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="btn-secondary flex-1">İptal</button>
              <button onClick={handleSave} className="btn-primary flex-1">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* Stok hareketi Modal */}
      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm p-6 animate-slide-in">
            <h2 className="text-lg font-bold text-white mb-1">Stok Hareketi</h2>
            <p className="text-slate-400 text-sm mb-5">{adjustModal.name} — Mevcut: {adjustModal.current_stock} {adjustModal.unit}</p>
            <div className="space-y-4">
              <div><label className="text-sm text-slate-300 block mb-1.5">İşlem Türü</label>
                <select className="input" value={adjustForm.type} onChange={e => setAdjustForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="in">Giriş (Stok Artır)</option>
                  <option value="out">Çıkış (Stok Düş)</option>
                  <option value="adjustment">Düzeltme (Yeni Değer)</option>
                  <option value="waste">Fire / Kayıp</option>
                </select>
              </div>
              <div><label className="text-sm text-slate-300 block mb-1.5">Miktar ({adjustModal.unit})</label><input type="number" className="input" value={adjustForm.quantity} onChange={e => setAdjustForm(f => ({ ...f, quantity: e.target.value }))} step="0.001" /></div>
              <div><label className="text-sm text-slate-300 block mb-1.5">Not</label><input className="input" value={adjustForm.note} onChange={e => setAdjustForm(f => ({ ...f, note: e.target.value }))} placeholder="Opsiyonel..." /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setAdjustModal(null)} className="btn-secondary flex-1">İptal</button>
              <button onClick={handleAdjust} className="btn-primary flex-1">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DEMO_INGREDIENTS: Ingredient[] = [
  { id: 'i1', name: 'Tavuk Göğsü', unit: 'gram', current_stock: 5000, critical_stock: 2000, cost_per_unit: 0.08, supplier: 'Seymen Et' },
  { id: 'i2', name: 'Un', unit: 'kg', current_stock: 25, critical_stock: 5, cost_per_unit: 2.5 },
  { id: 'i3', name: 'Domates', unit: 'kg', current_stock: 3, critical_stock: 5, cost_per_unit: 8.0, supplier: 'Köylü Market' },
  { id: 'i4', name: 'Zeytinyağı', unit: 'lt', current_stock: 8, critical_stock: 2, cost_per_unit: 35 },
  { id: 'i5', name: 'Makarna', unit: 'kg', current_stock: 1.5, critical_stock: 3, cost_per_unit: 12 },
];
