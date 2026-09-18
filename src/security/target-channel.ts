import type { ChannelProfile, RuntimeConfig } from '../types';

export class TargetChannelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TargetChannelError';
  }
}

export function normalizeChannelHandle(value: string): string {
  let clean = value.trim();
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // Keep the original value if it is not percent-encoded.
  }
  if (/^https?:\/\//i.test(clean)) {
    try {
      const url = new URL(clean);
      clean = url.pathname.split('/').filter(Boolean).find((part) => part.startsWith('@')) ?? clean;
    } catch {
      // The configured value is validated by the comparison below.
    }
  }
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // Keep URL.pathname output if it is not valid percent-encoding.
  }
  return clean.replace(/^@/, '').replace(/\/$/, '').normalize('NFC').toLocaleLowerCase();
}

export function assertTargetChannel(channel: ChannelProfile, config: RuntimeConfig): void {
  if (config.targetChannelId) {
    if (channel.channelId !== config.targetChannelId) {
      throw new TargetChannelError('연결한 Google 계정의 채널이 낭만구조대 채널과 일치하지 않습니다.');
    }
    return;
  }

  const expected = normalizeChannelHandle(config.targetChannelHandle);
  const actual = normalizeChannelHandle(channel.customUrl ?? '');
  if (!expected) throw new TargetChannelError('전용 채널 식별자가 설정되지 않았습니다.');
  if (!actual || actual !== expected) {
    throw new TargetChannelError(
      `연결한 채널(${channel.customUrl ?? channel.title})은 @${expected} 채널이 아닙니다. 올바른 브랜드 채널을 선택해 주세요.`,
    );
  }
}
