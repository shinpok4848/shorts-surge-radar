import type { RegionCode } from '../types';

const HANGUL = /[\uac00-\ud7a3]/;
const JAPANESE_KANA = /[\u3040-\u30ff]/;

// Titles for KR/JP feeds frequently include off-language spam even with a regionCode,
// so require a native script for those regions. US/GB stay unfiltered.
export function titleMatchesRegion(title: string, region: RegionCode): boolean {
  if (region === 'KR') return HANGUL.test(title);
  if (region === 'JP') return JAPANESE_KANA.test(title);
  return true;
}

export function hasHangul(value: string): boolean {
  return HANGUL.test(value);
}
