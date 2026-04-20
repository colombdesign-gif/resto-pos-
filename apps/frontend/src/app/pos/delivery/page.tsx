'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ArrowLeft, Truck, MapPin, User, Phone, Clock, RefreshCw, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Delivery { id: string; order_number: number; status: string; address: string; city?: string; district?: string; courier_name?: string; created_at: string; estimated_minutes?: number; total: number; }

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  waiting:   { label: 'Bekliyor',      color: '#f59e0b', icon: '⏳' },
  assigned:  { label: 'Kurye Atandı', color: '#3b82f6', icon: '👤' },
  picked_up: { label: 'Yolda',        color: '#8b5cf6', icon: '🛵' },
  delivered: { label: 'Teslim Edildi', color: '#22c55e', icon: '✅' },
  failed:    { label: 'Başarısız',    color: '#ef4444', icon: '❌' },
};

export default function DeliveryPage() {
  const { user } = useAuthStore();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetch = async () => {
    try {
      const res: any = await api.get('/deliveries', { params: user?.role === 'courier' ? { courierId: user.id } : {} });
      setDeliveries(res.data || res);
    } catch { setDeliveries(DEMO_DELIVERIES); } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); const t = setInterval(fetch, 30000); return () => clearInterval(t); }, []);

  const filtered = deliveries.filter(d => filter === 'all' ? true : d.status === filter);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/deliveries/${id}/status`, { status });
      setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status } : d));
      toast.success(`Durum güncellendi: ${STATUS_MAP[status]?.label}`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-dark-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><Truck className="w-5 h-5 text-blue-400" /></div>
          <div>
            <h1 className="text-xl font-bold text-white">Teslimat Takip</h1>
            <p className="text-sm text-slate-400">{filtered.length} teslimat</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
            {['all', 'waiting', 'assigned', 'picked_up', 'delivered'].map(s => (
              <button key={s} onClick={() => setFilter(s)} className={clsx('px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all', filter === s ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white')}>
                {s === 'all' ? 'Tümü' : STATUS_MAP[s]?.icon}
              </button>
            ))}
          </div>
          <button onClick={fetch} className="btn-secondary p-2.5"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
        {loading ? (
          <div className="col-span-3 flex items-center justify-center h-40"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        ) : filtered.map(d => {
          const status = STATUS_MAP[d.status] || STATUS_MAP.waiting;
          return (
            <div key={d.id} className="card border" style={{ borderColor: `${status.color}30` }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-lg font-bold text-white">#{d.order_number}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-base">{status.icon}</span>
                    <span className="text-sm font-medium" style={{ color: status.color }}>{status.label}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-orange-400">₺{Number(d.total).toFixed(2)}</div>
                  {d.estimated_minutes && <div className="flex items-center gap-1 text-xs text-slate-400 mt-1"><Clock className="w-3 h-3" />{d.estimated_minutes} dk</div>}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-300"><MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" /><span className="truncate">{d.address}{d.district ? `, ${d.district}` : ''}</span></div>
                {d.courier_name && <div className="flex items-center gap-2 text-sm text-slate-300"><User className="w-4 h-4 text-slate-400 flex-shrink-0" />{d.courier_name}</div>}
              </div>

              {/* Aksiyon butonları */}
              <div className="flex gap-2">
                {d.status === 'waiting' && user?.role !== 'courier' && (
                  <button onClick={() => handleUpdateStatus(d.id, 'assigned')} className="flex-1 py-2 rounded-xl bg-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-colors">
                    Kurye Ata
                  </button>
                )}
                {d.status === 'assigned' && (
                  <button onClick={() => handleUpdateStatus(d.id, 'picked_up')} className="flex-1 py-2 rounded-xl bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors">
                    🛵 Yola Çıktı
                  </button>
                )}
                {d.status === 'picked_up' && (
                  <button onClick={() => handleUpdateStatus(d.id, 'delivered')} className="flex-1 py-2 rounded-xl bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors">
                    ✅ Teslim Edildi
                  </button>
                )}
                {d.status === 'delivered' && (
                  <div className="flex-1 py-2 rounded-xl bg-green-500/10 text-green-400 text-sm font-medium text-center">Teslim Edildi</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DEMO_DELIVERIES: Delivery[] = [
  { id: 'd1', order_number: 1045, status: 'waiting', address: 'Bağdat Cad. No:42, D:5', city: 'İstanbul', district: 'Kadıköy', created_at: new Date().toISOString(), total: 185, estimated_minutes: 30 },
  { id: 'd2', order_number: 1046, status: 'picked_up', address: 'Moda Cad. No:18', city: 'İstanbul', district: 'Kadıköy', courier_name: 'Ali Kaya', created_at: new Date().toISOString(), total: 220, estimated_minutes: 12 },
  { id: 'd3', order_number: 1043, status: 'delivered', address: 'Söğütlüçeşme No:7', city: 'İstanbul', district: 'Kadıköy', courier_name: 'Mehmet Öz', created_at: new Date().toISOString(), total: 95 },
];
