import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { getArchive, deleteFromArchive, TYPE_META } from '../utils/archive'
import Navbar from '../components/layout/Navbar'

/* ─── 색상 (design.md 기준) ────────────────────────── */
const C = {
  primary:  '#2ECC87',
  ink:      '#1A1A1A',
  body:     '#3f6856',
  canvas:   '#FAFBFC',
  surface:  '#FFFFFF',
  hairline: '#C2EAD8',
  dark:     '#1E3A2F',
  onDark:   '#FAFBFC',
}

const fadeUp = (i = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay: i * 0.06, ease: 'easeOut' },
})

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\. /g, '.').replace('.', '')
}

function Pct({ value }) {
  const pct = Math.round((value ?? 0) * 100)
  return <span style={{ color: pct >= 80 ? C.primary : pct >= 60 ? '#FABF4B' : '#dc2626' }}>{pct}%</span>
}

const START_OPTIONS = [
  { type: 'new', icon: '🍳', label: '신규배치' },
  { type: 're',  icon: '🔄', label: '재배치'   },
  { type: 'tf',  icon: '⚡', label: 'TF 구성'  },
]

/* ─── 시작 드롭다운 버튼 ────────────────────────────── */
function StartDropdown({ label, dark = false, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-mono rounded-sm hover:opacity-90 transition-opacity"
        style={{ backgroundColor: dark ? C.primary : C.primary, color: '#fff' }}
      >
        {label} <span style={{ fontSize: 10, opacity: 0.8 }}>▾</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 mt-1 w-40 rounded-sm border overflow-hidden z-20"
            style={{ backgroundColor: C.surface, borderColor: C.hairline }}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {START_OPTIONS.map(o => (
              <button
                key={o.type}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:opacity-80 transition-opacity border-b last:border-0"
                style={{ color: C.ink, borderColor: C.hairline }}
                onClick={() => { setOpen(false); onSelect(o.type) }}
              >
                <span>{o.icon}</span>
                <span className="font-mono">{o.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── 빈 상태 ──────────────────────────────────────── */
function EmptyState({ onSelect }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center text-center py-32 px-8"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
    >
      <img src="/pot icon.svg" alt="" style={{ width: 96, opacity: 0.35, marginBottom: 24 }} />
      <p className="text-lg font-bold mb-2" style={{ color: C.ink }}>아직 완성된 팀이 없어요</p>
      <p className="text-sm mb-8" style={{ color: C.body }}>첫 번째 팀을 요리해보세요!</p>
      <StartDropdown label="시작하기 →" onSelect={onSelect} />
    </motion.div>
  )
}

/* ─── 아카이브 카드 ────────────────────────────────── */
function ArchiveCard({ item, onView, onReplace, onDelete, index }) {
  const meta = TYPE_META[item.type] ?? TYPE_META.new
  const s = item.summary ?? {}
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <motion.div
      {...fadeUp(index)}
      className="p-6 rounded-sm border flex flex-col gap-4"
      style={{ backgroundColor: C.surface, borderColor: C.hairline }}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <div>
            <div className="text-sm font-bold" style={{ color: C.ink }}>{meta.label}</div>
            <div className="text-xs font-mono" style={{ color: C.body }}>{formatDate(item.createdAt)}</div>
          </div>
        </div>
        {/* 삭제 */}
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: C.body }}>삭제할까요?</span>
            <button onClick={() => { onDelete(item.id); setConfirmDelete(false) }} className="text-xs text-red-500 font-mono hover:opacity-70">삭제</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs font-mono hover:opacity-70" style={{ color: C.body }}>취소</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-xs font-mono hover:opacity-60" style={{ color: C.body }}>✕</button>
        )}
      </div>

      {/* 요약 수치 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="px-3 py-2 rounded-sm" style={{ backgroundColor: C.canvas }}>
          <div className="font-mono uppercase tracking-widest text-[10px] mb-1" style={{ color: C.body }}>구성원</div>
          <div className="font-bold text-base" style={{ color: C.ink }}>{s.memberCount ?? '—'}명</div>
        </div>
        <div className="px-3 py-2 rounded-sm" style={{ backgroundColor: C.canvas }}>
          <div className="font-mono uppercase tracking-widest text-[10px] mb-1" style={{ color: C.body }}>팀 / 과제</div>
          <div className="font-bold text-base" style={{ color: C.ink }}>{s.teamCount ?? '—'}개</div>
        </div>
        <div className="px-3 py-2 rounded-sm" style={{ backgroundColor: C.canvas }}>
          <div className="font-mono uppercase tracking-widest text-[10px] mb-1" style={{ color: C.body }}>조건 충족률</div>
          <div className="font-bold text-base"><Pct value={s.conditionFulfillment} /></div>
        </div>
        <div className="px-3 py-2 rounded-sm" style={{ backgroundColor: C.canvas }}>
          <div className="font-mono uppercase tracking-widest text-[10px] mb-1" style={{ color: C.body }}>스킬 커버리지</div>
          <div className="font-bold text-base"><Pct value={s.coverage} /></div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onView(item)}
          className="flex-1 py-2 text-xs font-mono rounded-sm border transition-opacity hover:opacity-80"
          style={{ backgroundColor: C.primary, color: '#fff', borderColor: C.primary }}
        >
          결과 보기
        </button>
        <button
          onClick={() => onReplace(item)}
          className="flex-1 py-2 text-xs font-mono rounded-sm border transition-opacity hover:opacity-80"
          style={{ backgroundColor: C.surface, color: C.ink, borderColor: C.hairline }}
        >
          다시 배치
        </button>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════ */
export default function Archive() {
  const navigate = useNavigate()
  const store = useStore()
  const [items, setItems] = useState([])

  useEffect(() => { setItems(getArchive()) }, [])

  const handleStart = (type) => { store.setPlacementType(type); navigate('/step/1') }

  const handleDelete = (id) => {
    deleteFromArchive(id)
    setItems(getArchive())
  }

  // 스토어 복원 후 4단계로 이동
  const handleView = (item) => {
    store.setPlacementType(item.type)
    if (item.snapshot) {
      const s = item.snapshot
      if (s.skills)         store.setSkills(s.skills)
      if (s.members)        store.setMembers(s.members)
      if (s.skillMatrix)    store.setSkillMatrix(s.skillMatrix)
      if (s.teams)          store.setTeams(s.teams)
      if (s.placementMode)  store.setPlacementMode(s.placementMode)
      if (s.analysisResult) store.setAnalysisResult(s.analysisResult)
      if (s.conditions)     store.setConditions(s.conditions)
      if (s.placementResult) store.setPlacementResult(s.placementResult)
    }
    store.setCurrentStep(4)
    navigate('/step/4')
  }

  // 조건까지만 복원 후 3단계로 이동
  const handleReplace = (item) => {
    store.setPlacementType(item.type)
    if (item.snapshot) {
      const s = item.snapshot
      if (s.skills)         store.setSkills(s.skills)
      if (s.members)        store.setMembers(s.members)
      if (s.skillMatrix)    store.setSkillMatrix(s.skillMatrix)
      if (s.teams)          store.setTeams(s.teams)
      if (s.placementMode)  store.setPlacementMode(s.placementMode)
      if (s.analysisResult) store.setAnalysisResult(s.analysisResult)
      if (s.conditions)     store.setConditions(s.conditions)
      store.setPlacementResult(null)
    }
    store.setCurrentStep(3)
    navigate('/step/3')
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.canvas }}>
      <Navbar currentStep={0} />

      <div style={{ paddingTop: 57 }}>
        {/* ── 헤더 배너 (다크) ── */}
        <section className="px-8 py-12" style={{ backgroundColor: C.dark }}>
          <div className="max-w-5xl mx-auto flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: C.primary }}>
                Archive
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: C.onDark }}>
                내 배치 기록
              </h1>
              {items.length > 0 && (
                <p className="text-sm mt-1" style={{ color: 'rgba(250,251,252,0.55)' }}>
                  저장된 결과 {items.length}개 · 최대 20개 보관
                </p>
              )}
            </div>
            <StartDropdown label="+ 새 배치 시작하기" onSelect={handleStart} />
          </div>
        </section>

        {/* ── 카드 목록 ── */}
        <section className="px-8 py-10">
          <div className="max-w-5xl mx-auto">
            {items.length === 0 ? (
              <EmptyState onSelect={handleStart} />
            ) : (
              <AnimatePresence>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item, i) => (
                    <ArchiveCard
                      key={item.id}
                      item={item}
                      index={i}
                      onView={handleView}
                      onReplace={handleReplace}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
