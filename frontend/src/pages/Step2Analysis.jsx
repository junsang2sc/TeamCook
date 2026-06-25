import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import useStore from '../store/useStore'
import { mockAnalyze, mockReplacementAnalysis } from '../api/mock'
import { analyzeData } from '../api/index'
import { buildMockTFResult } from '../api/tf'
import WhiskLoader from '../components/ui/WhiskLoader'

const LOADING_STEPS_NEW = [
  '스킬 희귀도 계산 중...',
  '인재 유형 분류 중...',
  '팀 간 스킬 갭 분석 중...',
  '인사이트 생성 완료!',
]
const LOADING_STEPS_REPLACE = [
  '현재 배치 현황 분석 중...',
  '차출 가능 여부 검토 중...',
  '기존 팀 리스크 계산 중...',
  '재배치 분석 완료!',
]
const LOADING_STEPS_TF = [
  '구성원 스킬 분석 중...',
  'TF 필수 스킬 보유자 확인 중...',
  '차출 가능 인원 검증 중...',
  'TF 구성 분석 완료!',
]

const TYPE_LABELS = { specialist: '전문가형', t_shaped: 'T자형', generalist: '제너럴리스트형' }
const TYPE_COLORS = { specialist: 'orange', t_shaped: 'periwinkle', generalist: 'mint' }
const RARITY_LABELS = { rare: '희귀', normal: '보통', common: '보편' }
const RISK_COLORS = { low: 'mint', medium: 'orange', high: 'red' }
const RISK_LABELS = { low: '안전', medium: '주의', high: '위험' }

