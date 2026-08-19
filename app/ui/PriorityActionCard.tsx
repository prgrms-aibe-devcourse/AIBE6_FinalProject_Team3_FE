import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { type PriorityAction } from '../types/domain';

type PriorityActionCardProps = {
  action: PriorityAction;
};

export function PriorityActionCard({ action }: PriorityActionCardProps) {
  return (
    <div className="mb-10 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100">
            <Sparkles className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="mb-1 text-xs font-bold text-indigo-600">다음 할 일</p>
            <h2 className="mb-1 text-lg font-bold text-slate-950">{action.title}</h2>
            <p className="text-sm leading-relaxed text-slate-600">{action.description}</p>
          </div>
        </div>
        {action.onCtaClick ? (
          <button
            type="button"
            onClick={action.onCtaClick}
            className="ansim-button-primary w-fit shrink-0 px-5 py-3 md:self-center"
          >
            {action.ctaLabel}
          </button>
        ) : (
          <Link href={action.ctaHref} className="ansim-button-primary w-fit shrink-0 px-5 py-3 md:self-center">
            {action.ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
