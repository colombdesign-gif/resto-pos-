'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { getSocket } from '@/lib/socket';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Plus, RefreshCw, Users, Clock,
  Loader2, LayoutGrid, Zap, Coffee, Circle
} from 'lucide-react';

interface Table {
  id: string;
  name: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  shape: string;
  floor_plan_id?: string;
  active_order?: {
    order_number: number;
    total: number;
    created_at: string;
    item_count?: number;
  };
}

const STATUS_CONFIG = {
  available: { label: 'Boş',          color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.4)',   badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
  occupied:  { label: 'Dolu',         color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.4)',  badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  reserved:  { label: 'Rezerve',      color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.4)',  badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  cleaning:  { label: 'Temizleniyor', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.4)', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
};

export default function TablesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentBranchId, branches, setBranches, setCurrentBranch } = useBranchStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchTables = useCallback(async (bId?: string) => {
    const targetId = bId || currentBranchId;
    if (!targetId) return;
    try {
      setLoading(true);
      const res: any = await api.get(`/tables/branch/${targetId}?_t=${Date.now()}`);
      setTables(res.data || res);
    } catch {
      setTables(DEMO_TABLES);
    } finally {
      setLoading(false);
    }
  }, [currentBranchId]);

  useEffect(() => {
    // Şubeleri yükle
    api.get('/branches').then((res: any) => {
      const list = res.data || res;
      setBranches(list);
      
      // Eğer seçili şube yoksa varsayılanı ayarla
      if (!currentBranchId || !list.find((b: any) => b.id === currentBranchId)) {
        const defaultBranch = user?.branch_id || list[0]?.id;
        if (defaultBranch) setCurrentBranch(defaultBranch);
      }
    });
  }, [user?.branch_id]);

  useEffect(() => {
    if (currentBranchId) fetchTables();
    
    const socket = getSocket();
    socket.on('table.status_changed', (updated: Table) => {
      // Sadece şu anki şubedeki masaları güncelle
      setTables((prev) => prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t));
    });
    return () => { socket.off('table.status_changed'); };
  }, [currentBranchId, fetchTables]);

  const filteredTables = filter === 'all' ? tables : tables.filter((t) => t.status === filter);

  const stats = {
    total:    tables.length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    available:tables.filter((t) => t.status === 'available').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
  };

  function elapsedTime(createdAt?: string) {
    if (!createdAt) return '';
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (diff < 60) return `${diff} dk`;
    return `${Math.floor(diff / 60)} sa ${diff % 60} dk`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-3" />
          <p className="text-slate-400">Masalar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-dark-800/50 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Masa Planı</h1>
            {branches.length > 1 && (
              <select 
                value={currentBranchId || ''} 
                onChange={(e) => setCurrentBranch(e.target.value)}
                className="ml-3 bg-slate-800 border-none text-orange-400 text-xs font-bold rounded-lg px-2 py-1 focus:ring-1 focus:ring-orange-500/50 cursor-pointer"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            {branches.length === 1 && (
              <span className="ml-3 text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-lg border border-orange-500/20">
                {branches[0].name}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">{stats.occupied} / {stats.total} masa dolu</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filtre */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
            {['all', 'available', 'occupied', 'reserved'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  filter === s ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                {s === 'all' ? 'Tümü' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => router.push('/pos/quick-sale')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-dark-900 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 transition-all shadow-lg shadow-orange-500/20"
          >
            <Zap className="w-4 h-4" />
            Hızlı Satış
          </button>

          <button onClick={() => fetchTables()} className="btn-secondary p-2.5">
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => toast('Masa ekleme özelliği admin panelinde', { icon: 'ℹ️' })}
            className="btn-primary py-2.5"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:block">Masa Ekle</span>
          </button>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="flex gap-6 px-6 py-3 border-b border-slate-700/30">
        {[
          { label: 'Toplam', value: stats.total,    color: 'text-slate-300', dot: '#94a3b8' },
          { label: 'Boş',    value: stats.available, color: 'text-green-400', dot: '#22c55e' },
          { label: 'Dolu',   value: stats.occupied,  color: 'text-orange-400',dot: '#f97316' },
          { label: 'Rezerve',value: stats.reserved,  color: 'text-blue-400',  dot: '#3b82f6' },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
            <span className={clsx('text-lg font-bold', s.color)}>{s.value}</span>
            <span className="text-xs text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Masa Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
              <LayoutGrid className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-300">Masa Bulunamadı</h3>
            <p className="text-slate-500 max-w-xs mt-2">Admin panelinden masa ekleyerek başlayın.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredTables.map((table) => {
              const cfg = STATUS_CONFIG[table.status];
              const isOccupied = table.status === 'occupied';

              return (
                <button
                  key={table.id}
                  onClick={() => router.push(`/pos/order/${table.id}`)}
                  className={clsx(
                    'relative flex flex-col items-center justify-between p-4 rounded-2xl border transition-all duration-200 text-left group',
                    'hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]',
                    table.shape === 'circle' ? 'rounded-full aspect-square' : 'rounded-2xl',
                  )}
                  style={{
                    backgroundColor: cfg.bg,
                    borderColor: cfg.border,
                    boxShadow: isOccupied ? `0 4px 20px ${cfg.color}20` : 'none',
                  }}
                >
                  {/* Durum göstergesi */}
                  <div
                    className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
                  />

                  {/* Masa adı */}
                  <div className="w-full">
                    <div className="text-sm font-bold text-white truncate pr-4">{table.name}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3 flex-shrink-0" style={{ color: cfg.color }} />
                      <span className="text-xs" style={{ color: cfg.color }}>{table.capacity} kişi</span>
                    </div>
                  </div>

                  {/* Dolu masa bilgisi */}
                  {isOccupied && table.active_order ? (
                    <div className="w-full mt-3 pt-3 border-t border-slate-700/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">#{table.active_order.order_number}</span>
                        <div className="flex items-center gap-1 text-[10px] text-orange-300">
                          <Clock className="w-2.5 h-2.5" />
                          {elapsedTime(table.active_order.created_at)}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-orange-400">
                        ₺{Number(table.active_order.total).toFixed(0)}
                      </div>
                    </div>
                  ) : (
                    <div className={clsx('mt-3 self-start text-[10px] font-semibold px-2 py-0.5 rounded-full border', cfg.badge)}>
                      {cfg.label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Demo masaları (API bağlanana kadar gösterilir)
const DEMO_TABLES: Table[] = [
  { id: '1', name: 'Masa 1', capacity: 4, status: 'available', position_x: 0, position_y: 0, width: 100, height: 80, shape: 'rectangle' },
  { id: '2', name: 'Masa 2', capacity: 2, status: 'occupied',  position_x: 0, position_y: 0, width: 100, height: 80, shape: 'rectangle', active_order: { order_number: 42, total: 485, created_at: new Date(Date.now() - 25*60000).toISOString() } },
  { id: '3', name: 'Masa 3', capacity: 6, status: 'reserved',  position_x: 0, position_y: 0, width: 120, height: 80, shape: 'rectangle' },
  { id: '4', name: 'Masa 4', capacity: 4, status: 'available', position_x: 0, position_y: 0, width: 100, height: 80, shape: 'rectangle' },
  { id: '5', name: 'Masa 5', capacity: 2, status: 'occupied',  position_x: 0, position_y: 0, width: 80,  height: 80, shape: 'circle',    active_order: { order_number: 38, total: 210, created_at: new Date(Date.now() - 8*60000).toISOString() } },
  { id: '6', name: 'Masa 6', capacity: 8, status: 'available', position_x: 0, position_y: 0, width: 140, height: 90, shape: 'rectangle' },
  { id: '7', name: 'Bar 1',  capacity: 2, status: 'occupied',  position_x: 0, position_y: 0, width: 80,  height: 60, shape: 'rectangle', active_order: { order_number: 41, total: 315, created_at: new Date(Date.now() - 45*60000).toISOString() } },
  { id: '8', name: 'Bar 2',  capacity: 2, status: 'available', position_x: 0, position_y: 0, width: 80,  height: 60, shape: 'rectangle' },
  { id: '9', name: 'VIP',    capacity: 10, status: 'reserved', position_x: 0, position_y: 0, width: 160, height: 120, shape: 'rectangle' },
];
