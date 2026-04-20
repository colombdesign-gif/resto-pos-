'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Plus, Pencil, Trash2, Search, Shield, User, Loader2, Eye, EyeOff } from 'lucide-react';

interface UserItem {
  id: string; name: string; email: string; role: string;
  phone?: string; branch_id?: string; is_active: boolean; created_at: string;
}

const ROLES = [
  { value: 'admin',   label: 'Admin',   color: '#ef4444', icon: '👑' },
  { value: 'manager', label: 'Yönetici', color: '#f97316', icon: '🏆' },
  { value: 'waiter',  label: 'Garson',  color: '#3b82f6', icon: '🍽️' },
  { value: 'kitchen', label: 'Mutfak',  color: '#22c55e', icon: '🍳' },
  { value: 'cashier', label: 'Kasiyer', color: '#a855f7', icon: '💳' },
  { value: 'courier', label: 'Kurye',   color: '#06b6d4', icon: '🛵' },
];

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', role: 'waiter', phone: '', branch_id: '', password: '',
  });

  const fetchAll = async () => {
    try {
      const [usersRes, branchRes]: any = await Promise.all([
        api.get('/users'),
        api.get('/branches'),
      ]);
      setUsers(usersRes.data || usersRes);
      setBranches(branchRes.data || branchRes);
    } catch { setUsers(DEMO_USERS); } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search)
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', role: 'waiter', phone: '', branch_id: '', password: '' });
    setShowModal(true);
  };

  const openEdit = (u: UserItem) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, role: u.role, phone: u.phone || '', branch_id: u.branch_id || '', password: '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) { toast.error('Ad ve e-posta zorunludur'); return; }
    if (!editing && !form.password) { toast.error('Yeni kullanıcı için şifre gereklidir'); return; }
    try {
      const payload: any = { name: form.name, email: form.email, role: form.role, phone: form.phone, branch_id: form.branch_id || undefined };
      if (form.password) payload.password = form.password;
      if (editing) {
        await api.patch(`/users/${editing.id}`, payload);
        toast.success('Kullanıcı güncellendi');
      } else {
        await api.post('/users', payload);
        toast.success('Kullanıcı oluşturuldu');
      }
      setShowModal(false);
      fetchAll();
    } catch (e: any) { toast.error(e.response?.data?.message || e.message); }
  };

  const handleToggle = async (u: UserItem) => {
    try {
      await api.patch(`/users/${u.id}`, { is_active: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
      toast.success(u.is_active ? 'Kullanıcı devre dışı bırakıldı' : 'Kullanıcı aktif edildi');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Kullanıcıyı silmek istediğinizden emin misiniz?')) return;
    try { await api.delete(`/users/${id}`); setUsers(p => p.filter(u => u.id !== id)); toast.success('Kullanıcı silindi'); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Kullanıcı Yönetimi</h1>
          <p className="text-slate-400 text-sm mt-0.5">{users.length} kullanıcı</p>
        </div>
        <button onClick={openCreate} className="btn-primary py-2.5"><Plus className="w-4 h-4" />Kullanıcı Ekle</button>
      </div>

      {/* Rol filtreleri */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-10 py-2 text-sm" placeholder="İsim veya e-posta..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {ROLES.map(r => {
            const count = users.filter(u => u.role === r.value).length;
            return (
              <div key={r.value} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-xs">
                <span>{r.icon}</span>
                <span className="text-slate-300">{r.label}</span>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: r.color }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kullanıcı tablosu */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              {['Kullanıcı', 'Rol', 'Şube', 'Telefon', 'Durum', 'Kayıt', 'İşlem'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" /></td></tr>
            ) : filtered.map(u => {
              const role = ROLES.find(r => r.value === u.role);
              const isSelf = u.id === currentUser?.id;
              return (
                <tr key={u.id} className={clsx('hover:bg-slate-700/10 transition-colors', !u.is_active && 'opacity-50')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-white">{u.name} {isSelf && <span className="text-xs text-orange-400">(siz)</span>}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {role && (
                      <span className="flex items-center gap-1.5 w-fit px-2 py-1 rounded-lg text-xs font-medium" style={{ background: `${role.color}15`, color: role.color }}>
                        {role.icon} {role.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {branches.find(b => b.id === u.branch_id)?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('badge', u.is_active ? 'badge-ready' : 'badge-cancelled')}>
                      {u.is_active ? '✅ Aktif' : '❌ Pasif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(u.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-slate-600 text-slate-400 hover:text-white transition-colors" title="Düzenle">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {!isSelf && (
                        <>
                          <button onClick={() => handleToggle(u)} className={clsx('p-1.5 rounded-lg text-slate-400 transition-colors', u.is_active ? 'hover:bg-yellow-500/20 hover:text-yellow-400' : 'hover:bg-green-500/20 hover:text-green-400')} title={u.is_active ? 'Devre Dışı Bırak' : 'Aktif Et'}>
                            <Shield className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors" title="Sil">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center text-slate-500">Kullanıcı bulunamadı</div>
        )}
      </div>

      {/* Kullanıcı Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 animate-slide-in">
            <h2 className="text-lg font-bold text-white mb-5">{editing ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</h2>
            <div className="space-y-4">
              <div><label className="text-sm text-slate-300 block mb-1.5">Ad Soyad *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ali Yılmaz" />
              </div>
              <div><label className="text-sm text-slate-300 block mb-1.5">E-posta *</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ali@restoran.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm text-slate-300 block mb-1.5">Rol *</label>
                  <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
                  </select>
                </div>
                <div><label className="text-sm text-slate-300 block mb-1.5">Şube</label>
                  <select className="input" value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}>
                    <option value="">Tüm Şubeler</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="text-sm text-slate-300 block mb-1.5">Telefon</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0532 xxx xx xx" />
              </div>
              <div><label className="text-sm text-slate-300 block mb-1.5">{editing ? 'Yeni Şifre (boş bırakılırsa değişmez)' : 'Şifre *'}</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input pr-10"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 6 karakter"
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
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

const DEMO_USERS: UserItem[] = [
  { id: 'u1', name: 'Admin Kullanıcı', email: 'admin@restoran.com', role: 'admin', is_active: true, created_at: '2026-01-01' },
  { id: 'u2', name: 'Ali Garson', email: 'ali@restoran.com', role: 'waiter', phone: '0532 111 22 33', is_active: true, created_at: '2026-02-15' },
  { id: 'u3', name: 'Fatma Mutfak', email: 'fatma@restoran.com', role: 'kitchen', is_active: true, created_at: '2026-02-20' },
  { id: 'u4', name: 'Mehmet Kurye', email: 'mehmet@restoran.com', role: 'courier', phone: '0545 444 55 66', is_active: false, created_at: '2026-03-01' },
];
