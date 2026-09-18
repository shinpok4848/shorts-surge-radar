import type {
  AnalyzedVideo,
  ChannelAnalysis,
  ChannelDataset,
  ChannelVideo,
  ContentKind,
  DataBasis,
  Diagnosis,
  FormatSummary,
  MetricScore,
  VideoGuide,
  WeeklyAction,
} from '../types';

const DAY_MS = 86_400_000;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function median(values: Array<number | null | undefined>): number | null {
  const sorted = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function weightedScore(items: Array<{ value: number | null; weight: number }>): number {
  const available = items.filter((item): item is { value: number; weight: number } => item.value !== null && Number.isFinite(item.value));
  const weights = available.reduce((sum, item) => sum + item.weight, 0);
  if (!weights) return 0;
  return Math.round(available.reduce((sum, item) => sum + item.value * item.weight, 0) / weights);
}

function metric(value: number | null, basis: DataBasis, label: string, detail: string): MetricScore {
  return { value: value === null ? null : Math.round(clamp(value)), basis: value === null ? 'unavailable' : basis, label, detail };
}

function countCharacters(value: string): number {
  return [...value].length;
}

function titleHeuristic(title: string): number {
  const length = countCharacters(title.trim());
  let score = 46;
  if (length >= 22 && length <= 58) score += 22;
  else if (length < 12 || length > 82) score -= 18;
  else score += 7;
  if (/\d/.test(title)) score += 7;
  if (/[?!]/.test(title)) score += 4;
  if (/^#|#{3,}/.test(title)) score -= 13;
  if (/^(대박|충격|소름|무조건|절대)/.test(title)) score -= 8;
  if (/[|｜].{12,}$/.test(title)) score -= 5;
  return clamp(score);
}

function relativeScore(value: number | null, baseline: number | null): number | null {
  if (value === null) return null;
  if (!baseline || baseline <= 0) return value > 0 ? 60 : 20;
  if (value <= 0) return 10;
  return clamp(50 + Math.log2(value / baseline) * 22);
}

function effectiveDays(dataset: ChannelDataset, video: ChannelVideo): number {
  const published = Date.parse(video.publishedAt);
  if (dataset.dateRange) {
    const start = Date.parse(`${dataset.dateRange.startDate}T00:00:00Z`);
    const end = Date.parse(`${dataset.dateRange.endDate}T23:59:59Z`);
    const activeStart = Number.isFinite(published) ? Math.max(start, published) : start;
    return Math.max(1, (end - activeStart) / DAY_MS);
  }
  return Number.isFinite(published) ? Math.max(1, (Date.now() - published) / DAY_MS) : 30;
}

function engagementRate(video: ChannelVideo): number | null {
  const views = video.metrics.views;
  if (views === null || views <= 0) return null;
  const available = [video.metrics.likes, video.metrics.comments, video.metrics.shares].some((value) => value !== null);
  if (!available) return null;
  return ((video.metrics.likes ?? 0) + (video.metrics.comments ?? 0) * 2 + (video.metrics.shares ?? 0) * 3) / views;
}

function retentionPercentage(video: ChannelVideo): number | null {
  if (video.metrics.averagePercentageViewed !== null) return video.metrics.averagePercentageViewed;
  if (video.metrics.averageViewDurationSeconds !== null && video.durationSeconds && video.durationSeconds > 0) {
    return video.metrics.averageViewDurationSeconds / video.durationSeconds * 100;
  }
  return null;
}

function netSubscribers(video: ChannelVideo): number | null {
  const gained = video.metrics.subscribersGained;
  const lost = video.metrics.subscribersLost;
  if (gained === null && lost === null) return null;
  return (gained ?? 0) - (lost ?? 0);
}

function metricBasis(_dataset: ChannelDataset, _privateMetric = false): DataBasis {
  return 'measured';
}

function scoreVideo(
  dataset: ChannelDataset,
  video: ChannelVideo,
  formatVelocityMedian: number | null,
  formatEngagementMedian: number | null,
  formatCtrMedian: number | null,
): AnalyzedVideo['scores'] {
  const views = video.metrics.views;
  const velocity = views === null ? null : views / effectiveDays(dataset, video);
  const reachValue = relativeScore(velocity, formatVelocityMedian);

  const ctr = video.metrics.impressionClickThroughRate;
  const packagingValue = ctr === null
    ? titleHeuristic(video.title)
    : Math.round(clamp((ctr / 7) * 70 + (relativeScore(ctr, formatCtrMedian) ?? 50) * .3));

  const retention = retentionPercentage(video);
  const retentionTarget = video.contentKind === 'short' ? 75 : 45;
  const retentionValue = retention === null ? null : clamp(retention / retentionTarget * 75);

  const engagement = engagementRate(video);
  const engagementTarget = video.contentKind === 'short' ? .055 : .04;
  const engagementValue = engagement === null
    ? null
    : clamp((engagement / engagementTarget * 65) + ((relativeScore(engagement, formatEngagementMedian) ?? 50) * .35));

  const subscribers = netSubscribers(video);
  const subscriberRate = subscribers !== null && views !== null && views > 0 ? subscribers / views * 1000 : null;
  const conversionTarget = video.contentKind === 'short' ? 2.5 : 4;
  const conversionValue = subscriberRate === null ? null : clamp(subscriberRate / conversionTarget * 75);

  return {
    reach: metric(reachValue, metricBasis(dataset), '확산력', velocity === null ? '조회수 데이터 없음' : `활성일 기준 일평균 ${formatCompact(velocity)}회`),
    packaging: metric(
      packagingValue,
      ctr === null ? 'inferred' : 'measured',
      ctr === null ? '제목 포장 추정' : '클릭 포장',
      ctr === null ? 'CTR 없이 제목 구조만 점검' : `노출 클릭률 ${ctr.toFixed(1)}%`,
    ),
    retention: metric(
      retentionValue,
      retention === null ? 'unavailable' : 'measured',
      '시청 유지',
      retention === null ? '평균 조회율 데이터 없음' : `평균 조회율 ${retention.toFixed(1)}%`,
    ),
    engagement: metric(
      engagementValue,
      engagement === null ? 'unavailable' : metricBasis(dataset),
      '반응',
      engagement === null ? '좋아요·댓글 데이터 없음' : `가중 반응률 ${(engagement * 100).toFixed(2)}%`,
    ),
    conversion: metric(
      conversionValue,
      subscriberRate === null ? 'unavailable' : 'measured',
      '구독 전환',
      subscriberRate === null ? '구독 전환 데이터 없음' : `조회 1천회당 순구독 ${subscriberRate.toFixed(1)}명`,
    ),
  };
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function videoDiagnoses(video: ChannelVideo, scores: AnalyzedVideo['scores']): Diagnosis[] {
  const diagnoses: Diagnosis[] = [];
  const ctr = video.metrics.impressionClickThroughRate;
  const retention = retentionPercentage(video);
  const subscriber = netSubscribers(video);
  const views = video.metrics.views;
  const titleLength = countCharacters(video.title);

  if (ctr !== null && ctr < 3.2) {
    diagnoses.push({
      id: `${video.videoId}-low-ctr`, priority: 'high', basis: 'measured', videoId: video.videoId,
      title: '노출을 클릭으로 바꾸지 못하고 있습니다',
      summary: '주제는 노출되고 있지만 제목·썸네일의 약속이 선택을 만들지 못하는 구간입니다.',
      evidence: [`노출 클릭률 ${ctr.toFixed(1)}%`, scores.packaging.detail],
      actions: ['핵심 결과를 제목 첫 30자 안으로 이동', '썸네일 문구는 2~4단어 한 메시지로 축소', 'YouTube Studio에서 제목·썸네일 A/B 테스트 실행'],
    });
  }
  if (retention !== null && retention < (video.contentKind === 'short' ? 55 : 32)) {
    diagnoses.push({
      id: `${video.videoId}-low-retention`, priority: 'critical', basis: 'measured', videoId: video.videoId,
      title: '첫 약속 뒤 시청 유지가 약합니다',
      summary: '클릭 이후 핵심 보상이 늦거나, 제목의 기대와 도입 내용이 다를 가능성이 큽니다.',
      evidence: [`평균 조회율 ${retention.toFixed(1)}%`, `${video.contentKind === 'short' ? '쇼츠 후보' : '일반 영상'} 기준 목표 이하`],
      actions: ['첫 3초 안에 결과 장면 또는 핵심 증거 선공개', '인사·로고·배경 설명을 삭제하거나 뒤로 이동', '한 문장마다 새 정보·화면 변화·질문 중 하나 배치'],
    });
  }
  if (ctr !== null && ctr >= 5.5 && retention !== null && retention < (video.contentKind === 'short' ? 60 : 35)) {
    diagnoses.push({
      id: `${video.videoId}-promise-gap`, priority: 'high', basis: 'measured', videoId: video.videoId,
      title: '포장은 강하지만 내용이 약속을 따라가지 못합니다',
      summary: '클릭은 충분합니다. 제목과 썸네일에서 약속한 장면을 영상 앞부분으로 당겨야 합니다.',
      evidence: [`CTR ${ctr.toFixed(1)}%`, `평균 조회율 ${retention.toFixed(1)}%`],
      actions: ['썸네일 속 결과를 첫 장면에서 바로 확인', '제목의 핵심 질문에 15초 안에 1차 답변', '후반부 보상을 기다리게 하는 불필요한 예고 제거'],
    });
  }
  if (scores.retention.value !== null && scores.retention.value >= 75 && scores.reach.value !== null && scores.reach.value < 45) {
    diagnoses.push({
      id: `${video.videoId}-hidden-winner`, priority: 'opportunity', basis: 'measured', videoId: video.videoId,
      title: '내용은 강합니다—포장과 배포를 다시 시험할 후보입니다',
      summary: '시청자는 남아 있지만 충분한 확산을 얻지 못했습니다.',
      evidence: [scores.retention.detail, scores.reach.detail],
      actions: ['제목·썸네일 새 조합으로 A/B 테스트', '같은 핵심 내용을 다른 훅의 후속 영상으로 제작', '성과가 좋은 관련 영상의 엔드스크린·고정댓글에서 연결'],
    });
  }
  if (subscriber !== null && views !== null && views >= 1000 && subscriber / views * 1000 < .5) {
    diagnoses.push({
      id: `${video.videoId}-low-conversion`, priority: 'medium', basis: 'measured', videoId: video.videoId,
      title: '조회가 채널 관계로 이어지지 않습니다',
      summary: '개별 영상은 소비되지만 다음 영상까지 볼 이유가 충분히 전달되지 않았습니다.',
      evidence: [`조회 ${formatCompact(views)}회`, `순구독 ${subscriber.toLocaleString('ko-KR')}명`],
      actions: ['영상 중간에 다음 편의 구체적 효익을 한 문장으로 예고', '같은 문제를 3편 시리즈로 묶고 제목 규칙 통일', '일반적인 구독 요청 대신 다음 영상 주제를 CTA로 사용'],
    });
  }
  if (titleLength > 72 || titleLength < 10 || /^#|#{3,}/.test(video.title)) {
    diagnoses.push({
      id: `${video.videoId}-title-structure`, priority: 'medium', basis: 'inferred', videoId: video.videoId,
      title: '제목의 핵심 메시지가 흐려질 수 있습니다',
      summary: '모바일에서 먼저 보이는 앞부분에 주제·결과·차별점이 남도록 압축해 보세요.',
      evidence: [`제목 길이 ${titleLength}자`, '공개 메타데이터 기반 구조 점검'],
      actions: ['중복 수식어와 채널명을 뒤로 이동', '핵심 검색어·결과를 첫 30자에 배치', '해시태그는 제목 대신 설명 하단에서 보조적으로 사용'],
    });
  }
  if (video.tags.length > 15) {
    diagnoses.push({
      id: `${video.videoId}-tag-focus`, priority: 'medium', basis: 'public', videoId: video.videoId,
      title: '태그보다 제목·썸네일·유지율에 시간을 옮기세요',
      summary: '태그는 오탈자 보정에 유용하지만 발견 성과의 핵심 수단은 아닙니다.',
      evidence: [`현재 태그 ${video.tags.length}개`],
      actions: ['핵심 주제·고유명사·오탈자 변형 3~6개만 유지', '남은 시간은 썸네일 대비와 첫 30초 재편집에 투자'],
    });
  }

  return diagnoses;
}

const STOP_WORDS = new Set(['그리고', '하지만', '하는', '있는', '없는', '이것', '저것', '영상', '쇼츠', 'shorts', 'youtube', '유튜브', '정말', '진짜']);

function topicWords(video: ChannelVideo): string[] {
  const fromTitle = video.title
    .replace(/[#()[\]{}|｜!?.,:;“”"']/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word.toLocaleLowerCase()));
  const fromTags = video.tags.map((tag) => tag.replace(/^#/, '').trim()).filter((tag) => tag.length >= 2);
  return [...new Set([...fromTitle, ...fromTags])].slice(0, 6);
}

function guideFor(video: ChannelVideo): VideoGuide {
  const words = topicWords(video);
  const subject = words.slice(0, 2).join(' ') || video.title.slice(0, 20);
  const object = words[2] ?? (video.contentKind === 'short' ? '결과' : '핵심 과정');
  const isShort = video.contentKind === 'short';
  return {
    titleOptions: [
      `${subject}, ${object}부터 바꾸면 달라집니다`,
      `${subject}에서 놓치기 쉬운 3가지`,
      `${subject} 직접 해보니 가장 먼저 고칠 것은`,
    ],
    thumbnailCopy: [`${subject}의 차이`, '여기서 갈립니다', '직접 확인'],
    thumbnailDirection: '문구는 2~4단어만 사용하고, 결과 장면 1개와 원인 장면 1개를 강한 명암 차이로 배치하세요.',
    hookOptions: [
      `“${subject}, 대부분 이 장면에서 결과가 갈립니다.”`,
      `완성 결과를 먼저 보여준 뒤 “같은 조건에서 무엇을 바꿨는지 보세요.”`,
      `흔한 방법과 개선 방법을 1초 간격으로 나란히 비교`,
    ],
    structure: isShort ? [
      { range: '0–2초', purpose: '약속', direction: '결과·반전·실패 장면 중 가장 강한 한 컷을 먼저 보여줍니다.' },
      { range: '2–8초', purpose: '맥락', direction: '누가 어떤 상황에서 왜 필요한지 한 문장으로 제한합니다.' },
      { range: '8–25초', purpose: '핵심', direction: '한 컷당 한 정보만 전달하고 3단계 이내로 전개합니다.' },
      { range: '25–45초', purpose: '증거', direction: '직접 비교·수치·전후 장면으로 주장에 증거를 붙입니다.' },
      { range: '마지막 3초', purpose: '다음 행동', direction: '시청자의 경험을 묻거나 다음 편의 구체적 실험을 예고합니다.' },
    ] : [
      { range: '0–15초', purpose: '결과 선공개', direction: '제목·썸네일의 약속을 실제 장면으로 증명합니다.' },
      { range: '15–45초', purpose: '로드맵', direction: '얻게 될 결과와 3개 핵심 구간을 명확히 안내합니다.' },
      { range: '본론 1/3', purpose: '빠른 성과', direction: '가장 즉시 적용 가능한 내용을 먼저 제공합니다.' },
      { range: '본론 2/3', purpose: '차별 증거', direction: '직접 실험·비교·실패 사례를 배치합니다.' },
      { range: '마지막 10%', purpose: '회수와 연결', direction: '처음 질문을 회수하고 관련 후속 영상 하나로 연결합니다.' },
    ],
    supportingTags: [...new Set(words.map((word) => word.toLocaleLowerCase()))].slice(0, 6),
  };
}

function formatSummaries(analyzed: AnalyzedVideo[]): FormatSummary[] {
  return (['short', 'video'] as ContentKind[]).map((kind) => {
    const videos = analyzed.filter((video) => video.contentKind === kind);
    const top = [...videos].sort((a, b) => (b.metrics.views ?? 0) - (a.metrics.views ?? 0))[0];
    return {
      kind,
      count: videos.length,
      views: videos.reduce((sum, video) => sum + (video.metrics.views ?? 0), 0),
      medianViewsPerDay: median(videos.map((video) => video.velocityPerDay)) ?? 0,
      medianEngagementRate: median(videos.map((video) => video.engagementRate)),
      medianClickThroughRate: median(videos.map((video) => video.metrics.impressionClickThroughRate)),
      medianAveragePercentageViewed: median(videos.map(retentionPercentage)),
      topVideoId: top?.videoId,
    };
  }).filter((summary) => summary.count > 0);
}

function consistencyScore(videos: ChannelVideo[]): MetricScore {
  const timestamps = videos.map((video) => Date.parse(video.publishedAt)).filter(Number.isFinite).sort((a, b) => b - a).slice(0, 20);
  if (timestamps.length < 3) return metric(null, 'unavailable', '업로드 일관성', '게시일 데이터가 부족합니다.');
  const gaps = timestamps.slice(0, -1).map((time, index) => Math.max(1, (time - timestamps[index + 1]) / DAY_MS));
  const average = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
  const deviation = Math.sqrt(gaps.reduce((sum, value) => sum + (value - average) ** 2, 0) / gaps.length);
  const variation = deviation / average;
  return metric(clamp(88 - variation * 42), 'public', '업로드 일관성', `최근 업로드 간격 평균 ${average.toFixed(1)}일`);
}

function channelDiagnoses(
  dataset: ChannelDataset,
  videos: AnalyzedVideo[],
  formats: FormatSummary[],
  consistency: MetricScore,
): Diagnosis[] {
  const diagnoses: Diagnosis[] = [];
  const totalViews = videos.reduce((sum, video) => sum + (video.metrics.views ?? 0), 0);
  const topThreeViews = [...videos].sort((a, b) => (b.metrics.views ?? 0) - (a.metrics.views ?? 0)).slice(0, 3)
    .reduce((sum, video) => sum + (video.metrics.views ?? 0), 0);
  const concentration = totalViews > 0 ? topThreeViews / totalViews : 0;
  const ctrMedian = median(videos.map((video) => video.metrics.impressionClickThroughRate));
  const retentionMedian = median(videos.map(retentionPercentage));
  const conversionRates = videos.map((video) => {
    const net = video.netSubscribers;
    const views = video.metrics.views;
    return net !== null && views !== null && views > 0 ? net / views * 1000 : null;
  });
  const conversionMedian = median(conversionRates);

  if (concentration > .65 && videos.length >= 6) {
    diagnoses.push({
      id: 'channel-view-concentration', priority: 'high', basis: metricBasis(dataset),
      title: '조회가 소수 영상에 과도하게 집중돼 있습니다',
      summary: '상위 영상의 성공 공식을 시리즈로 복제하되 주제·사례·결론은 새롭게 확장해야 합니다.',
      evidence: [`상위 3개 영상이 전체 분석 조회의 ${(concentration * 100).toFixed(0)}% 차지`],
      actions: ['상위 3개 영상의 공통 주제·첫 문장·길이를 한 장에 정리', '각 성공 영상에서 후속 질문 3개를 뽑아 시리즈화', '저성과 주제는 2회 이상 반복하기 전 가설을 다시 설정'],
    });
  }
  if (ctrMedian !== null && ctrMedian < 3.8) {
    diagnoses.push({
      id: 'channel-packaging', priority: 'critical', basis: 'measured',
      title: '채널 전체의 제목·썸네일 실험이 먼저입니다',
      summary: '개별 태그 수정에 앞서 영상의 약속과 시각적 선택 이유를 강화해야 합니다.',
      evidence: [`영상 CTR 중앙값 ${ctrMedian.toFixed(1)}%`],
      actions: ['최근 일반 영상 3개에 제목·썸네일 A/B 테스트', '제목 첫 30자에 결과 또는 갈등 배치', '썸네일 요소를 인물/대상/결과 중 최대 2개로 제한'],
    });
  }
  if (retentionMedian !== null && retentionMedian < 42) {
    diagnoses.push({
      id: 'channel-retention', priority: 'critical', basis: 'measured',
      title: '더 많은 업로드보다 도입부 재설계가 우선입니다',
      summary: '평균적으로 영상의 핵심 보상이 늦게 등장하고 있을 가능성이 큽니다.',
      evidence: [`평균 조회율 중앙값 ${retentionMedian.toFixed(1)}%`],
      actions: ['첫 30초에서 인사·로고·중복 설명 제거', '제목의 답을 15초 내 1차 공개', '성과 상·하위 영상의 첫 30초를 문장 단위로 비교'],
    });
  }
  if (conversionMedian !== null && conversionMedian < 1) {
    diagnoses.push({
      id: 'channel-conversion', priority: 'high', basis: 'measured',
      title: '영상 소비는 채널 구독 이유와 분리돼 있습니다',
      summary: '각 영상이 채널의 반복 가능한 약속으로 연결되도록 시리즈 구조가 필요합니다.',
      evidence: [`조회 1천회당 순구독 중앙값 ${conversionMedian.toFixed(1)}명`],
      actions: ['채널이 매주 해결하는 문제를 한 문장으로 고정', '영상 말미에 관련 다음 편 하나만 추천', '제목과 썸네일에 반복 가능한 시리즈 시각 규칙 적용'],
    });
  }
  if (consistency.value !== null && consistency.value < 50) {
    diagnoses.push({
      id: 'channel-consistency', priority: 'medium', basis: 'public',
      title: '업로드 간격의 편차가 학습 속도를 늦춥니다',
      summary: '양을 무리하게 늘리기보다 지킬 수 있는 최소 발행 리듬을 정하세요.',
      evidence: [consistency.detail],
      actions: ['일반 영상과 쇼츠를 별도 리듬으로 계획', '촬영일·편집일·발행일을 묶은 2주 배치 제작', '성과 검토일을 발행 48시간 후로 고정'],
    });
  }

  if (formats.length === 2) {
    const [shorts, longform] = ['short', 'video'].map((kind) => formats.find((format) => format.kind === kind));
    if (shorts && longform) {
      const winner = shorts.medianViewsPerDay >= longform.medianViewsPerDay ? shorts : longform;
      const loser = winner.kind === 'short' ? longform : shorts;
      if (winner.medianViewsPerDay > loser.medianViewsPerDay * 2) {
        diagnoses.push({
          id: 'format-opportunity', priority: 'opportunity', basis: metricBasis(dataset),
          title: `${winner.kind === 'short' ? '쇼츠 후보' : '일반 영상'}에서 확산 공식이 더 선명합니다`,
          summary: '강한 포맷의 주제를 다른 포맷으로 그대로 복사하지 말고 역할을 나눠 연결하세요.',
          evidence: [`일평균 조회 중앙값 ${formatCompact(winner.medianViewsPerDay)} vs ${formatCompact(loser.medianViewsPerDay)}`],
          actions: winner.kind === 'short'
            ? ['쇼츠는 문제·결과 발견용, 일반 영상은 과정·증거 심화용으로 연결', '상위 쇼츠 댓글 질문을 다음 일반 영상 목차로 사용']
            : ['일반 영상의 강한 한 장면을 독립된 쇼츠 아이디어로 재촬영', '쇼츠에서 전체 영상 홍보보다 하나의 완결된 팁 제공'],
        });
      }
    }
  }

  if (!diagnoses.length) {
    diagnoses.push({
      id: 'channel-opportunity', priority: 'opportunity', basis: metricBasis(dataset),
      title: '명확한 치명점보다 성공 패턴 확장이 우선입니다',
      summary: '상위 영상의 공통 주제와 구조를 후속 실험으로 전환하세요.',
      evidence: [`분석 영상 ${videos.length.toLocaleString('ko-KR')}개`],
      actions: ['상위 20% 영상의 공통 키워드 3개 추출', '같은 시청자 문제를 다른 사례로 3편 제작', '각 업로드 후 48시간에 한 가지 가설만 검토'],
    });
  }
  return diagnoses.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority)).slice(0, 8);
}

function priorityOrder(priority: Diagnosis['priority']): number {
  return { critical: 0, high: 1, medium: 2, opportunity: 3 }[priority];
}

function weeklyPlan(videos: AnalyzedVideo[], diagnoses: Diagnosis[]): WeeklyAction[] {
  const top = [...videos].sort((a, b) => b.healthScore - a.healthScore)[0];
  const weak = [...videos].sort((a, b) => a.healthScore - b.healthScore)[0];
  const topTitle = top?.title ?? '상위 영상';
  const weakTitle = weak?.title ?? '최근 영상';
  const mainIssue = diagnoses[0]?.title ?? '성과 패턴 확인';
  return [
    { day: 'DAY 1', title: '상·하위 영상 해부', detail: `“${topTitle}”와 “${weakTitle}”의 제목, 첫 30초, 길이를 나란히 비교합니다.`, outcome: '차이를 만든 가설 3개' },
    { day: 'DAY 2', title: '한 가지 문제만 선택', detail: mainIssue, outcome: '이번 주 핵심 지표 1개' },
    { day: 'DAY 3', title: '포장 3안 제작', detail: '같은 내용으로 제목 3안과 썸네일 문구 3안을 만들고 약속이 일치하는 조합을 고릅니다.', outcome: '업로드 전 포장 세트' },
    { day: 'DAY 4', title: '오프닝 먼저 편집', detail: '완성 장면·핵심 증거·시청 이유를 첫 구간에 배치한 뒤 나머지를 편집합니다.', outcome: '이탈을 줄인 첫 30초' },
    { day: 'DAY 5', title: '발행과 내부 연결', detail: '관련 영상 1개를 고정댓글·설명·엔드스크린으로 연결합니다.', outcome: '다음 시청 경로' },
    { day: 'DAY 6', title: '초기 신호 기록', detail: '조회수만 보지 말고 CTR, 평균 조회율, 순구독을 같은 시간대에 기록합니다.', outcome: '비교 가능한 기준선' },
    { day: 'DAY 7', title: '다음 실험 결정', detail: '성과가 아니라 가설의 적중 여부를 판단하고 다음 영상에서는 한 요소만 바꿉니다.', outcome: '다음 주 실험 1개' },
  ];
}

export function analyzeChannel(dataset: ChannelDataset): ChannelAnalysis {
  const formatBaselines = new Map<ContentKind, {
    velocity: number | null;
    engagement: number | null;
    ctr: number | null;
  }>();

  for (const kind of ['short', 'video'] as ContentKind[]) {
    const videos = dataset.videos.filter((video) => video.contentKind === kind);
    formatBaselines.set(kind, {
      velocity: median(videos.map((video) => video.metrics.views === null ? null : video.metrics.views / effectiveDays(dataset, video))),
      engagement: median(videos.map(engagementRate)),
      ctr: median(videos.map((video) => video.metrics.impressionClickThroughRate)),
    });
  }

  const analyzed = dataset.videos.map((video) => {
    const baseline = formatBaselines.get(video.contentKind) ?? { velocity: null, engagement: null, ctr: null };
    const scores = scoreVideo(dataset, video, baseline.velocity, baseline.engagement, baseline.ctr);
    const healthScore = weightedScore([
      { value: scores.reach.value, weight: .30 },
      { value: scores.packaging.value, weight: .25 },
      { value: scores.retention.value, weight: .25 },
      { value: scores.engagement.value, weight: .12 },
      { value: scores.conversion.value, weight: .08 },
    ]);
    return {
      ...video,
      rank: 0,
      healthScore,
      velocityPerDay: video.metrics.views === null ? null : video.metrics.views / effectiveDays(dataset, video),
      engagementRate: engagementRate(video),
      netSubscribers: netSubscribers(video),
      scores,
      diagnoses: videoDiagnoses(video, scores),
      guide: guideFor(video),
    } satisfies AnalyzedVideo;
  }).sort((a, b) => b.healthScore - a.healthScore || (b.metrics.views ?? 0) - (a.metrics.views ?? 0))
    .map((video, index) => ({ ...video, rank: index + 1 }));

  const formats = formatSummaries(analyzed);
  const consistency = consistencyScore(dataset.videos);
  const component = (key: keyof AnalyzedVideo['scores'], label: string): MetricScore => {
    const value = median(analyzed.map((video) => video.scores[key].value));
    const representative = analyzed.find((video) => video.scores[key].value !== null)?.scores[key];
    return metric(value, representative?.basis ?? 'unavailable', label, representative?.detail ?? '데이터 없음');
  };
  const scores = {
    reach: component('reach', '확산력'),
    packaging: component('packaging', '클릭 포장'),
    retention: component('retention', '시청 유지'),
    engagement: component('engagement', '반응'),
    conversion: component('conversion', '구독 전환'),
    consistency,
  };
  const overallScore = weightedScore([
    { value: scores.reach.value, weight: .22 },
    { value: scores.packaging.value, weight: .20 },
    { value: scores.retention.value, weight: .24 },
    { value: scores.engagement.value, weight: .12 },
    { value: scores.conversion.value, weight: .12 },
    { value: scores.consistency.value, weight: .10 },
  ]);
  const coveragePoints = analyzed.reduce((sum, video) => sum
    + (video.metrics.views !== null ? 1 : 0)
    + (video.metrics.impressionClickThroughRate !== null ? 1 : 0)
    + (retentionPercentage(video) !== null ? 1 : 0)
    + (video.netSubscribers !== null ? 1 : 0)
    + (video.engagementRate !== null ? 1 : 0), 0);
  const metricCoverage = analyzed.length ? Math.round(coveragePoints / (analyzed.length * 5) * 100) : 0;
  const diagnoses = channelDiagnoses(dataset, analyzed, formats, consistency);

  return {
    overallScore,
    confidence: dataset.source === 'studio-csv' ? 'studio' : 'owner',
    metricCoverage,
    scores,
    formats,
    diagnoses,
    videos: analyzed,
    weeklyPlan: weeklyPlan(analyzed, diagnoses),
  };
}
