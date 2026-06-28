import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList } from 'recharts'
import Button from '../components/ui/Button'
import useStore from '../store/useStore'

/* ─── 색상 토큰 (design.md) ─────────────────────────── */
const C = {
  primary:   '#2ECC87',
  teal:      '#FFE586',
  navy:      '#2ECC87',
  canvas:    '#FAFBFC',
  surface:   '#eefcf9',
  hairline:  '#c9eade',
  ink:       '#1A1A1A',
  body:      '#007542',
  onDark:    '#FAFBFC',
}

/* ─── 데이터 ─────────────────────────────────────────── */
const CONTEXTS = ['회사 TF', '학회', '동아리', '강의 팀 프로젝트', '스터디']

const FLOW_OPTIONS = [
  {
    id: 'new',
    icon: '/icon/folder icon.png',
    label: '신규 배치',
    sublabel: '처음부터 팀을 만들 때',
    cta: '신규배치 시작하기',
    tag: '개인의 강점에 과제를 맞춤',
    bullets: [
      '스킬 데이터 업로드 한 번으로 시작',
      '희귀 스킬·병목 인재를 자동으로 파악',
      'ILP 알고리즘이 전체 최적 팀 구성 산출',
    ],
  },
  {
    id: 're',
    icon: '/icon/glass icon.png',
    label: '재배치',
    sublabel: '기존 팀에서 인원을 조정할 때',
    cta: '재배치 시작하기',
    tag: '받는 팀까지 고려해 재배치',
    bullets: [
      '기존 팀 스킬 현황과 차출 가능 여부 자동 검증',
      '잉여 인력 흡수·스킬 갭 보완 시나리오 지원',
      '이동 전/후 스킬 커버리지 변화를 한눈에 비교',
    ],
  },
  {
    id: 'tf',
    icon: '/icon/check icon.png',
    label: 'TF 구성',
    sublabel: '여러 팀에서 인원을 차출할 때',
    cta: 'TF 구성 시작하기',
    tag: '핵심 인재를 지키고 나머지로 짬',
    bullets: [
      'TF 필수 스킬 보유자를 자동으로 탐색',
      '원팀에 공백이 생기지 않는 인원만 선발',
      '차출 전/후 원팀 스킬 변화를 즉시 경고',
    ],
  },
]

const PROBLEMS = [
  { icon: '📞', label: '아는 사람 먼저',  desc: '오늘도 팀장들에게 전화를 돌렸어요' },
  { icon: '📊', label: '데이터는 있는데', desc: '스킬·역량 데이터는 있지만 배치 결정에 어떻게 써야할지 모르겠어요' },
  { icon: '🎲', label: '결과는 감으로',   desc: '좋은 사람이 엉뚱한 팀에 가고, 특정 인재에게만 일이 몰려요' },
]

const SOLUTIONS = [
  { icon: '🍳', label: '신규배치', desc: '처음부터 팀을 구성할 때 스킬 적합도 기반으로 전체 인원을 최적 배치', accent: C.surface },
  { icon: '🔄', label: '재배치',   desc: '팀이 해체되거나 인원 조정이 필요할 때 기존 팀을 유지하면서 잉여 인력을 최적 흡수', accent: C.surface },
  { icon: '⚡', label: 'TF 구성', desc: '신규 TF를 꾸려야 할 때 기존 팀 공백 없이 최소 인원으로 최적 조합', accent: C.surface },
]

const HOW_STEPS = [
  { step: '01', label: '스킬 데이터 업로드', desc: '구성원 정보와 스킬 역량 점수를 엑셀로 업로드합니다', color: C.primary },
  { step: '02', label: '자동 분석',          desc: '스킬 희귀도, 인재 유형, SPOF 탐지, 수요-공급 분석을 자동 수행합니다', color: C.teal },
  { step: '03', label: '최적 팀 배치',       desc: '조건 설정 후 알고리즘이 최적 배치를 생성합니다', color: C.hairline },
]

