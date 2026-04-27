'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Clock, CheckCircle, ChefHat, Loader2, RefreshCw, Bell, Filter } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/tr';

dayjs.extend(relativeTime);
dayjs.locale('tr');

interface KitchenOrder {
  id: string;
  order_number: number;
  type: string;
  status: string;
  table_name?: string;
  customer_note?: string;
  kitchen_note?: string;
  created_at: string;
  items: {
    id: string;
    product_name: string;
    quantity: number;
    status: string;
    notes?: string;
    modifiers?: any[];
    station_id?: string;
  }[];
}

const TYPE_LABELS: Record<string, string> = {
  dine_in: '🪑 Masa',
  takeaway: '📦 Paket',
  delivery: '🛵 Teslimat',
  qr: '📱 QR',
};

export default function KitchenPage() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'preparing' | 'ready'>('all');
  const [branchId, setBranchId] = useState<string>('');

  const fetchOrders = useCallback(async () => {
    if (!branchId) return;
    try {
      const res: any = await api.get('/kitchen/orders', { params: { branchId } });
      setOrders(res.data || res);
    } catch {
      setOrders(DEMO_KITCHEN_ORDERS);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    // İlk şubeyi al
    api.get('/branches').then((res: any) => {
      const list = res.data || res;
      if (list[0]) setBranchId(list[0].id);
    }).catch(() => {
      setBranchId('demo');
      setOrders(DEMO_KITCHEN_ORDERS);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (branchId) {
      fetchOrders();
      // WebSocket odasına katıl (Mutfak bildirimlerini almak için)
      const socket = getSocket();
      socket.emit('join_branch', { branchId });
    }

    const socket = getSocket();

    socket.on('kitchen.new_order', (order: KitchenOrder) => {
      setOrders((prev) => [order, ...prev]);
      toast('🔔 Yeni sipariş!', { icon: '🍳', duration: 5000 });
      // Ses çal (tarayıcı izin gerektiriyor)
      try { new Audio('/sounds/bell.mp3').play(); } catch {}
    });

    socket.on('kitchen.new_items', ({ orderId, items }) => {
      setOrders((prev) =>
        prev.map((o) => o.id === orderId ? { ...o, items: [...o.items, ...items] } : o)
      );
      toast('➕ Siparişe ürün eklendi', { icon: '📋' });
    });

    socket.on('order.status_changed', (order: any) => {
      // Eğer sipariş kapandıysa, iptal edildiyse veya teslim edildiyse KDS'den kaldır
      if (['closed', 'cancelled', 'delivered', 'served'].includes(order.status)) {
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
      }
    });

    socket.on('kitchen.order_updated', (order: KitchenOrder) => {
      setOrders((prev) => {
        // Eğer sipariş zaten listedeyse güncelle, değilse ve uygun durumdaysa ekle
        const exists = prev.find(o => o.id === order.id);
        if (exists) {
          // Eğer yeni durum listede olmaması gereken bir durumsa (örn: delivered) listeden çıkar
          if (['closed', 'cancelled', 'delivered', 'served'].includes(order.status)) {
             return prev.filter(o => o.id !== order.id);
          }
          return prev.map(o => o.id === order.id ? order : o);
        } else {
          // Sadece bekleyen/hazırlanan siparişleri listeye ekle
          if (['pending', 'confirmed', 'preparing', 'ready'].includes(order.status)) {
            return [order, ...prev];
          }
          return prev;
        }
      });
    });

    return () => {
      socket.off('kitchen.new_order');
      socket.off('kitchen.new_items');
      socket.off('order.status_changed');
      socket.off('kitchen.order_updated');
    };
  }, [branchId, fetchOrders]);

  const handleStartPreparing = async (orderId: string) => {
    try {
      await api.post(`/kitchen/orders/${orderId}/start`);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: 'preparing', items: o.items.map(i => ({ ...i, status: 'preparing' })) }
            : o
        )
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleItemReady = async (itemId: string, orderId: string) => {
    try {
      await api.patch(`/kitchen/items/${itemId}/status`, { status: 'ready' });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
              ...o,
              items: o.items.map((i) => i.id === itemId ? { ...i, status: 'ready' } : i),
            }
            : o
        )
      );
      toast.success('Ürün hazır işaretlendi');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleOrderReady = async (orderId: string) => {
    // Tüm ürünleri hazır yap
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    for (const item of order.items.filter((i) => i.status !== 'ready' && i.status !== 'cancelled')) {
      await handleItemReady(item.id, orderId);
    }
    toast.success('Tüm sipariş hazır! 🎉');
  };

  const getElapsedTime = (createdAt: string) => {
    const minutes = dayjs().diff(dayjs(createdAt), 'minute');
    return minutes;
  };

  const getTimeColor = (minutes: number) => {
    if (minutes < 10) return 'text-green-400';
    if (minutes < 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return o.status === 'pending';
    if (filter === 'preparing') return o.status === 'preparing';
    if (filter === 'ready') return o.status === 'ready';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-dark-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-dark-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Mutfak Ekranı (KDS)</h1>
            <p className="text-sm text-slate-400">{filteredOrders.length} bekleyen sipariş</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filtre */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
            {[
              { id: 'all', label: 'Tümü' },
              { id: 'pending', label: 'Bekliyor' },
              { id: 'preparing', label: 'Hazırlanıyor' },
              { id: 'ready', label: 'Hazır' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  filter === f.id ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button onClick={fetchOrders} className="btn-secondary p-2.5">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Siparişler grid */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <ChefHat className="w-20 h-20 text-slate-700 mb-4" />
          <h3 className="text-xl font-semibold text-slate-400">Bekleyen Sipariş Yok</h3>
          <p className="text-slate-600 mt-2">Yeni siparişler burada görünecek</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
          {filteredOrders.map((order) => {
            const elapsed = getElapsedTime(order.created_at);
            const allReady = order.items.filter(i => i.status !== 'cancelled').every(i => i.status === 'ready');
            const isPending = order.status === 'pending';

            return (
              <div
                key={order.id}
                className={clsx('kds-ticket', {
                  'new': isPending,
                  'ready': allReady || order.status === 'ready',
                })}
              >
                {/* Ticket header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white">#{order.order_number}</span>
                      <span className="badge badge-pending text-xs">
                        {TYPE_LABELS[order.type] || order.type}
                      </span>
                    </div>
                    {order.table_name && (
                      <div className="text-sm text-slate-400 mt-0.5">{order.table_name}</div>
                    )}
                  </div>
                  <div className={clsx('flex items-center gap-1 text-sm font-bold', getTimeColor(elapsed))}>
                    <Clock className="w-3.5 h-3.5" />
                    {elapsed}dk
                  </div>
                </div>

                {/* Ürünler */}
                <div className="space-y-2 mb-3">
                  {order.items
                    .filter((i) => i.status !== 'cancelled')
                    .map((item) => (
                      <div
                        key={item.id}
                        className={clsx(
                          'flex items-center gap-2 p-2 rounded-lg transition-all',
                          item.status === 'ready' ? 'bg-green-500/10 opacity-60' : 'bg-slate-700/50'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-orange-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                              {item.quantity}
                            </span>
                            <span className={clsx(
                              'text-sm font-medium truncate',
                              item.status === 'ready' ? 'text-green-400 line-through' : 'text-white'
                            )}>
                              {item.product_name}
                            </span>
                          </div>
                          {item.notes && (
                            <div className="text-xs text-yellow-400 mt-0.5 pl-6">📝 {item.notes}</div>
                          )}
                        </div>
                        {item.status !== 'ready' ? (
                          <button
                            onClick={() => handleItemReady(item.id, order.id)}
                            className="w-7 h-7 rounded-lg bg-slate-600 hover:bg-green-500 flex items-center justify-center transition-colors flex-shrink-0"
                          >
                            <CheckCircle className="w-4 h-4 text-slate-300" />
                          </button>
                        ) : (
                          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                </div>

                {/* Not */}
                {order.customer_note && (
                  <div className="text-xs text-yellow-300 bg-yellow-500/10 rounded-lg px-3 py-2 mb-3 border border-yellow-500/20">
                    📝 {order.customer_note}
                  </div>
                )}

                {/* Aksiyonlar */}
                <div className="flex gap-2">
                  {isPending && (
                    <button
                      onClick={() => handleStartPreparing(order.id)}
                      className="flex-1 py-2 rounded-xl bg-orange-500/20 text-orange-400 text-sm font-semibold hover:bg-orange-500/30 transition-colors border border-orange-500/30"
                    >
                      🍳 Başla
                    </button>
                  )}
                  {!allReady && order.status === 'preparing' && (
                    <button
                      onClick={() => handleOrderReady(order.id)}
                      className="flex-1 py-2 rounded-xl bg-green-500/20 text-green-400 text-sm font-semibold hover:bg-green-500/30 transition-colors border border-green-500/30"
                    >
                      ✅ Hazır
                    </button>
                  )}
                  {allReady && (
                    <button
                      onClick={async () => {
                        try {
                          // Tüm ürünleri 'served' (servis edildi) yap ki KDS'den kalıcı olarak düşsün
                          for (const item of order.items) {
                            if (item.status !== 'cancelled') {
                              await api.patch(`/kitchen/items/${item.id}/status`, { status: 'served' });
                            }
                          }
                          setOrders(prev => prev.filter(o => o.id !== order.id));
                          toast.success('Sipariş tamamlandı ve mutfaktan kaldırıldı');
                        } catch (err: any) {
                          toast.error('Hata oluştu: ' + err.message);
                        }
                      }}
                      className="flex-1 py-2 rounded-xl bg-blue-500/20 text-blue-400 text-sm font-semibold hover:bg-blue-500/30 transition-colors border border-blue-500/30"
                    >
                      🏁 Tamamla ve Kapat
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Demo verisi
const DEMO_KITCHEN_ORDERS: KitchenOrder[] = [
  {
    id: 'o1', order_number: 1042, type: 'dine_in', status: 'pending',
    table_name: 'Masa 3', created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    items: [
      { id: 'i1', product_name: 'Izgara Tavuk', quantity: 2, status: 'pending' },
      { id: 'i2', product_name: 'Çoban Salatası', quantity: 1, status: 'pending', notes: 'Soğansız' },
    ]
  },
  {
    id: 'o2', order_number: 1043, type: 'takeaway', status: 'preparing',
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
    items: [
      { id: 'i3', product_name: 'Karışık Pizza', quantity: 1, status: 'preparing' },
      { id: 'i4', product_name: 'Kola', quantity: 2, status: 'ready' },
    ]
  },
  {
    id: 'o3', order_number: 1044, type: 'dine_in', status: 'pending',
    table_name: 'Masa 7', created_at: new Date(Date.now() - 2 * 60000).toISOString(),
    customer_note: 'Çocuk için hafif olsun',
    items: [
      { id: 'i5', product_name: 'Bonfile Steak', quantity: 1, status: 'pending' },
      { id: 'i6', product_name: 'Mercimek Çorbası', quantity: 2, status: 'pending' },
    ]
  },
];
