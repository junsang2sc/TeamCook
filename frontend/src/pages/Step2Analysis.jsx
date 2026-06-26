import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import WhiskLoader from '../components/ui/WhiskLoader'
import useStore from '../store/useStore'
import { mockAnalysis } from '../api/mock'

const LOADING_STEPS_NEW = [
  '스킬 희귀도 계산 중...',
  '인재 유형 분류 중...',
  '수요-공급 분석 중...',
  '분석 완료!',
]
const LOADING_STEPS_RE = [
  '현재 배치 현황 분석 중...',
  '차출 가능 여부 검토 중...',
  '기존 팀 리스크 계산 중...',
  '재배치 분석 완료!',
]

export default function Step2Analysis() {
  const navigate = useNavigate()
  const { placementType, analysisResult, setAnalysisResult, setCurrentStep, members: storeMembers, skills: storeSkills } = useStore()
  const isRe = placementType === 're'

  const [loading, setLoading] = useState(true)
  const [loadStep, setLoadStep] = useState(0)
  const [useRarity, setUseRarity] = useState(true)
  const [useDifficulty, setUseDifficulty] = useState(true)

  const TABS_BASE = ['인재유형', '스킬희귀도', '수요-공급', 'SPOF·병목']
  const TABS_RE = ['기존팀현황', '매칭기회맵']
  const tabs = isRe ? [...TABS_BASE, ...TABS_RE] : TABS_BASE
  const [activeTab, setActiveTab] = useState(tabs[0])

  const data = analysisResult || mockAnalysis

  const LOADING_STEPS = isRe ? LOADING_STEPS_RE : LOADING_STEPS_NEW

  useEffect(() => {
    let i = 0
    const iv = setInterval(() => {
      setLoadStep(i)
      i++
      if (i >= LOADING_STEPS.length) {
        clearInterval(iv)
        setTimeout(() => {
          setLoading(false)
          if (!analysisResult) setAnalysisResult(mockAnalysis)
        }, 400)
      }
    }, 500)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar currentStep={2} />
      {loading ? (
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 69px)', marginTop: '69px' }}>
          <LoadingView loadStep={loadStep} steps={LOADING_STEPS} />
        </div>
      ) : (
        <div className="flex overflow-hidden relative" style={{ height: 'calc(100vh - 69px)', marginTop: '69px' }}>
          {/* 메인 콘텐츠 — 우측 사이드바 너비만큼 오른쪽 여백 */}
          <main className="flex-1 overflow-auto" style={{ marginRight: '280px' }}>
            <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
            <div className="p-6">
              {activeTab === '인재유형' && <MemberTypeTab data={data} members={storeMembers} />}
              {activeTab === '스킬희귀도' && <SkillRarityTab data={data} skills={storeSkills} />}
              {activeTab === '수요-공급' && <SupplyDemandTab data={data} skills={storeSkills} />}
              {activeTab === 'SPOF·병목' && <SpofTab data={data} skills={storeSkills} />}
              {activeTab === '기존팀현황' && <ExistingTeamTab data={data} />}
              {activeTab === '매칭기회맵' && <MatchingMapTab data={data} />}
            </div>
          </main>
          {/* 우측 fixed 사이드바 */}
          <OptionsPanel
            useRarity={useRarity} setUseRarity={setUseRarity}
            useDifficulty={useDifficulty} setUseDifficulty={setUseDifficulty}
            onNext={() => { setCurrentStep(3); navigate('/step/3') }}
            onBack={() => navigate('/step/1')}
          />
        </div>
      )}
    </div>
  )
}

function LoadingView({ loadStep, steps }) {
  return (
    <div className="flex flex-col items-center gap-8">
      <WhiskLoader fps={12} size={160} />
      <div className="text-center space-y-1.5">
        {steps.map((s, i) => (
          <p key={s} className={`text-sm transition-all ${i < loadStep ? 'text-primary font-medium' : i === loadStep ? 'text-ink font-medium' : 'text-muted-dark'}`}>
            {i < loadStep ? '✓ ' : i === loadStep ? '› ' : '  '}{s}
          </p>
        ))}
      </div>
    </div>
  )
}