const FAQ = [
  {
    q: '스킬 택소노미(Skill Taxonomy)란?',
    a: '구성원마다 다르게 부르던 스킬 이름을 하나의 기준으로 통일한 목록이에요.\nTeamCook은 이 목록을 기반으로 사람과 과제를 연결합니다.',
  },
  {
    q: 'SPOF란?',
    a: '특정 스킬을 딱 한 명만 갖고 있을 때, 그 사람이 빠지면 팀 전체가 그 역량을 잃게 되는 상황이에요.\nTeamCook은 이 위험을 자동으로 감지합니다.',
  },
  {
    q: 'ILP란?',
    a: 'Integer Linear Programming의 약자예요.\n500명 × 20개 과제의 모든 배치 조합을 동시에 고려해서 전체 적합도가 가장 높은 조합을 찾아주는 알고리즘입니다.\n사람이 순서대로 팀을 짜면 나중 팀이 불리해지는 문제를 해결합니다.',
  },
  {
    q: '적합도(Fit Score)란?',
    a: '이 사람이 이 과제에 얼마나 잘 맞는지를 나타내는 점수예요.\n해당 과제에 필요한 스킬을 얼마나, 얼마나 잘 갖고 있는지를 계산합니다.\n희귀하거나 수요가 많은 스킬에는 더 높은 가중치가 붙습니다.',
  },
]

/* ─── 도형 스펙 ──────────────────────────────────────── */
// startX: 시작 x 오프셋(px), startY: 시작 y(음수=위), landX: 착지 x 오프셋
// 위치(landX) 왼→오: 세모(-52) / 동그라미(0) / 네모(52)
// 낙하 순서(delay): 동그라미(0) → 세모(0.18) → 네모(0.36)
const SHAPES = [
  { id: 'circle',   delay: 0,    color: '#FFE586', type: 'circle',   startX:    0, startY: 50, landX:   0, initRotate: -30 },
  { id: 'triangle', delay: 0.18, color: '#FFABB5', type: 'triangle', startX:  -80, startY: 50, landX: -52, initRotate:  15 },
  { id: 'diamond',  delay: 0.36, color: '#B5F0DE', type: 'diamond',  startX:  110, startY: 0, landX:  52, initRotate:  45 },
]

const POT_HERO = 300   // 히어로 시 냄비 크기
const POT_LAND = 120   // 랜딩 정착 후 냄비 크기
const LOOP_SCALE = POT_LAND / POT_HERO  // 0.4

function ShapeSVG({ type, color, scale = 1 }) {
  const s = scale
  if (type === 'circle')   return <svg width={40*s} height={40*s}><circle cx={20*s} cy={20*s} r={20*s} fill={color}/></svg>
  if (type === 'triangle') return <svg width={40*s} height={40*s}><polygon points={`${20*s},${2*s} ${38*s},${38*s} ${2*s},${38*s}`} fill={color}/></svg>
  return <svg width={44*s} height={44*s}><polygon points={`${22*s},${2*s} ${42*s},${22*s} ${22*s},${42*s} ${2*s},${22*s}`} fill={color}/></svg>
}

/* ─── 애니메이션 헬퍼 ────────────────────────────────── */
// amount: 0.4 → 요소의 40%가 뷰포트에 들어와야 트리거
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.8 },
  transition: { duration: 0.6, delay, ease: 'easeOut' },
})

const Eyebrow = ({ children, dark }) => (
  <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: dark ? C.teal : C.body }}>
    {children}
  </p>
)

/* ═══════════════════════════════════════════════════════ */
/* ─── 루프 애니메이션 상수 ───────────────────────────── */
const LOOP_GAP   = 1.0   // 도형 간 시작 간격(초)
const LOOP_DUR   = 1.4   // 도형 하나의 애니메이션 지속(초)
const LOOP_TOTAL = 4.8   // 전체 사이클 (뚜껑 닫힘·바운스·열림 여유 포함)
const LOOP_REPEAT_DELAY = LOOP_TOTAL - LOOP_DUR  // 3.4s

// pot 치수 (120px 너비 기준)
const POT_W  = POT_LAND           // 120
const POT_H  = Math.round(POT_LAND * 517 / 934)  // ≈ 66px (냄비 높이)

