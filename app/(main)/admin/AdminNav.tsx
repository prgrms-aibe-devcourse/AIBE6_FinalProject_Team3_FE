'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/cn';

const TABS = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/users', label: '유저 관리' },
  { href: '/admin/reports', label: '신고 관리' },
  { href: '/admin/checklists', label: '체크리스트 관리' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200">
      {TABS.map((tab) => {
        const active = tab.href === '/admin' ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold transition',
              active ? 'border-slate-950 text-slate-950' : 'border-transparent text-slate-400 hover:text-slate-600',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
