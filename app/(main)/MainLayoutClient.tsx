'use client';

import { AlertCircle, Home, LogOut, Menu, Shield, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { navItems } from '../data/navigation';
import { cn } from '../lib/cn';
import { useLogout } from '../lib/useLogout';
import { NoticeBox } from '../ui/NoticeBox';

type MainLayoutClientProps = {
  children: ReactNode;
  nickname: string;
  profileImageUrl: string | null;
  isAdmin: boolean;
};

export default function MainLayoutClient({ children, nickname, profileImageUrl, isAdmin }: MainLayoutClientProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isLoggingOut, logoutError, handleLogout } = useLogout();

  const isActive = (path: string) => pathname === path;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-40 hidden w-full border-b border-slate-200 bg-white md:block">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link href="/home" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
                <Home className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-950">알고계약</span>
            </Link>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    isActive(item.path)
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
              >
                <Shield className="h-4 w-4" />
                관리자 페이지
              </Link>
            )}
            <Link
              href="/mypage"
              className="flex items-center gap-2 rounded-full border border-slate-200 p-1 pl-3 transition-colors hover:bg-slate-50"
            >
              <span className="text-sm font-medium text-slate-700">{nickname}님</span>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200">
                {profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5 text-slate-500" />
                )}
              </div>
            </Link>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-1 rounded-full p-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
            </button>
          </div>
        </div>
      </header>

      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/home" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600">
              <Home className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-950">알고계약</span>
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href="/admin" className="p-2 text-slate-500">
                <Shield className="h-5 w-5" />
              </Link>
            )}
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-500">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {logoutError && (
        <div className="container mx-auto px-4 pt-4">
          <NoticeBox icon={AlertCircle} iconClassName="text-red-500" className="bg-red-50 text-red-600">
            {logoutError}
          </NoticeBox>
        </div>
      )}

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-white md:hidden">
          <div className="flex h-full flex-col p-4">
            <div className="mb-8 flex items-center justify-between">
              <span className="text-xl font-bold text-slate-950">메뉴</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl p-4 text-lg font-medium transition-colors',
                    isActive(item.path) ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <item.icon className="h-6 w-6" />
                  {item.name}
                </Link>
              ))}
              <Link
                href="/mypage"
                onClick={() => setIsMobileMenuOpen(false)}
                className="mt-4 flex items-center gap-3 border-t border-slate-100 p-4 pt-8 text-lg font-medium text-slate-600 hover:bg-slate-50"
              >
                <User className="h-6 w-6" />
                마이페이지
              </Link>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                disabled={isLoggingOut}
                className="flex items-center gap-3 p-4 text-lg font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                <LogOut className="h-6 w-6" />
                {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </nav>
          </div>
        </div>
      )}

      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-slate-200 bg-white px-2 md:hidden">
        {navItems.slice(0, 4).map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={cn(
              'flex h-full w-full flex-col items-center justify-center gap-1 transition-colors',
              isActive(item.path) ? 'text-teal-700' : 'text-slate-400',
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.name}</span>
          </Link>
        ))}
        <Link
          href="/mypage"
          className={cn(
            'flex h-full w-full flex-col items-center justify-center gap-1 transition-colors',
            isActive('/mypage') ? 'text-teal-700' : 'text-slate-400',
          )}
        >
          <User className="h-5 w-5" />
          <span className="text-[10px] font-medium">마이</span>
        </Link>
      </nav>
    </div>
  );
}
