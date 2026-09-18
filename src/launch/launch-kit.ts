import type {
  CalendarEntry,
  HookTemplate,
  LaunchInputs,
  LaunchKit,
  NicheBlueprint,
  RetentionCheck,
  SeriesConcept,
} from '../types';
import { blueprintById } from './niches';

const DAY_MS = 86_400_000;

// Hook library grounded in short-form retention behavior: the first 1-2 seconds
// decide whether the viewer stays, so every pattern front-loads tension or payoff.
const HOOK_LIBRARY: HookTemplate[] = [
  { category: '결과 선공개', pattern: '완성/최종 결과를 첫 프레임에 노출', example: '“이게 최종 결과입니다. 어떻게 했을까요?”', why: '보상을 먼저 보여줘 이탈을 막고 과정을 궁금하게 만듭니다.' },
  { category: '통념 반박', pattern: '흔한 믿음을 즉시 부정', example: '“대부분 이걸 반대로 알고 있습니다.”', why: '기존 지식과 충돌시켜 확인 욕구를 자극합니다.' },
  { category: '손실 회피', pattern: '모르면 손해라는 위험 제시', example: '“이거 모르면 계속 손해 봅니다.”', why: '이득보다 손실 회피가 클릭을 강하게 유발합니다.' },
  { category: '즉시성', pattern: '지금·1초·오늘 같은 즉각 보상', example: '“1초 만에 확인하는 법.”', why: '노력 대비 즉각 보상을 약속해 진입 장벽을 낮춥니다.' },
  { category: '호기심 격차', pattern: '핵심 정보를 살짝 감추기', example: '“마지막 한 가지가 진짜입니다.”', why: '정보 공백을 만들어 끝까지 보게 합니다.' },
  { category: '동일시', pattern: '시청자의 상황을 지목', example: '“아직도 이렇게 하세요?”', why: '자신의 이야기라고 느끼면 이탈하지 않습니다.' },
  { category: '반전 예고', pattern: '결말이 뒤집힌다고 암시', example: '“끝까지 보면 완전히 달라집니다.”', why: '엔딩까지의 시청 지속을 끌어올립니다.' },
];

