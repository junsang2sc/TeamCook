import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import useStore from '../store/useStore'

const CONTEXTS = ['회사 TF', '학회', '동아리', '강의 팀 프로젝트', '스터디']

const FLOW_STEPS = [
  { icon: '📂', label: '스킬 데이터 업로드' },
  { icon: '🔍', label: '자동 분석' },
  { icon: '✅', label: '최적 팀 배치' },
]

const FLOW_OPTIONS = [
  {
    id: 'new',
    icon: '◈',
    label: '신규 배치',
    sublabel: '처음부터 팀을 만들 때',
    cta: '신규배치 시작하기',
    bullets: [
      '전체 구성원을 빈 팀에 처음 배정',
      '코사인 유사도 기반 최적 배치',
      '스킬 희귀도·SPOF 자동 경고',
    ],
  },
  {
    id: 're',
    icon: '◉',
    label: '재배치',
    sublabel: '기존 팀에서 인원을 조정할 때',
    cta: '재배치 시작하기',
    bullets: [
      '잉여 인력·스킬 갭 시나리오 지원',
      '차출 가능 여부 자동 검증',
      '변경 전/후 비교 대시보드',
    ],
  },
  {
    id: 'tf',
    icon: '◇',
    label: 'TF 구성',
    sublabel: '여러 팀에서 인원을 차출할 때',
    cta: 'TF 구성 시작하기',
    bullets: [
      '필수 스킬 보유자 자동 탐색',
      '기존 팀 공백 없는 인원만 선발',
      '차출 전/후 팀 영향도 시각화',
    ],
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const { skills, members, reset, currentStep, placementType, setPlacementType } = useStore()
  const [showResume, setShowResume] = useState(false)

  useEffect(() => {
    if (skills.length > 0 || members.length > 0) setShowResume(true)
  }, [])

  const handleStart = (type) => {
    setPlacementType(type)
    navigate('/step/1')
  }

  const handleResume = () => navigate(`/step/${currentStep || 1}`)

  const handleReset = (type) => {
    reset()
    setShowResume(false)
    setPlacementType(type)
    navigate('/step/1')
  }

  const typeLabel = placementType === 're' ? '재배치' : placementType === 'tf' ? 'TF 구성' : '신규배치'

  return (
    <div className="min-h-screen bg-canvas-dark text-on-dark flex flex-col">
      {/* Nav — 아이콘만 */}
      <nav className="px-8 py-4 flex items-center border-b border-[rgba(255,255,255,0.08)]">
        <img src="/TeamCook Icon.png" alt="TeamCooK" className="h-9 w-auto" />
      </nav>

      <main className="flex-1 flex flex-col">

        {/* ① 헤드카피 */}
        <section className="flex flex-col items-center text-center px-6 pt-16 pb-16">
          {/* 로고 */}
          <img src="/TeamCooK Logo.png" alt="TeamCooK" className="h-10 w-auto mb-10" />
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-5">
            아는 사람 말고,{' '}
            <span className="gradient-brand">맞는 사람으로!</span>
          </h1>
          <p className="text-base text-body">
            스킬 택소노미 기반 팀 구성
          </p>
        </section>

        {/* ② 3단계 플로우 */}
        <section className="flex items-center justify-center gap-0 px-6 pb-16">
          <div className="flex items-center gap-0 border border-[rgba(255,255,255,0.1)] rounded-sm overflow-hidden">
            {FLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex items-center gap-3 px-6 py-4">
                  <span className="text-xl">{step.icon}</span>
                  <span className="text-sm font-medium text-on-dark whitespace-nowrap">{step.label}</span>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <div className="w-px h-10 bg-[rgba(255,255,255,0.12)]" />
                )}
              </div>
            ))}
          </div>
          {/* arrows between */}
        </section>

        {/* ③ 배치 유형 선택 카드 */}
        <section className="px-6 pb-10 max-w-4xl mx-auto w-full">
          <p className="text-xs font-mono uppercase tracking-widest text-body mb-5 text-center">
            어떤 작업을 하시겠어요?
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {FLOW_OPTIONS.map((flow) => (
              <div
                key={flow.id}
                className="group flex flex-col border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] rounded-sm transition-colors duration-150 hover:border-[rgba(77,158,237,0.5)] hover:bg-surface-dark-soft overflow-hidden"
              >
                {/* 항상 보이는 상단 영역 */}
                <div className="p-6 flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-mono text-xl text-primary">{flow.icon}</span>
                    <div>
                      <div className="text-base font-bold text-on-dark">{flow.label}</div>
                      <div className="text-xs text-body">{flow.sublabel}</div>
                    </div>
                  </div>

                  {/* hover 시 펼쳐지는 불릿 */}
                  <ul className="overflow-hidden max-h-0 group-hover:max-h-32 transition-all duration-300 ease-in-out space-y-1.5">
                    {flow.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-xs text-body leading-relaxed">
                        <span className="text-primary mt-0.5 shrink-0">·</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 시작하기 버튼 */}
                <div className="px-6 pb-6">
                  <button
                    onClick={() => handleStart(flow.id)}
                    className="w-full py-2.5 text-sm font-mono font-medium bg-primary text-on-dark rounded-sm hover:bg-[#3A8ADA] transition-colors cursor-pointer"
                  >
                    {flow.cta} →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ④ 사용 맥락 태그 */}
        <section className="flex flex-wrap justify-center gap-2 px-6 pb-16">
          {CONTEXTS.map((ctx) => (
            <span
              key={ctx}
              className="px-3 py-1.5 bg-surface-dark-soft text-on-dark text-sm font-mono rounded-sm border border-[rgba(255,255,255,0.08)]"
            >
              {ctx}
            </span>
          ))}
        </section>
      </main>

      {/* 재방문 팝업 */}
      {showResume && (skills.length > 0 || members.length > 0) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-canvas text-ink rounded-md p-8 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-lg font-bold mb-1">이전 데이터가 있습니다</h2>
            <p className="text-sm text-body mb-1">유형: <strong>{typeLabel}</strong></p>
            <p className="text-sm text-body mb-6">이어서 진행하시겠습니까?</p>
            <div className="flex gap-3 mb-3">
              <Button variant="primary" className="flex-1" onClick={() => { setShowResume(false); handleResume() }}>
                이어서 하기
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {FLOW_OPTIONS.map((f) => (
                <Button key={f.id} variant="outline" size="sm" onClick={() => { setShowResume(false); handleReset(f.id) }}>
                  {f.label} 새로 시작
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