export default function Step2Analysis() {
  const navigate = useNavigate()
  const {
    skills, members, skillMatrix, teams, placementMode,
    setAnalysisResult, analysisResult, setCurrentStep,
    flowType, placementType, replacementScenario, currentAssignment,
    tfRequiredSkills, currentTeams,
  } = useStore()

  const isReplacement = flowType === 'replacement'
  const isTF = placementType === 'tf'
  const LOADING_STEPS = isTF ? LOADING_STEPS_TF : isReplacement ? LOADING_STEPS_REPLACE : LOADING_STEPS_NEW

  const [loadingStep, setLoadingStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [replacementAnalysis, setReplacementAnalysis] = useState(null)
  const [tfAnalysis, setTfAnalysis] = useState(null)

  useEffect(() => {
    let step = 0
    const timer = setInterval(() => {
      step += 1
      setLoadingStep(step)
      if (step >= LOADING_STEPS.length - 1) {
        clearInterval(timer)
        runAnalysis()
      }
    }, 800)
    return () => clearInterval(timer)
  }, [])

  const runAnalysis = async () => {
    try {
      // 공통: 스킬 희귀도 / 인재 유형 / SPOF 분석
      const payload = {
        members: members.map((m) => ({ id: m.id, name: m.name, role: m.role, experience: m.experience || 0, gender: m.gender })),
        skills: skills.map((s) => ({ id: s.id, name: s.name, category: s.category, importance: s.importance })),
        skill_matrix: Object.fromEntries(
          members.map((m) => [m.id, Object.fromEntries(skills.map((s) => [s.id, skillMatrix[m.id]?.[s.id] ?? 0]))])
        ),
        teams: teams.map((t) => ({ id: t.id, name: t.name, required_skills: t.requiredSkills, size: t.size })),
        placement_mode: placementMode,
      }
      let result
      try {
        result = await analyzeData(payload)
      } catch {
        result = mockAnalyze({ members, skills, skillMatrix, teams, placementMode })
      }
      setAnalysisResult(result)

      // 재배치 전용: 차출 가능 여부 분석
      if (isReplacement) {
        const ra = mockReplacementAnalysis({ members, skills, skillMatrix, teams, currentAssignment, replacementScenario })
        setReplacementAnalysis(ra)
      }
      // TF 전용: 차출 가능 인원 + 스킬 커버리지 분석
      if (isTF) {
        const ta = buildMockTFResult({ members, skills, skillMatrix, currentAssignment, currentTeams, tfRequiredSkills })
        setTfAnalysis(ta)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    setCurrentStep(3)
    navigate('/step/3')
  }

  const r = analysisResult

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar currentStep={2} />
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-medium text-ink">자동 분석</h1>
              {isReplacement && <Badge variant="periwinkle">재배치</Badge>}
            </div>
            <p className="text-sm text-body">
              {isReplacement
                ? '현재 배치 현황을 분석해 차출 가능 인원과 기존 팀 리스크를 파악합니다.'
                : '데이터를 분석해 팀 구성에 필요한 인사이트를 제공합니다.'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <WhiskLoader fps={12} size={160} />
            <div className="text-center space-y-1">
              {LOADING_STEPS.map((s, i) => (
                <p key={s} className={`text-sm transition-all ${i <= loadingStep ? 'text-ink font-medium' : 'text-[#d1d5db]'}`}>
                  {i < loadingStep ? '✓ ' : i === loadingStep ? '› ' : '  '}{s}
                </p>
              ))}
            </div>
          </div>
        ) : r ? (
          <div className="space-y-6">
            {/* ── TF 전용 카드 ── */}
            {isTF && tfAnalysis && (
              <>
                <InsightCard title="TF 필수 스킬 보유자 현황" icon="◇" accent="orange">
                  <div className="mt-4 space-y-2">
                    {tfRequiredSkills.map((sid) => {
                      const skill = skills.find((s) => s.id === sid)
                      const cov = tfAnalysis.skill_coverage?.[sid]
                      const holderCount = cov?.holders?.length ?? 0
                      const isSpof = holderCount <= Math.ceil(members.length * 0.1)
                      return (
                        <div key={sid} className="flex items-center gap-3 p-3 border border-[rgba(0,0,0,0.08)] rounded-sm">
                          <span className="text-sm font-medium w-28 truncate">{skill?.name ?? sid}</span>
                          <div className="flex-1">
                            <div className="text-xs text-body">{holderCount}명 보유</div>
                          </div>
                          {isSpof && <Badge variant="red">⚡ SPOF</Badge>}
                          {!cov?.fulfilled && <Badge variant="orange">보유자 없음</Badge>}
                          {cov?.fulfilled && !isSpof && <Badge variant="mint">충분</Badge>}
                        </div>
                      )
                    })}
                  </div>
                </InsightCard>

                <InsightCard title="차출 가능 인원 사전 검증" icon="◈" accent="periwinkle">
                  <div className="mt-4 grid grid-cols-2 gap-3 mb-4">
                    <div className="p-4 bg-[#f0fdf4] border border-[#059669]/20 rounded-md text-center">
                      <div className="text-3xl font-mono font-medium text-[#059669]">{tfAnalysis.tf_members.length}</div>
                      <div className="text-xs text-body mt-1">TF 후보 인원</div>
                    </div>
                    <div className="p-4 bg-[#f0f9ff] border border-accent-periwinkle/20 rounded-md text-center">
                      <div className="text-3xl font-mono font-medium text-ink">{Object.keys(tfAnalysis.team_impact).length}</div>
                      <div className="text-xs text-body mt-1">영향받는 기존 팀</div>
                    </div>
                  </div>
                  {tfAnalysis.tf_members.length > 0 && (
                    <div>
                      <p className="text-xs font-mono text-body uppercase tracking-wider mb-2">TF 후보</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tfAnalysis.tf_members.map((mid) => {
                          const m = members.find((m) => m.id === mid)
                          return m ? <Badge key={mid} variant="mint">{m.name}</Badge> : null
                        })}
                      </div>
                    </div>
                  )}
                  {tfAnalysis.warnings.length > 0 && (
                    <div className="mt-4 space-y-1">
                      {tfAnalysis.warnings.map((w, i) => (
                        <p key={i} className="text-sm text-accent-orange">⚠ {w.message}</p>
                      ))}
                    </div>
                  )}
                </InsightCard>
              </>
            )}

            {/* ── 재배치 전용 카드 ── */}
            {isReplacement && replacementAnalysis && (
              <>
                {/* 차출 가능 여부 */}
                <InsightCard title="차출 가능 인원 목록" icon="◈" accent="periwinkle">
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-4 bg-[#f0fdf4] border border-[#059669]/20 rounded-md text-center">
                      <div className="text-3xl font-mono font-medium text-[#059669]">{replacementAnalysis.extractable.length}</div>
                      <div className="text-xs text-body mt-1">즉시 차출 가능</div>
                    </div>
                    <div className="p-4 bg-[#fff7ed] border border-[#f97316]/20 rounded-md text-center">
                      <div className="text-3xl font-mono font-medium text-accent-orange">{replacementAnalysis.blocked.length}</div>
                      <div className="text-xs text-body mt-1">차출 주의 (SPOF)</div>
                    </div>
                  </div>

                  {replacementAnalysis.blocked.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-mono text-body uppercase tracking-wider">차출 주의 인원 — SPOF 사유</p>
                      {replacementAnalysis.blocked.map((b) => (
                        <div key={b.memberId} className="flex items-start gap-3 p-3 bg-[#fff7ed] border border-[#f97316]/20 rounded-sm text-sm">
                          <span className="font-medium text-ink shrink-0">{b.memberName}</span>
                          <span className="text-body">차출 시 현재 팀에서 <strong className="text-accent-orange">"{b.soloSkillNames.join(', ')}"</strong> 스킬 공백 발생</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {replacementAnalysis.extractable.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-mono text-body uppercase tracking-wider mb-2">즉시 차출 가능</p>
                      <div className="flex flex-wrap gap-1.5">
                        {replacementAnalysis.extractable.map((mid) => {
                          const m = members.find((m) => m.id === mid)
                          return m ? <Badge key={mid} variant="mint">{m.name}</Badge> : null
                        })}
                      </div>
                    </div>
                  )}
                </InsightCard>

                {/* 기존 팀 리스크 */}
                {Object.keys(replacementAnalysis.currentTeamRisks).length > 0 && (
                  <InsightCard title="기존 팀 리스크" icon="⚠" accent="orange">
                    <div className="mt-4 space-y-3">
                      {Object.entries(replacementAnalysis.currentTeamRisks).map(([teamId, risk]) => {
                        const teamName = teams.find((t) => t.id === teamId)?.name ?? teamId
                        return (
                          <div key={teamId} className="flex items-start gap-3 p-3 border border-[rgba(0,0,0,0.08)] rounded-sm">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">{teamName}</span>
                                <Badge variant={RISK_COLORS[risk.riskLevel]}>{RISK_LABELS[risk.riskLevel]}</Badge>
                                <span className="text-xs text-body">{risk.extractedCount}명 차출</span>
                              </div>
                              {risk.lostSkills.length > 0 ? (
                                <div className="text-xs text-accent-orange">
                                  스킬 공백 발생: {risk.lostSkills.map((s) => s.name).join(', ')}
                                </div>
                              ) : (
                                <div className="text-xs text-[#059669]">차출 후에도 스킬 공백 없음</div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </InsightCard>
                )}
              </>
            )}

            {/* ── 공통 카드 ── */}

            {/* Card 1: Skill Rarity */}
            <SkillRarityCard skills={skills} skillRarity={r.skillRarity} />

            {/* Card 2: Member Types — 탭 전환 */}
            <MemberTypeCard members={members} memberTypes={r.memberTypes} />

            {/* Card 3: Supply-Demand — 개선된 바 차트 */}
            <SupplyDemandCard skills={skills} supplyDemand={r.supplyDemand} />

            {/* Card 4: SPOF */}
            <InsightCard title="병목 스킬 & SPOF 경고" icon="⚠">
              {r.spofSkills?.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-accent-orange font-medium">보유자 1명뿐인 스킬 — 팀 배치 시 주의 필요</p>
                  <div className="flex flex-wrap gap-2">
                    {r.spofSkills.map((sid) => {
                      const skill = skills.find((s) => s.id === sid)
                      return skill ? <Badge key={sid} variant="red">⚡ {skill.name}</Badge> : null
                    })}
                  </div>
                  <p className="text-xs text-body mt-2">이 스킬 보유자를 같은 팀에 배치하면 다른 팀이 커버할 수 없습니다.</p>
                </div>
              ) : (
                <p className="text-sm text-body mt-4">SPOF 스킬이 없습니다. 모든 스킬이 2명 이상에게 분산되어 있습니다. ✓</p>
              )}
            </InsightCard>

            {/* Card 5: Team Difficulty (신규배치 + different mode) */}
            {!isReplacement && placementMode === 'different' && (
              <InsightCard title="팀별 요구 난이도" icon="◆">
                <div className="mt-4 space-y-2">
                  {teams.map((team) => {
                    const score = r.teamDifficulty?.[team.id] || 0
                    const max = Math.max(...teams.map((t) => r.teamDifficulty?.[t.id] || 0), 1)
                    return (
                      <div key={team.id} className="flex items-center gap-3">
                        <span className="text-sm w-24 truncate">{team.name}</span>
                        <div className="flex-1 h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                          <div className="h-full bg-accent-magenta" style={{ width: `${(score / max) * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono text-body w-8 text-right">{score}</span>
                      </div>
                    )
                  })}
                </div>
              </InsightCard>
            )}

            <div className="pt-4 flex justify-between">
              <Button variant="outline" onClick={() => navigate('/step/1')}>← 데이터 수정</Button>
              <Button size="lg" onClick={handleNext}>배치 조건 설정하기 →</Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function InsightCard({ title, icon, children, accent = 'orange' }) {
  const iconColor = { orange: 'text-accent-orange', periwinkle: 'text-accent-periwinkle', mint: 'text-accent-mint' }
  return (
    <div className="border border-[rgba(0,0,0,0.08)] rounded-md p-6">
      <div className="flex items-center gap-2">
        <span className={`font-mono ${iconColor[accent] ?? 'text-accent-orange'}`}>{icon}</span>
        <h2 className="text-base font-medium text-ink">{title}</h2>
      </div>
      {children}
    </div>
  )
}

/* ── 스킬 희귀도 맵 — 탭 전환 ── */
const RARITY_TABS = [
  { key: 'all',    label: '전체',   badgeVariant: 'neutral' },
  { key: 'rare',   label: '희귀',   badgeVariant: 'orange'  },
  { key: 'normal', label: '보통',   badgeVariant: 'neutral' },
  { key: 'common', label: '보편',   badgeVariant: 'mint'    },
]
const RARITY_DESC = {
  all:    '전체 스킬의 보유 현황을 한눈에 확인합니다.',
  rare:   '보유자가 매우 적어 팀 배치 시 주의가 필요한 스킬입니다.',
  normal: '보유자 수가 평균 수준인 스킬입니다.',
  common: '구성원 절반 이상이 보유한 범용 스킬입니다.',
}

function SkillRarityCard({ skills, skillRarity }) {
  const [activeRarity, setActiveRarity] = useState('all')

  const counts = Object.fromEntries(
    ['rare', 'normal', 'common'].map((k) => [
      k, skills.filter((s) => (skillRarity?.[s.id]?.level ?? 'normal') === k).length,
    ])
  )
  const filtered = activeRarity === 'all'
    ? skills
    : skills.filter((s) => (skillRarity?.[s.id]?.level ?? 'normal') === activeRarity)

  const hasRare = counts.rare > 0

  return (
    <div className="border border-[rgba(0,0,0,0.08)] rounded-md overflow-hidden">
      <div className="px-6 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <span className="font-mono text-accent-orange">◉</span>
          <h2 className="text-base font-medium text-ink">스킬 희귀도 맵</h2>
          {hasRare && <Badge variant="orange">⚠ 희귀 {counts.rare}개</Badge>}
          <span className="ml-auto text-xs text-body">{skills.length}개 스킬</span>
        </div>

        {/* 탭 */}
        <div className="flex gap-0 border-b border-[rgba(0,0,0,0.08)]">
          {RARITY_TABS.map(({ key, label }) => {
            const count = key === 'all' ? skills.length : counts[key]
            return (
              <button
                key={key}
                onClick={() => setActiveRarity(key)}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer ${
                  activeRarity === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-body hover:text-ink'
                }`}
              >
                {label}
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded-sm ${
                  activeRarity === key ? 'bg-primary/10 text-primary' : 'bg-[#f3f4f6] text-body'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-6 py-4">
        <p className="text-xs text-body mb-4">{RARITY_DESC[activeRarity]}</p>
        {filtered.length === 0 ? (
          <p className="text-sm text-body py-4 text-center">해당하는 스킬이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {filtered.map((s) => {
              const rarity = skillRarity?.[s.id] || { level: 'normal', holderCount: 0 }
              const variantMap = { rare: 'orange', normal: 'neutral', common: 'mint' }
              return (
                <div key={s.id} className={`flex items-center justify-between p-3 border rounded-sm ${
                  rarity.level === 'rare' ? 'border-primary/20 bg-[#FDF0E8]' : 'border-[rgba(0,0,0,0.08)]'
                }`}>
                  <div className="min-w-0 mr-2">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-xs text-body">{rarity.holderCount}명 보유</div>
                  </div>
                  <Badge variant={variantMap[rarity.level]}>{RARITY_LABELS[rarity.level]}</Badge>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 하단 분포 바 */}
      <div className="px-6 pb-4">
        <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
          <div className="bg-accent-orange" style={{ width: `${(counts.rare / skills.length) * 100}%` }} />
          <div className="bg-[#d1d5db]" style={{ width: `${(counts.normal / skills.length) * 100}%` }} />
          <div className="bg-accent-mint" style={{ width: `${(counts.common / skills.length) * 100}%` }} />
        </div>
        <div className="flex gap-4 mt-2">
          {['rare', 'normal', 'common'].map((k) => (
            <span key={k} className="text-xs text-body">{RARITY_LABELS[k]} <strong className="text-ink">{counts[k]}개</strong></span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── 인재 유형 분류 — 탭 전환 ── */
const TYPE_DESCS = {
  specialist: '특정 스킬에 깊이 있는 전문가. 핵심 기술 과제를 맡기기 적합합니다.',
  t_shaped: '한 분야의 전문성에 폭넓은 이해를 겸비. 협업 허브 역할에 강합니다.',
  generalist: '다양한 스킬을 고루 갖춘 범용 인재. 역할 유연성이 높습니다.',
}
const TYPE_ICON = { specialist: '▲', t_shaped: 'T', generalist: '●' }

function MemberTypeCard({ members, memberTypes }) {
  const [activeType, setActiveType] = useState('specialist')
  const counts = Object.fromEntries(
    Object.keys(TYPE_LABELS).map((k) => [k, members.filter((m) => (memberTypes?.[m.id] || 'generalist') === k).length])
  )
  const filtered = members.filter((m) => (memberTypes?.[m.id] || 'generalist') === activeType)

  return (
    <div className="border border-[rgba(0,0,0,0.08)] rounded-md overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <span className="font-mono text-accent-orange">◈</span>
          <h2 className="text-base font-medium text-ink">인재 유형 분류</h2>
          <span className="ml-auto text-xs text-body">{members.length}명 전체</span>
        </div>

        {/* 탭 */}
        <div className="flex gap-0 border-b border-[rgba(0,0,0,0.08)]">
          {Object.entries(TYPE_LABELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setActiveType(k)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer ${
                activeType === k
                  ? 'border-primary text-primary'
                  : 'border-transparent text-body hover:text-ink'
              }`}
            >
              <span className="font-mono text-xs">{TYPE_ICON[k]}</span>
              {label}
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded-sm ${
                activeType === k ? 'bg-primary/10 text-primary' : 'bg-[#f3f4f6] text-body'
              }`}>
                {counts[k]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 탭 내용 */}
      <div className="px-6 py-4">
        <p className="text-xs text-body mb-4">{TYPE_DESCS[activeType]}</p>
        {filtered.length === 0 ? (
          <p className="text-sm text-body py-4 text-center">해당 유형 인원이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {filtered.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 border border-[rgba(0,0,0,0.08)] rounded-sm bg-surface">
                <div className="w-8 h-8 rounded-full bg-canvas-dark text-on-dark flex items-center justify-center text-xs font-medium shrink-0">
                  {m.name.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{m.name}</div>
                  <div className="text-xs text-body truncate">{m.role || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 하단 요약 바 */}
      <div className="px-6 pb-4">
        <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
          <div className="bg-accent-orange transition-all" style={{ width: `${(counts.specialist / members.length) * 100}%` }} title="전문가형" />
          <div className="bg-accent-periwinkle transition-all" style={{ width: `${(counts.t_shaped / members.length) * 100}%` }} title="T자형" />
          <div className="bg-accent-mint transition-all" style={{ width: `${(counts.generalist / members.length) * 100}%` }} title="제너럴리스트형" />
        </div>
        <div className="flex gap-4 mt-2">
          {Object.entries(TYPE_LABELS).map(([k, label]) => (
            <span key={k} className="text-xs text-body">{label} <strong className="text-ink">{counts[k]}명</strong></span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── 수요-공급 불균형 — 개선된 차트 ── */
function SupplyDemandCard({ skills, supplyDemand }) {
  const maxVal = Math.max(
    ...skills.map((s) => Math.max(supplyDemand?.[s.id]?.demand ?? 0, supplyDemand?.[s.id]?.supply ?? 0)),
    1
  )
  const shortages = skills.filter((s) => {
    const sd = supplyDemand?.[s.id] || {}
    return (sd.demand || 0) > (sd.supply || 0)
  })

  return (
    <div className="border border-[rgba(0,0,0,0.08)] rounded-md p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-accent-orange">◇</span>
        <h2 className="text-base font-medium text-ink">수요-공급 불균형</h2>
        {shortages.length > 0 && (
          <Badge variant="red">{shortages.length}개 부족</Badge>
        )}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-5 mb-5 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-accent-mint" />
          <span className="text-xs text-body">공급 (보유 인원)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-primary/70" />
          <span className="text-xs text-body">수요 (팀 필요 인원)</span>
        </div>
      </div>

      <div className="space-y-4">
        {skills.map((s) => {
          const sd = supplyDemand?.[s.id] || { demand: 0, supply: 0 }
          const gap = sd.demand - sd.supply
          const supplyPct = (sd.supply / maxVal) * 100
          const demandPct = (sd.demand / maxVal) * 100
          const isShort = gap > 0
          const isSurplus = gap < 0

          return (
            <div key={s.id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-body">공급 {sd.supply}명</span>
                  <span className="text-xs text-body">/</span>
                  <span className="text-xs font-mono text-body">수요 {sd.demand}명</span>
                  {isShort && (
                    <span className="text-xs font-mono font-medium text-white bg-primary px-2 py-0.5 rounded-sm">
                      -{gap} 부족
                    </span>
                  )}
                  {isSurplus && (
                    <span className="text-xs font-mono text-[#3A7D44] bg-[#eef6ed] px-2 py-0.5 rounded-sm">
                      +{Math.abs(gap)} 여유
                    </span>
                  )}
                </div>
              </div>

              {/* 공급 바 */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-body font-mono w-6 text-right shrink-0">공급</span>
                <div className="flex-1 h-5 bg-[#f3f4f6] rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-accent-mint rounded-sm transition-all flex items-center justify-end pr-2"
                    style={{ width: `${supplyPct}%` }}
                  >
                    {supplyPct > 15 && (
                      <span className="text-[10px] font-mono text-[#1A5C1A] font-medium">{sd.supply}</span>
                    )}
                  </div>
                </div>
                {supplyPct <= 15 && <span className="text-[10px] font-mono text-body w-3">{sd.supply}</span>}
              </div>

              {/* 수요 바 */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-body font-mono w-6 text-right shrink-0">수요</span>
                <div className="flex-1 h-5 bg-[#f3f4f6] rounded-sm overflow-hidden">
                  <div
                    className={`h-full rounded-sm transition-all flex items-center justify-end pr-2 ${isShort ? 'bg-primary/70' : 'bg-[#d1d5db]'}`}
                    style={{ width: `${demandPct}%` }}
                  >
                    {demandPct > 15 && (
                      <span className="text-[10px] font-mono text-white font-medium">{sd.demand}</span>
                    )}
                  </div>
                </div>
                {demandPct <= 15 && <span className="text-[10px] font-mono text-body w-3">{sd.demand}</span>}
              </div>

              {/* 부족 시 경고선 */}
              {isShort && (
                <p className="text-xs text-primary mt-1 ml-8">
                  ⚠ {s.name} 스킬 보유자가 {gap}명 부족합니다
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
