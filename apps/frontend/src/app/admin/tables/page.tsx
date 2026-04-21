'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Loader2, Grid3X3, Users, Building2 } from 'lucide-react';
import clsx from 'clsx';

interface Branch { id: string; name: string; }
interface Table { id: string; name: string; capacity: number; status: string; }

export default function TablesManagementPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTableModal, setShowTableModal] = useState(false);
  const [form, setForm] = useState({ name: '', capacity: 4 });

  const fetchBranches = async () => {
    try {
      const res: any = await api.get('/branches');
      const data = res.data || res;
      setBranches(data);
      if (data.length > 0) setSelectedBranchId(data[0].id);
    } catch (err: any) {
      toast.error('Şubeler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async (branchId: string) => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res: any = await api.get(`/tables/branch/${branchId}`);
      setTables(res.data || res);
    } catch (err: any) {
      toast.error('Masalar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBranches(); }, []);
  useEffect(() => { if (selectedBranchId) fetchTables(selectedBranchId); }, [selectedBranchId]);

  const handleAddTable = async () => {
    if (!form.name) { toast.error('Masa adı zorunludur'); return; }
    try {
      await api.post(`/tables/branch/${selectedBranchId}`, form);
      toast.success('Masa eklendi');
      setShowTableModal(false);
      setForm({ name: '', capacity: 4 });
      fetchTables(selectedBranchId);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm('Masayı silmek istediğinizden emin misiniz?')) return;
    try {
      await api.delete(`/tables/${id}`);
      toast.success('Masa silindi');
      setTables(prev => prev.filter(t => t.id !== id));
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Masa Yönetimi</h1>
          <p className="text-slate-400 text-sm mt-0.5">Şubelerinizdeki masaları düzenleyin</p>
        </div>
        <button 
          onClick={() => setShowTableModal(true)} 
          disabled={!selectedBranchId}
          className="btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />Masa Ekle
        </button>
      </div>

      {/* Şube Seçimi */}
      <div className="flex gap-4 mb-8">
        <div className="w-full max-w-xs">
          <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block tracking-wider">Şube Seçin</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              className="input pl-10 h-11"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
            >
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {tables.map((table) => (
            <div key={table.id} className="card p-4 group hover:border-orange-500/20 transition-all duration-300">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Grid3X3 className="w-5 h-5 text-orange-400" />
                </div>
                <button 
                  onClick={() => handleDeleteTable(table.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-bold text-white text-lg">{table.name}</h3>
              <div className="flex items-center gap-2 mt-2 text-slate-400">
                <Users className="w-3.5 h-3.5" />
                <span className="text-xs">{table.capacity} Kişilik</span>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700/30">
                <span className={clsx('text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full', 
                  table.status === 'available' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                )}>
                  {table.status === 'available' ? 'Müsait' : 'Dolu'}
                </span>
              </div>
            </div>
          ))}

          {tables.length === 0 && (
            <div className="col-span-full py-20 text-center glass-card border-dashed">
              <Grid3X3 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Bu şubede henüz masa bulunmuyor.</p>
              <button 
                onClick={() => setShowTableModal(true)}
                className="text-orange-500 text-sm font-semibold mt-2 hover:underline"
              >
                İlk masayı şimdi ekle
              </button>
            </div>
          )}
        </div>
      )}

      {/* Masa Modal */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm p-6 animate-slide-in">
            <h2 className="text-lg font-bold text-white mb-5">Yeni Masa Ekle</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block">Masa Adı / Numarası *</label>
                <input 
                  className="input" 
                  value={form.name} 
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                  placeholder="Örn: Masa 1, T-5, Bahçe 2" 
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block">Kapasite (Kişi)</label>
                <input 
                  type="number"
                  className="input" 
                  value={form.capacity} 
                  onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) || 0 }))} 
                  min="1"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowTableModal(false)} className="btn-secondary flex-1">İptal</button>
              <button onClick={handleAddTable} className="btn-primary flex-1">Ekle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
