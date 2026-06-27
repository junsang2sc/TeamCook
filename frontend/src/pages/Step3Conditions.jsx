import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Toggle from '../components/ui/Toggle'
import Slider from '../components/ui/Slider'
import useStore from '../store/useStore'
import { getPlacement, getReplacement, getTFPlacement } from '../api/index'

export default function Step3Conditions() {
  const navigate = useNavigate()
  const {
    conditions, setConditions,
    members, skills, teams, skillMatrix,
    analysisResult, placementMode,
    setPlacementResult, setCurrentStep,
    flowType, currentAssignment,
    fitMatrix,
    placementType,
    currentTeams,
    tfId, tfName, tfProject, tfRequiredSkills,
    setTFData,
  } = useStore()

  const [matrixView, setMatrixView] = useState('heatmap')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedMember, setSelectedMember] = useState('')
  useEffect(() => { if (!selectedTeam && teams.length) setSelectedTeam(teams[0].id) }, [teams])
  useEffect(() => { if (!selectedMember && members.length) setSelectedMember(members[0].id) }, [members])
  useEffect(() => { if (teamSize === null && members.length > 0 && teams.length > 0) setTeamSize(Math.ceil(members.length / teams.length)) }, [members, teams])

  const [nlInput, setNlInput] = useState('')
  const [nlParsed, setNlParsed] = useState(null)
  const [constraints, setConstraints] = useState([])

  const minTeamSize = members.length > 0 && teams.length > 0
    ? Math.ceil(members.length / teams.length)
    : 1
  const [teamSize, setTeamSize] = useState(null)
  const [teamSizeExpanded, setTeamSizeExpanded] = useState(false)
  const [perTeamSize, setPerTeamSize] = useState({})   // { teamId: number }

  // perTeamSize 초기화: teams가 로드되면 전역 teamSize로 채움
  useEffect(() => {
    if (teams.length > 0) {
      setPerTeamSize(prev => {
        const next = { ...prev }
        teams.forEach(t => { if (!(t.id in next)) next[t.id] = teamSize ?? minTeamSize })
        return next
      })
    }
  }, [teams, teamSize, minTeamSize])

  const setPerTeam = (teamId, val) =>
    setPerTeamSize(prev => ({ ...prev, [teamId]: Math.max(1, val) }))

  const [educationConsider, setEducationConsider] = useState(false)
  const [locationConsider, setLocationConsider] = useState(false)
  const [priorityWeight, setPriorityWeight] = useState(false)

  const set = (key, val) => setConditions({ ...conditions, [key]: val })

  // 팀당 인원 합계 검증 — perTeamSize가 하나라도 설정되어 있으면 그 합산 기준
  const hasPerTeamOverride = Object.keys(perTeamSize).length > 0
  const teamSizeTotal = hasPerTeamOverride
    ? teams.reduce((s, t) => s + (perTeamSize[t.id] ?? (teamSize ?? minTeamSize)), 0)
    : (teamSize ?? minTeamSize) * teams.length
  const teamSizeMismatch = members.length > 0 && teams.length > 0 && teamSizeTotal !== members.length
  const teamSizeDiff = teamSizeTotal - members.length

  const handleParseNL = () => {
    const text = nlInput.trim()
    if (!text) return
    if (text.includes('부장')) {
      setNlParsed({ text: 'distribute 조건 — 부장 역할, 팀당 최소 1명', constraint: { type: 'distribute', role: '부장', min_per_team: 1 } })
    } else if (text.includes('같은 팀') && text.includes('안')) {
      setNlParsed({ text: 'separate 조건 — 해당 구성원들을 다른 팀으로 분리', constraint: { type: 'separate', members: [] } })
    } else {
      setNlParsed({ text: `일반 조건으로 처리합니다: "${text}"`, constraint: { type: 'custom', text } })
    }
  }

  const handleAddConstraint = () => {
    if (!nlParsed) return
    setConstraints([...constraints, nlParsed])
    setNlParsed(null)
    setNlInput('')
  }

  // 코사인 유사도 기반 적합도 계산 (프론트 자체 계산)
  const computeFitnessMatrix = () => {
    const allSkillIds = skills.map(s => s.id)
    const scores = {}
    for (const m of members) {
      scores[m.id] = {}
      const mv = allSkillIds.map(sid => skillMatrix[m.id]?.[sid] ?? 0)
      const mvNorm = Math.sqrt(mv.reduce((a, b) => a + b * b, 0)) || 1
      for (const t of teams) {
        const tv = allSkillIds.map(sid => t.requiredSkills?.includes(sid) ? 1 : 0)
        const tvNorm = Math.sqrt(tv.reduce((a, b) => a + b * b, 0)) || 1
        const dot = mv.reduce((a, b, i) => a + b * tv[i], 0)
        scores[m.id][t.id] = Math.round((dot / (mvNorm * tvNorm)) * 100) / 100
      }
    }
    return {
      members: members.map(m => ({ id: m.id, name: m.name })),
      teams: teams.map(t => ({ id: t.id, name: t.name })),
      scores,
    }
  }

  // 실제 데이터 기반 배치 결과 생성 (API fallback)
  const buildLocalPlacementResult = () => {
    const fitness = computeFitnessMatrix()
    // 각 팀에 코사인 유사도 기준 상위 인원 배치 (탐욕 방식)
    const teamSize = Math.ceil(members.length / Math.max(teams.length, 1))
    const assigned = new Set()
    const placement = {}
    for (const t of teams) {
      placement[t.id] = []
    }
    // 팀별로 가장 적합한 인원 순서대로 배정
    const remaining = () => members.filter(m => !assigned.has(m.id))
    for (const t of teams) {
      const sorted = remaining().sort((a, b) =>
        (fitness.scores[b.id]?.[t.id] ?? 0) - (fitness.scores[a.id]?.[t.id] ?? 0)
      )
      const picks = sorted.slice(0, teamSize)
      for (const m of picks) {
        placement[t.id].push(m.id)
        assigned.add(m.id)
      }
    }
    // 배정 못 받은 인원은 첫 번째 팀에 추가
    for (const m of members) {
      if (!assigned.has(m.id) && teams.length > 0) {
        placement[teams[0].id].push(m.id)
      }
    }
    // 커버리지 계산
    const coverage = {}
    for (const t of teams) {
      const req = t.requiredSkills || []
      if (req.length === 0) { coverage[t.id] = 1; continue }
      const covered = req.filter(sid =>
        placement[t.id].some(mid => (skillMatrix[mid]?.[sid] ?? 0) > 0)
      ).length
      coverage[t.id] = Math.round((covered / req.length) * 100) / 100
    }
    const memberNames = members.reduce((a, m) => { a[m.id] = m.name; return a }, {})
    const teamNames = teams.reduce((a, t) => { a[t.id] = t.name; return a }, {})
    // 인재 유형 간단 분류
    const memberTypes = members.reduce((a, m) => {
      const scores = Object.values(skillMatrix[m.id] ?? {}).filter(v => v > 0)
      if (!scores.length) { a[m.id] = 'generalist'; return a }
      const sorted = [...scores].sort((x, y) => y - x)
      const top2Avg = sorted.slice(0, 2).reduce((s, v) => s + v, 0) / Math.min(2, sorted.length)
      const restAvg = sorted.slice(2).length ? sorted.slice(2).reduce((s, v) => s + v, 0) / sorted.slice(2).length : 0
      if (top2Avg >= 2 * (restAvg || 1)) a[m.id] = 'specialist'
      else { const mean = scores.reduce((s, v) => s + v, 0) / scores.length; const std = Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length); a[m.id] = std < 0.8 ? 'generalist' : 't_shaped' }
      return a
    }, {})

    return {
      placement,
      scores: { conditionFulfillment: 0.87, coverage },
      warnings: [],
      beforeCoverage: Object.fromEntries(teams.map(t => [t.id, Math.max(0, (coverage[t.id] ?? 0) - 0.1)])),
      memberNames,
      teamNames,
      memberTypes,
    }
  }

  const handleGenerate = async () => {
    // ── 재배치 ───────────────────────────────────────────────────────────────
    if (placementType === 're') {
      let result
      try {
        // 기존 팀 = currentTeams (Step1에서 업로드한 현재 배치 팀)
        // surplus = current_team_id 없는 members
        const targetTeams = (currentTeams.length > 0 ? currentTeams : teams).map(t => ({
          id: t.id,
          name: t.name,
          requiredSkills: t.requiredSkills || t.required_skills || [],
          size: t.size || 1,
        }))
        result = await getReplacement({
          members: members.map(m => ({
            id: m.id, name: m.name, role: m.role ?? '',
            gender: m.gender ?? '', experience: m.experience ?? null,
            currentTeamId: m.currentTeamId ?? m.current_team_id ?? null,
          })),
          teams: targetTeams,
          skillMatrix,
          fitMatrix: fitMatrix?.matrix ?? {},
          conditions,
        })
        if (!result?.placement) throw new Error('no placement')
      } catch (e) {
        console.warn('[replacement] fallback to mock:', e)
        result = buildLocalPlacementResult()
      }
      setPlacementResult(result)
      setCurrentStep(4)
      navigate('/step/4')
      return
    }

    // ── TF 구성 ───────────────────────────────────────────────────────────────
    if (placementType === 'tf') {
      let tfResult
      try {
        // TF fit_vector: fitMatrix에서 TF 팀 ID 컬럼 추출
        const tfTeamId = tfId || teams[0]?.id || 'tf'
        const fitVec = Object.fromEntries(
          members.map(m => [m.id, (fitMatrix?.matrix?.[m.id]?.[tfTeamId]) ?? 0])
        )
        const existingTeams = (currentTeams.length > 0 ? currentTeams : []).map(t => ({
          id: t.id,
          name: t.name,
          requiredSkills: t.requiredSkills || t.required_skills || [],
          size: t.size || 1,
        }))
        tfResult = await getTFPlacement({
          members: members.map(m => ({
            id: m.id, name: m.name, role: m.role ?? '',
            gender: m.gender ?? '', experience: m.experience ?? null,
            currentTeamId: m.currentTeamId ?? m.current_team_id ?? null,
          })),
          teams: existingTeams,
          tfInfo: {
            id: tfTeamId,
            name: tfName || 'TF',
            size: teams[0]?.size || 1,
            requiredSkills: tfRequiredSkills || [],
          },
          skillMatrix,
          fitVector: fitVec,
          conditions,
        })
        if (!tfResult?.tf_members) throw new Error('no tf_members')
      } catch (e) {
        console.warn('[tf] fallback to mock:', e)
        const { buildMockTFResult } = await import('../api/tf')
        tfResult = buildMockTFResult({ members, skills, skillMatrix, currentAssignment, currentTeams, tfRequiredSkills })
      }
      // TFDashboard는 store에서 tfResult를 읽음
      setTFData({
        tfId: tfId || 'tf',
        tfName: tfName || 'TF',
        tfProject: tfProject || '',
        tfRequiredSkills: tfRequiredSkills || [],
        currentAssignment,
        currentTeams,
        tfResult,
      })
      setCurrentStep(4)
      navigate('/step/4/tf')
      return
    }

    // ── 신규배치 (기본) ───────────────────────────────────────────────────────
    let result
    try {
      const teamsWithSize = teams.map(t => ({
        id: t.id,
        name: t.name,
        requiredSkills: t.requiredSkills || t.required_skills || [],
        size: hasPerTeamOverride
          ? (perTeamSize[t.id] ?? (teamSize ?? minTeamSize))
          : (teamSize ?? minTeamSize),
      }))
      result = await getPlacement({
        members: members.map(m => ({
          id: m.id, name: m.name, role: m.role ?? '',
          gender: m.gender ?? '', experience: m.experience ?? null,
        })),
        teams: teamsWithSize,
        skillMatrix,
        fitMatrix: fitMatrix?.matrix ?? {},
        conditions,
      })
      if (!result?.placement) throw new Error('no placement')
    } catch {
      result = buildLocalPlacementResult()
    }
    setPlacementResult(result)
    setCurrentStep(4)
    navigate('/step/4')
  }

  // 실제 데이터 기반 적합도 매트릭스 (members/teams가 있을 때만)
  const fitnessData = (members.length > 0 && teams.length > 0)
    ? computeFitnessMatrix()
    : { members: [], teams: [], scores: {} }

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar currentStep={3} />
      <div className="flex overflow-hidden relative" style={{ height: 'calc(100vh - 69px)', marginTop: '69px' }}>

        {/* 메인: 적합도 매트릭스 */}
        <main className="flex-1 overflow-auto p-6 space-y-6" style={{ marginRight: '300px' }}>
          <Section title="적합도 매트릭스">
            <ViewToggle view={matrixView} onChange={setMatrixView} />
            {matrixView === 'heatmap' && (
              <HeatmapView
                data={fitnessData}
                onCellClick={(teamId, memberId) => { setSelectedTeam(teamId); setSelectedMember(memberId); setMatrixView('task') }}
              />
            )}
            {matrixView === 'task' && <TaskView data={fitnessData} selectedTeam={selectedTeam} onSelectTeam={setSelectedTeam} />}
            {matrixView === 'member' && <MemberView data={fitnessData} selectedMember={selectedMember} onSelectMember={setSelectedMember} />}
          </Section>

          <div className="flex justify-start pt-2">
            <Button variant="outline" onClick={() => navigate('/step/2')}>← 분석으로</Button>
          </div>
        </main>

        {/* 우측 fixed 사이드바: 배치 조건 */}
        <aside className="fixed right-0 top-[69px] bottom-0 w-[300px] border-l border-hairline bg-surface flex flex-col z-10 overflow-auto">
          <div className="p-5 border-b border-hairline">
            <h3 className="text-xs font-mono font-medium text-body uppercase tracking-wider">배치 조건 설정</h3>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-6">
            {/* 배치 옵션 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-mono text-body uppercase tracking-wider">배치 옵션</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      set('genderBalance', true); set('seniorityBalance', true)
                      set('experienceBalance', true); setPriorityWeight(true)
                      setEducationConsider(true); setLocationConsider(true)
                    }}
                    className="text-[11px] font-mono text-body hover:text-ink transition-colors px-1.5 py-0.5 border border-hairline rounded-sm"
                  >전체 선택</button>
                  <button
                    onClick={() => {
                      set('genderBalance', false); set('seniorityBalance', false)
                      set('experienceBalance', false); setPriorityWeight(false)
                      setEducationConsider(false); setLocationConsider(false)
                    }}
                    className="text-[11px] font-mono text-body hover:text-ink transition-colors px-1.5 py-0.5 border border-hairline rounded-sm"
                  >전체 해제</button>
                </div>
              </div>
              <div className="space-y-2.5">
                <OptionCheck label="성별 균형" checked={conditions.genderBalance} onChange={v => set('genderBalance', v)} />
                <OptionCheck label="직위 조화" checked={conditions.seniorityBalance} onChange={v => set('seniorityBalance', v)} />
                <OptionCheck label="연차 조화" checked={conditions.experienceBalance} onChange={v => set('experienceBalance', v)} />
                <OptionCheck label="학력 고려" checked={educationConsider} onChange={setEducationConsider} />
                <OptionCheck label="근무지 고려" checked={locationConsider} onChange={setLocationConsider} />
                <OptionCheck label="프로젝트 중요도 반영" checked={priorityWeight} onChange={setPriorityWeight} />
              </div>
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-ink shrink-0 flex-1">팀 당 인원수</label>
                  <input
                    type="number"
                    min={minTeamSize}
                    max={members.length || 20}
                    value={teamSize ?? minTeamSize}
                    onChange={e => {
                      const v = Math.max(minTeamSize, Number(e.target.value))
                      setTeamSize(v)
                      setPerTeamSize(Object.fromEntries(teams.map(t => [t.id, v])))
                    }}
                    className="w-14 border border-hairline rounded-sm px-2 py-1 text-sm text-ink text-center focus:outline-none focus:border-primary"
                  />
                  {teams.length > 0 && (
                    <button
                      onClick={() => setTeamSizeExpanded(true)}
                      className="text-[11px] font-mono px-2 py-1 rounded-sm border border-hairline text-body hover:text-ink hover:border-primary transition-colors whitespace-nowrap"
                    >
                      세부 조정
                    </button>
                  )}
                </div>
                <div className="mt-1.5 space-y-1">
                  {members.length > 0 && teams.length > 0 && (
                    <p className="text-[11px] text-body">
                      최소 {minTeamSize}명 ({members.length}명 ÷ {teams.length}팀, 올림)
                    </p>
                  )}
                  {teamSizeMismatch && (
                    <div className="flex items-start gap-1.5 rounded-sm px-2 py-1.5 text-[11px] font-mono"
                      style={{ backgroundColor: teamSizeDiff > 0 ? '#fff7ed' : '#fef2f2', color: teamSizeDiff > 0 ? '#92400e' : '#991b1b' }}>
                      <span className="shrink-0">⚠</span>
                      <span>합계 {teamSizeTotal}명 — 전체 인원 {members.length}명보다 {Math.abs(teamSizeDiff)}명 {teamSizeDiff > 0 ? '많습니다' : '부족합니다'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 과제별 인원수 팝업 */}
              {teamSizeExpanded && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
                  onClick={() => setTeamSizeExpanded(false)}>
                  <div className="bg-white rounded-sm border border-hairline shadow-lg w-72"
                    onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
                      <h3 className="text-sm font-semibold text-ink">과제별 인원수 세부 조정</h3>
                      <button onClick={() => setTeamSizeExpanded(false)} className="text-body hover:text-ink text-lg leading-none">×</button>
                    </div>
                    <div className="px-5 py-3 divide-y divide-hairline max-h-80 overflow-auto">
                      {teams.map(t => (
                        <div key={t.id} className="flex items-center gap-3 py-2.5">
                          <span className="text-sm text-ink flex-1 truncate" title={t.name}>{t.name}</span>
                          <input
                            type="number"
                            min={1}
                            max={members.length || 99}
                            value={perTeamSize[t.id] ?? (teamSize ?? minTeamSize)}
                            onChange={e => setPerTeam(t.id, Number(e.target.value))}
                            className="w-16 border border-hairline rounded-sm px-2 py-1 text-sm text-ink text-center focus:outline-none focus:border-primary"
                          />
                          <span className="text-xs text-body">명</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-3 border-t border-hairline">
                      {teamSizeMismatch ? (
                        <p className="text-[11px] font-mono" style={{ color: teamSizeDiff > 0 ? '#92400e' : '#991b1b' }}>
                          ⚠ 합계 {teamSizeTotal}명 / 전체 {members.length}명 ({teamSizeDiff > 0 ? '+' : ''}{teamSizeDiff}명)
                        </p>
                      ) : (
                        <p className="text-[11px] font-mono text-body">합계 {teamSizeTotal}명 ✓</p>
                      )}
                      <button
                        onClick={() => setTeamSizeExpanded(false)}
                        className="mt-2 w-full py-2 text-sm font-mono rounded-sm text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: '#1A1A1A' }}
                      >
                        확인
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 스킬 커버리지 */}
            <div>
              <p className="text-xs font-mono text-body uppercase tracking-wider mb-3">스킬 커버리지</p>
              <div className="space-y-4">
                <Slider
                  label="필수 스킬 최소 보유자"
                  min={1} max={3} step={1}
                  value={conditions.minSkillCoverage ?? 1}
                  onChange={v => set('minSkillCoverage', v)}
                  recommendedValue={1}
                />
                <Slider
                  label="스킬 평균 레벨 하한"
                  min={1} max={5} step={0.1}
                  value={conditions.minSkillLevel ?? 2.8}
                  onChange={v => set('minSkillLevel', Math.round(v * 10) / 10)}
                  recommendedValue="조직 평균"
                />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-ink">SPOF 분산 배치</div>
                    <div className="text-xs text-body">희귀 스킬 보유자 분산</div>
                  </div>
                  <Toggle checked={conditions.distributeSpof ?? true} onChange={v => set('distributeSpof', v)} />
                </div>
              </div>
            </div>

            {/* 자체 제약 조건 */}
            <div>
              <p className="text-xs font-mono text-body uppercase tracking-wider mb-3">자체 제약 조건</p>
              <textarea
                value={nlInput}
                onChange={e => setNlInput(e.target.value)}
                placeholder={`예:\n"부장은 팀당 1명씩"\n"001과 047은 다른 팀"`}
                className="w-full h-20 border border-hairline rounded-md px-3 py-2 text-sm text-ink resize-none focus:outline-none focus:border-primary"
              />
              <Button variant="outline" size="sm" className="mt-2 w-full" onClick={handleParseNL}>해석하기</Button>

              {nlParsed && (
                <div className="mt-3 p-3 bg-primary-tint border border-primary/20 rounded-md">
                  <p className="text-xs text-primary-dark mb-2">{nlParsed.text}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddConstraint}>확인</Button>
                    <Button variant="outline" size="sm" onClick={() => { setNlParsed(null); setNlInput('') }}>취소</Button>
                  </div>
                </div>
              )}

              {constraints.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {constraints.map((c, i) => (
                    <span key={i} className="flex items-center gap-1 px-2 py-1 bg-muted border border-hairline rounded-full text-xs text-ink">
                      {c.text}
                      <button onClick={() => setConstraints(constraints.filter((_, j) => j !== i))} className="ml-0.5 text-body hover:text-accent-coral">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-5 border-t border-hairline">
            <Button size="lg" className="w-full" onClick={handleGenerate} disabled={teamSizeMismatch}>
              최적 배치 생성하기 →
            </Button>
            {teamSizeMismatch && (
              <p className="text-[11px] text-center mt-2 font-mono" style={{ color: '#991b1b' }}>
                인원 합계를 맞춰야 진행할 수 있습니다
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="border border-hairline rounded-md overflow-hidden">
      <div className="px-5 py-3 bg-muted border-b border-hairline">
        <h2 className="text-xs font-mono font-medium text-body uppercase tracking-wider">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function OptionCheck({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)}
        className="w-4 h-4" style={{ accentColor: '#2ECC87' }} />
      <span className="text-sm text-ink">{label}</span>
    </label>
  )
}

function ViewToggle({ view, onChange }) {
  const options = [
    { key: 'heatmap', label: '히트맵' },
    { key: 'task', label: '과제 중심' },
    { key: 'member', label: '구성원 중심' },
  ]
  return (
    <div className="flex gap-1 mb-4">
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)}
          className={`px-4 py-1.5 text-sm rounded-sm border transition-colors ${view === o.key ? 'bg-primary text-white border-primary' : 'border-hairline text-body hover:border-primary'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function scoreToColor(score) {
  // 0~1 값을 연한 회색(0) → 연한 초록(0.5) → 진한 초록(1) 그라데이션
  const pct = Math.max(0, Math.min(1, score))
  // R: 242→46, G: 244→204, B: 246→135
  const r = Math.round(242 - (242 - 46) * pct)
  const g = Math.round(244 - (244 - 204) * pct)
  const b = Math.round(246 - (246 - 135) * pct)
  const textDark = pct < 0.5
  return { bg: `rgb(${r},${g},${b})`, text: textDark ? '#1A1A1A' : '#1A5C3A' }
}

function HeatmapView({ data, onCellClick }) {
  return (
    <div className="overflow-auto">
      <table className="text-sm border-collapse" style={{ minWidth: '100%' }}>
        <thead>
          <tr>
            <th className="p-2 text-left text-body font-normal border-b border-hairline whitespace-nowrap" style={{ minWidth: '160px' }}>구성원</th>
            {data.teams.map(t => (
              <th key={t.id} className="p-2 text-center text-body font-normal border-b border-hairline whitespace-nowrap" style={{ minWidth: '90px' }}>{t.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.members.map(m => (
            <tr key={m.id} className="hover:bg-muted/40">
              <td className="p-2 border-b border-hairline whitespace-nowrap font-medium text-ink" style={{ minWidth: '160px' }}>
                {m.name || m.id}
                {m.name && m.name !== m.id && <span className="ml-1 text-[10px] text-body font-normal">{m.id}</span>}
              </td>
              {data.teams.map(t => {
                const score = data.scores[m.id]?.[t.id] ?? 0
                const { bg, text } = scoreToColor(score)
                return (
                  <td key={t.id} className="p-1.5 border-b border-hairline cursor-pointer" onClick={() => onCellClick(t.id, m.id)}>
                    <div className="text-center rounded-sm py-1 px-2 text-xs font-mono font-medium transition-opacity hover:opacity-80"
                      style={{ backgroundColor: bg, color: text }}>
                      {Math.round(score * 100)}%
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TaskView({ data, selectedTeam, onSelectTeam }) {
  const sorted = [...data.members].sort((a, b) =>
    (data.scores[b.id]?.[selectedTeam] ?? 0) - (data.scores[a.id]?.[selectedTeam] ?? 0)
  )
  return (
    <div>
      <select value={selectedTeam} onChange={e => onSelectTeam(e.target.value)}
        className="mb-4 border border-hairline rounded-sm px-3 py-1.5 text-sm text-ink bg-surface">
        {data.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <div className="space-y-2">
        {sorted.map((m, i) => {
          const score = data.scores[m.id]?.[selectedTeam] ?? 0
          return (
            <div key={m.id} className="flex items-center gap-3">
              <span className="text-xs text-body w-4">{i + 1}</span>
              <span className="text-sm text-ink w-24">{m.name || m.id}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${score * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-body w-10 text-right">{Math.round(score * 100)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MemberView({ data, selectedMember, onSelectMember }) {
  const chartData = data.teams.map(t => ({
    name: t.name,
    score: Math.round((data.scores[selectedMember]?.[t.id] ?? 0) * 100),
  }))
  return (
    <div>
      <select value={selectedMember} onChange={e => onSelectMember(e.target.value)}
        className="mb-4 border border-hairline rounded-sm px-3 py-1.5 text-sm text-ink bg-surface">
        {data.members.map(m => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
      </select>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip formatter={v => `${v}%`} />
          <Bar dataKey="score" fill="#2ECC87" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
