import type { RankedShort, ShortsVideo, VideoSnapshot } from '../types';

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function safePercent(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function rankShorts(
  videos: ShortsVideo[],
  previousByVideo: Map<string, VideoSnapshot>,
  capturedAt = Date.now(),
): RankedShort[] {
  const calculated = videos.map((video) => {
    const previous = previousByVideo.get(video.videoId);
    const ageHours = Math.max(1 / 12, (capturedAt - Date.parse(video.publishedAt)) / 3_600_000);
    const observedHours = previous ? Math.max(1 / 60, (capturedAt - previous.capturedAt) / 3_600_000) : 0;
    const viewDelta = previous ? Math.max(0, video.views - previous.views) : 0;
    const estimatedVelocity = video.views / ageHours;
    const velocity = previous ? viewDelta / observedHours : estimatedVelocity;
    const engagementRate = video.views > 0 ? (video.likes + video.comments * 2) / video.views : 0;

    return {
      ...video,
      velocity: safePercent(velocity),
      viewDelta,
      engagementRate: safePercent(engagementRate),
      dataQuality: previous ? 'observed' as const : 'estimated' as const,
      previousCapturedAt: previous?.capturedAt,
      ageHours,
    };
  });

  const maxLogVelocity = Math.max(1, ...calculated.map((video) => Math.log10(video.velocity + 1)));

  return calculated
    .map((video) => {
      const velocityScore = Math.log10(video.velocity + 1) / maxLogVelocity;
      const recencyScore = Math.exp(-video.ageHours / 72);
      const engagementScore = clamp(video.engagementRate / 0.12);
      const observationBonus = video.dataQuality === 'observed' ? 1 : 0.35;
      const score = Math.round(100 * (
        velocityScore * 0.55
        + recencyScore * 0.23
        + engagementScore * 0.17
        + observationBonus * 0.05
      ));

      const { ageHours: _ageHours, ...ranked } = video;
      return { ...ranked, score: clamp(score, 0, 100), rank: 0 } satisfies RankedShort;
    })
    .sort((a, b) => b.score - a.score || b.velocity - a.velocity)
    .map((video, index) => ({ ...video, rank: index + 1 }));
}
