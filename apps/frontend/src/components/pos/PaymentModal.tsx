'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { X, CreditCard, Banknote, Smartphone, Loader2, Calculator } from 'lucide-react';

interface PaymentModalProps {
  order: any;
  onClose: () => void;
  onSuccess: (updatedOrder: any) => void;
}

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Nakit', icon: Banknote, color: '#22c55e' },
  { id: 'card', label: 'Kartla', icon: CreditCard, color: '#3b82f6' },
  { id: 'iyzico', label: 'Online', icon: Smartphone, color: '#a855f7' },
];

export default function PaymentModal({ order, onClose, onSuccess }: PaymentModalProps) {
  const remaining = Number(order.total) - Number(order.paid_amount);
  const [method, setMethod] = useState<'cash' | 'card' | 'iyzico'>('cash');
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [cashGiven, setCashGiven] = useState('');
  const [loading, setLoading] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const parsedCash = parseFloat(cashGiven) || 0;
  const changeAmount = method === 'cash' ? Math.max(0, parsedCash - parsedAmount) : 0;

  const quickAmounts = [
    remaining,
    Math.ceil(remaining / 50) * 50,
    Math.ceil(remaining / 100) * 100,
    Math.ceil(remaining / 200) * 200,
  ].filter((v, i, a) => a.indexOf(v) === i);

  const handlePay = async () => {
    if (parsedAmount <= 0) { toast.error('Geçerli bir tutar girin'); return; }
    if (method === 'cash' && parsedCash > 0 && parsedCash < parsedAmount) {
      toast.error('Verilen tutar yetersiz'); return;
    }

    setLoading(true);
    try {
      const res: any = await api.post(`/payments/order/${order.id}`, {
        method,
        amount: parsedAmount,
        change_amount: changeAmount,
      });
      const data = res.data || res;
      toast.success(
        data.payment.isFullyPaid
          ? '✅ Ödeme tamamlandı!'
          : `✅ ₺${parsedAmount.toFixed(2)} alındı. Kalan: ₺${data.payment.remaining.toFixed(2)}`
      );
      onSuccess(data.order);
    } catch (err: any) {
      toast.error(err.message || 'Ödeme başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-md p-0 overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 gradient-brand">
          <div>
            <h2 className="text-lg font-bold text-white">Ödeme Al</h2>
            <p className="text-sm text-white/80">Sipariş #{order.order_number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Tutar özeti */}
          <div className="flex justify-between items-center p-4 rounded-xl bg-slate-700/50">
            <div>
              <div className="text-sm text-slate-400">Toplam Tutar</div>
              <div className="text-2xl font-bold text-white">₺{Number(order.total).toFixed(2)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">Ödenen</div>
              <div className="text-lg font-semibold text-green-400">₺{Number(order.paid_amount).toFixed(2)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">Kalan</div>
              <div className="text-2xl font-bold text-orange-400">₺{remaining.toFixed(2)}</div>
            </div>
          </div>

          {/* Ödeme yöntemi */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Ödeme Yöntemi</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id as any)}
                  className={clsx(
                    'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                    method === m.id
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-slate-700 bg-slate-700/50 hover:border-slate-500'
                  )}
                >
                  <m.icon className="w-5 h-5" style={{ color: method === m.id ? '#f97316' : '#94a3b8' }} />
                  <span className={`text-xs font-medium ${method === m.id ? 'text-orange-400' : 'text-slate-400'}`}>
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tutar input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Alınan Tutar</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₺</span>
              <input
                type="number"
                className="input pl-8 text-xl font-bold"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>
            {/* Hızlı tutar butonları */}
            <div className="flex gap-2 mt-2">
              {quickAmounts.slice(0, 4).map((q) => (
                <button
                  key={q}
                  onClick={() => { setAmount(q.toFixed(2)); if (method === 'cash') setCashGiven(q.toFixed(2)); }}
                  className="flex-1 py-1.5 rounded-lg bg-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-600 transition-colors"
                >
                  ₺{q.toFixed(0)}
                </button>
              ))}
            </div>
          </div>

          {/* Nakit üstü */}
          {method === 'cash' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Müşterinin Verdiği</label>
              <input
                type="number"
                className="input"
                placeholder="₺0.00"
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                step="0.01"
              />
              {changeAmount > 0 && (
                <div className="flex items-center justify-between mt-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <span className="text-green-400 font-medium">Para Üstü</span>
                  <span className="text-green-400 text-xl font-bold">₺{changeAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Ödeme butonu */}
          <button
            onClick={handlePay}
            disabled={loading || parsedAmount <= 0}
            className="btn-primary w-full py-4 text-lg"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> İşleniyor...</>
            ) : (
              <>✅ ₺{parsedAmount.toFixed(2)} Ödeme Al</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function clsx(...args: any[]) {
  return args.filter(Boolean).join(' ');
}
