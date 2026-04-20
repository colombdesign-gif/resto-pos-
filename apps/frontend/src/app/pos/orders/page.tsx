'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ClipboardList, RefreshCw, Loader2, Filter, Eye, X, CreditCard } from 'lucide-react';
import dayjs from 'dayjs';
import PaymentModal from '@/components/pos/PaymentModal';

interface Order { id: string; order_number: number; type: string; status: string; table_id?: string; total: number; paid_amount: number; created_at: string; items: any[]; waiter_id?: string; }

const STATUS_STYLE: Record<string, string> = {
  pending: 'badge-pending', confirmed: 'badge-preparing', preparing: 'badge-preparing',
  ready: 'badge-ready', delivered: 'badge-delivered', closed: 'badge-closed', cancelled: 'badge-cancelled',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor',
  ready: 'Hazır', delivered: 'Teslim', closed: 'Kapatıldı', cancelled: 'İptal',
};
const TYPE_LABELS: Record<string, string> = { dine_in: '🪑 Masa', takeaway: '📦 Paket', delivery: '🛵 Teslimat', qr: '📱 QR' };

export default function OrdersPage() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Order | null>(null);
  const [payOrder, setPayOrder] = useState<Order | null>(null);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/orders', { params: { date, status: filter === 'all' ? undefined : filter } });
      setOrders(res.data || res);
    } catch { setOrders(DEMO_ORDERS); } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [filter, date]);

  const handleStatusUpdate = async (orderId: string, status: string) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      if (selected?.id === orderId) setSelected(prev => prev ? { ...prev, status } : null);
      toast.success(`Durum güncellendi: ${STATUS_LABELS[status]}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const STATUSES = ['all', 'pending', 'preparing', 'ready', 'closed', 'cancelled'];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-dark-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-orange-400" /></div>
          <div>
            <h1 className="text-xl font-bold text-white">Siparişler</h1>
            <p className="text-sm text-slate-400">{orders.length} sipariş</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className="input py-1.5 text-sm w-auto" value={date} onChange={e => setDate(e.target.value)} />
          <button onClick={fetch} className="btn-secondary p-2.5"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Filtre */}
      <div className="flex gap-1.5 px-4 py-3 border-b border-slate-700/30 overflow-x-auto">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all', filter === s ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
            {s === 'all' ? '📋 Tümü' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <ClipboardList className="w-16 h-16 text-slate-700 mb-3" />
            <p>Sipariş bulunamadı</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-dark-800">
              <tr className="border-b border-slate-700/50">
                {['#', 'Tür', 'Ürünler', 'Tutar', 'Durum', 'Saat', 'İşlem'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-700/10 transition-colors">
                  <td className="px-4 py-3 font-bold text-white">#{order.order_number}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">{TYPE_LABELS[order.type] || order.type}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{order.items?.length || 0} ürün</td>
                  <td className="px-4 py-3 font-bold text-orange-400">₺{Number(order.total).toFixed(2)}</td>
                  <td className="px-4 py-3"><span className={clsx('badge', STATUS_STYLE[order.status])}>{STATUS_LABELS[order.status] || order.status}</span></td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{dayjs(order.created_at).format('HH:mm')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setSelected(order)} className="p-1.5 rounded-lg hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"><Eye className="w-4 h-4" /></button>
                      {!['closed', 'cancelled'].includes(order.status) && (
                        <button onClick={() => setPayOrder(order)} className="p-1.5 rounded-lg hover:bg-green-500/20 text-slate-400 hover:text-green-400 transition-colors"><CreditCard className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sipariş Detay Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="glass-card w-full max-w-lg p-0 overflow-hidden animate-slide-in max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
              <div>
                <h2 className="text-lg font-bold text-white">Sipariş #{selected.order_number}</h2>
                <span className={clsx('badge mt-1', STATUS_STYLE[selected.status])}>{STATUS_LABELS[selected.status]}</span>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-slate-700 transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-2 mb-5">
                {selected.items?.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/50">
                    <span className="w-6 h-6 rounded-md bg-orange-500 text-white text-xs flex items-center justify-center font-bold">{item.quantity}</span>
                    <span className="flex-1 text-sm text-white">{item.product_name || item.product_id}</span>
                    <span className="text-sm font-semibold text-orange-400">₺{Number(item.total_price).toFixed(2)}</span>
                    <span className={clsx('badge text-xs', STATUS_STYLE[item.status])}>{item.status}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-700/50 mb-4">
                <span className="font-bold text-white">Toplam</span>
                <span className="text-xl font-bold text-orange-400">₺{Number(selected.total).toFixed(2)}</span>
              </div>
              {/* Durum güncelleme */}
              {!['closed', 'cancelled'].includes(selected.status) && (
                <div className="grid grid-cols-2 gap-2">
                  {[{ to: 'confirmed', label: '✅ Onayla', show: selected.status === 'pending' },
                    { to: 'preparing', label: '🍳 Hazırlamaya Başla', show: selected.status === 'confirmed' },
                    { to: 'ready', label: '✅ Hazır', show: selected.status === 'preparing' },
                    { to: 'delivered', label: '🛵 Teslim Et', show: selected.status === 'ready' },
                    { to: 'cancelled', label: '❌ İptal Et', show: true }
                  ].filter(a => a.show).map(action => (
                    <button key={action.to} onClick={() => handleStatusUpdate(selected.id, action.to)} className={clsx('py-2.5 rounded-xl text-sm font-medium transition-colors', action.to === 'cancelled' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30')}>
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {payOrder && (
        <PaymentModal order={payOrder} onClose={() => setPayOrder(null)} onSuccess={updated => { setOrders(p => p.map(o => o.id === updated.id ? updated : o)); setPayOrder(null); toast.success('Ödeme alındı'); }} />
      )}
    </div>
  );
}

const DEMO_ORDERS: Order[] = [
  { id: 'o1', order_number: 1042, type: 'dine_in', status: 'preparing', table_id: 't1', total: 445, paid_amount: 0, created_at: new Date(Date.now() - 15 * 60000).toISOString(), items: [{ id: 'i1', product_name: 'Izgara Tavuk', quantity: 2, total_price: 360, status: 'preparing' }, { id: 'i2', product_name: 'Ayran', quantity: 2, total_price: 50, status: 'ready' }] },
  { id: 'o2', order_number: 1043, type: 'takeaway', status: 'ready', total: 220, paid_amount: 0, created_at: new Date(Date.now() - 25 * 60000).toISOString(), items: [{ id: 'i3', product_name: 'Karışık Pizza', quantity: 1, total_price: 220, status: 'ready' }] },
  { id: 'o3', order_number: 1041, type: 'dine_in', status: 'closed', table_id: 't2', total: 180, paid_amount: 180, created_at: new Date(Date.now() - 60 * 60000).toISOString(), items: [] },
];
