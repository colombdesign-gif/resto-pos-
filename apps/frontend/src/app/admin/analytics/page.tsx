'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import clsx from 'clsx';
import {
  TrendingUp, Star, Zap, ShoppingBag, ChefHat, Package,
  ArrowUp, ArrowDown, Loader2, RefreshCw, Lightbulb
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

const DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const HOUR_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

const MENU_CATEGORY_COLORS: Record<string, string> = {
  star: '#f59e0b',
  'plow-horse': '#3b82f6',
  puzzle: '#8b5cf6',
  dog: '#94a3b8',
};
const MENU_CATEGORY_LABELS: Record<string, string> = {
  star: '⭐ Yıldız',
  'plow-horse': '🐎 At Gücü',
  puzzle: '🧩 Bulmaca',
  dog: '🐕 Köpek',
};

export default function AnalyticsPage() {
  const { tenant } = useAuthStore();
  const [activeTab, setActiveTab] = useState('forecast');

  const [revenueForecast, setRevenueForecast] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [stockForecast, setStockForecast] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [menuMix, setMenuMix] = useState<any[]>([]);
  const [waiterPerf, setWaiterPerf] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [fc, ph, tp, sf, camp, mm, wp] = await Promise.all([
          api.get('/analytics/revenue-forecast').catch(() => ({ data: [] })),
          api.get('/analytics/peak-hours').catch(() => ({ data: [] })),
          api.get('/analytics/top-products').catch(() => ({ data: [] })),
          api.get('/analytics/stock-forecast').catch(() => ({ data: [] })),
          api.get('/analytics/campaign-suggestions').catch(() => ({ data: [] })),
          api.get('/analytics/menu-mix').catch(() => ({ data: [] })),
          api.get('/analytics/waiter-performance').catch(() => ({ data: [] })),
        ]);
        setRevenueForecast((fc as any).data || DEMO_FORECAST);
        setPeakHours((ph as any).data || []);
        setTopProducts((tp as any).data || DEMO_TOP);
        setStockForecast((sf as any).data || DEMO_STOCK);
        setCampaigns((camp as any).data || DEMO_CAMPAIGNS);
        setMenuMix((mm as any).data || DEMO_MENU_MIX);
        setWaiterPerf((wp as any).data || DEMO_WAITERS);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // Peak hours ısı haritası verisi
  const peakHeatmap = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const found = peakHours.find(
        (p: any) => Number(p.day_of_week) === day && Number(p.hour) === hour
      );
      return { hour, count: Number(found?.avg_orders || 0) };
    })
  );

  const tabs = [
    { id: 'forecast', label: '📈 Gelir Tahmini', icon: TrendingUp },
    { id: 'peak', label: '🔥 Yoğunluk Haritası', icon: Zap },
    { id: 'products', label: '🏆 Ürün Analizi', icon: Star },
    { id: 'stock', label: '📦 Stok Tahmini', icon: Package },
    { id: 'campaigns', label: '💡 Kampanya Önerileri', icon: Lightbulb },
    { id: 'menu', label: '🍽️ Menü Matrix', icon: ChefHat },
    { id: 'waiters', label: '👤 Garson Performansı', icon: ShoppingBag },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-3" />
        <p className="text-slate-400">Analitik veriler hesaplanıyor...</p>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🧠 Akıllı Analitik & AI İçgörüler</h1>
          <p className="text-slate-400 text-sm mt-0.5">Veriye dayalı kararlar alın</p>
        </div>
        <button onClick={() => window.location.reload()} className="btn-secondary py-2 px-3">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap mb-6 bg-slate-800 p-1 rounded-2xl">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={clsx('px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap',
              activeTab === t.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-slate-400 hover:text-white'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Gelir Tahmini */}
      {activeTab === 'forecast' && (
        <div className="space-y-5">
          <div className="card">
            <h2 className="font-semibold text-white mb-4">📊 Önümüzdeki 7 Günlük Gelir Tahmini</h2>
            <p className="text-xs text-slate-400 mb-4">Son 90 gün verisi baz alınarak hesaplanmıştır.</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `₺${v}`} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  formatter={(v: any) => [`₺${Number(v).toLocaleString('tr-TR')}`, 'Tahmini Ciro']}
                  labelFormatter={(l) => `📅 ${l}`} />
                <Bar dataKey="predicted_revenue" fill="#f97316" radius={[8, 8, 0, 0]}>
                  {revenueForecast.map((_, i) => (
                    <Cell key={i} fill={_ .confidence === 'low' ? '#64748b' : '#f97316'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-3 mt-3">
              <div className="flex items-center gap-2 text-xs text-slate-400"><div className="w-3 h-3 rounded-sm bg-orange-500" />Yüksek Güven</div>
              <div className="flex items-center gap-2 text-xs text-slate-400"><div className="w-3 h-3 rounded-sm bg-slate-600" />Düşük Güven (Veri Az)</div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-700">
              <div className="text-center">
                <div className="text-xl font-bold text-orange-400">
                  ₺{revenueForecast.reduce((s, d) => s + (d.predicted_revenue || 0), 0).toLocaleString('tr-TR')}
                </div>
                <div className="text-xs text-slate-400">7 Günlük Tahmini Ciro</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-400">
                  ₺{Math.max(...revenueForecast.map(d => d.predicted_revenue || 0)).toLocaleString('tr-TR')}
                </div>
                <div className="text-xs text-slate-400">En Yüksek Gün</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white">
                  {revenueForecast.find(d => d.predicted_revenue === Math.max(...revenueForecast.map(x => x.predicted_revenue || 0)))
                    ? DAY_NAMES[revenueForecast.find(d => d.predicted_revenue === Math.max(...revenueForecast.map(x => x.predicted_revenue || 0)))?.day_of_week] : '-'}
                </div>
                <div className="text-xs text-slate-400">En İyi Gün</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stok Tahmini */}
      {activeTab === 'stock' && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">📦 Stok Tükenme Tahmini</h2>
          <p className="text-xs text-slate-400 mb-4">Son 30 günlük tüketim hızına göre hesaplanmıştır.</p>
          <div className="space-y-3">
            {(stockForecast.length ? stockForecast : DEMO_STOCK).map((item: any) => (
              <div key={item.id} className={clsx('flex items-center gap-4 p-3 rounded-xl', {
                'bg-red-500/10 border border-red-500/20': item.forecast_status === 'urgent',
                'bg-yellow-500/10 border border-yellow-500/20': item.forecast_status === 'warning',
                'bg-slate-700/30': item.forecast_status === 'ok',
              })}>
                <div className="flex-1">
                  <div className="font-medium text-white">{item.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Mevcut: {Number(item.current_stock).toFixed(0)} {item.unit} •
                    Günlük tüketim: {Number(item.daily_use || 0).toFixed(1)} {item.unit}
                  </div>
                </div>
                <div className="text-center flex-shrink-0">
                  <div className={clsx('text-2xl font-bold', {
                    'text-red-400': item.forecast_status === 'urgent',
                    'text-yellow-400': item.forecast_status === 'warning',
                    'text-green-400': item.forecast_status === 'ok',
                  })}>
                    {item.days_remaining != null ? `${item.days_remaining}g` : '∞'}
                  </div>
                  <div className="text-xs text-slate-400">kaldı</div>
                </div>
                {item.suggested_order_qty && (
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-blue-400">+{Number(item.suggested_order_qty).toFixed(0)} {item.unit}</div>
                    <div className="text-xs text-slate-500">sipariş önerisi</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kampanya Önerileri */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-orange-400" />
              <span className="font-semibold text-orange-400">AI Sistemi {campaigns.length} Kampanya Önerisi Hazırladı</span>
            </div>
            <p className="text-sm text-slate-400">Bu öneriler satış veriniz analiz edilerek otomatik üretilmiştir.</p>
          </div>
          {(campaigns.length ? campaigns : DEMO_CAMPAIGNS).map((c: any, i: number) => (
            <div key={i} className="card">
              <div className="flex items-start gap-4">
                <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl',
                  c.type === 'discount' ? 'bg-green-500/10' : 'bg-purple-500/10'
                )}>
                  {c.type === 'discount' ? '🏷️' : '⏰'}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">{c.suggestion}</h3>
                  <p className="text-sm text-slate-400 mb-3">{c.reason}</p>
                  {c.current_price && (
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 line-through text-sm">₺{c.current_price}</span>
                      <span className="text-green-400 font-bold text-xl">₺{c.suggested_price}</span>
                      <span className="badge bg-green-500/20 text-green-400 text-xs">%15 İndirim</span>
                    </div>
                  )}
                  {c.hour !== undefined && (
                    <div className="text-sm text-purple-400 font-medium">
                      🕐 Önerilen Saat: {c.hour}:00 - {c.hour + 1}:00
                    </div>
                  )}
                </div>
                <button className="btn-primary py-2 px-4 text-sm flex-shrink-0">Uygula</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Menü Matrix (Boston Matrix) */}
      {activeTab === 'menu' && (
        <div className="card">
          <h2 className="font-semibold text-white mb-2">🍽️ Menü Matrix Analizi (Boston Matrix)</h2>
          <p className="text-xs text-slate-400 mb-5">Ürünlerinizi satış adedi ve gelir katkısına göre kategorize eder.</p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {Object.entries(MENU_CATEGORY_LABELS).map(([key, label]) => {
              const items = (menuMix.length ? menuMix : DEMO_MENU_MIX).filter((p: any) => p.category === key);
              return (
                <div key={key} className="p-4 rounded-2xl border" style={{ borderColor: `${MENU_CATEGORY_COLORS[key]}30`, background: `${MENU_CATEGORY_COLORS[key]}08` }}>
                  <div className="font-semibold mb-2" style={{ color: MENU_CATEGORY_COLORS[key] }}>{label}</div>
                  <div className="text-2xl font-bold text-white mb-2">{items.length} ürün</div>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((p: any) => (
                      <div key={p.id} className="text-xs text-slate-400 truncate">• {p.name}</div>
                    ))}
                    {items.length > 3 && <div className="text-xs text-slate-500">+{items.length - 3} daha</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <h3 className="font-medium text-blue-400 mb-2">💡 Boston Matrix Rehberi</h3>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div>⭐ <strong className="text-slate-300">Yıldız:</strong> Yüksek satış + Yüksek gelir → Aktif pazarla, menuye öne çıkar</div>
              <div>🐎 <strong className="text-slate-300">At Gücü:</strong> Yüksek satış + Düşük gelir → Fiyat artışı dene</div>
              <div>🧩 <strong className="text-slate-300">Bulmaca:</strong> Düşük satış + Yüksek gelir → VIP müşterilere öner</div>
              <div>🐕 <strong className="text-slate-300">Köpek:</strong> Düşük satış + Düşük gelir → Menüden çıkarmayı düşün</div>
            </div>
          </div>
        </div>
      )}

      {/* Garson Performansı */}
      {activeTab === 'waiters' && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">👤 Garson Performans Analizi (Son 30 Gün)</h2>
          <div className="space-y-3">
            {(waiterPerf.length ? waiterPerf : DEMO_WAITERS).map((w: any, i: number) => (
              <div key={w.id || i} className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/30">
                <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white font-bold flex-shrink-0">
                  {w.name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white">{w.name}</div>
                  <div className="flex gap-4 text-xs text-slate-400 mt-1">
                    <span>{w.order_count} sipariş</span>
                    <span>{w.unique_tables} masa</span>
                    {w.avg_service_minutes && <span>Ort. {Math.round(w.avg_service_minutes)} dk</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-orange-400">₺{Number(w.total_revenue).toLocaleString('tr-TR')}</div>
                  <div className="text-xs text-slate-400">₺{Number(w.avg_order_value).toFixed(0)} / sipariş</div>
                </div>
                <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center',
                  i === 0 ? 'bg-yellow-500 text-yellow-900' : i === 1 ? 'bg-slate-400 text-slate-900' : 'bg-amber-700 text-amber-100'
                )}>
                  <span className="text-sm font-bold">{i + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Ürünler */}
      {activeTab === 'products' && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">🏆 En Çok Satan Ürünler (30 Gün)</h2>
          <div className="space-y-3">
            {(topProducts.length ? topProducts : DEMO_TOP).map((p: any, i: number) => (
              <div key={p.id || i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-700/20">
                <span className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                  i === 0 ? 'bg-yellow-500 text-yellow-900' : i === 1 ? 'bg-slate-400 text-slate-900' : i === 2 ? 'bg-amber-700 text-amber-100' : 'bg-slate-700 text-slate-300'
                )}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{p.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{p.total_qty || p.total_quantity} adet satıldı</div>
                  <div className="h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${Math.min(100, ((p.total_qty || p.total_quantity) / ((topProducts[0]?.total_qty || DEMO_TOP[0]?.total_qty) || 1)) * 100)}%` }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-orange-400">₺{Number(p.total_revenue).toLocaleString('tr-TR')}</div>
                  <div className="text-xs text-slate-400">{p.order_count} sipariş</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Yoğunluk Haritası */}
      {activeTab === 'peak' && (
        <div className="card">
          <h2 className="font-semibold text-white mb-2">🔥 Haftalık Yoğunluk Haritası</h2>
          <p className="text-xs text-slate-400 mb-5">Son 90 günlük sipariş sayısına göre renklendirme yapılmıştır.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left text-slate-400 pb-2 pr-2">Gün \ Saat</th>
                  {Array.from({ length: 24 }, (_, h) => (
                    <th key={h} className="text-center text-slate-500 pb-2 px-0.5" style={{ minWidth: '28px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_NAMES.map((day, dayIdx) => (
                  <tr key={day}>
                    <td className="text-slate-400 pr-2 py-1 font-medium">{day}</td>
                    {peakHeatmap[dayIdx].map(({ hour, count }) => {
                      const maxCount = Math.max(...peakHeatmap.flat().map(x => x.count), 1);
                      const intensity = count / maxCount;
                      const bgColor = count === 0 ? '#1e293b'
                        : intensity < 0.2 ? '#1d4020'
                        : intensity < 0.4 ? '#166534'
                        : intensity < 0.6 ? '#d97706'
                        : intensity < 0.8 ? '#ea580c'
                        : '#dc2626';
                      return (
                        <td key={hour} className="py-1 px-0.5">
                          <div
                            className="w-6 h-6 rounded-sm mx-auto flex items-center justify-center cursor-default"
                            style={{ backgroundColor: bgColor }}
                            title={`${day} ${hour}:00 — ${count} sipariş`}
                          >
                            {count > 10 && <span className="text-white text-xs font-bold">{count}</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <span className="text-xs text-slate-500">Düşük</span>
            {['#1e293b','#1d4020','#166534','#d97706','#ea580c','#dc2626'].map(c => (
              <div key={c} className="w-4 h-4 rounded-sm" style={{ backgroundColor: c }} />
            ))}
            <span className="text-xs text-slate-500">Yüksek</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Demo verileri
const DEMO_FORECAST = [
  { date: '2026-04-17', day_of_week: 5, predicted_revenue: 5200, confidence: 'medium' },
  { date: '2026-04-18', day_of_week: 6, predicted_revenue: 7800, confidence: 'medium' },
  { date: '2026-04-19', day_of_week: 0, predicted_revenue: 6500, confidence: 'medium' },
  { date: '2026-04-20', day_of_week: 1, predicted_revenue: 3800, confidence: 'low' },
  { date: '2026-04-21', day_of_week: 2, predicted_revenue: 4200, confidence: 'low' },
  { date: '2026-04-22', day_of_week: 3, predicted_revenue: 4600, confidence: 'medium' },
  { date: '2026-04-23', day_of_week: 4, predicted_revenue: 5100, confidence: 'medium' },
];
const DEMO_TOP = [
  { id: 'p1', name: 'Izgara Tavuk', total_qty: 48, total_revenue: 8640, order_count: 38 },
  { id: 'p2', name: 'Karışık Pizza', total_qty: 31, total_revenue: 6820, order_count: 28 },
  { id: 'p3', name: 'Bonfile Steak', total_qty: 24, total_revenue: 9120, order_count: 22 },
  { id: 'p4', name: 'Cheeseburger', total_qty: 19, total_revenue: 3040, order_count: 19 },
  { id: 'p5', name: 'Baklava', total_qty: 15, total_revenue: 1800, order_count: 15 },
];
const DEMO_STOCK = [
  { id: 'i1', name: 'Domates', unit: 'kg', current_stock: 3, critical_stock: 5, daily_use: 1.2, days_remaining: 2, forecast_status: 'urgent', suggested_order_qty: 17 },
  { id: 'i2', name: 'Makarna', unit: 'kg', current_stock: 1.5, critical_stock: 3, daily_use: 0.3, days_remaining: 5, forecast_status: 'warning', suggested_order_qty: 4 },
  { id: 'i3', name: 'Tavuk Göğsü', unit: 'gram', current_stock: 5000, critical_stock: 2000, daily_use: 300, days_remaining: 16, forecast_status: 'ok', suggested_order_qty: 4200 },
  { id: 'i4', name: 'Un', unit: 'kg', current_stock: 25, critical_stock: 5, daily_use: 0.8, days_remaining: 31, forecast_status: 'ok', suggested_order_qty: 11 },
];
const DEMO_CAMPAIGNS = [
  { type: 'discount', product_name: 'Çoban Salatası', suggestion: '"Çoban Salatası" için %15 indirim kampanyası', reason: 'Son 7 günde sadece 3 adet satıldı', current_price: 85, suggested_price: 72 },
  { type: 'happy_hour', hour: 15, suggestion: 'Saat 15:00 - 16:00 arası "Happy Hour" kampanyası', reason: 'Bu saatte aylık ortalama sadece 2 sipariş alınıyor' },
  { type: 'discount', product_name: 'Sütlaç', suggestion: '"Sütlaç" + İçecek combo paketi', reason: 'Tatlı kategorisi zayıf performans gösteriyor', current_price: 95, suggested_price: 80 },
];
const DEMO_MENU_MIX = [
  { id: 'p1', name: 'Izgara Tavuk', category: 'star', total_qty: 48, total_revenue: 8640 },
  { id: 'p2', name: 'Bonfile Steak', category: 'puzzle', total_qty: 12, total_revenue: 4560 },
  { id: 'p3', name: 'Ayran', category: 'plow-horse', total_qty: 85, total_revenue: 2125 },
  { id: 'p4', name: 'Sütlaç', category: 'dog', total_qty: 5, total_revenue: 475 },
];
const DEMO_WAITERS = [
  { id: 'u1', name: 'Ali Yılmaz', order_count: 42, total_revenue: 8820, avg_order_value: 210, unique_tables: 28, avg_service_minutes: 35 },
  { id: 'u2', name: 'Fatma Demir', order_count: 38, total_revenue: 7980, avg_order_value: 210, unique_tables: 24, avg_service_minutes: 28 },
  { id: 'u3', name: 'Mehmet Kaya', order_count: 29, total_revenue: 5510, avg_order_value: 190, unique_tables: 19, avg_service_minutes: 42 },
];