function OptionsPanel({ useRarity, setUseRarity, useDifficulty, setUseDifficulty, onNext, onBack }) {
  return (
    <aside className="fixed right-0 top-[69px] bottom-0 w-[280px] border-l border-hairline bg-surface flex flex-col z-10">
      <div className="p-5 border-b border-hairline">
        <h3 className="text-xs font-mono font-medium text-body uppercase tracking-wider mb-4">분석 옵션</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useRarity} onChange={e => setUseRarity(e.target.checked)}
              className="w-4 h-4" style={{ accentColor: '#2ECC87' }} />
            <span className="text-sm text-ink">스킬 희귀도 반영</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useDifficulty} onChange={e => setUseDifficulty(e.target.checked)}
              className="w-4 h-4" style={{ accentColor: '#2ECC87' }} />
            <span className="text-sm text-ink">팀 난이도 반영</span>
          </label>
        </div>
      </div>
      <div className="mt-auto p-5 space-y-2">
        <Button size="lg" className="w-full" onClick={onNext}>배치 조건 설정 →</Button>
        <Button variant="outline" size="sm" className="w-full" onClick={onBack}>← 데이터 수정</Button>
      </div>
    </aside>
  )
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex border-b border-hairline bg-surface px-4">
      {tabs.map(tab => (
        <button key={tab} onClick={() => onChange(tab)}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${active === tab ? 'border-primary text-primary' : 'border-transparent text-body hover:text-ink'}`}>
          {tab}
        </button>
      ))}
    </div>
  )
}

const TYPE_VARIANT = { specialist: 'rare', t_shaped: 'normal', generalist: 'common' }
const TYPE_LABEL = { specialist: '전문가형', t_shaped: 'T자형', generalist: '제너럴리스트형' }

function classifyMemberType(memberId, skillMatrix) {
  const scores = Object.values(skillMatrix?.[memberId] ?? {}).filter(v => v > 0)
  if (scores.length === 0) return 'generalist'
  const sorted = [...scores].sort((a, b) => b - a)
  const top2Avg = sorted.slice(0, 2).reduce((a, b) => a + b, 0) / Math.min(2, sorted.length)
  const restAvg = sorted.slice(2).length > 0
    ? sorted.slice(2).reduce((a, b) => a + b, 0) / sorted.slice(2).length
    : 0
  if (top2Avg >= 2 * (restAvg || 1)) return 'specialist'
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const std = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length)
  if (std < 0.8) return 'generalist'
  return 't_shaped'
}

function MemberTypeTab({ data, members }) {
  const { skillMatrix } = useStore()

  // 실제 구성원 데이터 기반으로 인재 유형 분류
  const memberTypeMap = data.memberTypeMap || {}
  const enrichedMembers = (members || []).map(m => ({
    ...m,
    type: memberTypeMap[m.id] || classifyMemberType(m.id, skillMatrix),
  }))

  const counts = enrichedMembers.reduce((acc, m) => {
    acc[m.type] = (acc[m.type] || 0) + 1
    return acc
  }, {})

  const pieData = [
    { name: '전문가형', value: counts.specialist ?? 0, color: '#FFABB5' },
    { name: 'T자형', value: counts.t_shaped ?? 0, color: '#FFE586' },
    { name: '제너럴리스트형', value: counts.generalist ?? 0, color: '#2ECC87' },
  ]

  const [search, setSearch] = useState('')
  const filtered = enrichedMembers.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.id.includes(search)
  )

  return (
    <div>
      <div className="flex items-center gap-8 mb-6">
        <PieChart width={200} height={200}>
          <Pie data={pieData} cx={100} cy={100} innerRadius={60} outerRadius={90} dataKey="value">
            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v}명`, n]} />
        </PieChart>
        <div className="space-y-2">
          {pieData.map(d => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
              <span className="text-sm text-ink">{d.name}</span>
              <span className="text-sm font-mono font-medium text-ink">{d.value}명</span>
            </div>
          ))}
          <div className="text-xs text-body pt-1">총 {enrichedMembers.length}명</div>
        </div>
      </div>
      <input
        placeholder="이름 또는 사번 검색"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-4 w-full max-w-xs border border-hairline rounded-sm px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-primary"
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {filtered.map(m => (
          <div key={m.id} className="border border-hairline rounded-md p-3">
            <div className="text-sm font-medium text-ink mb-0.5">{m.name}</div>
            <div className="text-xs text-body mb-1">{m.id}</div>
            <Badge variant={TYPE_VARIANT[m.type]}>{TYPE_LABEL[m.type]}</Badge>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-sm text-body">검색 결과가 없습니다.</p>}
    </div>
  )
}

const RARITY_LABELS = { rare: '희귀', normal: '보통', common: '보편' }

function SkillRarityTab({ data, skills }) {
  const { skillMatrix, members: storeMembers } = useStore()
  const [filter, setFilter] = useState('all')

  // 실제 파싱 데이터가 있으면 항상 실제 skillMatrix 기반으로 계산
  const rarityMap = (() => {
    const totalMembers = storeMembers.length || 1
    const allSkillIds = (skills || []).map(s => s.id)
    // 실제 스킬 데이터가 있으면 직접 계산
    if (allSkillIds.length > 0 && Object.keys(skillMatrix || {}).length > 0) {
      const result = {}
      for (const sid of allSkillIds) {
        const holderCount = Object.values(skillMatrix).filter(m => (m[sid] ?? 0) > 0).length
        const ratio = holderCount / totalMembers
        result[sid] = {
          holderCount,
          level: ratio <= 0.1 ? 'rare' : ratio >= 0.5 ? 'common' : 'normal',
        }
      }
      return result
    }
    // fallback: analysisResult의 skillRarityMap
    if (data.skillRarityMap && Object.keys(data.skillRarityMap).length > 0) return data.skillRarityMap
    const result = {}
    for (const sid of allSkillIds) {
      const holderCount = Object.values(skillMatrix || {}).filter(m => (m[sid] ?? 0) > 0).length
      const ratio = holderCount / totalMembers
      result[sid] = {
        holderCount,
        level: ratio <= 0.1 ? 'rare' : ratio >= 0.5 ? 'common' : 'normal',
      }
    }
    return result
  })()

  // 스킬명 조회
  const skillNameMap = (skills || []).reduce((acc, s) => { acc[s.id] = s.name; return acc }, {})

  const entries = Object.entries(rarityMap)
  const filtered = filter === 'all' ? entries : entries.filter(([, v]) => v.level === filter)

  const cardBg = {
    rare: 'border-accent-coral/30 bg-accent-coral-tint',
    normal: 'border-accent-yellow/60 bg-accent-yellow-tint',
    common: 'border-primary/30 bg-primary-tint',
  }
  const badgeVariant = { rare: 'rare', normal: 'normal', common: 'common' }

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {['all', 'rare', 'normal', 'common'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${filter === f ? 'bg-primary text-white border-primary' : 'border-hairline text-body hover:border-primary'}`}>
            {f === 'all' ? '전체' : RARITY_LABELS[f]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {filtered.map(([sid, info]) => (
          <div key={sid} className={`flex items-center justify-between p-3 border rounded-sm ${cardBg[info.level]}`}>
            <div>
              <div className="text-sm font-medium text-ink">{skillNameMap[sid] || sid}</div>
              <div className="text-xs text-body">{sid} · {info.holderCount}명 보유</div>
            </div>
            <Badge variant={badgeVariant[info.level]}>{RARITY_LABELS[info.level]}</Badge>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-2 rounded-full overflow-hidden gap-0.5">
        <div className="bg-accent-coral" style={{ width: `${(entries.filter(([,v])=>v.level==='rare').length/Math.max(entries.length,1))*100}%` }} />
        <div className="bg-accent-yellow" style={{ width: `${(entries.filter(([,v])=>v.level==='normal').length/Math.max(entries.length,1))*100}%` }} />
        <div className="bg-primary" style={{ width: `${(entries.filter(([,v])=>v.level==='common').length/Math.max(entries.length,1))*100}%` }} />
      </div>
    </div>
  )
}

function SupplyDemandTab({ data, skills }) {
  const { skillMatrix, members: storeMembers, teams: storeTeams } = useStore()
  const skillNameMap = (skills || []).reduce((acc, s) => { acc[s.id] = s.name; return acc }, {})

  // 실제 데이터로 수요-공급 계산
  const sd = (() => {
    const allSkillIds = (skills || []).map(s => s.id)
    if (allSkillIds.length > 0 && storeMembers.length > 0) {
      const result = {}
      for (const sid of allSkillIds) {
        const supply = Object.values(skillMatrix || {}).filter(m => (m[sid] ?? 0) > 0).length
        // 수요: 해당 스킬을 필수로 요구하는 팀 수
        const demand = (storeTeams || []).filter(t => (t.requiredSkills || []).includes(sid)).length
        result[sid] = { supply, demand, gap: Math.max(0, demand - supply) }
      }
      return result
    }
    return data.supplyDemand || {}
  })()

  const entries = Object.entries(sd)
  const maxVal = Math.max(...entries.map(([, v]) => Math.max(v.demand, v.supply)), 1)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-5 mb-2">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary" /><span className="text-xs text-body">공급 (보유 인원)</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-accent-coral" /><span className="text-xs text-body">수요 (팀 필요 인원)</span></div>
      </div>
      {entries.map(([sid, info]) => {
        const isShort = info.gap > 0
        const supplyPct = (info.supply / maxVal) * 100
        const demandPct = (info.demand / maxVal) * 100
        return (
          <div key={sid}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-ink">{skillNameMap[sid] || sid}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-body">공급 {info.supply}명 / 수요 {info.demand}명</span>
                {isShort
                  ? <span className="text-xs font-mono font-medium text-white bg-accent-coral px-2 py-0.5 rounded-sm">-{info.gap} 부족</span>
                  : <span className="text-xs font-mono text-primary-dark bg-primary-tint px-2 py-0.5 rounded-sm">+{Math.abs(info.gap ?? 0)} 여유</span>
                }
              </div>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-body font-mono w-6 text-right shrink-0">공급</span>
              <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                <div className="h-full bg-primary rounded-sm" style={{ width: `${supplyPct}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-body font-mono w-6 text-right shrink-0">수요</span>
              <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                <div className={`h-full rounded-sm ${isShort ? 'bg-accent-coral' : 'bg-accent-yellow'}`} style={{ width: `${demandPct}%` }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SpofTab({ data, skills }) {
  const { skillMatrix, members: storeMembers } = useStore()
  const skillNameMap = (skills || []).reduce((acc, s) => { acc[s.id] = s.name; return acc }, {})
  const totalMembers = storeMembers.length || 1

  // 실제 데이터로 SPOF 계산: 보유자가 1명뿐인 스킬
  const spofList = (() => {
    const allSkillIds = (skills || []).map(s => s.id)
    if (allSkillIds.length > 0 && Object.keys(skillMatrix || {}).length > 0) {
      return allSkillIds
        .map(sid => ({
          sid,
          holderCount: Object.values(skillMatrix).filter(m => (m[sid] ?? 0) > 0).length,
        }))
        .filter(({ holderCount }) => holderCount === 1)
    }
    return (data.spofSkills || []).map(sid => ({ sid, holderCount: 1 }))
  })()

  return (
    <div>
      {spofList.length === 0 ? (
        <p className="text-sm text-body">SPOF 스킬이 없습니다. 모든 스킬이 2명 이상에게 분산되어 있습니다. ✓</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-accent-coral font-medium mb-3">보유자 1명뿐인 스킬 {spofList.length}개 — 팀 배치 시 주의 필요</p>
          {spofList.map(({ sid, holderCount }) => (
            <div key={sid} className="p-4 bg-accent-coral-tint border border-accent-coral/30 rounded-md flex items-center gap-3">
              <span className="text-accent-coral text-lg">⚠</span>
              <div>
                <div className="text-sm font-medium text-ink">{skillNameMap[sid] || sid}</div>
                <div className="text-xs text-body">{sid} · 보유자 {holderCount}명</div>
              </div>
              <Badge variant="rare" className="ml-auto">SPOF</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExistingTeamTab({ data }) {
  const teams = data.existingTeamStatus || {}
  const riskBg = { safe: 'bg-primary', warning: 'bg-accent-yellow', danger: 'bg-accent-coral' }
  const riskLabel = { safe: '안전', warning: '주의', danger: '위험' }
  const riskBadge = { safe: 'common', warning: 'normal', danger: 'rare' }
  return (
    <div className="space-y-4">
      {Object.entries(teams).map(([teamId, info]) => (
        <div key={teamId} className="border border-hairline rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium text-ink">{info.name || teamId}</div>
            <Badge variant={riskBadge[info.riskLevel]}>{riskLabel[info.riskLevel]}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-body">커버리지</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${riskBg[info.riskLevel]}`} style={{ width: `${info.coverage * 100}%` }} />
            </div>
            <span className="text-xs font-mono text-body">{Math.round(info.coverage * 100)}%</span>
          </div>
          {info.riskLevel === 'danger' && (
            <p className="text-xs text-accent-coral mt-2">⚠ 이 팀은 인원 차출 시 리스크가 높습니다</p>
          )}
        </div>
      ))}
    </div>
  )
}

function MatchingMapTab({ data }) {
  const opp = data.matchingOpportunities || {}
  return (
    <div>
      <p className="text-sm font-medium text-ink mb-4">
        {opp.matchCount ?? 0}명이 {opp.teamCount ?? 0}개 팀의 스킬 부족을 채울 수 있습니다
      </p>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="text-xs font-mono text-body uppercase tracking-wider mb-3">잉여 스킬</h4>
          <div className="space-y-1">
            {(opp.surplusSkills || []).map(sid => (
              <div key={sid} className="px-3 py-2 bg-primary-tint border border-primary/20 rounded-sm text-sm text-primary-dark">{sid}</div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-mono text-body uppercase tracking-wider mb-3">팀별 부족 스킬</h4>
          <div className="space-y-2">
            {Object.entries(opp.teamGapSkills || {}).map(([teamId, skills]) => (
              <div key={teamId} className="p-3 border border-hairline rounded-md">
                <div className="text-xs font-medium text-body mb-1">{teamId}</div>
                <div className="flex flex-wrap gap-1">
                  {skills.map(sid => <Badge key={sid} variant="rare">{sid}</Badge>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
