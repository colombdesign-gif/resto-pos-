'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Plus, Minus, Trash2, Zap,
  Search, Loader2, ShoppingCart, CreditCard, X
} from 'lucide-react';
import clsx from 'clsx';

interface Product { id: string; name: string; price: number; category_id: string; is_available: boolean; }
interface Category { id: string; name: string; icon: string; color: string; }
interface CartItem { product_id: string; product_name: string; unit_price: number; quantity: number; }

export default function QuickSalePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cashGiven, setCashGiven] = useState('');

  const cartTotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const change = paymentMethod === 'cash' ? Math.max(0, parseFloat(cashGiven || '0') - cartTotal) : 0;

  useEffect(() => {
    api.get('/branches').then((res: any) => {
      const list = res.data || res;
      if (list.length > 0) setBranchId(list[0].id);
    }).catch(() => {});

    Promise.all([api.get('/menu/categories'), api.get('/menu/products')])
      .then(([c, p]: any) => {
        setCategories(c.data || c);
        setProducts(p.data || p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.product_id === product.id);
      if (ex) return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product_id: product.id, product_name: product.name, unit_price: product.price, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) setCart(prev => prev.filter(i => i.product_id !== productId));
    else setCart(prev => prev.map(i => i.product_id === productId ? { ...i, quantity: qty } : i));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error('Sepet boş!'); return; }
    if (!branchId) { toast.error('Şube bulunamadı'); return; }

    setSubmitting(true);
    try {
      // 1. Siparişi oluştur
      const orderRes: any = await api.post('/orders', {
        branch_id: branchId,
        type: 'takeaway',
        waiter_id: user?.id,
        items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
      });
      const order = orderRes.data || orderRes;

      // 2. Hemen ödeme al
      await api.post(`/payments/order/${order.id}`, {
        method: paymentMethod,
        amount: cartTotal,
        change_amount: change,
      });

      toast.success('✅ Satış tamamlandı!');
      setCart([]);
      setShowPaymentModal(false);
      setCashGiven('');
    } catch (err: any) {
      toast.error(err.message || 'Satış başarısız');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = products.filter(p => {
    if (!p.is_available) return false;
    if (activeCategory !== 'all' && p.category_id !== activeCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const quickAmounts = [cartTotal, Math.ceil(cartTotal / 50) * 50, Math.ceil(cartTotal / 100) * 100]
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);

  return (
    <div className="flex h-full" style={{ maxHeight: '100vh' }}>
      {/* SOL — Menü */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-700/50 bg-dark-800/50">
          <button onClick={() => router.push('/pos/tables')} className="btn-secondary p-2">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white">Hızlı Satış</h1>
              <p className="text-xs text-slate-400">Paket / Gel-al müşteri</p>
            </div>
          </div>
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

        {/* Kategoriler */}
        <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-slate-700/30 scrollbar-hide">
          <button
            onClick={() => setActiveCategory('all')}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
              activeCategory === 'all' ? 'bg-yellow-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
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

        {/* Ürünler */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="product-card text-left group"
                >
                  <div className="w-full h-24 bg-slate-700 rounded-lg mb-2 flex items-center justify-center text-3xl">
                    🍽️
                  </div>
                  <div className="text-xs font-semibold text-white leading-tight">{product.name}</div>
                  <div className="text-sm font-bold text-yellow-400 mt-1">
                    ₺{Number(product.price).toFixed(2)}
                  </div>
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-3.5 h-3.5 text-white" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SAĞ — Sepet */}
      <div className="w-80 flex-shrink-0 flex flex-col border-l border-slate-700/50 bg-dark-800">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-yellow-400" />
            <span className="font-semibold text-white">Sepet</span>
            {cartCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-yellow-500 text-white text-xs flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-300">Temizle</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Zap className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-500 text-sm">Ürün ekleyerek başlayın</p>
            </div>
          ) : cart.map((item) => (
            <div key={item.product_id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-700/50">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{item.product_name}</div>
                <div className="text-xs text-yellow-400 font-semibold">₺{(item.unit_price * item.quantity).toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="w-6 h-6 rounded-lg bg-slate-600 flex items-center justify-center hover:bg-slate-500">
                  <Minus className="w-3 h-3 text-white" />
                </button>
                <span className="w-6 text-center text-sm font-bold text-white">{item.quantity}</span>
                <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="w-6 h-6 rounded-lg bg-slate-600 flex items-center justify-center hover:bg-slate-500">
                  <Plus className="w-3 h-3 text-white" />
                </button>
                <button onClick={() => setCart(prev => prev.filter(i => i.product_id !== item.product_id))} className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center hover:bg-red-500/40 ml-1">
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="p-4 border-t border-slate-700/50 space-y-3">
            <div className="flex items-center justify-between border-t border-slate-700 pt-2">
              <span className="font-bold text-white">Toplam</span>
              <span className="text-xl font-bold text-yellow-400">₺{cartTotal.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="w-full py-3 rounded-xl font-bold text-base text-dark-900 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 flex items-center justify-center gap-2 transition-all"
            >
              <CreditCard className="w-5 h-5" />
              Ödeme Al — ₺{cartTotal.toFixed(2)}
            </button>
          </div>
        )}
      </div>

      {/* Ödeme Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dark-800 border border-slate-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Ödeme Al</h2>
              <button onClick={() => setShowPaymentModal(false)} className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="text-3xl font-bold text-yellow-400 text-center mb-5">₺{cartTotal.toFixed(2)}</div>

            {/* Yöntem */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[{ id: 'cash', label: '💵 Nakit' }, { id: 'card', label: '💳 Kart' }].map(m => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={clsx('py-3 rounded-xl border-2 font-medium text-sm transition-all',
                    paymentMethod === m.id ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400' : 'border-slate-700 bg-slate-700/50 text-slate-400'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Nakit üstü */}
            {paymentMethod === 'cash' && (
              <div className="mb-4 space-y-2">
                <label className="text-sm text-slate-400">Verilen Tutar</label>
                <input
                  type="number"
                  className="input w-full text-center text-xl font-bold"
                  placeholder="₺0.00"
                  value={cashGiven}
                  onChange={(e) => setCashGiven(e.target.value)}
                  step="0.01"
                />
                <div className="flex gap-2">
                  {quickAmounts.map(q => (
                    <button key={q} onClick={() => setCashGiven(q.toFixed(2))}
                      className="flex-1 py-1.5 rounded-lg bg-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-600">
                      ₺{q.toFixed(0)}
                    </button>
                  ))}
                </div>
                {change > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <span className="text-green-400 font-medium">Para Üstü</span>
                    <span className="text-green-400 text-xl font-bold">₺{change.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={submitting || (paymentMethod === 'cash' && cashGiven !== '' && parseFloat(cashGiven) < cartTotal)}
              className="w-full py-4 rounded-xl font-bold text-base text-dark-900 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '✅ Satışı Tamamla'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
