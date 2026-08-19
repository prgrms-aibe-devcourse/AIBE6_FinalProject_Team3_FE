'use client';

import { notFound, useParams } from 'next/navigation';
import { type LandingDemoKey } from '../../types/domain';
import { PreviewClient } from './PreviewClient';

const VALID_KEYS: readonly LandingDemoKey[] = ['market', 'contract', 'deposit', 'checklist'];

function isLandingDemoKey(value: string): value is LandingDemoKey {
  return (VALID_KEYS as readonly string[]).includes(value);
}

export default function Page() {
  const params = useParams<{ key: string }>();

  if (!isLandingDemoKey(params.key)) {
    notFound();
  }

  return <PreviewClient demoKey={params.key} />;
}
