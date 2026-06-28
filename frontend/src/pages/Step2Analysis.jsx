import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, PieChart, Pie, ReferenceLine, Legend,
} from 'recharts'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import WhiskLoader from '../components/ui/WhiskLoader'
import useStore from '../store/useStore'
import { analyzeEda, analyzeFit, getPlacementPhase1, getReplacementPhase1, getTFPhase1 } from '../api/index'

// ── 색상 (DESIGN.md) ─────────────────────────────────────────────────────────
const C = {
  primary: '#2ECC87',
  amber:   '#FABF4B',
  coral:   '#E05C5C',
  blue:    '#7A9CC6',
  green:   '#6DBF8A',
  purple:  '#8E44AD',
  ink:     '#1A1A1A',
  body:    '#3f6856',
  hairline:'#C2EAD8',
  canvas:  '#FAFBFC',
  talentColors: { '전문가형': '#4D9EED', '제너럴리스트형': '#E05C5C', '혼합형': '#FABF4B' },
}

const LOADING_STEPS = [
  '스킬 희귀도 계산 중...',
  '수요-공급 불균형 분석 중...',
  '스킬 난이도 산출 중...',
  '인재 유형 분류 중...',
  '분석 완료!',
]

const STEP_META = [
  { label: '우리 조직 살펴보기' },
  { label: '부족한 스킬 확인' },
  { label: '희귀한 스킬 확인' },
  { label: '어려운 스킬 확인' },
]

