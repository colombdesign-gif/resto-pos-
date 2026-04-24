'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useOrderStore } from '@/store/orderStore';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  ArrowLeft, Plus, Minus, Trash2, Send, CreditCard,
  Search, Loader2, ShoppingCart, X,
  CheckCircle2, Clock, ChefHat, Ban, ChevronDown, ChevronUp,
} from 'lucide-react';
import PaymentModal from '@/components/pos/PaymentModal';

interface Product  { id: string; name: string; price: number; category_id: string; image_url?: string; is_available: boolean; }
interface Category { id: string; name: string; icon: string; color: string; }
interface CartItem  { product_id: string; product_name: string; unit_price: number; quantity: number; notes?: string; }

// Grouped active-order item (same product_id + same status → merged)
interface GroupedItem {
  key: string;           // composite key
  product_id: string;
  product_name: string;
  total_price: number;
  quantity: number;      // sum
  status: string;
  ids: string[];         // individual DB item ids (for actions)
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:   { label: 'Bekliyor',       color: 'text-yellow-400',  bg: 'bg-yellow-400/10 border-yellow-400/30', icon: <Clock className="w-3 h-3" /> },
  preparing: { label: 'Hazırlanıyor',   color: 'text-orange-400',  bg: 'bg-orange-400/10 border-orange-400/30', icon: <ChefHat className="w-3 h-3" /> },
  ready:     { label: 'Hazır ★',        color: 'text-blue-300',    bg: 'bg-blue-400/20 border-blue-400/30',     icon: <CheckCircle2 className="w-3 h-3" /> },
  delivered: { label: 'Teslim Edildi',  color: 'text-green-400',   bg: 'bg-green-400/10 border-green-400/30',  icon: <CheckCircle2 className="w-3 h-3" /> },
  served:    { label: 'Teslim Edildi',  color: 'text-green-400',   bg: 'bg-green-400/10 border-green-400/30',  icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled: { label: 'İptal',          color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/30',      icon: <Ban className="w-3 h-3" /> },
};

const ACTIVE_STATUSES   = ['pending', 'preparing', 'ready'];
const DONE_STATUSES     = ['delivered', 'served'];
const CANCEL_STATUSES   = ['cancelled'];

type TabKey = 'active' | 'done' | 'cancelled';
const TABS: { key: TabKey; label: string; statuses: string[] }[] = [
  { key: 'active',    label: 'Aktif',          statuses: ACTIVE_STATUSES },
  { key: 'done',      label: 'Teslim',         statuses: DONE_STATUSES   },
  { key: 'cancelled', label: 'İptal',          statuses: CANCEL_STATUSES },
];

/** Groups raw backend items by product_id + status so duplicates show as "x2" */
function groupItems(items: any[], products: Product[]): GroupedItem[] {
  const map = new Map<string, GroupedItem>();
  for (const item of items) {
    const pName = products.find(p => p.id === item.product_id)?.name
                  || item.product?.name
                  || item.product_name
                  || 'Ürün';
    const key = `${item.product_id}__${item.status}`;
    if (map.has(key)) {
      const g = map.get(key)!;
      g.quantity   += Number(item.quantity ?? 1);
      g.total_price += Number(item.total_price ?? item.unit_price ?? 0);
      g.ids.push(item.id);
    } else {
      map.set(key, {
        key,
        product_id:   item.product_id,
        product_name: pName,
        total_price:  Number(item.total_price ?? item.unit_price ?? 0),
        quantity:     Number(item.quantity ?? 1),
        status:       item.status,
        ids:          [item.id],
      });
    }
  }
  return Array.from(map.values());
}

export default function OrderPage() {
  const params   = useParams();
  const router   = useRouter();
  const tableId  = params.tableId as string;
  const { user } = useAuthStore();
  const { cart, addToCart, removeFromCart, updateCartQuantity, clearCart, submitOrder, currentOrder, setCurrentOrder, addItemsToOrder } = useOrderStore();

  const [categories,       setCategories]       = useState<Category[]>([]);
  const [products,         setProducts]         = useState<Product[]>([]);
  const [activeCategory,   setActiveCategory]   = useState<string>('all');
  const [search,           setSearch]           = useState('');
  const [loading,          setLoading]          = useState(true);
  const [submitting,       setSubmitting]       = useState(false);
  const [showPayment,      setShowPayment]      = useState(false);
  const [tableName,        setTableName]        = useState('');
  const [activeOrder,      setActiveOrder]      = useState<any>(null);
  const [addingToExisting, setAddingToExisting] = useState(false);
  const [branchId,         setBranchId]         = useState<string>('');
  const [cancelModal,      setCancelModal]      = useState<{ ids: string[]; name: string } | null>(null);
  const [cancelReason,     setCancelReason]     = useState('');
  const [cancelling,       setCancelling]       = useState(false);
  const [orderTab,         setOrderTab]         = useState<TabKey>('active');
  const [orderExpanded,    setOrderExpanded]    = useState(true);

  useEffect(() => {
    api.get('/branches').then((res: any) => {
      const list = res.data || res;
      if (list.length > 0 && !branchId) setBranchId(list[0].id);
    }).catch(() => {});

    if (tableId !== 'takeaway' && tableId !== 'delivery') {
      api.get(`/tables/${tableId}`).then((res: any) => {
        const t = res.data || res;
        setTableName(t.name || 'Masa');
        if (t.branch_id) setBranchId(t.branch_id);
      }).catch(() => setTableName('Masa'));

      api.get(`/orders/table/${tableId}/active`).then((res: any) => {
        const order = res.data || res;
        if (order?.id) {
          setActiveOrder(order);
          setCurrentOrder(order);
          setAddingToExisting(true);
        }
      }).catch(() => {});
    } else {
      setTableName(tableId === 'takeaway' ? 'Paket Servis' : 'Teslimat');
    }

    Promise.all([api.get('/menu/categories'), api.get('/menu/products')])
      .then(([catRes, prodRes]: any) => {
        setCategories(catRes.data || catRes);
        setProducts(prodRes.data || prodRes);
      })
      .catch(() => { setCategories(DEMO_CATEGORIES); setProducts(DEMO_PRODUCTS); })
      .finally(() => setLoading(false));

    const socket = getSocket();
    socket.on('order.updated', (updatedOrder: any) => {
      if (updatedOrder.id === activeOrder?.id || updatedOrder.table_id === tableId) {
        setActiveOrder(updatedOrder);
        setCurrentOrder(updatedOrder);
      }
    });
    return () => { socket.off('order.updated'); };
    // eslint-disable-next-line
  }, [tableId]);

  const filteredProducts = products.filter((p) => {
    if (!p.is_available) return false;
    if (activeCategory !== 'all' && p.category_id !== activeCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const cartTotal = cart.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);

  const handleAddProduct = (product: Product) => {
    addToCart({ product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.price });
    const el = document.getElementById(`product-${product.id}`);
    if (el) { el.classList.add('animate-ticker'); setTimeout(() => el.classList.remove('animate-ticker'), 500); }
  };

  const handleSubmitOrder = async () => {
    if (cart.items.length === 0) { toast.error('Sepet boş!'); return; }
    setSubmitting(true);
    try {
      if (activeOrder && addingToExisting) {
        await addItemsToOrder(activeOrder.id, cart.items.map(i => ({
          product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, notes: i.notes,
        })));
        clearCart();
        const res: any = await api.get(`/orders/${activeOrder.id}`);
        setActiveOrder(res.data || res);
        toast.success('Ürünler siparişe eklendi!');
      } else {
        const orderData = {
          branch_id: branchId,
          table_id:  tableId !== 'takeaway' && tableId !== 'delivery' ? tableId : undefined,
          type:      tableId === 'takeaway' ? 'takeaway' : tableId === 'delivery' ? 'delivery' : 'dine_in',
          waiter_id: user?.id,
          items: cart.items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, notes: i.notes })),
        };
        const order = await submitOrder(orderData);
        setActiveOrder(order);
        toast.success(`Sipariş #${order.order_number} oluşturuldu! 🎉`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Sipariş gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateItemStatus = async (itemId: string, newStatus: string) => {
    if (!activeOrder) return;
    try {
      const res: any = await api.patch(`/orders/${activeOrder.id}/items/${itemId}/status`, { status: newStatus });
      setActiveOrder(res.data || res);
      toast.success('Durum güncellendi!');
    } catch {
      toast.error('Durum güncellenemedi');
    }
  };

  const handleCancelItem = async () => {
    if (!activeOrder || !cancelModal) return;
    if (cancelReason.trim().length < 3) { toast.error('Lütfen mantıklı bir sebep girin.'); return; }
    setCancelling(true);
    try {
      // Cancel all grouped item IDs
      let updated: any = null;
      for (const id of cancelModal.ids) {
        const res: any = await api.delete(`/orders/${activeOrder.id}/items/${id}?reason=${encodeURIComponent(cancelReason)}`);
        updated = res.data || res;
      }
      if (updated) setActiveOrder(updated);
      toast.success('Ürün(ler) iptal edildi.');
      setCancelModal(null);
      setCancelReason('');
    } catch (err: any) {
      toast.error(err.message || 'İptal başarısız');
    } finally {
      setCancelling(false);
    }
  };

  // Grouped items for active order
  const allItems    = activeOrder?.items ?? [];
  const grouped     = groupItems(allItems, products);

  const tabItems = (tab: TabKey) =>
    grouped.filter(g => TABS.find(t => t.key === tab)?.statuses.includes(g.status));

  const activeCount    = tabItems('active').length;
  const doneCount      = tabItems('done').length;
  const cancelledCount = tabItems('cancelled').length;

  // === RENDER ===
  return (
    <div className="flex h-full" style={{ maxHeight: '100vh' }}>

      {/* ── LEFT: Menu ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-700/50 bg-dark-800/50">
          <button onClick={() => router.push('/pos/tables')} className="btn-secondary p-2">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-white">{tableName}</h1>
            {activeOrder && (
              <span className="text-xs text-orange-400">Aktif Sipariş #{activeOrder.order_number}</span>
            )}
          </div>
          {activeOrder && (
            <button onClick={() => setShowPayment(true)} className="btn-primary py-2">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:block">Ödeme Al</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-slate-700/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-10 py-2 text-sm" placeholder="Ürün ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-slate-700/30 scrollbar-hide">
          <button
            onClick={() => setActiveCategory('all')}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
              activeCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600')}
          >🍽️ Tümü</button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                activeCategory === cat.id ? 'text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600')}
              style={activeCategory === cat.id ? { backgroundColor: cat.color } : {}}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  id={`product-${product.id}`}
                  onClick={() => handleAddProduct(product)}
                  className="product-card text-left group"
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                  ) : (
                    <div className="w-full h-24 bg-slate-700 rounded-lg mb-2 flex items-center justify-center text-3xl">🍽️</div>
                  )}
                  <div className="text-xs font-semibold text-white leading-tight">{product.name}</div>
                  <div className="text-sm font-bold text-orange-400 mt-1">₺{Number(product.price).toFixed(2)}</div>
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-3.5 h-3.5 text-white" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Cart + Active Order ── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-l border-slate-700/50 bg-dark-800 overflow-hidden">

        {/* ── ACTIVE ORDER PANEL ── */}
        {activeOrder && allItems.length > 0 && (
          <div className="flex flex-col border-b border-slate-700/50" style={{ maxHeight: orderExpanded ? '55%' : 'auto' }}>

            {/* Panel header — collapsible */}
            <button
              onClick={() => setOrderExpanded(v => !v)}
              className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 hover:bg-slate-900/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                  Gönderilen #{activeOrder.order_number}
                </span>
                <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full px-1.5 py-0.5 font-bold">
                  {allItems.length}
                </span>
              </div>
              {orderExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </button>

            {orderExpanded && (
              <>
                {/* Status tabs */}
                <div className="flex border-b border-slate-700/50">
                  {TABS.map(tab => {
                    const count = tabItems(tab.key).length;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setOrderTab(tab.key)}
                        className={clsx(
                          'flex-1 py-1.5 text-[11px] font-semibold transition-all relative',
                          orderTab === tab.key
                            ? 'text-orange-400 border-b-2 border-orange-500 bg-orange-500/5'
                            : 'text-slate-500 hover:text-slate-300'
                        )}
                      >
                        {tab.label}
                        {count > 0 && (
                          <span className={clsx(
                            'ml-1 text-[9px] font-bold px-1 py-0.5 rounded-full inline-block',
                            orderTab === tab.key ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-400'
                          )}>{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Grouped items list */}
                <div className="overflow-y-auto flex-1 p-2 space-y-1.5">
                  {tabItems(orderTab).length === 0 ? (
                    <div className="text-center text-slate-600 text-xs py-4">Bu sekmede ürün yok</div>
                  ) : (
                    tabItems(orderTab).map((g) => {
                      const s = STATUS_MAP[g.status] ?? STATUS_MAP['preparing'];
                      const isReady = g.status === 'ready';
                      const isCancellable = !['cancelled', 'delivered', 'served'].includes(g.status);

                      return (
                        <div
                          key={g.key}
                          className={clsx('flex items-center gap-2 px-2.5 py-2 rounded-xl border bg-slate-800/60 transition-all', isReady && 'ring-1 ring-blue-500/40')}
                        >
                          {/* Qty badge */}
                          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center">
                            <span className="text-[11px] font-extrabold text-white">×{g.quantity}</span>
                          </div>

                          {/* Name & price */}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{g.product_name}</div>
                            <div className="text-[10px] text-slate-400">₺{g.total_price.toFixed(2)}</div>
                          </div>

                          {/* Status chip */}
                          <div className={clsx('flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0', s.bg, s.color)}>
                            {s.icon}
                            <span className="hidden sm:block">{s.label}</span>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-1">
                            {isReady && (
                              <button
                                onClick={() => g.ids.forEach(id => handleUpdateItemStatus(id, 'delivered'))}
                                className="w-6 h-6 rounded-md bg-green-500/20 hover:bg-green-500/40 flex items-center justify-center"
                                title="Teslim Et"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                              </button>
                            )}
                            {isCancellable && (
                              <button
                                onClick={() => setCancelModal({ ids: g.ids, name: g.product_name })}
                                className="w-6 h-6 rounded-md bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center"
                                title="İptal"
                              >
                                <X className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CART ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-orange-400" />
            <span className="font-semibold text-white">Sepet</span>
            {cartCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </div>
          {cart.items.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-300">Temizle</button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <ShoppingCart className="w-10 h-10 text-slate-700 mb-2" />
              <p className="text-slate-600 text-xs">Menüden ürün seçin</p>
            </div>
          ) : (
            cart.items.map((item) => (
              <div key={item.product_id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-700/50">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{item.product_name}</div>
                  <div className="text-xs text-orange-400 font-semibold">₺{(item.unit_price * item.quantity).toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)}
                    className="w-6 h-6 rounded-lg bg-slate-600 flex items-center justify-center hover:bg-slate-500 transition-colors">
                    <Minus className="w-3 h-3 text-white" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-white">{item.quantity}</span>
                  <button onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                    className="w-6 h-6 rounded-lg bg-slate-600 flex items-center justify-center hover:bg-slate-500 transition-colors">
                    <Plus className="w-3 h-3 text-white" />
                  </button>
                  <button onClick={() => removeFromCart(item.product_id)}
                    className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center hover:bg-red-500/40 transition-colors ml-1">
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Order summary & submit */}
        {cart.items.length > 0 && (
          <div className="p-4 border-t border-slate-700/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Ara Toplam</span>
              <span className="text-white font-semibold">₺{cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">KDV (%8)</span>
              <span className="text-slate-300">₺{(cartTotal * 8 / 108).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-700 pt-2">
              <span className="font-bold text-white">Toplam</span>
              <span className="text-xl font-bold text-orange-400">₺{cartTotal.toFixed(2)}</span>
            </div>

            {activeOrder && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/50">
                <input type="checkbox" id="addExisting" checked={addingToExisting}
                  onChange={(e) => setAddingToExisting(e.target.checked)} className="accent-orange-500" />
                <label htmlFor="addExisting" className="text-xs text-slate-300 cursor-pointer">
                  Mevcut siparişe ekle (#{activeOrder.order_number})
                </label>
              </div>
            )}

            <button onClick={handleSubmitOrder} disabled={submitting} className="btn-primary w-full py-3 text-base">
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Gönderiliyor...</>
                : <><Send className="w-4 h-4" /> Siparişi Gönder</>}
            </button>

            {activeOrder && (
              <button onClick={() => setShowPayment(true)} className="btn-success w-full py-2.5">
                <CreditCard className="w-4 h-4" />
                Ödeme Al — ₺{(Number(activeOrder.total) - Number(activeOrder.paid_amount)).toFixed(2)}
              </button>
            )}
          </div>
        )}

        {/* Ödeme butonu (sepet boşsa da göster) */}
        {cart.items.length === 0 && activeOrder && (
          <div className="p-4 border-t border-slate-700/50">
            <button onClick={() => setShowPayment(true)} className="btn-success w-full py-2.5">
              <CreditCard className="w-4 h-4" />
              Ödeme Al — ₺{(Number(activeOrder.total) - Number(activeOrder.paid_amount)).toFixed(2)}
            </button>
          </div>
        )}
      </div>

      {/* ── Payment Modal ── */}
      {showPayment && activeOrder && (
        <PaymentModal
          order={activeOrder}
          onClose={() => setShowPayment(false)}
          onSuccess={(updated) => {
            setActiveOrder(updated);
            if (updated.status === 'closed') {
              toast.success('Ödeme alındı! Masa kapatıldı.');
              router.push('/pos/tables');
            }
          }}
        />
      )}

      {/* ── Cancel Modal ── */}
      {cancelModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-dark-800 border border-slate-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-red-400 mb-2 text-center">Ürün İptali</h3>
            <p className="text-sm text-slate-300 text-center mb-4">
              <span className="font-bold text-white">{cancelModal.name}</span>
              {cancelModal.ids.length > 1 ? ` (×${cancelModal.ids.length})` : ''} ürününü iptal ediyorsunuz.
            </p>
            <input
              autoFocus
              type="text"
              placeholder="Örn: Sipariş yanlış girildi / Müşteri vazgeçti"
              className="input w-full bg-slate-900 border-slate-700 text-white mb-4"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCancelItem(); }}
            />
            <div className="flex gap-2">
              <button onClick={() => { setCancelModal(null); setCancelReason(''); }} className="btn-secondary flex-1 py-2" disabled={cancelling}>
                Vazgeç
              </button>
              <button onClick={handleCancelItem} className="btn-primary flex-1 py-2 bg-red-500 hover:bg-red-600 shadow-red-500/20"
                disabled={cancelling || cancelReason.trim().length === 0}>
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'İptal Et'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Demo ──
const DEMO_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Başlangıçlar', icon: '🥗', color: '#22c55e' },
  { id: 'c2', name: 'Ana Yemekler', icon: '🍖', color: '#f97316' },
  { id: 'c3', name: 'Pizza & Burger', icon: '🍕', color: '#ef4444' },
  { id: 'c4', name: 'İçecekler',    icon: '🥤', color: '#3b82f6' },
  { id: 'c5', name: 'Tatlılar',     icon: '🍰', color: '#a855f7' },
];

const DEMO_PRODUCTS: Product[] = [
  { id: 'p1',  name: 'Çoban Salatası',   price: 85,  category_id: 'c1', is_available: true },
  { id: 'p2',  name: 'Mercimek Çorbası', price: 65,  category_id: 'c1', is_available: true },
  { id: 'p3',  name: 'Izgara Tavuk',     price: 180, category_id: 'c2', is_available: true },
  { id: 'p4',  name: 'Bonfile Steak',    price: 380, category_id: 'c2', is_available: true },
  { id: 'p5',  name: 'Karışık Pizza',    price: 220, category_id: 'c3', is_available: true },
  { id: 'p6',  name: 'Cheeseburger',     price: 160, category_id: 'c3', is_available: true },
  { id: 'p7',  name: 'Ayran',            price: 25,  category_id: 'c4', is_available: true },
  { id: 'p8',  name: 'Kola',             price: 35,  category_id: 'c4', is_available: true },
  { id: 'p9',  name: 'Su',               price: 15,  category_id: 'c4', is_available: true },
  { id: 'p10', name: 'Sütlaç',           price: 95,  category_id: 'c5', is_available: true },
  { id: 'p11', name: 'Baklava',          price: 120, category_id: 'c5', is_available: true },
  { id: 'p12', name: 'Lahmacun',         price: 75,  category_id: 'c3', is_available: true },
];