// 마지막 재료(i=2)가 pot에 닿는 시점 = 2*GAP + DUR*0.70 ≈ 2.98s
const COVER_CLOSE_AT  = (SHAPES.length - 1) * LOOP_GAP + LOOP_DUR * 0.70  // 2.98
const COVER_CLOSE_DUR = 0.35   // 뚜껑 닫히는 데 걸리는 시간
const POT_BOUNCE_DELAY        = COVER_CLOSE_AT + COVER_CLOSE_DUR           // 3.33s
const POT_BOUNCE_DUR          = 0.45
const COVER_OPEN_AT           = POT_BOUNCE_DELAY + POT_BOUNCE_DUR           // 3.78s
const COVER_OPEN_DUR          = 0.50
const POT_BOUNCE_REPEAT_DELAY = LOOP_TOTAL - POT_BOUNCE_DUR                 // 4.35s

// 뚜껑 회전 keyframe times (0~1, LOOP_TOTAL 기준)
const T = (s) => s / LOOP_TOTAL
const COVER_TIMES = [0, T(COVER_CLOSE_AT), T(COVER_CLOSE_AT + COVER_CLOSE_DUR), T(COVER_OPEN_AT), T(COVER_OPEN_AT + COVER_OPEN_DUR), 1]

const SHAPE_SCALE = LOOP_SCALE * 2   // 재료 크기 = 냄비 비율 × 2배

function LoopingShapes() {
  const halfBase = (type) => (type === 'diamond' ? 22 : 20) * SHAPE_SCALE
  return SHAPES.map((s, i) => (
    <motion.div
      key={s.id}
      className="absolute"
      style={{ left: '50%', marginLeft: s.landX * LOOP_SCALE - halfBase(s.type), top: 0 }}
      animate={{
        y:       [-40, 50, 50],
        opacity: [1, 1, 0],
        scale:   [1, 1, 0],
        rotate:  [s.initRotate, 0, 0],
      }}
      transition={{
        duration: LOOP_DUR,
        delay: i * LOOP_GAP,
        repeat: Infinity,
        repeatDelay: LOOP_REPEAT_DELAY,
        ease: 'easeIn',
        times: [0, 0.70, 0.71],
      }}
    >
      <ShapeSVG type={s.type} color={s.color} scale={SHAPE_SCALE} />
    </motion.div>
  ))
}

