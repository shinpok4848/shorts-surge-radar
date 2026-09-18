import type { NicheBlueprint } from '../types';

// Blueprints reflect proven short-form growth patterns: a sharp channel promise,
// a repeatable format, hook angles that stop the scroll, and a realistic cadence.
export const NICHE_BLUEPRINTS: NicheBlueprint[] = [
  {
    id: 'how-to-fix',
    label: '문제 해결 · 하우투',
    promise: '흔한 실수를 60초 안에 고쳐주는 채널',
    audience: '지금 당장 문제를 해결하고 싶은 실사용자',
    formats: ['잘못된 방법 vs 올바른 방법 비교', '3단계 즉효 해결', '이거 하나만 바꾸세요'],
    hookAngles: ['대부분 여기서 틀립니다', '이거 모르면 계속 실패합니다', '1초 만에 확인하는 법'],
    keywords: ['방법', '실수', '해결', '팁', '고치는법'],
    postingCadence: '주 5회 이상, 같은 시간대 고정',
    monetizationPath: '시청 유지 → 구독 → 제휴/디지털 상품',
  },
  {
    id: 'satisfying-process',
    label: '과정·비포애프터',
    promise: '결과가 확실한 변화를 짧게 보여주는 채널',
    audience: '몰입감과 완성 쾌감을 원하는 시청자',
    formats: ['비포→애프터 원컷', '타임랩스 + 핵심 순간', '실패→성공 반전'],
    hookAngles: ['결과부터 보여드릴게요', '이게 이렇게 바뀝니다', '끝까지 보면 반전'],
    keywords: ['비포애프터', '변화', '과정', '결과', '만들기'],
    postingCadence: '주 5회, 결과 장면 우선 편집',
    monetizationPath: '도달 확장 → 브랜드 협업 → 제품/키트 판매',
  },
  {
    id: 'micro-education',
    label: '지식·요약',
    promise: '어려운 개념을 60초로 정리해주는 채널',
    audience: '빠르게 배우고 싶은 학습형 시청자',
    formats: ['오해 바로잡기', '핵심 3가지', '한 장면 비유로 이해'],
    hookAngles: ['다들 반대로 알고 있습니다', '이거 하나면 정리 끝', '왜 아무도 안 알려줄까요'],
    keywords: ['정리', '핵심', '이유', '차이', '한번에'],
    postingCadence: '주 3~5회, 시리즈 넘버링 고정',
    monetizationPath: '저장·공유 → 구독 → 강의/뉴스레터',
  },
  {
    id: 'reaction-opinion',
    label: '리액션·관점',
    promise: '남들이 지나친 지점을 콕 집어주는 채널',
    audience: '새로운 시각과 토론을 즐기는 시청자',
    formats: ['이 장면 다시 보기', '내 생각은 다릅니다', '숨은 디테일 해설'],
    hookAngles: ['아무도 이 부분을 얘기 안 합니다', '사실은 이게 핵심입니다', '이 장면 하나로 설명됩니다'],
    keywords: ['해설', '관점', '분석', '반전', '디테일'],
    postingCadence: '주 5~7회, 화제성 즉시 대응',
    monetizationPath: '댓글·공유 → 커뮤니티 → 멤버십',
  },
  {
    id: 'daily-life-hack',
    label: '일상·라이프핵',
    promise: '오늘 바로 써먹는 생활 팁 채널',
    audience: '실용 정보를 모으는 폭넓은 일반 시청자',
    formats: ['몰랐던 기능', '3초 꿀팁', '이렇게 쓰면 편합니다'],
    hookAngles: ['이거 진작 알았으면', '왜 이제 알았을까', '아직도 이렇게 하세요?'],
    keywords: ['꿀팁', '생활', '기능', '노하우', '추천'],
    postingCadence: '주 7회, 짧고 빠른 컷',
    monetizationPath: '광범위 도달 → 구독 → 쿠팡/제휴',
  },
];

export function blueprintById(id: string): NicheBlueprint {
  return NICHE_BLUEPRINTS.find((niche) => niche.id === id) ?? NICHE_BLUEPRINTS[0];
}
