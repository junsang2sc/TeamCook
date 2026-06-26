import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import useStore from '../store/useStore'
import { mockPlacementResult } from '../api/mock'
import { saveToArchive } from '../utils/archive'

export default function Step4Dashboard() {
  const navigate = useNavigate()
  const store = useStore()
  const { placementResult, placementType, setCurrentStep, skillMatrix, skills, teams, members, conditions, analysisResult, placementMode } = store
  const isRe = placementType === 're'
  const data = placementResult || mockPlacementResult

  // 4단계 최초 진입 시 아카이브 자동 저장 (중복 방지)
  const savedRef = useRef(false)
  useEffect(() => {
    if (savedRef.current || !data) return
    savedRef.current = true
    const placement = data.placement ?? {}
    const teamCount = Object.keys(placement).length
    const memberCount = Object.values(placement).flat().length
    const coverage = data.scores?.coverage
      ? Object.values(data.scores.coverage).reduce((a, b) => a + b, 0) / Math.max(teamCount, 1)
      : 0
    saveToArchive({
      type: placementType ?? 'new',
      summary: {
        memberCount,
        teamCount,
        conditionFulfillment: data.scores?.condition_fulfillment ?? 0,
        coverage,
      },
      snapshot: {
        placementType,
        skills,
        members,
        skillMatrix,
        teams,
        placementMode,
        analysisResult,
        conditions,
        placementResult: data,
      },
    })
  }, [data])

  const [nlInput, setNlInput] = useState('')
  const [nlParsed, setNlParsed] = useState(null)
  const [history, setHistory] = useState([])
  const [impactOpen, setImpactOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null) // {mid, teamId}


  const handleParseNL = () => {
    if (!nlInput.trim()) return
    setNlParsed(`"${nlInput}" — 해석 완료: 조건을 분석하여 재배치를 실행합니다.`)
  }

  const handleApply = () => {
    setHistory([...history, nlInput])
    setNlParsed(null)
    setNlInput('')
  }

  const exportCSV = () => {
    const rows = [['팀', '구성원ID', '이름']]
    Object.entries(data.placement || {}).forEach(([teamId, members]) => {
      members.forEach(mid => {
        rows.push([data.teamNames?.[teamId] || teamId, mid, data.memberNames?.[mid] || mid])
      })
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'placement.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const totalFulfillment = Math.round((data.scores?.conditionFulfillment ?? 0) * 100)

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar currentStep={4} />
      {/* SummaryBar — Navbar 바로 아래 fixed */}
      <div className="fixed left-0 right-0 z-20" style={{ top: '69px' }}>
        <SummaryBar data={data} isRe={isRe} fulfillment={totalFulfillment} />
      </div>

      {/* 메인 + 우측 fixed 사이드바 */}
      <div className="relative" style={{ marginRight: '320px', marginTop: 'calc(69px + 64px)' }}>
        <main className="overflow-auto p-6 space-y-4" style={{ height: 'calc(100vh - 69px - 64px)' }}>
          {/* 팀 카드 그리드 */}
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
            {Object.entries(data.placement || {}).map(([teamId, memberIds]) => (
              <TeamCard
                key={teamId}
                teamId={teamId}
                memberIds={memberIds}
                data={data}
                isRe={isRe}
                skillMatrix={skillMatrix}
                skills={skills}
                teams={teams}
                onSelectMember={(mid) => setSelectedMember({ mid, teamId })}
              />
            ))}
          </div>

          {/* 배치 전후 영향도 */}
          <div className="border border-hairline rounded-md overflow-hidden">
            <button
              className="w-full px-5 py-3 bg-muted flex items-center justify-between text-sm font-medium text-ink"
              onClick={() => setImpactOpen(!impactOpen)}
            >
              <span>배치 전후 영향도</span>
              <span>{impactOpen ? '▲' : '▼'}</span>
            </button>
            {impactOpen && <ImpactChart data={data} />}
          </div>
        </main>
      </div>

      {/* 우측 fixed 사이드바 */}
      <aside className="fixed right-0 bottom-0 w-[320px] border-l border-hairline bg-surface flex flex-col z-10 overflow-auto" style={{ top: 'calc(69px + 64px)' }}>
        <div className="p-5 border-b border-hairline">
          <h3 className="text-sm font-semibold text-ink mb-4">배치 조정 요청</h3>
          <textarea
            value={nlInput}
            onChange={e => setNlInput(e.target.value)}
            placeholder={`예시:\n"000이랑 ***은 같은 팀이면 안돼"\n"P003을 000이 꼭 해야해"`}
            className="w-full h-24 border border-hairline rounded-md px-3 py-2 text-sm text-ink resize-none focus:outline-none focus:border-primary mb-2"
          />
          <Button size="sm" className="w-full" onClick={handleParseNL}>요청 보내기</Button>

          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" className="flex-1"
              onClick={() => { setCurrentStep(5); navigate('/step/5') }}>
              수동 조정하기
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={exportCSV}>
              CSV 내보내기
            </Button>
          </div>

          {nlParsed && (
            <div className="mt-3 p-3 bg-primary-tint border border-primary/20 rounded-md">
              <p className="text-xs text-primary-dark mb-3">{nlParsed}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleApply}>적용</Button>
                <Button variant="outline" size="sm" onClick={() => setNlParsed(null)}>취소</Button>
              </div>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="p-5 border-b border-hairline">
            <h4 className="text-xs font-mono text-body uppercase tracking-wider mb-3">조정 이력</h4>
            <div className="space-y-1">
              {history.map((h, i) => <p key={i} className="text-xs text-body">· {h}</p>)}
            </div>
          </div>
        )}

      </aside>

      {/* 구성원 세부정보 팝업 */}
      {selectedMember && (
        <MemberDetailPopup
          memberId={selectedMember.mid}
          teamId={selectedMember.teamId}
          data={data}
          skillMatrix={skillMatrix}
          skills={skills}
          teams={teams}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  )
}

function SummaryBar({ data, isRe, fulfillment }) {
  const coverages = Object.values(data.scores?.coverage || {})
  const avgCoverage = coverages.length
    ? Math.round(coverages.reduce((a, b) => a + b, 0) / coverages.length * 100)
    : 0
  const totalMembers = Object.values(data.placement || {}).flat().length

  return (
    <div className="bg-surface border-b border-hairline px-8 flex items-center gap-8" style={{ height: '64px' }}>
      <div>
        <div className="text-xs text-body mb-0.5">조건 충족률</div>
        <div className="text-2xl font-bold text-primary">{fulfillment}%</div>
      </div>
      <div className="flex-1">
        <div className="text-xs text-body mb-1">평균 스킬 커버리지</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${avgCoverage}%` }} />
          </div>
          <span className="text-xs font-mono text-body">{avgCoverage}%</span>
        </div>
      </div>
      {(data.warnings || []).length > 0 && (
        <Badge variant="rare">⚠ 미충족 {data.warnings.length}건</Badge>
      )}
      <div className="text-xs text-body">{totalMembers}명 배치</div>
    </div>
  )
}

// 구성원의 상위 스킬 N개 추출
function getTopSkills(memberId, skillMatrix, skills, n = 3) {
  const memberScores = skillMatrix?.[memberId] ?? {}
  const skillNameMap = (skills || []).reduce((acc, s) => { acc[s.id] = s.name; return acc }, {})
  return Object.entries(memberScores)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([sid, level]) => ({ id: sid, name: skillNameMap[sid] || sid, level }))
}

function TeamCard({ teamId, memberIds, data, isRe, skillMatrix, skills, teams, onSelectMember }) {
  const [open, setOpen] = useState(true)
  const [reasonOpen, setReasonOpen] = useState(false)
  const teamName = data.teamNames?.[teamId] || teamId
  const coverage = Math.round((data.scores?.coverage?.[teamId] ?? 0) * 100)
  const hasWarning = (data.warnings || []).some(w => w.teamId === teamId)

  // 팀 필수 스킬 목록
  const teamInfo = (teams || []).find(t => t.id === teamId)
  const requiredSkills = teamInfo?.requiredSkills || []
  const skillNameMap = (skills || []).reduce((acc, s) => { acc[s.id] = s.name; return acc }, {})

  // 충족/미충족 스킬 분류
  const coveredSkills = requiredSkills.filter(sid =>
    memberIds.some(mid => (skillMatrix?.[mid]?.[sid] ?? 0) > 0)
  )
  const missingSkills = requiredSkills.filter(sid =>
    !memberIds.some(mid => (skillMatrix?.[mid]?.[sid] ?? 0) > 0)
  )

  return (
    <div className="border border-hairline rounded-md bg-surface overflow-hidden">
      {/* 카드 헤더 — 항상 표시 */}
      <button
        className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-muted/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="min-w-0">
          <div className="text-xs font-semibold text-ink truncate">{teamName}</div>
          <div className="text-[10px] text-body">{memberIds.length}명 · {coverage}%{hasWarning ? ' ⚠' : ''}</div>
        </div>
        <span className="text-[10px] text-body ml-1 shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {/* 접히는 바디 */}
      {open && (
        <div className="px-2 pb-2 border-t border-hairline">

          {/* 커버리지 바 */}
          <div className="mt-2 mb-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${coverage}%` }} />
            </div>
          </div>

          {/* 배치 근거 토글 */}
          {requiredSkills.length > 0 && (
            <div className="border border-hairline rounded-sm overflow-hidden mb-2">
              <button
                className="w-full flex items-center justify-between px-2 py-1 bg-muted/50 text-[10px] text-body hover:bg-muted transition-colors"
                onClick={() => setReasonOpen(o => !o)}
              >
                <span className="font-mono uppercase tracking-wider">배치 근거</span>
                <span>{reasonOpen ? '▲' : '▼'}</span>
              </button>
              {reasonOpen && (
                <div className="px-2 py-2 space-y-2">
                  {coveredSkills.length > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {coveredSkills.map(sid => {
                        const best = memberIds.reduce((best, mid) => {
                          const lv = skillMatrix?.[mid]?.[sid] ?? 0
                          return lv > best.lv ? { mid, lv } : best
                        }, { mid: null, lv: 0 })
                        return (
                          <span key={sid} className="flex items-center gap-0.5 px-1 py-0.5 bg-primary-tint border border-primary/20 rounded-sm text-[9px] text-primary-dark">
                            ✓ {skillNameMap[sid] || sid}
                            {best.lv > 0 && <span className="font-medium">Lv{best.lv}</span>}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {missingSkills.length > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {missingSkills.map(sid => (
                        <span key={sid} className="px-1 py-0.5 bg-accent-coral-tint border border-accent-coral/20 rounded-sm text-[9px] text-accent-coral-dark">
                          ✗ {skillNameMap[sid] || sid}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] text-body border-t border-hairline pt-1">
                    {coveredSkills.length === requiredSkills.length
                      ? `필수 스킬 ${requiredSkills.length}개 모두 충족`
                      : `${requiredSkills.length}개 중 ${coveredSkills.length}개 충족`
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 구성원 목록 */}
          <div className="space-y-1">
            {[...memberIds].sort((a, b) => (data.memberNames?.[a] || a).localeCompare(data.memberNames?.[b] || b, 'ko')).map(mid => {
              const name = data.memberNames?.[mid] || mid
              const topSkills = getTopSkills(mid, skillMatrix, skills, 2)
              return (
                <button
                  key={mid}
                  className="w-full flex items-start gap-1.5 px-1.5 py-1 rounded-sm hover:bg-muted/50 transition-colors text-left"
                  onClick={() => onSelectMember(mid)}
                >
                  <div className="w-5 h-5 rounded-full bg-primary-tint flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-primary-dark">{name[0] || '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-ink leading-tight">{name}</div>
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {topSkills.map(s => (
                        <span key={s.id} className="px-1 py-0.5 bg-muted text-body text-[9px] rounded-sm border border-hairline leading-tight">
                          {s.name} <span className="text-primary-dark font-medium">Lv{s.level}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function MemberDetailPopup({ memberId, teamId, data, skillMatrix, skills, teams, onClose }) {
  const name = data.memberNames?.[memberId] || memberId
  const allSkills = getTopSkills(memberId, skillMatrix, skills, 999)
  const skillNameMap = (skills || []).reduce((acc, s) => { acc[s.id] = s.name; return acc }, {})

  // 소속 팀 필수 스킬
  const teamInfo = (teams || []).find(t => t.id === teamId)
  const requiredSkills = teamInfo?.requiredSkills || []

  // 본인이 커버하는 팀 필수 스킬
  const memberCovers = requiredSkills.filter(sid => (skillMatrix?.[memberId]?.[sid] ?? 0) > 0)
  const memberMisses = requiredSkills.filter(sid => (skillMatrix?.[memberId]?.[sid] ?? 0) === 0)

  // 팀 내 기여도: 본인이 보유하고 팀 내 유일하게 커버하는 스킬
  const teamMemberIds = data.placement?.[teamId] || []
  const uniqueContributions = requiredSkills.filter(sid => {
    const myLevel = skillMatrix?.[memberId]?.[sid] ?? 0
    if (myLevel === 0) return false
    const othersCover = teamMemberIds.filter(mid => mid !== memberId && (skillMatrix?.[mid]?.[sid] ?? 0) > 0).length
    return othersCover === 0
  })

  // 팀 내 최고 레벨 스킬
  const bestInTeam = allSkills.filter(s => {
    const myLevel = s.level
    return teamMemberIds.every(mid => mid === memberId || (skillMatrix?.[mid]?.[s.id] ?? 0) <= myLevel)
  }).slice(0, 3)

  const levelColor = (l) => {
    if (l >= 4) return 'bg-primary text-white'
    if (l >= 3) return 'bg-primary/50 text-primary-dark'
    if (l >= 2) return 'bg-accent-yellow/60 text-accent-yellow-dark'
    return 'bg-muted text-body'
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface rounded-md border border-hairline shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 팝업 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
          <div>
            <div className="text-base font-semibold text-ink">{name}</div>
            <div className="text-xs text-body">{memberId} · {data.teamNames?.[teamId] || teamId}</div>
          </div>
          <button onClick={onClose} className="text-body hover:text-ink text-xl leading-none px-1">×</button>
        </div>

        <div className="flex-1 overflow-auto">
          {/* 배치 근거 섹션 */}
          {requiredSkills.length > 0 && (
            <div className="px-6 py-4 border-b border-hairline space-y-3">
              <p className="text-xs font-mono text-body uppercase tracking-wider">이 팀에 배치된 근거</p>

              {/* 팀 필수 스킬 커버 현황 */}
              {memberCovers.length > 0 && (
                <div>
                  <p className="text-[10px] text-primary-dark font-mono mb-1.5">내가 커버하는 팀 필수 스킬</p>
                  <div className="flex flex-wrap gap-1">
                    {memberCovers.map(sid => {
                      const lv = skillMatrix?.[memberId]?.[sid] ?? 0
                      const isUnique = uniqueContributions.includes(sid)
                      return (
                        <span key={sid} className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] border ${isUnique ? 'bg-accent-yellow-tint border-accent-yellow/40 text-accent-yellow-dark' : 'bg-primary-tint border-primary/20 text-primary-dark'}`}>
                          {isUnique ? '★' : '✓'} {skillNameMap[sid] || sid} <span className="font-medium">Lv{lv}</span>
                        </span>
                      )
                    })}
                  </div>
                  {uniqueContributions.length > 0 && (
                    <p className="text-[10px] text-accent-yellow-dark mt-1.5">★ 이 스킬은 팀 내 본인만 보유 — 핵심 기여자</p>
                  )}
                </div>
              )}

              {/* 커버 못하는 필수 스킬 */}
              {memberMisses.length > 0 && (
                <div>
                  <p className="text-[10px] text-body font-mono mb-1.5">미보유 팀 필수 스킬</p>
                  <div className="flex flex-wrap gap-1">
                    {memberMisses.map(sid => (
                      <span key={sid} className="px-2 py-0.5 bg-muted border border-hairline rounded-sm text-[10px] text-body">
                        {skillNameMap[sid] || sid}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 팀 내 최고 레벨 */}
              {bestInTeam.length > 0 && (
                <div className="pt-2 border-t border-hairline">
                  <p className="text-[10px] text-body font-mono mb-1.5">팀 내 최고 레벨 보유 스킬</p>
                  <div className="flex flex-wrap gap-1">
                    {bestInTeam.map(s => (
                      <span key={s.id} className="px-2 py-0.5 bg-surface-dark text-on-dark rounded-sm text-[10px] border border-hairline">
                        {s.name} Lv{s.level}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 한 줄 요약 */}
              <p className="text-[10px] text-body leading-relaxed bg-muted px-3 py-2 rounded-sm">
                {memberCovers.length === requiredSkills.length
                  ? `팀 필수 스킬 ${requiredSkills.length}개를 모두 보유합니다.`
                  : `팀 필수 스킬 ${requiredSkills.length}개 중 ${memberCovers.length}개 보유${uniqueContributions.length > 0 ? ` · ${uniqueContributions.length}개 스킬은 팀 내 유일` : ''}`
                }
              </p>
            </div>
          )}

          {/* 보유 스킬 전체 */}
          <div className="px-6 py-4">
            {allSkills.length === 0 ? (
              <p className="text-sm text-body">등록된 스킬 정보가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-mono text-body uppercase tracking-wider mb-3">보유 스킬 전체 ({allSkills.length}개)</p>
                {allSkills.map(s => {
                  const isRequired = requiredSkills.includes(s.id)
                  return (
                    <div key={s.id} className={`flex items-center justify-between py-1 ${isRequired ? 'opacity-100' : 'opacity-70'}`}>
                      <div className="flex items-center gap-1.5">
                        {isRequired && <span className="text-primary text-[10px]">●</span>}
                        <span className="text-sm text-ink">{s.name}</span>
                        <span className="text-xs text-body">{s.id}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className={`w-2.5 h-2.5 rounded-full ${i <= s.level ? 'bg-primary' : 'bg-muted'}`} />
                          ))}
                        </div>
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded-sm ${levelColor(s.level)}`}>Lv{s.level}</span>
                      </div>
                    </div>
                  )
                })}
                {requiredSkills.length > 0 && (
                  <p className="text-[10px] text-body pt-2 border-t border-hairline">● 팀 필수 스킬</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ImpactChart({ data }) {
  const chartData = Object.entries(data.scores?.coverage || {}).map(([teamId, after]) => {
    const before = data.beforeCoverage?.[teamId] ?? after - 0.1
    return {
      name: data.teamNames?.[teamId] || teamId,
      before: Math.round(before * 100),
      after: Math.round(after * 100),
    }
  })

  return (
    <div className="p-5">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip formatter={v => `${v}%`} />
          <Bar dataKey="before" name="배치 전" fill="#d1d5db" radius={[2, 2, 0, 0]} />
          <Bar dataKey="after" name="배치 후" fill="#2ECC87" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
