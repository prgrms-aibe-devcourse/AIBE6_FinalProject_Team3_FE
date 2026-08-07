import { type PropertyTradeType } from '../types/domain';

export function getJeonseRatioDisplay(type: PropertyTradeType, jeonseRatio: number | undefined): string {
  if (type === '월세') {
    return '판정불가(전세 매물만 계산됩니다)';
  }

  return jeonseRatio !== undefined ? `${jeonseRatio}%` : '준비 중';
}
