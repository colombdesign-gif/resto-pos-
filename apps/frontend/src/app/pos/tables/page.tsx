'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Plus, RefreshCw, Users, Clock, ChevronDown,
  Circle, Square, Loader2, Filter, LayoutGrid, Zap
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
}

const STATUS_CONFIG = {
  available: { label: 'Boş', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: '#22c55e' },
  occupied:  { label: 'Dolu', color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: '#f97316' },
  reserved:  { label: 'Rezerve', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: '#3b82f6' },
  cleaning:  { label: 'Temizleniyor', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: '#f59e0b' },
};

export default function TablesPage() {
  const router = useRouter();
  const { user, tenant } = useAuthStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Şube ID'sini user'dan al (gerçekte branch selector olacak)
  const branchId = user?.tenant_id; // Demo: ilk şube

  const fetchTables = useCallback(async () => {
    if (!branchId) return;
    try {
      setLoading(true);
      // İlk şubeyi al
      const branches: any = await api.get('/branches');
      const branchList = branches.data || branches;
      if (!branchList.length) { setLoading(false); return; }
      const firstBranch = branchList[0];

      const res: any = await api.get(`/tables/branch/${firstBranch.id}?_t=${Date.now()}`);
      setTables(res.data || res);
    } catch {
      // Demo verisi göster
      setTables(DEMO_TABLES);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchTables();
    const socket = getSocket();
    socket.on('table.status_changed', (updated: Table) => {
      setTables((prev) => prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t));
    });
    return () => { socket.off('table.status_changed'); };
  }, [fetchTables]);

  // Drag & Drop (masa pozisyonu)
  const handleMouseDown = (e: React.MouseEvent, tableId: string) => {
    if (user?.role === 'kitchen' || user?.role === 'courier') return;
    setDragging(tableId);
    const table = tables.find((t) => t.id === tableId)!;
    setDragOffset({ x: e.clientX - table.position_x, y: e.clientY - table.position_y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setTables((prev) =>
      prev.map((t) =>
        t.id === dragging
          ? { ...t, position_x: e.clientX - dragOffset.x, position_y: e.clientY - dragOffset.y }
          : t,
      ),
    );
  };

  const handleMouseUp = async () => {
    if (!dragging) return;
    const table = tables.find((t) => t.id === dragging);
    if (table) {
      try {
        await api.patch(`/tables/${table.id}`, {
          position_x: table.position_x,
          position_y: table.position_y,
        });
      } catch {}
    }
    setDragging(null);
  };

  const handleTableClick = (table: Table) => {
    if (dragging) return;
    router.push(`/pos/order/${table.id}`);
  };

  const filteredTables = filter === 'all' ? tables : tables.filter((t) => t.status === filter);

  const stats = {
    total: tables.length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    available: tables.filter((t) => t.status === 'available').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
  };

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
          <h1 className="text-xl font-bold text-white">Masa Planı</h1>
          <p className="text-sm text-slate-400">{stats.occupied} / {stats.total} masa dolu</p>
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

          <button onClick={fetchTables} className="btn-secondary p-2.5">
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
      <div className="flex gap-4 px-6 py-3 border-b border-slate-700/30">
        {[
          { label: 'Toplam Masa', value: stats.total, color: 'text-slate-300' },
          { label: 'Boş', value: stats.available, color: 'text-green-400' },
          { label: 'Dolu', value: stats.occupied, color: 'text-orange-400' },
          { label: 'Rezerve', value: stats.reserved, color: 'text-blue-400' },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <div className={clsx('text-2xl font-bold', s.color)}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Kat planı canvas */}
      <div
        className="flex-1 relative overflow-auto bg-dark-900"
        style={{ backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
              <LayoutGrid className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-300">Masa Bulunamadı</h3>
            <p className="text-slate-500 max-w-xs mt-2">Admin panelinden masa ekleyerek başlayın.</p>
          </div>
        ) : (
          filteredTables.map((table) => {
            const cfg = STATUS_CONFIG[table.status];
            return (
              <div
                key={table.id}
                className={clsx(
                  'absolute flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-150',
                  dragging === table.id && 'opacity-80 scale-105 z-50',
                  table.shape === 'circle' ? 'rounded-full' : 'rounded-2xl',
                )}
                style={{
                  left: table.position_x,
                  top: table.position_y,
                  width: table.width || 100,
                  height: table.height || 80,
                  backgroundColor: cfg.bg,
                  border: `2px solid ${cfg.border}`,
                  boxShadow: dragging === table.id
                    ? `0 20px 40px ${cfg.border}40`
                    : `0 4px 15px ${cfg.border}25`,
                }}
                onMouseDown={(e) => handleMouseDown(e, table.id)}
                onClick={() => handleTableClick(table)}
              >
                <div className="text-sm font-bold text-white">{table.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Users className="w-3 h-3" style={{ color: cfg.color }} />
                  <span className="text-xs" style={{ color: cfg.color }}>{table.capacity}</span>
                </div>
                <div
                  className="absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-dark-900"
                  style={{ backgroundColor: cfg.color }}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Demo masaları (API bağlanana kadar gösterilir)
const DEMO_TABLES: Table[] = [
  { id: '1', name: 'Masa 1', capacity: 4, status: 'available', position_x: 80, position_y: 80, width: 100, height: 80, shape: 'rectangle' },
  { id: '2', name: 'Masa 2', capacity: 2, status: 'occupied', position_x: 220, position_y: 80, width: 100, height: 80, shape: 'rectangle' },
  { id: '3', name: 'Masa 3', capacity: 6, status: 'reserved', position_x: 360, position_y: 80, width: 120, height: 80, shape: 'rectangle' },
  { id: '4', name: 'Masa 4', capacity: 4, status: 'available', position_x: 80, position_y: 220, width: 100, height: 80, shape: 'rectangle' },
  { id: '5', name: 'Masa 5', capacity: 2, status: 'occupied', position_x: 220, position_y: 220, width: 80, height: 80, shape: 'circle' },
  { id: '6', name: 'Masa 6', capacity: 8, status: 'available', position_x: 360, position_y: 220, width: 140, height: 90, shape: 'rectangle' },
  { id: '7', name: 'Bar 1', capacity: 2, status: 'occupied', position_x: 80, position_y: 360, width: 80, height: 60, shape: 'rectangle' },
  { id: '8', name: 'Bar 2', capacity: 2, status: 'available', position_x: 180, position_y: 360, width: 80, height: 60, shape: 'rectangle' },
  { id: '9', name: 'VIP',  capacity: 10, status: 'reserved', position_x: 520, position_y: 100, width: 160, height: 120, shape: 'rectangle' },
];