function topicWords(topic: string, fallback: string[]): string[] {
  const words = topic
    .replace(/[#()[\]{}!?.,:;“”"']/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
  return words.length ? words.slice(0, 5) : fallback;
}

function buildSeries(niche: NicheBlueprint, subject: string): SeriesConcept[] {
  return niche.formats.slice(0, 3).map((format, index) => {
    const names = [`${subject} 바로잡기`, `${subject} 3초 정리`, `${subject} 실전편`];
    return {
      name: names[index] ?? `${subject} 시리즈 ${index + 1}`,
      premise: `${niche.promise} — ${format} 포맷으로 매 회 하나의 문제만 다룹니다.`,
      episodePattern: `EP.## | ${format} | 고정 인트로 로고 없이 훅부터 시작`,
      visualRule: index === 0
        ? '좌상단 시리즈 배지, 하단 자막 2줄 고정, 밝은 대비 색 1개'
        : index === 1
          ? '숫자 카운터(1/3, 2/3, 3/3)로 진행 표시'
          : '전/후 화면을 동일 구도로 분할 비교',
      sampleEpisodes: [
        `${subject}에서 가장 흔한 실수`,
        `${subject}, 이 순서만 바꿔도 달라집니다`,
        `${subject} 초보가 놓치는 한 가지`,
      ],
    };
  });
}

function focusForDay(index: number): CalendarEntry['focus'] {
  // Rotate emphasis so the channel trains every growth lever, not just reach.
  const cycle: CalendarEntry['focus'][] = ['reach', 'retention', 'engagement', 'reach', 'conversion'];
  return cycle[index % cycle.length];
}

function ctaForFocus(focus: CalendarEntry['focus']): string {
  return {
    reach: '저장하고 싶으면 저장 버튼, 주변에 공유해 주세요',
    retention: '끝에 반전이 있으니 끝까지 보세요',
    engagement: '여러분 방식은 어떤지 댓글로 알려주세요',
    conversion: '이런 실전 팁이 매일 올라옵니다. 구독하면 놓치지 않아요',
  }[focus];
}

function isoDate(value: string): Date {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed) : new Date();
}

function buildCalendar(
  series: SeriesConcept[],
  subject: string,
  inputs: LaunchInputs,
): CalendarEntry[] {
  const start = isoDate(inputs.startDateLocal);
  const perWeek = inputs.cadencePerWeek;
  // Spread posts evenly across each week based on the chosen cadence.
  const weekdayGaps = perWeek >= 7
    ? [0, 1, 2, 3, 4, 5, 6]
    : perWeek === 5
      ? [0, 1, 2, 3, 4]
      : [0, 2, 4];
  const formatter = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  const entries: CalendarEntry[] = [];
  let dayCounter = 0;
  for (let week = 0; entries.length < 30; week += 1) {
    for (const gap of weekdayGaps) {
      if (entries.length >= 30) break;
      const date = new Date(start.getTime() + (week * 7 + gap) * DAY_MS);
      const seriesConcept = series[entries.length % series.length];
      const hook = HOOK_LIBRARY[entries.length % HOOK_LIBRARY.length];
      const focus = focusForDay(entries.length);
      entries.push({
        day: entries.length + 1,
        dateLabel: formatter.format(date),
        seriesName: seriesConcept.name,
        workingTitle: `${subject} · ${seriesConcept.sampleEpisodes[entries.length % seriesConcept.sampleEpisodes.length]}`,
        hook: hook.example,
        focus,
        cta: ctaForFocus(focus),
      });
      dayCounter += 1;
    }
    if (dayCounter > 400) break; // Safety guard against infinite loops.
  }
  return entries;
}

function retentionChecklist(): RetentionCheck[] {
  return [
    { label: '0–2초 훅', target: '이탈 최소화', detail: '로고·인사 없이 결과나 갈등을 먼저 보여줍니다.' },
    { label: '자막 가독성', target: '무음 시청 대응', detail: '핵심 단어를 큰 자막으로, 한 화면 2줄 이내로 유지합니다.' },
    { label: '한 컷 한 정보', target: '지루함 방지', detail: '1.5~2.5초마다 화면·정보·소리 중 하나를 바꿉니다.' },
    { label: '루프 설계', target: '평균 조회율 100% 초과', detail: '마지막 프레임이 첫 프레임과 자연스럽게 이어지게 만듭니다.' },
    { label: '단일 메시지', target: '완주율 상승', detail: '영상 하나에 주제 하나. 곁가지는 다음 편으로 미룹니다.' },
    { label: '엔딩 CTA', target: '구독·댓글 전환', detail: '다음 영상 예고 또는 시청자 경험을 묻는 질문으로 마칩니다.' },
  ];
}

export function generateLaunchKit(inputs: LaunchInputs): LaunchKit {
  const niche = blueprintById(inputs.nicheId);
  const fallback = niche.keywords.slice(0, 3);
  const words = topicWords(inputs.topic, fallback);
  const subject = words.slice(0, 2).join(' ') || niche.label;
  const series = buildSeries(niche, subject);
  const calendar = buildCalendar(series, subject, inputs);

  return {
    niche,
    channelPromise: `${subject}에 대해 ${niche.promise}`,
    visualIdentity: [
      '채널명·프로필·배너에 한 문장 약속을 그대로 노출',
      '모든 썸네일에 동일한 색 1개와 폰트 1개만 사용',
      '시리즈별 좌상단 배지로 채널을 3초 안에 각인',
      '9:16 세로 고정, 안전 영역 밖에 UI 겹치지 않기',
    ],
    series,
    hooks: HOOK_LIBRARY,
    calendar,
    retentionChecklist: retentionChecklist(),
    weeklyReview: [
      '조회수보다 평균 조회율과 시청 유지 그래프를 먼저 봅니다.',
      '가장 잘된 영상의 첫 3초를 그대로 다음 영상에 재사용합니다.',
      '이탈이 급감하는 지점을 찾아 그 구간을 짧게 다시 편집합니다.',
      '한 주에 한 가지 변수(훅/길이/자막)만 바꿔 실험합니다.',
      '상위 영상 주제를 다음 주 시리즈로 3편 더 확장합니다.',
    ],
    firstWeekActions: [
      `채널명과 소개에 “${subject} ${niche.promise}”를 한 문장으로 고정`,
      `시리즈 1개(${series[0].name})로 첫 5편을 배치 촬영`,
      `${inputs.cadencePerWeek >= 7 ? '매일' : `주 ${inputs.cadencePerWeek}회`} 같은 시간대에 발행 예약`,
      '첫 3초 훅 3안을 만들어 CapCut 작업팩으로 대본화',
      '발행 48시간 뒤 평균 조회율만 기록해 기준선 확보',
    ],
    createdAt: new Date().toISOString(),
  };
}