function sortDesc(arr, key) {
  return [...arr].sort((a, b) => b[key] - a[key])
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function Step2Analysis() {
  const navigate = useNavigate()
  const {
    members, skills, skillMatrix, teams,
    edaResult, selectedIdf, selectedKss, selectedDiff,
    step2CurrentStep,
    setEdaResult, setSelectedIdf, setSelectedKss, setSelectedDiff,
    setFitMatrix, setStep2CurrentStep, setCurrentStep, setPhase1Info,
    placementType, currentTeams, tfId, tfName, tfRequiredSkills, tfSize, setTfSize,
    candidateTeams, maxAddPerTeam, setCandidateTeams, setMaxAddPerTeam,
    currentAssignment,
  } = useStore()

  // currentAssignment 포맷:
  //   재배치: { memberId: { currentTeamId, isTarget, isSurplus } }
  //   TF:     { memberId: teamId (string) }
  const getMemberTeamId = (mid) => {
    const v = currentAssignment[mid]
    if (!v) return null
    if (typeof v === 'string') return v   // TF 포맷
    return v?.currentTeamId ?? null       // 재배치 포맷
  }

  // ── TF / 재배치 팀선택 단계 관리 ────────────────────────────────────────────
  const isTF          = placementType === 'tf'
  const isReplacement = placementType === 're'
  // 재배치: teams에 기존팀 / TF: currentTeams에 기존팀
  const reBaseTeams = isReplacement
    ? (currentTeams.length > 0 ? currentTeams : teams)
    : []
  const tfBaseTeams = isTF ? currentTeams : []
  const baseTeams   = isTF ? tfBaseTeams : reBaseTeams

  const [replacementPhase, setReplacementPhase] = useState(
    () => ((isReplacement || isTF) && candidateTeams.length === 0) ? 'team-select' : 'eda'
  )
  // 팀선택 로컬 상태 (store에 저장 전)
  const allTeamIds = baseTeams.map(t => t.id)
  const [localCandidates, setLocalCandidates] = useState(
    () => new Set(candidateTeams.length > 0 ? candidateTeams : allTeamIds)
  )
  const [localMaxAdd, setLocalMaxAdd] = useState(
    () => Object.fromEntries(
      baseTeams.map(t => [t.id, maxAddPerTeam[t.id] ?? (isTF ? 3 : 5)])
    )
  )
  const [localTfSize, setLocalTfSize] = useState(tfSize ?? 10)

  // 기존 팀 현황 계산 (팀선택 단계 표시용, AVG_LEVEL=2.8 기준)
  const AVG_LEVEL_DEFAULT = 2.8
  const ROLE_MAP_KR = { '부장': 5, '차장': 4, '과장': 3, '대리': 2, '사원': 1, '팀장급': 5, '중간급': 3, '주니어': 1 }
  const teamStatus = useMemo(() => baseTeams.map(team => {
    const tm = members.filter(m => getMemberTeamId(m.id) === team.id)
    const n = tm.length
    if (n === 0) return { id: team.id, name: team.name, n, femaleRatio: 0, avgRank: 0, gapCount: 0, totalGap: 0, skillCount: 0 }
    const nF = tm.filter(m => ['여','f','female'].includes((m.gender||'').toLowerCase())).length
    const avgRank = tm.map(m => ROLE_MAP_KR[m.role] || 3).reduce((a,b)=>a+b,0) / n
    const reqSkills = team.requiredSkills || team.required_skills || []
    let gapCount = 0, totalGap = 0
    reqSkills.forEach(sid => {
      const lv = tm.reduce((acc, m) => acc + (skillMatrix[m.id]?.[sid] ?? 0), 0)
      const gap = Math.max(0, AVG_LEVEL_DEFAULT * n - lv)
      if (gap > 0) { gapCount++; totalGap += gap }
    })
      // TF 전용: TF 필수 스킬 보유자 수
    const tfHolders = isTF
      ? (tfRequiredSkills || []).reduce((sum, sid) =>
          sum + tm.filter(m => (skillMatrix[m.id]?.[sid] ?? 0) > 0).length, 0)
      : null
    return { id: team.id, name: team.name, n, femaleRatio: nF/n, avgRank, gapCount, totalGap: Math.round(totalGap*10)/10, skillCount: reqSkills.length, tfHolders }
  }), [baseTeams, members, skillMatrix, isTF, tfRequiredSkills])

  function confirmTeamSelect() {
    const selected = [...localCandidates]
    setCandidateTeams(selected)
    setMaxAddPerTeam(localMaxAdd)
    if (isTF) setTfSize(localTfSize)
    setReplacementPhase('eda')
  }

  // TF: currentTeams(기존팀) + TF 팀 자체를 projects로 사용
  // 재배치: 사용자가 선택한 candidateTeams만 (미선택 시 전체)
  // 신규: teams
  const effectiveCandidateIds = candidateTeams.length > 0 ? candidateTeams : allTeamIds
  // TF: 단일 TF 과제만 project로 사용 (차출 후보 × P21)
  // 재배치: 선택된 후보 팀만
  // 신규: teams
  const analysisTeams = placementType === 'tf'
    ? [{ id: tfId || 'tf', name: tfName || 'TF', requiredSkills: tfRequiredSkills || [] }]
    : placementType === 're'
      ? reBaseTeams.filter(t => effectiveCandidateIds.includes(t.id))
      : teams

  const [loading, setLoading] = useState(!edaResult)
  const [loadStep, setLoadStep] = useState(0)
  const [edaError, setEdaError] = useState(null)
  const [fitLoading, setFitLoading] = useState(false)
  const [fitError, setFitError] = useState(null)

  const skillNameMap = skills.reduce((acc, s) => { acc[s.id] = s.name || s.id; return acc }, {})
  const memberNameMap = members.reduce((acc, m) => { acc[m.id] = m.name || m.id; return acc }, {})

  // ── EDA 호출 ──────────────────────────────────────────────────────────────
  const didFetch = useRef(false)
  useEffect(() => {
    if (replacementPhase === 'team-select') return   // 팀선택 완료 후 EDA 시작
    if (edaResult || didFetch.current) return
    didFetch.current = true

    let step = 0
    const iv = setInterval(() => {
      setLoadStep(step)
      step++
      if (step >= LOADING_STEPS.length - 1) clearInterval(iv)
    }, 400)

    analyzeEda({
      members: members.map(m => ({ id: m.id, name: m.name, role: m.role,
        current_team_id: getMemberTeamId(m.id) })),
      skill_matrix: skillMatrix,
      skills: skills.map(s => ({ id: s.id, name: s.name })),
      projects: analysisTeams.map(t => ({ id: t.id, name: t.name, required_skills: t.requiredSkills || t.required_skills || [] })),
      placement_type: placementType === 're' ? 're' : placementType === 'tf' ? 'tf' : 'new',
      ...(placementType === 'tf' ? {
        tf_required_skills: tfRequiredSkills || [],
        tf_size: tfSize ?? localTfSize ?? 10,
        candidate_team_ids: effectiveCandidateIds,
      } : {}),
    })
      .then(res => {
        clearInterval(iv)
        setLoadStep(LOADING_STEPS.length - 1)
        setEdaResult(res)
        setTimeout(() => setLoading(false), 300)
      })
      .catch(err => {
        clearInterval(iv)
        setEdaError(err.message)
        setLoading(false)
      })

    return () => clearInterval(iv)
  }, [replacementPhase])

  // ── 적합도 계산 ───────────────────────────────────────────────────────────
  async function handleCalcFit() {
    setFitLoading(true)
    setFitError(null)
    try {
      const res = await analyzeFit({
        members: members.map(m => ({ id: m.id, name: m.name, role: m.role,
          current_team_id: getMemberTeamId(m.id) })),
        skill_matrix: skillMatrix,
        skills: skills.map(s => ({ id: s.id, name: s.name })),
        projects: analysisTeams.map(t => ({ id: t.id, name: t.name, required_skills: t.requiredSkills || t.required_skills || [] })),
        placement_type: placementType === 're' ? 're' : placementType === 'tf' ? 'tf' : 'new',
        ...(placementType === 'tf' ? {
          candidate_team_ids: effectiveCandidateIds,
          tf_required_skills: tfRequiredSkills || [],
          tf_size: tfSize ?? localTfSize ?? 10,
        } : {}),
        selected_idf: selectedIdf,
        selected_kss: selectedKss,
        selected_diff: selectedDiff,
      })
      setFitMatrix(res)

      // 1차 ILP 실행 → avgLevelRange (슬라이더 범위) 계산
      try {
        const fitMatrixForPhase1 = res?.matrix || {}
        const basePayload = {
          members: members.map(m => ({ id: m.id, name: m.name, role: m.role, gender: m.gender,
            currentTeamId: getMemberTeamId(m.id) })),
          teams: analysisTeams.map(t => ({
            id: t.id, name: t.name,
            requiredSkills: t.requiredSkills || t.required_skills || [],
            size: Math.ceil(members.length / analysisTeams.length),
          })),
          skillMatrix: skillMatrix,
          fitMatrix: fitMatrixForPhase1,
        }
        const phase1Fn = placementType === 're'
          ? getReplacementPhase1
          : placementType === 'tf'
            ? getTFPhase1
            : getPlacementPhase1
        // TF phase1은 '차출 원천 팀들'(currentTeams 중 선택된 팀)이 필요함.
        // analysisTeams(=TF 단일 과제)가 아니라 기존 팀을 보내야 잔류 평균 레벨이 계산됨.
        const tfSourceTeams = (isTF ? currentTeams : [])
          .filter(t => effectiveCandidateIds.includes(t.id))
          .map(t => ({
            id: t.id, name: t.name,
            requiredSkills: t.requiredSkills || t.required_skills || [],
            size: t.size || 1,
          }))
        const p1 = await phase1Fn(
          placementType === 'tf'
            ? {
                ...basePayload,
                teams: tfSourceTeams,
                tfInfo: {
                  id: tfId || 'tf', name: tfName || 'TF',
                  requiredSkills: tfRequiredSkills || [],
                  size: tfSize ?? localTfSize ?? 10,
                },
                fitVector: Object.fromEntries(
                  Object.entries(fitMatrixForPhase1).map(([mid, scores]) =>
                    [mid, typeof scores === 'object' ? (scores[tfId || 'tf'] ?? 0) : scores]
                  )
                ),
              }
            : basePayload
        )
        setPhase1Info(p1)
      } catch (_) {
        // phase1 실패 시 슬라이더 기본값(1~5) 유지, 배치는 계속 가능
      }

      setCurrentStep(3)
      navigate('/step/3')
    } catch (err) {
      setFitError(err.message)
      setFitLoading(false)
    }
  }

  // ── 재배치: 팀 현황 EDA + 팀 선택 + MAX_ADD 입력 단계 (로딩보다 먼저 체크) ──
  if ((isReplacement || isTF) && replacementPhase === 'team-select') {
    const surplusMembers = isReplacement ? members.filter(m => !getMemberTeamId(m.id)) : []
    const nF = surplusMembers.filter(m => ['여','f','female'].includes((m.gender||'').toLowerCase())).length
    const poolF = surplusMembers.length > 0 ? nF / surplusMembers.length : 0
    const candidateMembers = isTF
      ? members.filter(m => localCandidates.has(getMemberTeamId(m.id) || ''))
      : []
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar currentStep={2} />
        <div className="pt-[69px] max-w-5xl mx-auto px-6 pb-20">
          <div className="pt-8 pb-5">
            <h2 className="text-xl font-semibold text-ink">
              {isTF ? 'TF 구성 — 차출 허용 팀 설정' : '기존 팀 현황 분석'}
            </h2>
            <p className="text-sm text-body mt-1">
              {isTF
                ? `TF 차출을 허용할 팀을 선택하고 팀당 최대 차출 인원을 설정하세요.`
                : '재배치 인원을 받을 팀을 선택하고 팀당 최대 인원을 설정하세요.'}
            </p>
            {/* TF 목표 인원 입력 */}
            {isTF && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm font-medium text-ink">TF 목표 인원:</span>
                <input
                  type="number" min={1} max={200}
                  value={localTfSize}
                  onChange={e => setLocalTfSize(Math.max(1, parseInt(e.target.value)||1))}
                  className="w-20 text-center border border-hairline rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-primary"
                />
                <span className="text-xs text-body">명</span>
                {tfName && <span className="text-xs text-body ml-2">TF: {tfName} ({(tfRequiredSkills||[]).length}개 필수스킬)</span>}
              </div>
            )}
          </div>

          {/* 팀별 현황 카드 */}
          <div className="space-y-2 mb-8">
            {teamStatus.map(ts => {
              const selected = localCandidates.has(ts.id)
              return (
                <div key={ts.id}
                  className={`border rounded-lg p-4 transition-colors cursor-pointer ${
                    selected ? 'border-primary bg-primary/5' : 'border-hairline bg-surface opacity-60'
                  }`}
                  onClick={() => setLocalCandidates(prev => {
                    const next = new Set(prev)
                    next.has(ts.id) ? next.delete(ts.id) : next.add(ts.id)
                    return next
                  })}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        selected ? 'border-primary bg-primary' : 'border-hairline'
                      }`}>
                        {selected && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div>
                        <span className="font-semibold text-ink">{ts.id}</span>
                        {ts.name && ts.name !== ts.id && (
                          <span className="ml-2 text-xs text-body">{ts.name}</span>
                        )}
                        <span className="ml-2 text-xs text-body">· {ts.n}명</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      {isTF && (
                        <div className="text-center">
                          <div className={`font-mono font-semibold ${(ts.tfHolders||0) === 0 ? 'text-body' : 'text-primary'}`}>
                            {ts.tfHolders ?? 0}명
                          </div>
                          <div className="text-xs text-body">TF스킬보유</div>
                        </div>
                      )}
                      <div className="text-center">
                        <div className={`font-mono font-semibold ${ts.gapCount > 0 ? 'text-accent-coral' : 'text-primary'}`}>
                          {ts.gapCount}/{ts.skillCount}
                        </div>
                        <div className="text-xs text-body">미달스킬</div>
                      </div>
                      <div className="text-center">
                        <div className={`font-mono font-semibold ${ts.totalGap > 0 ? 'text-accent-amber' : 'text-body'}`}>
                          {ts.totalGap.toFixed(1)}
                        </div>
                        <div className="text-xs text-body">스킬부족도</div>
                      </div>
                      <div className="text-center">
                        <div className="font-mono font-semibold text-ink">{(ts.femaleRatio*100).toFixed(0)}%</div>
                        <div className="text-xs text-body">여성비율</div>
                      </div>
                      <div className="text-center">
                        <div className="font-mono font-semibold text-ink">{ts.avgRank.toFixed(1)}</div>
                        <div className="text-xs text-body">평균직급</div>
                      </div>
                      <div className="text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="number" min={0} max={50}
                          value={localMaxAdd[ts.id] ?? 5}
                          onChange={e => setLocalMaxAdd(prev => ({ ...prev, [ts.id]: Math.max(0, parseInt(e.target.value)||0) }))}
                          className="w-14 text-center border border-hairline rounded px-1 py-0.5 text-sm font-mono focus:outline-none focus:border-primary"
                          disabled={!selected}
                        />
                        <div className="text-xs text-body">최대추가</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 요약 */}
          <div className="p-4 border border-hairline rounded-lg bg-surface mb-8">
            {isTF ? (
              <>
                <p className="text-sm font-medium text-ink mb-2">
                  TF 목표: {localTfSize}명 | 차출 후보 (선택된 팀 소속): {candidateMembers.length}명
                </p>
                <div className="flex gap-4 text-xs text-body">
                  <span>선택된 팀: {localCandidates.size}개</span>
                  <span>팀별 상한 합계: {[...localCandidates].reduce((a, id) => a + (localMaxAdd[id] ?? 3), 0)}명</span>
                  {[...localCandidates].reduce((a, id) => a + (localMaxAdd[id] ?? 3), 0) < localTfSize && (
                    <span className="text-accent-coral">⚠ 상한 합계가 TF 목표보다 적습니다</span>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-ink mb-2">
                  재배치 대상 잉여 인력: {surplusMembers.length}명
                </p>
                <div className="flex gap-4 text-xs text-body">
                  <span>선택된 팀: {localCandidates.size}개</span>
                  <span>총 수용 가능: {[...localCandidates].reduce((a, id) => a + (localMaxAdd[id] ?? 5), 0)}명</span>
                  <span className={poolF*100 < 20 ? 'text-accent-coral' : ''}>잉여 인력 여성비율: {(poolF*100).toFixed(0)}%</span>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => navigate('/step/1')}>← 데이터 수정</Button>
            <Button onClick={confirmTeamSelect} disabled={localCandidates.size === 0}>
              {isTF ? '선택 완료 — TF 후보 적합도 분석 →' : '선택 완료 — 적합도 분석 시작 →'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── 로딩 ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar currentStep={2} />
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 69px)', marginTop: '69px' }}>
          <div className="flex flex-col items-center gap-8">
            <WhiskLoader fps={12} size={160} />
            <div className="text-center space-y-1.5">
              {LOADING_STEPS.map((s, i) => (
                <p key={s} className={`text-sm transition-all ${
                  i < loadStep ? 'text-primary font-medium' : i === loadStep ? 'text-ink font-medium' : 'text-body'
                }`}>
                  {i < loadStep ? '✓ ' : i === loadStep ? '› ' : '  '}{s}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (edaError) {
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar currentStep={2} />
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 69px)', marginTop: '69px' }}>
          <div className="text-center space-y-4">
            <p className="text-accent-coral font-medium">분석 오류: {edaError}</p>
            <Button variant="outline" onClick={() => navigate('/step/1')}>← 데이터 수정</Button>
          </div>
        </div>
      </div>
    )
  }

  const { idf = {}, kss = {}, difficulty = {}, talent_types = {} } = edaResult || {}
  const cur = step2CurrentStep || 1

  function goNext() {
    if (cur === 4) handleCalcFit()
    else setStep2CurrentStep(cur + 1)
  }
  function goPrev() {
    if (cur > 1) setStep2CurrentStep(cur - 1)
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar currentStep={2} />
      <div className="pt-[69px] max-w-5xl mx-auto px-6 pb-20">

        {/* 스텝 인디케이터 */}
        <StepIndicator current={cur} total={4} steps={STEP_META} />

        {/* 상단 지시사항 */}
        <Instruction step={cur} />

        {/* 2컬럼 본문 — 1/2단계는 차트(3):인사이트(2), 3/4단계는 요약(2):선택목록(3) */}
        <div className={`mt-6 grid gap-6 items-stretch ${cur <= 2 ? 'grid-cols-5' : 'grid-cols-5'}`}>
          <div className={`flex flex-col ${cur <= 2 ? 'col-span-3' : 'col-span-2'}`}>
            {cur === 1 && <TalentPie talentTypes={talent_types} />}
            {cur === 2 && <KssScatter kss={kss} skillNameMap={skillNameMap} />}
            {cur === 3 && <IdfSummary idf={idf} />}
            {cur === 4 && <DiffSummary difficulty={difficulty} />}
          </div>
          <div className={`flex flex-col gap-4 ${cur <= 2 ? 'col-span-2' : 'col-span-3'}`}>
            {cur === 1 && <TalentInsight talentTypes={talent_types} memberNameMap={memberNameMap} />}
            {cur === 2 && <KssSelect kss={kss} skillNameMap={skillNameMap} selected={selectedKss} onChange={setSelectedKss} />}
            {cur === 3 && <IdfSelect idf={idf} skillNameMap={skillNameMap} selected={selectedIdf} onChange={setSelectedIdf} />}
            {cur === 4 && <DiffSelect difficulty={difficulty} skillNameMap={skillNameMap} selected={selectedDiff} onChange={setSelectedDiff} />}
          </div>
        </div>

        {fitError && <p className="mt-4 text-sm text-accent-coral">{fitError}</p>}

        {/* 하단 네비게이션 */}
        <div className="mt-8 flex justify-between items-center">
          {cur > 1
            ? <Button variant="outline" onClick={goPrev}>← 이전</Button>
            : <div />
          }
          <Button onClick={goNext} disabled={fitLoading}>
            {cur === 4
              ? (fitLoading ? '계산 중...' : '적합도 계산하기 →')
              : '다음 →'
            }
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── 스텝 인디케이터 ───────────────────────────────────────────────────────────
function StepIndicator({ current, total, steps }) {
  return (
    <div className="flex items-center gap-2 pt-8 pb-5">
      {steps.map((s, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-medium transition-colors ${
              done   ? 'bg-primary text-white' :
              active ? 'bg-ink text-white' :
                       'border border-hairline text-body bg-surface'
            }`}>
              {done ? '✓' : n}
            </div>
            {active && (
              <span className="text-xl font-semibold text-ink tracking-tight">
                {n}/{total} — {s.label}
              </span>
            )}
            {n < total && (
              <div className={`w-6 h-px mx-1 ${done ? 'bg-primary' : 'bg-hairline'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 상단 지시사항 ─────────────────────────────────────────────────────────────
function Instruction({ step }) {
  const texts = [
    '우리 조직의 인재 구성을 먼저 확인하세요. 이 단계는 선택 없이 다음으로 넘어가면 됩니다.',
    '여러 과제에서 동시에 요구하지만 보유자가 적은 스킬입니다. 배치 적합도 계산에 반영할 스킬을 선택하세요.',
    '보유자가 적어 귀한 스킬입니다. 이 스킬을 가진 인재에게 더 높은 가중치를 부여하려면 선택하세요.',
    '레벨 4 이상 보유자가 적을수록 숙달이 어려운 스킬입니다. 난이도 높은 과제에 더 역량 있는 인원을 배치하려면 선택하세요.',
  ]
  return (
    <p className="text-sm text-body border-l-2 border-primary pl-3 py-0.5 leading-relaxed">
      {texts[step - 1]}
    </p>
  )
}

// ── 공통: 빠른 선택 버튼 ──────────────────────────────────────────────────────
function QuickBtn({ label, onClick, variant = 'default' }) {
  const cls = {
    default: 'border-hairline text-body hover:border-primary hover:text-primary',
    red:     'border-accent-coral/40 text-accent-coral hover:bg-accent-coral hover:text-white',
    amber:   'border-amber/40 text-amber-dark hover:bg-amber hover:text-white',
  }[variant]
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 text-xs border rounded-sm transition-colors ${cls}`}>
      {label}
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 1/4  인재 유형
// ────────────────────────────────────────────────────────────────────────────
function TalentPie({ talentTypes }) {
  const entries = Object.values(talentTypes)
  const counts = entries.reduce((acc, e) => {
    acc[e.talent_type] = (acc[e.talent_type] || 0) + 1
    return acc
  }, {})
  const pieData = Object.entries(counts).map(([type, value]) => ({
    name: type, value, color: C.talentColors[type] || C.body,
  }))

  return (
    <div className="border border-hairline rounded-xl bg-surface p-5 flex-1 flex flex-col">
      <p className="text-xs text-body font-mono uppercase tracking-wider mb-4">유형별 인원 분포</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="45%" innerRadius="30%" outerRadius="52%" dataKey="value">
              {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [`${v}명`, n]} />
            <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 13 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function TalentInsight({ talentTypes, memberNameMap }) {
  const entries = Object.entries(talentTypes).map(([id, v]) => ({ id, ...v }))
  const counts = entries.reduce((acc, e) => {
    acc[e.talent_type] = (acc[e.talent_type] || 0) + 1
    return acc
  }, {})
  const scatterData = entries.map(e => ({
    x: e.skill_count, y: e.level_std, type: e.talent_type, id: e.id,
  }))

  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="border border-hairline rounded-xl bg-surface p-5">
        <p className="text-xs text-body font-mono uppercase tracking-wider mb-3">유형별 인원</p>
        {Object.entries(counts).map(([type, n]) => (
          <div key={type} className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: C.talentColors[type] }} />
            <span className="text-sm text-ink flex-1">{type}</span>
            <span className="text-sm font-mono font-medium text-ink">{n}명</span>
          </div>
        ))}
        <p className="text-xs text-body mt-2 pt-2 border-t border-hairline">총 {entries.length}명</p>
      </div>

      <div className="border border-hairline rounded-xl bg-surface p-5">
        <p className="text-xs text-body font-mono uppercase tracking-wider mb-2">스킬 수 vs 레벨 분산</p>
        <div className="flex gap-3 mb-2 flex-wrap">
          {Object.entries(C.talentColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1 text-xs text-body">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color, opacity: 0.75 }} />
              {type}
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <ScatterChart margin={{ left: 4, right: 12, top: 4, bottom: 32 }}>
            <XAxis dataKey="x" name="보유스킬수" tick={{ fontSize: 10 }}
              label={{ value: '보유 스킬 수', position: 'insideBottom', offset: -18, fontSize: 10 }} />
            <YAxis dataKey="y" name="레벨표준편차" tick={{ fontSize: 10 }} width={32} />
            <Tooltip content={({ payload }) => {
              if (!payload?.length) return null
              const d = payload[0]?.payload
              return (
                <div className="bg-surface border border-hairline rounded px-2 py-1 text-xs shadow-sm">
                  <div className="font-medium">{memberNameMap[d?.id] || d?.id}</div>
                  <div className="text-body">{d?.type}</div>
                </div>
              )
            }} />
            {Object.entries(C.talentColors).map(([type, color]) => (
              <Scatter key={type} name={type}
                data={scatterData.filter(d => d.type === type)}
                fill={color} opacity={0.65} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 2/4  수요-공급 & SPOF
// ────────────────────────────────────────────────────────────────────────────
function KssScatter({ kss, skillNameMap }) {
  const entries = Object.entries(kss).map(([sid, v]) => ({ sid, ...v }))
  const maxVal = Math.max(...entries.map(e => Math.max(e.holders, e.demand)), 1)

  const spofData = entries.filter(e => e.is_spof).map(e => ({ x: e.holders, y: e.demand, sid: e.sid, is_spof: true, is_bottleneck: false }))
  const btlData  = entries.filter(e => !e.is_spof && e.is_bottleneck).map(e => ({ x: e.holders, y: e.demand, sid: e.sid, is_spof: false, is_bottleneck: true }))
  const normData = entries.filter(e => !e.is_spof && !e.is_bottleneck).map(e => ({ x: e.holders, y: e.demand, sid: e.sid, is_spof: false, is_bottleneck: false }))

  return (
    <div className="border border-hairline rounded-xl bg-surface p-5 flex-1 flex flex-col">
      <p className="text-xs text-body font-mono uppercase tracking-wider mb-4">수요 vs 공급 분포</p>
      {/* 범례 — 차트 위에 별도 배치해서 X축 레이블 겹침 방지 */}
      <div className="flex gap-4 mb-2">
        {[{ label: '일반', color: C.primary, opacity: 0.4 }, { label: '병목', color: C.amber, opacity: 1 }, { label: 'SPOF', color: C.coral, opacity: 1 }].map(item => (
          <div key={item.label} className="flex items-center gap-1 text-xs text-body">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color, opacity: item.opacity }} />
            {item.label}
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ left: 12, right: 16, top: 4, bottom: 36 }}>
          <XAxis dataKey="x" type="number" tick={{ fontSize: 10 }}
            label={{ value: '보유자 수 (공급)', position: 'insideBottom', offset: -20, fontSize: 10 }} />
          <YAxis dataKey="y" type="number" tick={{ fontSize: 10 }} width={36}
            label={{ value: '요구 과제 수', angle: -90, position: 'insideLeft', dx: -4, fontSize: 10 }} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxVal, y: maxVal }]}
            stroke="#ccc" strokeDasharray="3 3" />
          <Tooltip content={({ payload }) => {
            if (!payload?.length) return null
            const d = payload[0]?.payload
            return (
              <div className="bg-surface border border-hairline rounded px-2 py-1 text-xs shadow-sm">
                <div className="font-medium">{skillNameMap[d?.sid] || d?.sid}</div>
                <div className="text-body">공급 {d?.x}명 / 수요 {d?.y}건</div>
                {d?.is_spof && <div className="text-accent-coral font-medium mt-0.5">SPOF</div>}
                {!d?.is_spof && d?.is_bottleneck && <div className="text-amber-dark font-medium mt-0.5">병목</div>}
              </div>
            )
          }} />
          <Scatter name="일반" data={normData} fill={C.primary} opacity={0.35} />
          <Scatter name="병목" data={btlData}  fill={C.amber} opacity={0.85} />
          <Scatter name="SPOF" data={spofData} fill={C.coral} opacity={0.9} />
        </ScatterChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}

function KssSelect({ kss, skillNameMap, selected, onChange }) {
  const entries = sortDesc(Object.entries(kss).map(([sid, v]) => ({ sid, ...v })), 'kss_norm')
  const sel = new Set(selected)
  const spofIds = entries.filter(e => e.is_spof).map(e => e.sid)
  const btlIds  = entries.filter(e => e.is_bottleneck).map(e => e.sid)

  function toggle(sid) {
    const next = new Set(sel)
    next.has(sid) ? next.delete(sid) : next.add(sid)
    onChange([...next])
  }

  const nSpof = spofIds.length
  const nBtl  = btlIds.length

  const kssGuide = (() => {
    if (nSpof === 0 && nBtl === 0)
      return { text: '현재 SPOF나 병목 스킬이 없습니다. 수요가 높은 스킬을 선택적으로 반영할 수 있습니다.', color: '#1a7a4a', bg: '#edfaf3' }
    if (nSpof > 0 && nBtl === 0)
      return { text: `보유자가 극히 적은 SPOF 스킬이 ${nSpof}개 있습니다. 적합도 계산에 반영할 스킬을 선택해주세요.`, color: C.coral, bg: '#fde8e8' }
    if (nSpof === 0 && nBtl > 0)
      return { text: `수요 대비 공급이 부족한 병목 스킬이 ${nBtl}개 있습니다. 해당 스킬 보유자가 중요한 자원이 될 수 있습니다.`, color: '#b7791f', bg: '#fef3c7' }
    return { text: `SPOF ${nSpof}개, 병목 ${nBtl}개가 발견됐습니다. 리스트에서 확인 후 반영할 스킬을 선택해주세요.`, color: C.coral, bg: '#fde8e8' }
  })()

  return (
    <div className="border border-hairline rounded-xl bg-surface p-5 flex flex-col gap-3">
      {/* 안내 멘트 */}
      <div className="rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={{ background: kssGuide.bg, color: kssGuide.color }}>
        {kssGuide.text}
      </div>
      <div className="flex items-center gap-3 flex-wrap text-xs font-mono">
        <span className="text-accent-coral font-medium">SPOF {nSpof}개</span>
        <span className="text-body">·</span>
        <span style={{ color: '#b7791f' }}>병목 {nBtl}개</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <QuickBtn label="SPOF 전체 선택" variant="red"   onClick={() => onChange(spofIds)} />
        <QuickBtn label="병목 전체 선택" variant="amber" onClick={() => onChange(btlIds)} />
        <QuickBtn label="전체 해제"                      onClick={() => onChange([])} />
      </div>
      <span className="text-xs text-body font-mono">{selected.length}개 선택됨</span>
      <div className="overflow-auto border border-hairline rounded-md" style={{ maxHeight: 320 }}>
        {entries.map(e => (
          <label key={e.sid}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-hairline last:border-0 hover:bg-canvas transition-colors ${sel.has(e.sid) ? 'bg-primary/5' : ''}`}>
            <input type="checkbox" checked={sel.has(e.sid)} onChange={() => toggle(e.sid)}
              className="w-3.5 h-3.5 shrink-0" style={{ accentColor: C.primary }} />
            <span className="font-mono text-xs text-body w-20 shrink-0 truncate">{e.sid}</span>
            <span className="text-xs text-ink flex-1 truncate">{skillNameMap[e.sid] || ''}</span>
            <span className="text-xs text-body font-mono shrink-0 mr-1">수요{e.demand}/공급{e.holders}</span>
            {e.is_spof && (
              <span className="text-[10px] px-1 py-0.5 rounded font-medium shrink-0" style={{ background: '#fde8e8', color: C.coral }}>SPOF</span>
            )}
            {!e.is_spof && e.is_bottleneck && (
              <span className="text-[10px] px-1 py-0.5 rounded font-medium shrink-0" style={{ background: '#fef3c7', color: '#b7791f' }}>병목</span>
            )}
          </label>
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 3/4  스킬 희귀도 (IDF)
// ────────────────────────────────────────────────────────────────────────────
function IdfSummary({ idf }) {
  const entries = Object.values(idf)
  const counts = entries.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + 1; return acc }, {})
  const total  = entries.length
  const nRare  = counts['희귀'] || 0
  const rareEntries  = entries.filter(e => e.category === '희귀').sort((a, b) => a.holders - b.holders)
  const minHolders   = rareEntries[0]?.holders ?? 0
  const maxHolders   = rareEntries[rareEntries.length - 1]?.holders ?? 0

  const catColor = { '희귀': '#1E7A52', '보통': C.primary, '보편': '#C2EAD8' }
  const pieData  = ['희귀', '보통', '보편']
    .filter(c => counts[c])
    .map(c => ({ name: c, value: counts[c], color: catColor[c] }))

  return (
    <div className="border border-hairline rounded-xl bg-surface p-5 flex-1 flex flex-col gap-4">
      <p className="text-xs text-body font-mono uppercase tracking-wider">희귀도 분포 요약</p>

      {/* 파이차트 */}
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="45%" innerRadius="30%" outerRadius="55%" dataKey="value">
              {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [`${v}개`, n]} />
            <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-2">
        {['희귀', '보통', '보편'].map(cat => (
          <div key={cat} className="rounded-lg p-3 text-center" style={{ background: `${catColor[cat]}22` }}>
            <div className="text-lg font-mono font-semibold" style={{ color: catColor[cat] === '#C2EAD8' ? '#1a7a4a' : catColor[cat] }}>
              {counts[cat] || 0}
            </div>
            <div className="text-[10px] text-body mt-0.5">{cat}</div>
          </div>
        ))}
      </div>

      {/* 희귀 스킬 보유자 범위 */}
      {nRare > 0 && (
        <div className="rounded-lg px-3 py-2 bg-canvas text-xs text-body">
          희귀 분류 스킬의 실제 보유자: <span className="font-mono font-medium text-ink">{minHolders}명 ~ {maxHolders}명</span>
          <br />
          <span className="text-[10px]">상대 순위 기준(하위 33%)이므로 보유자 수를 직접 확인하세요.</span>
        </div>
      )}
    </div>
  )
}

function IdfSelect({ idf, skillNameMap, selected, onChange }) {
  const entries = sortDesc(Object.entries(idf).map(([sid, v]) => ({ sid, ...v })), 'idf_norm')
  const sel = new Set(selected)
  const counts = entries.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + 1; return acc }, {})
  const rareIds = entries.filter(e => e.category === '희귀').map(e => e.sid)

  function toggle(sid) {
    const next = new Set(sel)
    next.has(sid) ? next.delete(sid) : next.add(sid)
    onChange([...next])
  }

  const catStyle = {
    '희귀': { background: '#fde8e8', color: C.coral },
    '보통': { background: '#e8f0f8', color: '#4a6fa5' },
    '보편': { background: '#edfaf3', color: '#1a7a4a' },
  }

  const nRare   = counts['희귀'] || 0
  const nCommon = counts['보편'] || 0
  const total   = entries.length

  const idfGuide = (() => {
    if (nRare === 0)
      return {
        text: '전체 스킬 보유자 분포가 고른 편입니다. 희귀 분류는 상대적 기준(하위 33%)이라 실제로는 희귀하지 않을 수 있습니다.',
        color: '#4a6fa5', bg: '#e8f0f8',
      }
    const rarePct = Math.round(nRare / total * 100)
    return {
      text: `상대적으로 보유자가 적은 스킬 ${nRare}개(상위 ${rarePct}%)가 희귀로 분류됐습니다. 분류는 전체 스킬 내 상대 순위 기준이므로, 아래 목록에서 실제 보유자 수(명)를 확인한 뒤 진짜로 드문 스킬인지 직접 판단해주세요.`,
      color: '#92400e', bg: '#fef3c7',
    }
  })()

  return (
    <div className="border border-hairline rounded-xl bg-surface p-5 flex flex-col gap-3">
      {/* 안내 멘트 */}
      <div className="rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={{ background: idfGuide.bg, color: idfGuide.color }}>
        {idfGuide.text}
      </div>
      <div className="flex gap-3 text-xs font-mono flex-wrap">
        <span style={{ color: C.coral }}>희귀 {nRare}개</span>
        <span className="text-body">보통 {counts['보통'] || 0}개</span>
        <span style={{ color: '#1a7a4a' }}>보편 {nCommon}개</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <QuickBtn label="희귀 스킬 전체 선택" variant="red" onClick={() => onChange(rareIds)} />
        <QuickBtn label="전체 해제" onClick={() => onChange([])} />
      </div>
      <span className="text-xs text-body font-mono">{selected.length}개 선택됨</span>
      <div className="overflow-auto border border-hairline rounded-md" style={{ maxHeight: 320 }}>
        {entries.map(e => (
          <label key={e.sid}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-hairline last:border-0 hover:bg-canvas transition-colors ${sel.has(e.sid) ? 'bg-primary/5' : ''}`}>
            <input type="checkbox" checked={sel.has(e.sid)} onChange={() => toggle(e.sid)}
              className="w-3.5 h-3.5 shrink-0" style={{ accentColor: C.primary }} />
            <span className="font-mono text-xs text-body w-20 shrink-0 truncate">{e.sid}</span>
            <span className="text-xs text-ink flex-1 truncate">{skillNameMap[e.sid] || ''}</span>
            <span className="text-xs text-body font-mono shrink-0 mr-1">{e.holders}명</span>
            <span className="text-[10px] px-1 py-0.5 rounded font-medium shrink-0"
              style={catStyle[e.category] || {}}>
              {e.category}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 4/4  스킬 난이도
// ────────────────────────────────────────────────────────────────────────────
function DiffSummary({ difficulty }) {
  const entries = Object.values(difficulty)
  const total = entries.length
  const withHolders = entries.filter(e => e.holders > 0)
  const avg  = withHolders.length ? withHolders.reduce((s, e) => s + e.difficulty, 0) / withHolders.length : 0
  const hard = entries.filter(e => e.difficulty >= 0.7).length   // lv4+ 비율 30% 미만
  const easy = entries.filter(e => e.difficulty === 0).length    // 전원 lv4+

  const buckets = [
    { label: '매우 어려움', desc: 'lv4+ 비율 0~30%', count: entries.filter(e => e.difficulty >= 0.7).length, color: C.coral },
    { label: '보통',        desc: 'lv4+ 비율 30~70%', count: entries.filter(e => e.difficulty > 0.3 && e.difficulty < 0.7).length, color: C.amber },
    { label: '쉬움',        desc: 'lv4+ 비율 70%+',   count: entries.filter(e => e.difficulty <= 0.3 && e.holders > 0).length, color: C.primary },
    { label: '보유자 없음', desc: '미측정',             count: entries.filter(e => e.holders === 0).length, color: C.hairline },
  ]

  return (
    <div className="border border-hairline rounded-xl bg-surface p-5 flex-1 flex flex-col gap-4">
      <p className="text-xs text-body font-mono uppercase tracking-wider">스킬 난이도 요약</p>

      {/* 핵심 수치 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg p-4 bg-canvas text-center">
          <div className="text-2xl font-mono font-semibold text-ink">{(avg * 100).toFixed(0)}%</div>
          <div className="text-[10px] text-body mt-1">평균 난이도</div>
          <div className="text-[10px] text-body">(lv4+ 미달 비율)</div>
        </div>
        <div className="rounded-lg p-4 bg-canvas text-center">
          <div className="text-2xl font-mono font-semibold" style={{ color: C.coral }}>{hard}</div>
          <div className="text-[10px] text-body mt-1">어려운 스킬</div>
          <div className="text-[10px] text-body">(lv4+ 비율 30% 미만)</div>
        </div>
      </div>

      {/* 구간별 분포 */}
      <div className="flex flex-col gap-1.5">
        {buckets.map(b => (
          <div key={b.label} className="flex items-center gap-2">
            <div className="w-20 text-[10px] text-body shrink-0">{b.label}</div>
            <div className="flex-1 h-4 rounded-sm overflow-hidden bg-canvas">
              <div className="h-full rounded-sm transition-all"
                style={{ width: `${total ? (b.count / total * 100) : 0}%`, background: b.color, opacity: 0.8 }} />
            </div>
            <div className="text-[10px] font-mono text-body w-6 text-right shrink-0">{b.count}</div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-body">난이도 = 1 − (lv4+ 보유자 수 / 전체 보유자 수)</p>
    </div>
  )
}

function DiffSelect({ difficulty, skillNameMap, selected, onChange }) {
  const entries = sortDesc(Object.entries(difficulty).map(([sid, v]) => ({ sid, ...v })), 'difficulty')
  const sel = new Set(selected)
  const top20ids = entries.slice(0, 20).map(e => e.sid)

  function toggle(sid) {
    const next = new Set(sel)
    next.has(sid) ? next.delete(sid) : next.add(sid)
    onChange([...next])
  }

  return (
    <div className="border border-hairline rounded-xl bg-surface p-5 flex flex-col gap-3">
      <div className="flex gap-1.5 flex-wrap">
        <QuickBtn label="어려운 스킬 TOP 20" variant="amber" onClick={() => onChange(top20ids)} />
        <QuickBtn label="전체 해제" onClick={() => onChange([])} />
      </div>
      <span className="text-xs text-body font-mono">{selected.length}개 선택됨</span>
      <div className="overflow-auto border border-hairline rounded-md" style={{ maxHeight: 320 }}>
        {entries.map(e => (
          <label key={e.sid}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-hairline last:border-0 hover:bg-canvas transition-colors ${sel.has(e.sid) ? 'bg-primary/5' : ''}`}>
            <input type="checkbox" checked={sel.has(e.sid)} onChange={() => toggle(e.sid)}
              className="w-3.5 h-3.5 shrink-0" style={{ accentColor: C.primary }} />
            <span className="font-mono text-xs text-body w-20 shrink-0 truncate">{e.sid}</span>
            <span className="text-xs text-ink flex-1 truncate">{skillNameMap[e.sid] || ''}</span>
            <span className="text-xs text-body font-mono shrink-0 mr-1">lv4+ {e.holders_lv4}/{e.holders}명</span>
            <span className="text-xs font-mono font-medium text-ink shrink-0">{e.difficulty.toFixed(2)}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
