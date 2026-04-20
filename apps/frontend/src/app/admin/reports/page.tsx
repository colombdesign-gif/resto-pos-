'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, Users, Package, Calendar, Download } from 'lucide-react';
import dayjs from 'dayjs';

const TABS = ['Satış', 'Ürünler', 'Garsonlar', 'Şubeler', 'Saatlik'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('Satış');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));

  const fetchReport = async () => {
    setLoading(true);
    try {
      const endpoint = {
        'Satış': `/reports/sales?startDate=${startDate}&endDate=${endDate}&groupBy=day`,
        'Ürünler': `/reports/products?startDate=${startDate}&endDate=${endDate}`,
        'Garsonlar': `/reports/waiters?startDate=${startDate}&endDate=${endDate}`,
        'Şubeler': `/reports/branches?startDate=${startDate}&endDate=${endDate}`,
        'Saatlik': `/reports/hourly`,
      }[activeTab];

      const res: any = await api.get(endpoint!);
      setData(res.data || res);
    } catch {
      setData(activeTab === 'Satış' ? DEMO_SALES : activeTab === 'Ürünler' ? DEMO_PRODS : DEMO_WAITERS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [activeTab, startDate, endDate]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Raporlar & Analitik</h1>
          <p className="text-slate-400 text-sm mt-0.5">İş performansınızı takip edin</p>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input type="date" className="input w-auto py-2" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <span className="text-slate-400 self-center">—</span>
        <input type="date" className="input w-auto py-2" value={endDate} onChange={e => setEndDate(e.target.value)} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-xl mb-5 w-fit">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* İçerik */}
      <div className="card">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        ) : activeTab === 'Satış' ? (
          <>
            <h2 className="font-semibold text-white mb-4">Satış Trendi</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `₺${v}`} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#f1f5f9' }} formatter={(v: any) => [`₺${Number(v).toLocaleString('tr-TR')}`, 'Ciro']} />
                <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-700">
              <div className="text-center"><div className="text-xl font-bold text-white">₺{data.reduce((s: number, d: any) => s + Number(d.revenue || 0), 0).toLocaleString('tr-TR')}</div><div className="text-xs text-slate-400">Toplam Ciro</div></div>
              <div className="text-center"><div className="text-xl font-bold text-white">{data.reduce((s: number, d: any) => s + Number(d.order_count || 0), 0)}</div><div className="text-xs text-slate-400">Toplam Sipariş</div></div>
              <div className="text-center"><div className="text-xl font-bold text-white">₺{data.length > 0 ? (data.reduce((s: number, d: any) => s + Number(d.avg_order_value || 0), 0) / data.length).toFixed(2) : '0'}</div><div className="text-xs text-slate-400">Ort. Sipariş</div></div>
            </div>
          </>
        ) : activeTab === 'Ürünler' ? (
          <>
            <h2 className="font-semibold text-white mb-4">Ürün Satış Analizi</h2>
            <div className="space-y-3">
              {data.slice(0, 15).map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="w-6 text-center text-sm font-bold text-slate-400">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white font-medium truncate">{p.name}</span>
                      <span className="text-slate-400 ml-2 flex-shrink-0">{p.total_quantity} adet</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(100, (p.total_quantity / (data[0]?.total_quantity || 1)) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-orange-400 font-bold text-sm flex-shrink-0">₺{Number(p.total_revenue || 0).toLocaleString('tr-TR')}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700">{Object.keys(data[0] || {}).slice(0, 5).map(k => <th key={k} className="text-left px-3 py-2 text-slate-400 font-medium capitalize">{k}</th>)}</tr></thead>
              <tbody>{data.map((row: any, i: number) => <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-700/20"><td colSpan={5} className="px-3 py-2 text-slate-300">{JSON.stringify(row)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const DEMO_SALES = [
  { period: '04-10', revenue: 3200, order_count: 16, avg_order_value: 200 },
  { period: '04-11', revenue: 4100, order_count: 21, avg_order_value: 195 },
  { period: '04-12', revenue: 2900, order_count: 14, avg_order_value: 207 },
  { period: '04-13', revenue: 5600, order_count: 28, avg_order_value: 200 },
  { period: '04-14', revenue: 4800, order_count: 24, avg_order_value: 200 },
  { period: '04-15', revenue: 3700, order_count: 19, avg_order_value: 195 },
  { period: '04-16', revenue: 4850, order_count: 23, avg_order_value: 211 },
];
const DEMO_PRODS = [
  { name: 'Izgara Tavuk', total_quantity: 48, total_revenue: 8640 },
  { name: 'Karışık Pizza', total_quantity: 31, total_revenue: 6820 },
  { name: 'Bonfile Steak', total_quantity: 24, total_revenue: 9120 },
];
const DEMO_WAITERS = [
  { name: 'Ali Yılmaz', order_count: 42, total_revenue: 8400 },
  { name: 'Fatma Demir', order_count: 38, total_revenue: 7600 },
];
