'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { ShoppingCart, Plus, Minus, Send, ChefHat, Loader2, X, Search } from 'lucide-react';
import clsx from 'clsx';

interface Product { id: string; name: string; price: number; description?: string; image_url?: string; category_id: string; }
interface Category { id: string; name: string; icon: string; color: string; }

export default function QRMenuPage() {
  const params = useParams();
  const tenantSlug = params.slug as string;
  const tableId = params.tableId as string;

  const [menu, setMenu] = useState<{ tenant: any; categories: Category[]; products: Product[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    api.get(`/menu/qr/${tenantSlug}`)
      .then((res: any) => setMenu(res.data || res))
      .catch(() => setMenu(DEMO_MENU))
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      return existing
        ? prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev
      .map(i => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const handleSubmit = async () => {
    const itemsCount = cart.reduce((s, i) => s + i.quantity, 0);
    if (itemsCount === 0) return;

    setSubmitting(true);
    try {
      await api.post('/orders', {
        tenant_id: menu?.tenant?.id,
        branch_id: menu?.tenant?.default_branch_id,
        table_id: tableId,
        type: 'qr',
        source: 'qr',
        customer_note: note,
        items: cart.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.product.price,
        })),
      }, {
        headers: { 'x-tenant-id': menu?.tenant?.id }
      });
      setOrdered(true);
      setCart([]);
    } catch (err: any) {
      toast.error(err.message || 'Sipariş gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = menu?.products.filter(p => {
    if (activeCategory !== 'all' && p.category_id !== activeCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) || [];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Menü yükleniyor...</p>
      </div>
    </div>
  );

  if (ordered) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0f172a' }}>
      <div className="text-center max-w-sm">
        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
          <span className="text-5xl">✅</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Siparişiniz Alındı!</h1>
        <p className="text-slate-400 mb-6">Siparişiniz mutfağa iletildi. Kısa süre içinde hazırlanacak.</p>
        <button onClick={() => setOrdered(false)} className="btn-primary py-3 px-8">
          Yeni Sipariş Ver
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#0f172a' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-md border-b border-white/5" style={{ background: 'rgba(15,23,42,0.95)' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">{menu?.tenant?.name || 'RestoPOS'}</div>
              {tableId && <div className="text-xs text-slate-400">Masa • QR Sipariş</div>}
            </div>
          </div>
          {cartCount > 0 && (
            <button onClick={() => setShowCart(true)} className="relative btn-primary py-2.5 px-4">
              <ShoppingCart className="w-4 h-4" />
              <span>Sepet</span>
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-orange-600 text-xs font-bold flex items-center justify-center">
                {cartCount}
              </span>
            </button>
          )}
        </div>

        {/* Arama */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-10 py-2.5 text-sm" placeholder="Ürün ara..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Kategori scroll */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveCategory('all')} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all', activeCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300')}>
            🍽️ Tümü
          </button>
          {menu?.categories.map(c => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all', activeCategory === c.id ? 'text-white' : 'bg-slate-800 text-slate-300')} style={activeCategory === c.id ? { backgroundColor: c.color } : {}}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Ürün listesi */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-24">
        {filtered.map(product => {
          const inCart = cart.find(i => i.product.id === product.id);
          return (
            <div key={product.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800 border border-slate-700/50">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-slate-700 flex items-center justify-center text-3xl flex-shrink-0">🍽️</div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white">{product.name}</h3>
                {product.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{product.description}</p>}
                <div className="text-lg font-bold text-orange-400 mt-1">₺{Number(product.price).toFixed(2)}</div>
              </div>
              <div className="flex-shrink-0">
                {inCart ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(product.id, -1)} className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center hover:bg-red-500/20 transition-colors">
                      <Minus className="w-4 h-4 text-white" />
                    </button>
                    <span className="w-6 text-center font-bold text-white">{inCart.quantity}</span>
                    <button onClick={() => updateQty(product.id, 1)} className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center hover:bg-orange-600 transition-colors">
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => addToCart(product)} className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30">
                    <Plus className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">Ürün bulunamadı</div>
        )}
      </div>

      {/* Sepet sticky butonu */}
      {cartCount > 0 && (
        <div className="sticky bottom-0 p-4 max-w-2xl mx-auto">
          <button onClick={() => setShowCart(true)} className="btn-primary w-full py-4 text-base shadow-2xl shadow-orange-500/30">
            <ShoppingCart className="w-5 h-5" />
            Sepeti Gör — ₺{cartTotal.toFixed(2)}
            <span className="ml-auto bg-white/20 rounded-lg px-2 py-0.5 text-sm">{cartCount} ürün</span>
          </button>
        </div>
      )}

      {/* Sepet çekmecesi */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="relative bg-slate-900 rounded-t-3xl border-t border-slate-700 p-6 max-h-[85vh] overflow-y-auto animate-slide-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-orange-400" />Siparişiniz</h2>
              <button onClick={() => setShowCart(false)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800">
                  <div className="flex-1">
                    <div className="font-medium text-white">{item.product.name}</div>
                    <div className="text-sm text-orange-400 font-semibold">₺{(item.product.price * item.quantity).toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.product.id, -1)} className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center"><Minus className="w-3.5 h-3.5 text-white" /></button>
                    <span className="w-6 text-center font-bold text-white">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product.id, 1)} className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center"><Plus className="w-3.5 h-3.5 text-white" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-sm text-slate-300 block mb-1.5">Özel Not (opsiyonel)</label>
              <textarea className="input resize-none" rows={2} placeholder="Özel istek veya alerji bilgisi..." value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <div className="flex items-center justify-between mb-5 p-4 rounded-xl bg-slate-800">
              <span className="font-bold text-white">Toplam</span>
              <span className="text-2xl font-bold text-orange-400">₺{cartTotal.toFixed(2)}</span>
            </div>

            <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full py-4 text-lg">
              {submitting ? <><Loader2 className="w-5 h-5 animate-spin" />Gönderiliyor...</> : <><Send className="w-5 h-5" />Siparişi Gönder</>}
            </button>
            <p className="text-xs text-slate-500 text-center mt-3">Sipariş verilir, masanızda hazırlanır. Ödeme garsondan yapılır.</p>
          </div>
        </div>
      )}
    </div>
  );
}

const DEMO_MENU = {
  tenant: { name: 'Demo Restoran' },
  categories: [
    { id: 'c1', name: 'Başlangıçlar', icon: '🥗', color: '#22c55e' },
    { id: 'c2', name: 'Ana Yemekler', icon: '🍖', color: '#f97316' },
    { id: 'c3', name: 'İçecekler', icon: '🥤', color: '#3b82f6' },
  ],
  products: [
    { id: 'p1', name: 'Çoban Salatası', price: 85, category_id: 'c1', description: 'Taze mevsim sebzeleriyle' },
    { id: 'p2', name: 'Izgara Tavuk', price: 180, category_id: 'c2', description: 'Yanında pilav ve salata' },
    { id: 'p3', name: 'Ayran', price: 25, category_id: 'c3' },
    { id: 'p4', name: 'Su', price: 10, category_id: 'c3' },
  ],
};
