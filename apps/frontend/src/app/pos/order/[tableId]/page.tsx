'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useOrderStore } from '@/store/orderStore';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  ArrowLeft, Plus, Minus, Trash2, Send, CreditCard,
  Search, ChevronRight, Loader2, ShoppingCart, Tag,
  StickyNote, X
} from 'lucide-react';
import PaymentModal from '@/components/pos/PaymentModal';

interface Product { id: string; name: string; price: number; category_id: string; image_url?: string; is_available: boolean; }
interface Category { id: string; name: string; icon: string; color: string; }
interface CartItem { product_id: string; product_name: string; unit_price: number; quantity: number; notes?: string; }

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.tableId as string;
  const { user } = useAuthStore();
  const { cart, addToCart, removeFromCart, updateCartQuantity, clearCart, submitOrder, currentOrder, setCurrentOrder } = useOrderStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [tableName, setTableName] = useState('');
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [addingToExisting, setAddingToExisting] = useState(false);
  const [branchId, setBranchId] = useState<string>('');
  const [cancelModal, setCancelModal] = useState<{ itemId: string, name: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const { addItemsToOrder } = useOrderStore();

  useEffect(() => {
    // Şubeleri yükle (özellikle takeaway/delivery ve yeni masalar için gerekli)
    api.get('/branches').then((res: any) => {
      const branchList = res.data || res;
      if (branchList.length > 0 && !branchId) {
        // Eğer hala branchId yoksa (takeaway veya table yüklenirken hata oluştuysa) varsayılanı kullan
        setBranchId(branchList[0].id);
      }
    }).catch(() => {});

    // Masa adını al
    if (tableId !== 'takeaway' && tableId !== 'delivery') {
      api.get(`/tables/${tableId}`).then((res: any) => {
        const t = res.data || res;
        setTableName(t.name || 'Masa');
        if (t.branch_id) setBranchId(t.branch_id);
      }).catch(() => setTableName('Masa'));

      // Aktif sipariş var mı?
      api.get(`/orders/table/${tableId}/active`).then((res: any) => {
        const order = res.data || res;
        if (order?.id) {
          setActiveOrder(order);
          setCurrentOrder(order);
        }
      }).catch(() => {});
    } else {
      setTableName(tableId === 'takeaway' ? 'Paket Servis' : 'Teslimat');
    }

    // Menü yükle
    Promise.all([
      api.get('/menu/categories'),
      api.get('/menu/products'),
    ]).then(([catRes, prodRes]: any) => {
      setCategories(catRes.data || catRes);
      setProducts(prodRes.data || prodRes);
    }).catch(() => {
      setCategories(DEMO_CATEGORIES);
      setProducts(DEMO_PRODUCTS);
    }).finally(() => setLoading(false));
  }, [tableId]);

  const filteredProducts = products.filter((p) => {
    if (!p.is_available) return false;
    if (activeCategory !== 'all' && p.category_id !== activeCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const cartTotal = cart.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const cartCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  const handleAddProduct = (product: Product) => {
    addToCart({
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_price: product.price,
    });
    // Kısa titreme animasyonu
    const el = document.getElementById(`product-${product.id}`);
    if (el) { el.classList.add('animate-ticker'); setTimeout(() => el.classList.remove('animate-ticker'), 500); }
  };

  const handleSubmitOrder = async () => {
    if (cart.items.length === 0) { toast.error('Sepet boş!'); return; }

    setSubmitting(true);
    try {
      if (activeOrder && addingToExisting) {
        // Mevcut siparişe ekle
        await addItemsToOrder(activeOrder.id, cart.items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          notes: i.notes,
        })));
        toast.success('Ürünler siparişe eklendi!');
      } else {
        // Yeni sipariş
        const orderData = {
          branch_id: branchId,
          table_id: tableId !== 'takeaway' && tableId !== 'delivery' ? tableId : undefined,
          type: tableId === 'takeaway' ? 'takeaway' : tableId === 'delivery' ? 'delivery' : 'dine_in',
          waiter_id: user?.id,
          items: cart.items.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            notes: i.notes,
          })),
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
      await api.patch(`/orders/${activeOrder.id}/items/${itemId}/status`, { status: newStatus });
      toast.success('Ürün durumu güncellendi!');
      // State is automatically updated via WebSocket 'order.updated' 
    } catch (err: any) {
      toast.error('Durum güncellenemedi');
    }
  };

  const handleCancelItem = async () => {
    if (!activeOrder || !cancelModal) return;
    if (cancelReason.trim().length < 3) {
      toast.error('Lütfen mantıklı bir iptal/iade sebebi girin.');
      return;
    }

    setCancelling(true);
    try {
      await api.delete(`/orders/${activeOrder.id}/items/${cancelModal.itemId}?reason=${encodeURIComponent(cancelReason)}`);
      toast.success('Ürün iptal edildi.');
      setCancelModal(null);
      setCancelReason('');
    } catch (err: any) {
      toast.error(err.message || 'İptal işlemi başarısız');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex h-full" style={{ maxHeight: '100vh' }}>
      {/* SOL PANEL — Menü */}
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

        {/* Arama */}
        <div className="px-4 py-2 border-b border-slate-700/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-10 py-2 text-sm"
              placeholder="Ürün ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Kategori sekmeler */}
        <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-slate-700/30 scrollbar-hide">
          <button
            onClick={() => setActiveCategory('all')}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
              activeCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
          >
            🍽️ Tümü
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                activeCategory === cat.id ? 'text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              )}
              style={activeCategory === cat.id ? { backgroundColor: cat.color } : {}}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Ürün grid */}
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
                    <div className="w-full h-24 bg-slate-700 rounded-lg mb-2 flex items-center justify-center text-3xl">
                      🍽️
                    </div>
                  )}
                  <div className="text-xs font-semibold text-white leading-tight">{product.name}</div>
                  <div className="text-sm font-bold text-orange-400 mt-1">
                    ₺{Number(product.price).toFixed(2)}
                  </div>
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-3.5 h-3.5 text-white" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SAĞ PANEL — Sepet */}
      <div className="w-80 flex-shrink-0 flex flex-col border-l border-slate-700/50 bg-dark-800">
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

        {/* Siparişteki mevcut ürünler */}
        {activeOrder && activeOrder.items?.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Gönderilen Siparişler</h3>
            <div className="space-y-2">
              {activeOrder.items.map((item: any) => {
                const product = products.find(p => p.id === item.product_id);
                // Durum — Garsonlar sadece 3 durum görür
                const statusMap: any = {
                  pending:    { label: 'Hazırlanıyor', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
                  preparing:  { label: 'Hazırlanıyor', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
                  ready:      { label: 'Hazır ★',        color: 'text-blue-300 bg-blue-400/20 border-blue-400/30' },
                  delivered:  { label: 'Teslim Edildi', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
                  served:     { label: 'Teslim Edildi', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
                  cancelled:  { label: 'İptal',          color: 'text-red-400 bg-red-400/10 border-red-400/20'    },
                };
                const s = statusMap[item.status] || statusMap['preparing'];

                return (
                  <div key={item.id} className="flex flex-col gap-2 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate flex items-center gap-2">
                          <span className="w-6 text-center text-xs font-bold text-slate-300 bg-slate-700 rounded p-0.5">{item.quantity}x</span>
                          {product?.name || item.product?.name || 'Ürün'}
                        </div>
                        <div className="text-xs text-orange-400 font-semibold mt-1">₺{Number(item.total_price).toFixed(2)}</div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${s.color}`}>
                          {s.label}
                        </div>
                      </div>
                    </div>
                    
                    {item.status !== 'cancelled' && (
                      <div className="flex justify-end gap-1.5 border-t border-slate-700/50 pt-2 mt-1">
                        {/* Hazır olanı Teslim Et Butonu */}
                        {item.status === 'ready' && (
                          <button 
                            onClick={() => handleUpdateItemStatus(item.id, 'delivered')}
                            className="bg-green-500/20 text-green-400 hover:bg-green-500/40 text-xs px-2 py-1 rounded"
                          >
                            Teslim Et
                          </button>
                        )}
                        {/* İptal Butonu */}
                        <button 
                          onClick={() => setCancelModal({ itemId: item.id, name: product?.name || 'Ürün' })}
                          className="bg-red-500/20 text-red-400 hover:bg-red-500/40 text-xs px-2 py-1 rounded"
                        >
                          İptal / İade
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {cart.items.length > 0 && <div className="h-px bg-slate-700/50 my-4" />}
          </div>
        )}

        {/* Sepet ürünleri */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.items.length === 0 && (!activeOrder || activeOrder.items?.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <ShoppingCart className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-500 text-sm">Menüden ürün seçin</p>
            </div>
          ) : (
            cart.items.map((item) => (
              <div key={item.product_id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-700/50">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{item.product_name}</div>
                  <div className="text-xs text-orange-400 font-semibold">₺{(item.unit_price * item.quantity).toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)}
                    className="w-6 h-6 rounded-lg bg-slate-600 flex items-center justify-center hover:bg-slate-500 transition-colors"
                  >
                    <Minus className="w-3 h-3 text-white" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-white">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                    className="w-6 h-6 rounded-lg bg-slate-600 flex items-center justify-center hover:bg-slate-500 transition-colors"
                  >
                    <Plus className="w-3 h-3 text-white" />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center hover:bg-red-500/40 transition-colors ml-1"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sipariş özeti */}
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
                <input
                  type="checkbox"
                  id="addExisting"
                  checked={addingToExisting}
                  onChange={(e) => setAddingToExisting(e.target.checked)}
                  className="accent-orange-500"
                />
                <label htmlFor="addExisting" className="text-xs text-slate-300 cursor-pointer">
                  Mevcut siparişe ekle (#{activeOrder.order_number})
                </label>
              </div>
            )}

            <button
              onClick={handleSubmitOrder}
              disabled={submitting}
              className="btn-primary w-full py-3 text-base"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Gönderiliyor...</>
              ) : (
                <><Send className="w-4 h-4" /> Siparişi Gönder</>
              )}
            </button>

            {activeOrder && (
              <button onClick={() => setShowPayment(true)} className="btn-success w-full py-2.5">
                <CreditCard className="w-4 h-4" />
                Ödeme Al — ₺{(Number(activeOrder.total) - Number(activeOrder.paid_amount)).toFixed(2)}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Ödeme modalı */}
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

      {/* İptal Modal'ı */}
      {cancelModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-dark-800 border border-slate-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 text-center text-red-400">Ürün İptali</h3>
            <p className="text-sm text-slate-300 text-center mb-4">
              <span className="font-bold text-white">{cancelModal.name}</span> ürününü iptal ediyorsunuz. Lütfen yönetici kayıtları için sebep girin.
            </p>
            <input
              autoFocus
              type="text"
              placeholder="Örn: Sipariş yanlış girildi / Müşteri vazgeçti"
              className="input w-full bg-slate-900 border-slate-700 text-white mb-4"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCancelItem();
              }}
            />
            <div className="flex gap-2">
              <button 
                onClick={() => { setCancelModal(null); setCancelReason(''); }}
                className="btn-secondary flex-1 py-2"
                disabled={cancelling}
              >
                Vazgeç
              </button>
              <button 
                onClick={handleCancelItem}
                className="btn-primary flex-1 py-2 bg-red-500 hover:bg-red-600 shadow-red-500/20"
                disabled={cancelling || cancelReason.trim().length === 0}
              >
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'İptal Et'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Demo verisi
const DEMO_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Başlangıçlar', icon: '🥗', color: '#22c55e' },
  { id: 'c2', name: 'Ana Yemekler', icon: '🍖', color: '#f97316' },
  { id: 'c3', name: 'Pizza & Burger', icon: '🍕', color: '#ef4444' },
  { id: 'c4', name: 'İçecekler', icon: '🥤', color: '#3b82f6' },
  { id: 'c5', name: 'Tatlılar', icon: '🍰', color: '#a855f7' },
];

const DEMO_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Çoban Salatası', price: 85, category_id: 'c1', is_available: true },
  { id: 'p2', name: 'Mercimek Çorbası', price: 65, category_id: 'c1', is_available: true },
  { id: 'p3', name: 'Izgara Tavuk', price: 180, category_id: 'c2', is_available: true },
  { id: 'p4', name: 'Bonfile Steak', price: 380, category_id: 'c2', is_available: true },
  { id: 'p5', name: 'Karışık Pizza', price: 220, category_id: 'c3', is_available: true },
  { id: 'p6', name: 'Cheeseburger', price: 160, category_id: 'c3', is_available: true },
  { id: 'p7', name: 'Ayran', price: 25, category_id: 'c4', is_available: true },
  { id: 'p8', name: 'Kola', price: 35, category_id: 'c4', is_available: true },
  { id: 'p9', name: 'Su', price: 15, category_id: 'c4', is_available: true },
  { id: 'p10', name: 'Sütlaç', price: 95, category_id: 'c5', is_available: true },
  { id: 'p11', name: 'Baklava', price: 120, category_id: 'c5', is_available: true },
  { id: 'p12', name: 'Lahmacun', price: 75, category_id: 'c3', is_available: true },
];