export default function Landing() {
  const navigate = useNavigate()
  const { skills, members, reset, currentStep, placementType, setPlacementType } = useStore()
  const [showResume, setShowResume] = useState(false)
  // 최초 방문 여부 (세션 단위)
  const heroPlayed = typeof sessionStorage !== 'undefined'
    && sessionStorage.getItem('teamcook_hero_played') === '1'
  const [phase, setPhase] = useState(heroPlayed ? 3 : 0)
  const [openFaq, setOpenFaq] = useState(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setShowResume(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (skills.length > 0 || members.length > 0) setShowResume(true)
    if (heroPlayed) return   // 재방문: 애니메이션 스킵
    const t1 = setTimeout(() => setPhase(1), 700)
    const t2 = setTimeout(() => setPhase(2), 2400)
    const t3 = setTimeout(() => {
      setPhase(3)
      sessionStorage.setItem('teamcook_hero_played', '1')
    }, 3400)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const handleStart = (type) => { setPlacementType(type); navigate('/step/1') }
  const handleResume = () => navigate(`/step/${currentStep || 1}`)
  const typeLabel = placementType === 're' ? '재배치' : placementType === 'tf' ? 'TF 구성' : '신규배치'

  // stagger 딜레이 (wrapper 안 자식들은 CSS transition으로 처리)
  const staggerDelay = (i) => (phase >= 3 ? i * 0.18 : 0)

  return (
    <div className="min-h-screen text-ink" style={{ backgroundColor: C.canvas }}>

      {/* ── Navbar ──────────────────────────────────── */}
      <nav className="px-8 py-4 flex items-center justify-between border-b" style={{ borderColor: C.hairline, backgroundColor: C.canvas }}>
        <img src="/TeamCook Icon.png" alt="TeamCooK" className="h-9 w-auto" />
        <div className="flex items-center gap-6">
          <a href="#about" className="text-sm font-mono hover:opacity-70 transition-opacity" style={{ color: C.body }}>
            서비스 소개 ↓
          </a>
          <button onClick={() => navigate('/archive')} className="text-sm font-mono hover:opacity-70 transition-opacity" style={{ color: C.body }}>
            내 배치 기록
          </button>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════
          HERO — 히어로 모션
      ════════════════════════════════════════════════ */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-40 pb-16" style={{ minHeight: 'calc(100vh - 69px)' }}>

        {/* 냄비 + 도형 */}
        <motion.div
          className="relative flex items-end justify-center"
          animate={{ height: phase >= 3 ? 80 : 200, marginBottom: phase >= 3 ? 32 : 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: '100%' }}
        >
          {/* 재방문: 루프 애니메이션 */}
          {heroPlayed && <LoopingShapes />}

          {/* 최초 방문: 한 번짜리 낙하 애니메이션 */}
          {!heroPlayed && phase >= 1 && phase < 3 && SHAPES.map((s) => (
            <motion.div
              key={s.id}
              className="absolute"
              style={{ left: '50%', top: 0, marginLeft: s.startX - (s.type === 'diamond' ? 22 : 20) }}
              initial={{ y: s.startY, x: 0, opacity: 0, rotate: s.initRotate, scale: 1 }}
              animate={{
                y:       [null, 62, 62],
                x:       [null, s.landX - s.startX, s.landX - s.startX],
                opacity: [null,  1,  0],
                rotate:  [null,  0,  0],
                scale:   [null,  1,  0],
              }}
              transition={{ delay: s.delay, duration: 1.4, ease: [0.22, 1, 0.36, 1], times: [0, 0.65, 1] }}
            >
              <ShapeSVG type={s.type} color={s.color} />
            </motion.div>
          ))}

          {/* 냄비 + 뚜껑 */}
          <motion.div
            className="absolute bottom-0 left-1/2"
            style={{ x: '-50%' }}
            {...(heroPlayed ? {
              animate: { y: [0, -12, 0] },
              transition: { y: { delay: POT_BOUNCE_DELAY, duration: POT_BOUNCE_DUR, repeat: Infinity, repeatDelay: POT_BOUNCE_REPEAT_DELAY, ease: [0.22, 1, 0.36, 1], times: [0, 0.5, 1] } },
            } : {})}
          >
            <div style={{ position: 'relative' }}>
              {/* 뚜껑 — 루프 상태에서만 표시. 왼쪽 축 고정, 오른쪽 회전 */}
              {heroPlayed && (
                <motion.img
                  src="/pot cover icon.svg"
                  alt=""
                  style={{
                    position: 'absolute',
                    width: POT_W,
                    height: 'auto',
                    bottom: POT_H,
                    left: 0,
                    transformOrigin: '0% 50%',
                  }}
                  animate={{ rotate: [-70, -70, 0, 0, -70, -70] }}
                  transition={{
                    duration: LOOP_TOTAL,
                    repeat: Infinity,
                    ease: ['linear', 'easeInOut', 'linear', 'easeInOut', 'linear'],
                    times: COVER_TIMES,
                  }}
                />
              )}

              {/* 냄비 본체 */}
              <motion.img
                src="/pot icon.svg"
                alt=""
                initial={heroPlayed ? false : { opacity: 0, scale: 0.72 }}
                animate={heroPlayed
                  ? { opacity: 1, scale: 1, width: POT_W }
                  : { opacity: 1, scale: 1, width: phase >= 3 ? 120 : 300, y: phase === 2 ? [0, -22, 0] : 0 }
                }
                transition={heroPlayed
                  ? { width: { duration: 0 }, opacity: { duration: 0 }, scale: { duration: 0 } }
                  : phase === 2
                  ? { y: { duration: 0.75, ease: 'easeOut', repeat: 1, repeatType: 'reverse' }, width: { duration: 0 }, opacity: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }, scale: { duration: 0.8 } }
                  : phase >= 3
                  ? { width: { duration: 0.9, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0 }, scale: { duration: 0 } }
                  : { opacity: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }, scale: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
                }
                style={{ height: 'auto' }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* ── 텍스트 블록: wrapper 하나에만 opacity 걸어서 gradient-brand 렌더링 보호 */}
        <motion.div
          className="flex flex-col items-center w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 3 ? 1 : 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          style={{ pointerEvents: phase >= 3 ? 'auto' : 'none' }}
        >
          {/* 헤드카피 — gradient-brand가 직접 opacity 영향 없이 렌더됨 */}
          <h1 className="font-extrabold leading-tight tracking-tight" style={{ fontSize: 52, color: C.ink, marginBottom: 16 }}>
            딱 맞는 <span className="gradient-brand">스킬</span>,{' '}
            딱 맞는 <span className="gradient-brand">팀</span>
          </h1>

          {/* 서브카피 */}
          <p className="text-base" style={{ color: C.body, marginBottom: 40 }}>
            스킬 택소노미 기반 팀 구성, 팀쿡과 함께해요!
          </p>

          {/* CTA 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-4xl">
            {FLOW_OPTIONS.map((flow) => (
              <div
                key={flow.id}
                className="group flex flex-col rounded-sm overflow-hidden border transition-colors duration-150"
                style={{ borderColor: C.hairline, backgroundColor: '#fff' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.primary}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.hairline}
              >
                <div className="p-6 flex-1 text-left">
                  <div className="flex items-center gap-2 mb-3">
                    <img src={flow.icon} alt="" className="w-6 h-6 object-contain" />
                    <div>
                      <div className="text-base font-bold" style={{ color: C.ink }}>{flow.label}</div>
                      <div className="text-xs" style={{ color: C.body }}>{flow.sublabel}</div>
                    </div>
                  </div>
                  <ol className="overflow-hidden max-h-0 group-hover:max-h-32 transition-all duration-300 space-y-1.5">
                    {flow.bullets.map((b, i) => (
                      <li key={b} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: '#404040' }}>
                        <span className="mt-0.5 shrink-0 font-semibold" style={{ color: C.primary }}>{i + 1}.</span>{b}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="px-6 pb-6">
                  <button
                    onClick={() => handleStart(flow.id)}
                    className="w-full py-2.5 text-sm font-mono font-medium rounded-sm transition-opacity hover:opacity-90 cursor-pointer"
                    style={{ backgroundColor: C.primary, color: '#fff' }}
                  >
                    {flow.cta} →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 맥락 태그 */}
          <div className="flex flex-wrap justify-center gap-2" style={{ marginTop: 28 }}>
            {CONTEXTS.map(ctx => (
              <span key={ctx} className="px-3 py-1.5 text-sm font-mono rounded-sm border" style={{ color: C.body, borderColor: C.hairline, backgroundColor: '#fff' }}>
                {ctx}
              </span>
            ))}
          </div>

          {/* 아래 화살표 */}
          <button
            onClick={() => document.getElementById('about').scrollIntoView({ behavior: 'smooth' })}
            className="flex flex-col items-center gap-1 cursor-pointer group"
            style={{ color: C.body, marginTop: 48 }}
          >
          <span className="text-xs font-mono uppercase tracking-widest group-hover:opacity-70 transition-opacity">서비스 소개</span>
          <motion.svg
            width="24" height="24" viewBox="0 0 24 24" fill="none"
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
          >
            <path d="M12 5v14M5 13l7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </motion.svg>
          </button>
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════════
          서비스 소개 (스크롤)
      ════════════════════════════════════════════════ */}
      <div id="about">

        {/* ── 섹션 1. 문제 정의 ── */}
        <section className="px-8 py-20" style={{ backgroundColor: C.canvas }}>
          <div className="max-w-5xl mx-auto">
            <motion.div {...fadeUp(0)}><Eyebrow>Problem</Eyebrow></motion.div>
            <motion.h2 className="text-3xl font-bold mb-12 tracking-tight" style={{ color: C.ink }} {...fadeUp(0.1)}>
              팀 배치, 지금 이렇게 하고 계신가요?
            </motion.h2>

            {/* 2컬럼 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">

              {/* 왼쪽: 통계 근거 카드 */}
              <motion.div
                className="p-7 rounded-sm border flex flex-col"
                style={{ borderColor: C.hairline, backgroundColor: '#fff' }}
                {...fadeUp(0.1)}
              >
                <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: C.body }}>Research</div>
                <h3 className="text-lg font-bold mb-1" style={{ color: C.ink }}>전문가도 직관에 의존합니다</h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: '#404040' }}>
                  통계 모형이 인간 판단보다 약 <strong>25% 더 정확한</strong> 결정을 내립니다.<br/>
                  그럼에도 전문가의 <strong>85~97%</strong>는 여전히 직관에 상당 부분 의존합니다.
                </p>
                <div className="flex-1" style={{ minHeight: 110 }}>
                  <ResponsiveContainer width="100%" height={110}>
                    <BarChart
                      layout="vertical"
                      data={[
                        { name: '인간 판단', value: 100 },
                        { name: '통계 판단', value: 125 },
                      ]}
                      margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
                    >
                      <XAxis type="number" domain={[0, 140]} hide />
                      <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 12, fill: '#404040' }} axisLine={false} tickLine={false} />
                      <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={28}>
                        <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 600, fill: C.ink }} formatter={(v) => `~${v}`} />
                        <Cell fill={C.hairline} />
                        <Cell fill={C.primary} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs mt-3" style={{ color: C.body }}>
                  출처: MGMA, "Avoiding Bias in Day-to-Day Management Decisions"
                </p>
              </motion.div>

              {/* 오른쪽: 현장 목소리 카드 */}
              <motion.div
                className="p-7 rounded-sm border flex flex-col gap-4"
                style={{ borderColor: C.hairline, backgroundColor: '#fff' }}
                {...fadeUp(0.2)}
              >
                <div className="text-xs font-mono uppercase tracking-widest mb-0" style={{ color: C.body }}>Real voices</div>
                <h3 className="text-lg font-bold" style={{ color: C.ink }}>현장에서는 이런 일이 일어납니다</h3>

                <div className="flex flex-col gap-3 flex-1">
                  <div className="p-4 rounded-md text-sm leading-relaxed" style={{ backgroundColor: '#f3f4f6', color: '#1f2937' }}>
                    💬 <span className="font-medium">"TF팀 구성은 보통 누가 해?</span><br/>
                    임원이 TF꾸리라고 지시 → 팀장이 파트장에게 필요해보이는 사람 구성하라고 지시 → 파트장이 인솔.. 보통 이런거야?🤔"
                    <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>출처: TEAMBLIND</p>
                  </div>
                  <div className="p-4 rounded-md text-sm leading-relaxed" style={{ backgroundColor: '#f3f4f6', color: '#1f2937' }}>
                    💬 <span className="font-medium">"TF팀 발령났더니 1키로 빠짐😭</span><br/>
                    다른 팀원들은 발령 일주일만에 각각 7,3,3키로 빠짐.<br></br>나만 제일 편한 거 같아 미안하다"
                    <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>출처: TEAMBLIND</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* 하단 한 줄 */}
            <motion.div
              className="p-5 rounded-sm border text-center"
              style={{ borderColor: C.hairline, backgroundColor: C.surface }}
              {...fadeUp(0.3)}
            >
              <p className="text-sm leading-relaxed" style={{ color: C.ink }}>
                직무 적합도는 팀 성과와 강하게 연결됩니다. <strong>인구통계 다양성보다 스킬 적합도가 훨씬 중요합니다.</strong>
              </p>
              <p className="text-xs mt-1" style={{ color: C.body }}>
                출처: Kristof-Brown et al.(2005), Wallrich et al.(2024)
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── 섹션 2. 솔루션 (다크밴드) ── */}
        <section className="px-8 py-20" style={{ backgroundColor: C.navy }}>
          <div className="max-w-5xl mx-auto">
            <motion.div {...fadeUp(0)}><Eyebrow dark>Solution</Eyebrow></motion.div>
            <motion.h2 className="text-3xl font-bold mb-2 tracking-tight" style={{ color: C.onDark }} {...fadeUp(0.1)}>
              같은 엔진으로 세 가지 배치 과제를 해결합니다
            </motion.h2>
            <motion.p className="text-sm mb-12 leading-relaxed" style={{ color: 'rgba(250,251,252,0.60)' }} {...fadeUp(0.15)}>
              제약과 정원만 바꾸면 신규배치·재배치·TF 구성을 동일한 ILP 엔진으로 처리합니다
            </motion.p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {FLOW_OPTIONS.map((flow, i) => (
                <motion.div
                  key={flow.id}
                  className="p-6 rounded-sm border flex flex-col"
                  style={{ borderColor: C.hairline, backgroundColor: 'rgba(255,255,255,0.80)' }}
                  {...fadeUp(i * 0.1)}
                >
                  <img src={flow.icon} alt="" className="w-8 h-8 object-contain mb-3" />
                  <div className="text-base font-bold mb-1" style={{ color: C.ink }}>{flow.label}</div>
                  <div className="text-xs mb-4" style={{ color: C.body }}>{flow.sublabel}</div>
                  <ol className="space-y-1.5 flex-1">
                    {flow.bullets.map((b, j) => (
                      <li key={b} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: '#404040' }}>
                        <span className="shrink-0 font-semibold mt-0.5" style={{ color: C.primary }}>{j + 1}.</span>{b}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-5 pt-4 border-t" style={{ borderColor: C.hairline }}>
                    <div className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: C.body }}>핵심 장치</div>
                    <div className="text-xs font-medium" style={{ color: C.primary }}>{flow.tag}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 섹션 3. 작동 원리 ── */}
        <section className="px-8 py-20" style={{ backgroundColor: C.surface }}>
          <div className="max-w-5xl mx-auto">
            <motion.div {...fadeUp(0)}><Eyebrow>How it works</Eyebrow></motion.div>
            <motion.h2 className="text-3xl font-bold mb-12 tracking-tight" style={{ color: C.ink }} {...fadeUp(0.1)}>
              3단계로 최적 팀을 만듭니다
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {HOW_STEPS.map((s, i) => (
                <motion.div
                  key={s.step}
                  className="p-6 rounded-sm border relative overflow-hidden"
                  style={{ borderColor: C.hairline, backgroundColor: '#fff' }}
                  {...fadeUp(i * 0.1)}
                >
                  {/* 스텝 번호 — 배경 워터마크 */}
                  <div className="absolute top-3 right-4 text-6xl font-black opacity-40 select-none" style={{ color: s.color }}>
                    {s.step}
                  </div>
                  <div className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: s.color }}>{s.step}</div>
                  <div className="text-base font-bold mb-2" style={{ color: C.ink }}>{s.label}</div>
                  <p className="text-sm leading-relaxed" style={{ color: C.body }}>{s.desc}</p>
                  {/* 하단 색상 바 */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-sm" style={{ backgroundColor: s.color }} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 섹션 4. 도메인 지식 아코디언 ── */}
        <section className="px-8 py-20" style={{ backgroundColor: C.navy }}>
          <div className="max-w-3xl mx-auto">
            <motion.div {...fadeUp(0)}><Eyebrow dark>Domain knowledge</Eyebrow></motion.div>
            <motion.h2 className="text-3xl font-bold mb-8 tracking-tight" style={{ color: C.onDark }} {...fadeUp(0.1)}>
              용어 설명
            </motion.h2>
            <div className="space-y-3">
              {FAQ.map((faq, i) => (
                <motion.div
                  key={faq.q}
                  className="rounded-sm overflow-hidden border"
                  style={{ borderColor: 'rgba(201,234,218,0.45)', backgroundColor: 'rgba(255,255,255,0.08)' }}
                  {...fadeUp(i * 0.08)}
                >
                  <button
                    className="w-full flex items-center justify-between px-6 py-4 text-left transition-opacity hover:opacity-80"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="text-sm font-semibold" style={{ color: C.onDark }}>{faq.q}</span>
                    <span className="ml-4 shrink-0 font-mono text-xs px-2 py-0.5 rounded-sm" style={{ color: C.primary, backgroundColor: 'rgba(46,204,135,0.15)', border: `1px solid rgba(46,204,135,0.35)` }}>
                      {openFaq === i ? '접기 ▲' : '펼치기 ▼'}
                    </span>
                  </button>
                  {openFaq === i && (
                    <motion.div
                      className="px-6 pb-5 pt-4 border-t"
                      style={{ borderColor: 'rgba(201,234,218,0.30)' }}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.25 }}
                    >
                      {faq.a.split('\n').map((line, j) => (
                        <p key={j} className="text-sm leading-relaxed" style={{ color: 'rgba(250,251,252,0.82)', marginBottom: j < faq.a.split('\n').length - 1 ? 6 : 0 }}>
                          {line}
                        </p>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 섹션 5. CTA ── */}
        <section className="px-8 py-24 text-center" style={{ backgroundColor: C.canvas }}>
          <div className="max-w-4xl mx-auto">
            <motion.h2 className="text-4xl font-extrabold tracking-tight mb-3" style={{ color: C.ink }} {...fadeUp(0)}>
              지금 팀을 요리해보세요!
            </motion.h2>
            <motion.p className="text-base mb-10" style={{ color: C.body }} {...fadeUp(0.1)}>
              스킬 데이터를 활용해 최적 팀 배치 결과를 확인할 수 있어요.
            </motion.p>
            <motion.div className="flex flex-col sm:flex-row gap-3 justify-center" {...fadeUp(0.2)}>
              <button onClick={() => handleStart('new')} className="flex items-center gap-2 px-6 py-3 font-mono text-sm rounded-sm transition-opacity hover:opacity-90" style={{ backgroundColor: '#fff', border: '1.5px solid #2ECC87', color: '#1a6b45' }}>
                <img src="/icon/folder icon.png" alt="" className="w-4 h-4 object-contain" /> 신규배치 시작하기
              </button>
              <button onClick={() => handleStart('re')} className="flex items-center gap-2 px-6 py-3 font-mono text-sm rounded-sm transition-opacity hover:opacity-90" style={{ backgroundColor: '#fff', border: '1.5px solid #2ECC87', color: '#1a6b45' }}>
                <img src="/icon/glass icon.png" alt="" className="w-4 h-4 object-contain" /> 재배치 시작하기
              </button>
              <button onClick={() => handleStart('tf')} className="flex items-center gap-2 px-6 py-3 font-mono text-sm rounded-sm transition-opacity hover:opacity-90" style={{ backgroundColor: '#fff', border: '1.5px solid #2ECC87', color: '#1a6b45' }}>
                <img src="/icon/check icon.png" alt="" className="w-4 h-4 object-contain" /> TF 구성하기
              </button>
            </motion.div>
          </div>
        </section>

        {/* 푸터 */}
        <footer className="px-8 py-6 text-center text-xs font-mono border-t" style={{ borderColor: C.hairline, color: C.body }}>
          © 2026 TeamCook · Insight 2차 인사이콘
        </footer>
      </div>

      {/* ── 재방문 팝업 ── */}
      {showResume && (skills.length > 0 || members.length > 0) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="rounded-md p-8 max-w-sm w-full mx-4 border" style={{ backgroundColor: '#fff', borderColor: C.hairline }}>
            <h2 className="text-lg font-bold mb-1" style={{ color: C.ink }}>이전 데이터가 있습니다</h2>
            <p className="text-sm mb-1" style={{ color: C.body }}>유형: <strong>{typeLabel}</strong></p>
            <p className="text-sm mb-6" style={{ color: C.body }}>이어서 진행하시겠습니까?</p>
            <div className="flex gap-3 mb-3">
              <Button variant="primary" className="flex-1" onClick={() => { setShowResume(false); handleResume() }}>이어서 하기</Button>
            </div>
            <Button variant="outline" className="w-full" onClick={() => { setShowResume(false); reset() }}>새로 시작</Button>
          </div>
        </div>
      )}
    </div>
  )
}
