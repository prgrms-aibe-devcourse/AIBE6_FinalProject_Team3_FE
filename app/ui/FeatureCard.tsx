import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

type FeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  iconClassName?: string;
  descriptionClassName?: string;
  className?: string;
  // 있으면 이 카드가 실제 결과 화면과 비슷한 미리보기 페이지로 이동하는 링크 카드가 된다
  // (frontend/app/preview/[key] 참고) - 회원가입 전 방문자용이라 모달이 아니라 실제 페이지
  // 이동으로 구현했다(모달은 보여줄 수 있는 정보량이 너무 제한적이라는 피드백 반영).
  href?: string;
};

export function FeatureCard({
  icon: Icon,
  title,
  description,
  iconClassName,
  descriptionClassName,
  className,
  href,
}: FeatureCardProps) {
  const content = (
    <>
      <Icon className={cn('mb-3 h-5 w-5 text-teal-600', iconClassName)} />
      <p className="mb-1 font-bold text-slate-950">{title}</p>
      <p className={cn('text-xs leading-relaxed text-slate-500', descriptionClassName)}>{description}</p>
      {href && (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-teal-700">
          예시 보러가기 <ArrowRight className="h-3 w-3" />
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn('ansim-card block p-4 transition hover:border-teal-200 hover:shadow-md', className)}
      >
        {content}
      </Link>
    );
  }

  return <div className={cn('ansim-card p-4', className)}>{content}</div>;
}
