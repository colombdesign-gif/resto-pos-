'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import clsx from 'clsx';
import {
  LayoutDashboard, UtensilsCrossed, Package, Users, BarChart3,
  Building2, Settings, ChefHat, LogOut, ArrowLeft, Brain, UserCog
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/menu', icon: UtensilsCrossed, label: 'Menü Yönetimi' },
  { href: '/admin/inventory', icon: Package, label: 'Stok & Reçete' },
  { href: '/admin/customers', icon: Users, label: 'Müşteriler' },
  { href: '/admin/users', icon: UserCog, label: 'Kullanıcılar' },
  { href: '/admin/reports', icon: BarChart3, label: 'Raporlar' },
  { href: '/admin/analytics', icon: Brain, label: 'AI Analitik' },
  { href: '/admin/branches', icon: Building2, label: 'Şubeler' },
  { href: '/admin/settings', icon: Settings, label: 'Ayarlar' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, tenant, logout, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else if (!['admin', 'manager'].includes(user?.role || '')) {
      router.push('/pos/tables');
    }
  }, [isAuthenticated, user]);

  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-dark-800 border-r border-slate-700/50 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
          <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center shadow-md shadow-orange-500/20">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{tenant?.name}</div>
            <div className="text-xs text-orange-400 capitalize">{user?.role} Paneli</div>
          </div>
        </div>

        {/* POS'a dön */}
        <div className="p-2 border-b border-slate-700/30">
          <Link href="/pos/tables">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
              <ArrowLeft className="w-4 h-4" />
              POS Ekranına Dön
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={clsx('sidebar-item', pathname === item.href && 'active')}>
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-slate-700/50">
          <div className="px-2 py-2 mb-1">
            <div className="text-sm font-semibold text-slate-200 truncate">{user?.name}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
          <button
            onClick={() => { logout(); router.push('/login'); }}
            className="sidebar-item w-full hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-dark-900">
        {children}
      </main>
    </div>
  );
}
