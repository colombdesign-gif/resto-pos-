'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Plus, Pencil, Trash2, Search, Power, Image,
  ChevronRight, Loader2, Tag, Grid3X3
} from 'lucide-react';

interface Category { id: string; name: string; icon: string; color: string; is_active: boolean; }
interface Product { id: string; name: string; price: number; category_id?: string; is_active: boolean; is_available: boolean; description?: string; tax_rate: number; image_url?: string; }

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '', description: '', price: '', category_id: '', tax_rate: '8', is_available: true,
  });

  const fetchData = async () => {
    try {
      const [catRes, prodRes]: any = await Promise.all([
        api.get('/menu/categories'),
        api.get('/menu/products'),
      ]);
      setCategories(catRes.data || catRes);
      setProducts(prodRes.data || prodRes);
    } catch {
      setCategories(DEMO_CATS);
      setProducts(DEMO_PRODS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== 'all' && p.category_id !== selectedCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.price) { toast.error('Ad ve fiyat zorunludur'); return; }
    try {
      const data = { ...productForm, price: parseFloat(productForm.price), tax_rate: parseFloat(productForm.tax_rate) };
      if (editingProduct) {
        await api.patch(`/menu/products/${editingProduct.id}`, data);
        toast.success('Ürün güncellendi');
      } else {
        await api.post('/menu/products', data);
        toast.success('Ürün eklendi');
      }
      setShowProductModal(false);
      setEditingProduct(null);
      setProductForm({ name: '', description: '', price: '', category_id: '', tax_rate: '8', is_available: true });
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleToggle = async (product: Product) => {
    try {
      await api.post(`/menu/products/${product.id}/toggle`);
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_available: !p.is_available } : p));
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      name: formData.get('name'),
      icon: formData.get('icon') || '🍔',
      color: formData.get('color') || '#f97316',
    };
    if (!data.name) { toast.error('Kategori adı zorunludur'); return; }
    try {
      await api.post('/menu/categories', data);
      toast.success('Kategori eklendi');
      setShowCategoryModal(false);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Kategoriyi silmek istediğinizden emin misiniz? (İçindeki ürünler kategorisiz kalacaktır)')) return;
    try {
      await api.delete(`/menu/categories/${id}`);
      toast.success('Kategori silindi');
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Ürünü silmek istediğinizden emin misiniz?')) return;
    try {
      await api.delete(`/menu/products/${id}`);
      setProducts(prev => prev.filter(p => p.id !== id));
      toast.success('Ürün silindi');
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Menü Yönetimi</h1>
          <p className="text-slate-400 text-sm mt-0.5">{products.length} ürün</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCategoryModal(true)} className="btn-secondary py-2.5">
            <Tag className="w-4 h-4" />Kategori Ekle
          </button>
          <button onClick={() => { setEditingProduct(null); setShowProductModal(true); }} className="btn-primary py-2.5">
            <Plus className="w-4 h-4" />Ürün Ekle
          </button>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-10 py-2 text-sm" placeholder="Ürün ara..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          <button onClick={() => setSelectedCategory('all')} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap', selectedCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600')}>Tümü</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setSelectedCategory(c.id)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap', selectedCategory === c.id ? 'text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600')} style={selectedCategory === c.id ? { backgroundColor: c.color } : {}}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Ürün tablosu */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Ürün</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Kategori</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Fiyat</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Durum</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" /></td></tr>
            ) : filteredProducts.map((product) => {
              const cat = categories.find(c => c.id === product.category_id);
              return (
                <tr key={product.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{product.name}</div>
                    {product.description && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{product.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {cat && <span className="badge text-xs" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>{cat.icon} {cat.name}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-orange-400">₺{Number(product.price).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggle(product)} className={clsx('badge', product.is_available ? 'badge-ready' : 'badge-cancelled')}>
                      {product.is_available ? '✅ Aktif' : '❌ Pasif'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => { setEditingProduct(product); setProductForm({ name: product.name, description: product.description || '', price: String(product.price), category_id: product.category_id || '', tax_rate: String(product.tax_rate), is_available: product.is_available }); setShowProductModal(true); }} className="p-1.5 rounded-lg hover:bg-slate-600 text-slate-400 hover:text-white transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && filteredProducts.length === 0 && (
          <div className="py-16 text-center text-slate-500">Ürün bulunamadı</div>
        )}
      </div>

      {/* Ürün Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 animate-slide-in">
            <h2 className="text-lg font-bold text-white mb-5">{editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}</h2>
            <div className="space-y-4">
              <div><label className="text-sm text-slate-300 mb-1.5 block">Ürün Adı *</label><input className="input" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} placeholder="Izgara Tavuk" /></div>
              <div><label className="text-sm text-slate-300 mb-1.5 block">Açıklama</label><textarea className="input resize-none" rows={2} value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} placeholder="Kısa açıklama..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm text-slate-300 mb-1.5 block">Fiyat (₺) *</label><input type="number" className="input" value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" step="0.01" min="0" /></div>
                <div><label className="text-sm text-slate-300 mb-1.5 block">KDV (%)</label><input type="number" className="input" value={productForm.tax_rate} onChange={e => setProductForm(f => ({ ...f, tax_rate: e.target.value }))} placeholder="8" /></div>
              </div>
              <div><label className="text-sm text-slate-300 mb-1.5 block">Kategori</label>
                <select className="input" value={productForm.category_id} onChange={e => setProductForm(f => ({ ...f, category_id: e.target.value }))}>
                  <option value="">Kategori seçin</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="available" className="accent-orange-500" checked={productForm.is_available} onChange={e => setProductForm(f => ({ ...f, is_available: e.target.checked }))} />
                <label htmlFor="available" className="text-sm text-slate-300 cursor-pointer">Satışa Açık</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowProductModal(false); setEditingProduct(null); }} className="btn-secondary flex-1">İptal</button>
              <button onClick={handleSaveProduct} className="btn-primary flex-1">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* Kategori Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 animate-slide-in">
            <h2 className="text-lg font-bold text-white mb-5">Yeni Kategori Ekle</h2>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block">Kategori Adı *</label>
                <input name="name" className="input" placeholder="Örn: Tatlılar" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-300 mb-1.5 block">İkon</label>
                  <input name="icon" className="input" placeholder="🍔" defaultValue="🍔" />
                </div>
                <div>
                  <label className="text-sm text-slate-300 mb-1.5 block">Renk</label>
                  <input name="color" type="color" className="input h-10 p-1" defaultValue="#f97316" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" className="btn-primary flex-1">Ekle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const DEMO_CATS: Category[] = [
  { id: 'c1', name: 'Başlangıçlar', icon: '🥗', color: '#22c55e', is_active: true },
  { id: 'c2', name: 'Ana Yemekler', icon: '🍖', color: '#f97316', is_active: true },
];
const DEMO_PRODS: Product[] = [
  { id: 'p1', name: 'Çoban Salatası', price: 85, category_id: 'c1', is_active: true, is_available: true, tax_rate: 8 },
  { id: 'p2', name: 'Izgara Tavuk', price: 180, category_id: 'c2', is_active: true, is_available: true, tax_rate: 8 },
];
