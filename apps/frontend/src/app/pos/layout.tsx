'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { ChefHat, LayoutGrid, ClipboardList, UtensilsCrossed, Truck, BarChart3, Settings, LogOut, Bell } from 'lucide-react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { getSocket } from '@/lib/socket';
import { useOrderStore } from '@/store/orderStore';
import toast from 'react-hot-toast';

export default function POSLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, tenant, logout, isAuthenticated } = useAuthStore();
  const { updateOrderFromSocket } = useOrderStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // WebSocket bağlan
    const socket = getSocket();

    socket.on('order.created', (order) => {
      updateOrderFromSocket(order);
      if (user?.role !== 'kitchen') {
        toast('🍽️ Yeni sipariş #' + order.order_number, { icon: '🆕' });
      }
    });

    socket.on('order.status_changed', (order) => {
      updateOrderFromSocket(order);
      if (order.status === 'ready') {
        toast.success(`Sipariş #${order.order_number} hazır!`);
      }
    });

    socket.on('stock.alert', (data) => {
      toast.error(`⚠️ Kritik stok: ${data.name}`, { duration: 6000 });
    });

    return () => {
      socket.off('order.created');
      socket.off('order.status_changed');
      socket.off('stock.alert');
    };
  }, [isAuthenticated]);

  const navItems = [
    { href: '/pos/tables', icon: LayoutGrid, label: 'Masalar', roles: ['admin','manager','waiter'] },
    { href: '/pos/orders', icon: ClipboardList, label: 'Siparişler', roles: ['admin','manager','waiter'] },
    { href: '/pos/kitchen', icon: UtensilsCrossed, label: 'Mutfak', roles: ['admin','manager','kitchen'] },
    { href: '/pos/delivery', icon: Truck, label: 'Teslimat', roles: ['admin','manager','courier'] },
    { href: '/admin/dashboard', icon: BarChart3, label: 'Yönetim', roles: ['admin','manager'] },
    { href: '/admin/settings', icon: Settings, label: 'Ayarlar', roles: ['admin'] },
  ].filter(item => item.roles.includes(user?.role || ''));

  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 lg:w-56 flex flex-col bg-dark-800 border-r border-slate-700/50 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-3 py-5 border-b border-slate-700/50">
          <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-500/20">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div className="hidden lg:block min-w-0">
            <div className="text-sm font-bold text-white truncate">{tenant?.name || 'RestoPOS'}</div>
            <div className="text-xs text-slate-400 capitalize">{user?.role}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={clsx('sidebar-item', pathname === item.href && 'active')}>
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="hidden lg:block">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="p-2 border-t border-slate-700/50">
          <div className="hidden lg:block px-3 py-2 mb-1">
            <div className="text-sm font-medium text-slate-200 truncate">{user?.name}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
          <button
            onClick={() => { logout(); router.push('/login'); }}
            className="sidebar-item w-full hover:text-red-400"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="hidden lg:block">Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
