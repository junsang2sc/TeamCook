export const SKILL_PRESETS = {
  it: {
    label: 'IT 개발팀',
    skills: [
      { name: 'React', category: '기술', importance: 4 },
      { name: 'Node.js', category: '기술', importance: 4 },
      { name: 'Python', category: '기술', importance: 4 },
      { name: 'SQL', category: '기술', importance: 3 },
      { name: '머신러닝', category: '기술', importance: 4 },
      { name: 'Docker', category: '기술', importance: 3 },
      { name: '프로젝트 관리', category: '커뮤니케이션', importance: 3 },
      { name: '코드 리뷰', category: '기술', importance: 3 },
      { name: 'AWS', category: '기술', importance: 3 },
      { name: 'UX 설계', category: '도메인 지식', importance: 2 },
    ],
  },
  marketing: {
    label: '마케팅팀',
    skills: [
      { name: '콘텐츠 기획', category: '도메인 지식', importance: 5 },
      { name: 'SNS 운영', category: '기술', importance: 4 },
      { name: '데이터 분석', category: '기술', importance: 4 },
      { name: '카피라이팅', category: '커뮤니케이션', importance: 4 },
      { name: '브랜드 전략', category: '도메인 지식', importance: 5 },
      { name: '광고 집행', category: '기술', importance: 3 },
      { name: '디자인', category: '기술', importance: 3 },
      { name: '발표/PT', category: '커뮤니케이션', importance: 3 },
    ],
  },
  research: {
    label: '학술 연구팀',
    skills: [
      { name: '논문 작성', category: '도메인 지식', importance: 5 },
      { name: '통계 분석', category: '기술', importance: 5 },
      { name: '실험 설계', category: '도메인 지식', importance: 4 },
      { name: '데이터 수집', category: '기술', importance: 3 },
      { name: '발표', category: '커뮤니케이션', importance: 3 },
      { name: '문헌 리뷰', category: '도메인 지식', importance: 4 },
    ],
  },
  club: {
    label: '동아리',
    skills: [
      { name: '기획', category: '커뮤니케이션', importance: 4 },
      { name: '디자인', category: '기술', importance: 3 },
      { name: '개발', category: '기술', importance: 4 },
      { name: '마케팅', category: '도메인 지식', importance: 3 },
      { name: '운영/총무', category: '커뮤니케이션', importance: 3 },
      { name: '대외협력', category: '커뮤니케이션', importance: 3 },
    ],
  },
}

export const SKILL_CATEGORIES = ['기술', '커뮤니케이션', '도메인 지식', '자유입력']

export const ROLE_OPTIONS = ['팀장급', '중간급', '주니어', '자유입력']

export const QUICK_SKILLS = [
  'React', 'Python', 'Java', 'SQL', 'AWS', 'Docker', 'Figma',
  '기획', '마케팅', '데이터 분석', '발표/PT', '프로젝트 관리',
  '머신러닝', 'UX 설계', '영업', '회계', '법무',
]

export const PLACEMENT_MODES = {
  same: {
    id: 'same',
    label: '하나의 과제를 여러 팀이 함께 수행',
    description: '모든 팀에 동일한 필요 스킬 기준 적용 — 팀 간 스킬 균형 분산이 핵심',
  },
  different: {
    id: 'different',
    label: '팀마다 서로 다른 과제 수행',
    description: '각 팀마다 필요 스킬을 별도로 정의 — 과제 적합도 최대화가 핵심',
  },
  mixed: {
    id: 'mixed',
    label: '혼합 (일부는 같은 과제, 일부는 다른 과제)',
    description: '팀 카드별로 독립/공동 과제 토글 선택',
  },
}
