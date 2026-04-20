'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  TrendingUp, ShoppingBag, Users, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle,
  BarChart2, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import dayjs from 'dayjs';

export default function DashboardPage() {
  const { tenant } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = dayjs().format('YYYY-MM-DD');
    const weekAgo = dayjs().subtract(7, 'day').format('YYYY-MM-DD');

    Promise.all([
      api.get('/reports/dashboard').catch(() => null),
      api.get('/reports/sales', { params: { startDate: weekAgo, endDate: today, groupBy: 'day' } }).catch(() => null),
      api.get('/reports/products', { params: { startDate: today, endDate: today, limit: 5 } }).catch(() => null),
      api.get('/reports/hourly').catch(() => null),
    ]).then(([dashRes, salesRes, prodRes, hourRes]: any) => {
      setStats((dashRes?.data || dashRes)?.today_stats || DEMO_STATS);
      setSalesData((salesRes?.data || salesRes) || DEMO_SALES);
      setTopProducts(((prodRes?.data || prodRes)?.data || prodRes?.data || prodRes) || DEMO_TOP_PRODUCTS);
      setHourlyData((hourRes?.data || hourRes) || DEMO_HOURLY);
    }).finally(() => setLoading(false));
  }, []);

  const statCards = [
    {
      label: 'Günlük Ciro',
      value: `₺${Number(stats?.today_revenue || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.1)',
      change: '+12%',
      up: true,
    },
    {
      label: 'Toplam Sipariş',
      value: stats?.today_orders || '0',
      icon: ShoppingBag,
      color: '#f97316',
      bg: 'rgba(249,115,22,0.1)',
      change: '+8%',
      up: true,
    },
    {
      label: 'Aktif Siparişler',
      value: stats?.active_orders || '0',
      icon: Clock,
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.1)',
      change: null,
      up: null,
    },
    {
      label: 'Dolu Masa',
      value: stats?.occupied_tables || '0',
      icon: Users,
      color: '#a855f7',
      bg: 'rgba(168,85,247,0.1)',
      change: null,
      up: null,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">{dayjs().format('D MMMM YYYY, dddd')}</p>
        </div>
        <button onClick={() => window.location.reload()} className="btn-secondary py-2 px-3">
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:block text-sm">Yenile</span>
        </button>
      </div>

      {/* Stat kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="card">
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: card.bg }}
              >
                <card.icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              {card.change && (
                <div className={`flex items-center gap-1 text-xs font-semibold ${card.up ? 'text-green-400' : 'text-red-400'}`}>
                  {card.up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {card.change}
                </div>
              )}
            </div>
            <div className="text-2xl font-bold text-white mb-1">{loading ? '...' : card.value}</div>
            <div className="text-sm text-slate-400">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Satış grafiği */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Son 7 Günlük Ciro</h2>
            <span className="badge badge-pending text-xs">Haftalık</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `₺${v}`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#f1f5f9' }}
                formatter={(v: any) => [`₺${Number(v).toLocaleString('tr-TR')}`, 'Ciro']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5}
                fill="url(#revenueGrad)" dot={{ fill: '#f97316', r: 4 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* En çok satanlar */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">🏆 En Çok Satanlar</h2>
          <div className="space-y-3">
            {topProducts.slice(0, 5).map((p: any, i: number) => (
              <div key={p.id || i} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-yellow-500 text-yellow-900' :
                  i === 1 ? 'bg-slate-400 text-slate-900' :
                  i === 2 ? 'bg-amber-700 text-amber-100' : 'bg-slate-700 text-slate-300'
                }`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.total_quantity || p.qty} adet</div>
                </div>
                <div className="text-xs font-semibold text-orange-400">
                  ₺{Number(p.total_revenue || 0).toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Saatlik yoğunluk */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">📊 Saatlik Yoğunluk (Bugün)</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={hourlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v}:00`} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#f1f5f9' }}
              formatter={(v: any) => [v, 'Sipariş']}
              labelFormatter={(l) => `${l}:00 - ${l}:59`}
            />
            <Bar dataKey="order_count" fill="#f97316" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Demo verileri
const DEMO_STATS = { today_revenue: 4850, today_orders: 23, active_orders: 4, occupied_tables: 6 };
const DEMO_SALES = [
  { period: '04-10', revenue: 3200 }, { period: '04-11', revenue: 4100 },
  { period: '04-12', revenue: 2900 }, { period: '04-13', revenue: 5600 },
  { period: '04-14', revenue: 4800 }, { period: '04-15', revenue: 3700 },
  { period: '04-16', revenue: 4850 },
];
const DEMO_TOP_PRODUCTS = [
  { name: 'Izgara Tavuk', total_quantity: 48, total_revenue: 8640 },
  { name: 'Karışık Pizza', total_quantity: 31, total_revenue: 6820 },
  { name: 'Bonfile Steak', total_quantity: 24, total_revenue: 9120 },
  { name: 'Çoban Salatası', total_quantity: 19, total_revenue: 1615 },
  { name: 'Baklava', total_quantity: 15, total_revenue: 1800 },
];
const DEMO_HOURLY = [
  { hour: 10, order_count: 2 }, { hour: 11, order_count: 5 }, { hour: 12, order_count: 12 },
  { hour: 13, order_count: 18 }, { hour: 14, order_count: 8 }, { hour: 15, order_count: 4 },
  { hour: 16, order_count: 3 }, { hour: 17, order_count: 6 }, { hour: 18, order_count: 14 },
  { hour: 19, order_count: 21 }, { hour: 20, order_count: 16 }, { hour: 21, order_count: 9 },
];
