import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import useStore from '../store/useStore'
import { mockPlacementResult } from '../api/mock'
import { saveToArchive } from '../utils/archive'

const getTeamLabel = (teamId, teams, teamNamesMap) => {
  const teamInfo = (teams || []).find(t => t.id === teamId)
  return (teamInfo?.taskName && teamInfo.taskName !== '' ? teamInfo.taskName : null)
    || teamNamesMap?.[teamId]
    || teamInfo?.name
    || teamId
}

const MEMBER_PANEL_W = 260
const DIST_PANEL_W = 280

export default function Step4Dashboard() {
  const navigate = useNavigate()
  const store = useStore()
  const { placementResult, placementType, setCurrentStep, skillMatrix, skills, teams, members, conditions, analysisResult, placementMode, currentTeams, currentAssignment, surplusMembers } = store
  const isRe = placementType === 're'
  const data = placementResult || mockPlacementResult
  const memberMap = Object.fromEntries((members || []).map(m => [m.id, m]))

  // 재배치: changes가 없으면 surplus 멤버 기준으로 직접 계산
  const reChanges = (() => {
    if (!isRe) return []
    if ((data.changes || []).length > 0) return data.changes
    const surplusIds = new Set((surplusMembers || []).map(m => m.id || m))
    const result = []
    for (const [tid, mids] of Object.entries(data.placement || {})) {
      for (const mid of mids) {
        if (surplusIds.has(mid)) {
          result.push({ member_id: mid, from_team: null, to_team: tid })
        } else {
          const prev = currentAssignment?.[mid]
          const prevTid = typeof prev === 'string' ? prev : prev?.currentTeamId
          if (prevTid && prevTid !== tid) {
            result.push({ member_id: mid, from_team: prevTid, to_team: tid })
          }
        }
      }
    }
    return result
  })()
  console.log('[Step4] mounted, placementType:', placementType, 'placementResult:', placementResult, 'placement keys:', Object.keys(data?.placement ?? {}))

  // 아카이브 자동 저장
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
      summary: { memberCount, teamCount, conditionFulfillment: data.scores?.condition_fulfillment ?? 0, coverage },
      snapshot: { placementType, skills, members, skillMatrix, teams, placementMode, analysisResult, conditions, placementResult: data },
    })
  }, [data])

  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [history, setHistory] = useState([])
  const [impactOpen, setImpactOpen] = useState(false)
  const [showOnlyWarning, setShowOnlyWarning] = useState(false)
  const teamGridRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return
      if (selectedMember) { setSelectedMember(null); return }
      if (selectedTeamId) { setSelectedTeamId(null); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedMember, selectedTeamId])

  // 팀별 경고 집계
  const warningsByTeam = (data.warnings || []).reduce((acc, w) => {
    const tid = w.team_id ?? w.teamId
    if (tid) { if (!acc[tid]) acc[tid] = []; acc[tid].push(w) }
    return acc
  }, {})
  const warningTeamIds = new Set(Object.keys(warningsByTeam))
  const hasTeamWarnings = warningTeamIds.size > 0

  const exportCSV = () => {
    const rows = [['팀', '구성원ID', '이름']]
    Object.entries(data.placement || {}).forEach(([teamId, ms]) => {
      ms.forEach(mid => rows.push([data.teamNames?.[teamId] || teamId, mid, data.memberNames?.[mid] || mid]))
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'placement.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const totalFulfillment = Math.round((data.scores?.conditionFulfillment ?? 0) * 100)
  const rightOffset = selectedTeamId ? MEMBER_PANEL_W + DIST_PANEL_W : 0

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar currentStep={4} />

      {/* SummaryBar */}
      <div className="fixed left-0 right-0 z-20" style={{ top: '69px' }}>
        <SummaryBar
          data={data}
          fulfillment={totalFulfillment}
          warningTeamIds={warningTeamIds}
          showOnlyWarning={showOnlyWarning}
          hasTeamWarnings={hasTeamWarnings}
          conditions={conditions}
          onWarningClick={() => {
            if (!hasTeamWarnings) return
            setShowOnlyWarning(v => !v)
            teamGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          onAdjust={() => { setCurrentStep(5); navigate('/step/5') }}
          onExportCSV={exportCSV}
        />
      </div>

      {/* 메인 콘텐츠 */}
      <div style={{ marginRight: `${rightOffset}px`, marginTop: 'calc(69px + 64px)' }}>
        <main className="overflow-auto p-6 space-y-4" style={{ height: 'calc(100vh - 69px - 64px)' }}>
          {/* 재배치 인원 현황 + 팀 영향도 */}
          {isRe && reChanges.length > 0 && (
            <>
              <ReplacementChangesPanel
                changes={reChanges}
                memberMap={memberMap}
                teamNames={data.teamNames || {}}
                currentTeams={currentTeams || []}
              />
              <ReplacementImpactPanel
                changes={reChanges}
                memberMap={memberMap}
                members={members || []}
                currentTeams={currentTeams || []}
                currentAssignment={currentAssignment || {}}
                skillMatrix={skillMatrix || {}}
                skills={skills || []}
                teamNames={data.teamNames || {}}
                conditions={conditions}
              />
            </>
          )}

          {!isRe && (
            <div ref={teamGridRef}>
              {showOnlyWarning && warningTeamIds.size > 0 && (
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs text-accent-coral font-medium">⚠ 미충족 팀 {warningTeamIds.size}개만 표시 중</span>
                  <button onClick={() => setShowOnlyWarning(false)} className="text-xs text-body underline hover:text-ink">전체 보기</button>
                </div>
              )}
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                {Object.entries(data.placement || {})
                  .filter(([tid]) => !showOnlyWarning || warningTeamIds.has(tid))
                  .map(([teamId, memberIds]) => (
                    <TeamCard
                      key={teamId}
                      teamId={teamId}
                      memberIds={memberIds}
                      data={data}
                      skillMatrix={skillMatrix}
                      skills={skills}
                      teams={teams}
                      warnings={warningsByTeam[teamId] || []}
                      isSelected={selectedTeamId === teamId}
                      onSelect={() => setSelectedTeamId(tid => tid === teamId ? null : teamId)}
                    />
                  ))}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* 우측 사이드바: 구성원 목록 + 분포 */}
      {selectedTeamId && (
        <>
          {/* 분포 패널 (맨 우측) */}
          <aside
            className="fixed bottom-0 border-l border-hairline bg-surface flex flex-col z-10 overflow-auto"
            style={{ top: 'calc(69px + 64px)', right: 0, width: `${DIST_PANEL_W}px` }}
          >
            <DistributionPanel
              teamId={selectedTeamId}
              memberIds={data.placement?.[selectedTeamId] || []}
              data={data}
              skillMatrix={skillMatrix}
              skills={skills}
              teams={teams}
              members={members}
            />
          </aside>
          {/* 구성원 목록 패널 (분포 패널 왼쪽) */}
          <aside
            className="fixed bottom-0 border-l border-hairline bg-surface flex flex-col z-10"
            style={{ top: 'calc(69px + 64px)', right: `${DIST_PANEL_W}px`, width: `${MEMBER_PANEL_W}px` }}
          >
            <TeamMemberPanel
              teamId={selectedTeamId}
              memberIds={data.placement?.[selectedTeamId] || []}
              data={data}
              skillMatrix={skillMatrix}
              skills={skills}
              teams={teams}
              members={members}
              warnings={warningsByTeam[selectedTeamId] || []}
              onSelectMember={(mid) => setSelectedMember({ mid, teamId: selectedTeamId })}
              onClose={() => setSelectedTeamId(null)}
            />
          </aside>
        </>
      )}


      {/* 구성원 세부정보 팝업 */}
      {selectedMember && (
        <MemberDetailPopup
          memberId={selectedMember.mid}
          teamId={selectedMember.teamId}
          data={data}
          skillMatrix={skillMatrix}
          skills={skills}
          teams={teams}
          members={members}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  )
}

// ─── SummaryBar ───────────────────────────────────────────────────────────────
function SummaryBar({ data, fulfillment, warningTeamIds, showOnlyWarning, hasTeamWarnings, onWarningClick, conditions, onAdjust, onExportCSV }) {
  const coverages = Object.values(data.scores?.coverage || {})
  const avgCoverage = coverages.length
    ? Math.round(coverages.reduce((a, b) => a + b, 0) / coverages.length * 100)
    : 0
  const totalMembers = Object.values(data.placement || {}).flat().length
  const warnCount = warningTeamIds.size

  return (
    <div className="bg-surface border-b border-hairline px-8 flex items-center gap-8" style={{ height: '64px' }}>
      <div>
        <div className="text-xs text-body mb-0.5">
          최소 레벨 충족률
          {conditions?.minSkillLevel != null && (
            <span className="ml-1.5 font-mono text-[10px] text-body">(하한 {Number(conditions.minSkillLevel).toFixed(1)})</span>
          )}
        </div>
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
      {warnCount > 0 && (
        <button
          onClick={hasTeamWarnings ? onWarningClick : undefined}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            showOnlyWarning
              ? 'bg-accent-coral text-white border-accent-coral'
              : 'bg-accent-coral/10 text-accent-coral border-accent-coral/30 hover:bg-accent-coral/20'
          } ${!hasTeamWarnings ? 'cursor-default' : 'cursor-pointer'}`}
        >
          ⚠ 미충족 {warnCount}팀
          {hasTeamWarnings && (
            <span className="opacity-60">{showOnlyWarning ? '← 전체 보기' : '→ 확인하기'}</span>
          )}
        </button>
      )}
      <div className="text-xs text-body shrink-0">{totalMembers}명 배치</div>
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <button
          onClick={onAdjust}
          className="px-3 py-1.5 rounded-sm border border-hairline text-xs font-medium text-ink hover:bg-muted transition-colors"
        >
          수동 조정하기
        </button>
        <button
          onClick={onExportCSV}
          className="px-3 py-1.5 rounded-sm border border-hairline text-xs font-medium text-ink hover:bg-muted transition-colors"
        >
          CSV 내보내기
        </button>
      </div>
    </div>
  )
}

// ─── TeamCard ─────────────────────────────────────────────────────────────────
function TeamCard({ teamId, memberIds, data, skillMatrix, skills, teams, warnings, isSelected, onSelect }) {
  const teamName = getTeamLabel(teamId, teams, data.teamNames)
  const coverage = Math.round((data.scores?.coverage?.[teamId] ?? 0) * 100)
  const hasWarning = warnings.length > 0

  const teamInfo = (teams || []).find(t => t.id === teamId)
  const requiredSkills = teamInfo?.requiredSkills || []
  const skillNameMap = (skills || []).reduce((acc, s) => { acc[s.id] = s.name; return acc }, {})

  const coveredSkills = requiredSkills.filter(sid =>
    memberIds.some(mid => (skillMatrix?.[mid]?.[sid] ?? 0) > 0)
  )
  const missingSkills = requiredSkills.filter(sid =>
    !memberIds.some(mid => (skillMatrix?.[mid]?.[sid] ?? 0) > 0)
  )

  // 경고 타입별 분류
  const avgLevelWarnings = warnings.filter(w => w.type === 'avg_level')
  const noHolderWarnings = warnings.filter(w => w.type === 'no_holder')

  return (
    <div
      className={`border rounded-md bg-surface cursor-pointer transition-all flex flex-col ${
        isSelected
          ? 'border-primary shadow-sm ring-1 ring-primary/30'
          : hasWarning
          ? 'border-accent-coral/40 hover:border-accent-coral/70'
          : 'border-hairline hover:border-primary/40'
      }`}
      onClick={onSelect}
    >
      {/* 헤더 */}
      <div className={`px-3 py-2.5 ${isSelected ? 'bg-primary-tint' : hasWarning ? 'bg-accent-coral/5' : ''}`}>
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-ink truncate">{teamName}</div>
            <div className="text-[10px] text-body mt-0.5">{memberIds.length}명</div>
          </div>
          {hasWarning
            ? <span className="text-[9px] text-accent-coral font-medium shrink-0">⚠ 미충족</span>
            : <span className="text-[9px] text-primary font-medium shrink-0">✓ 충족</span>
          }
        </div>

        {/* 커버리지 바 */}
        <div className="mt-2">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${coverage === 100 ? 'bg-primary' : 'bg-accent-coral'}`}
                style={{ width: `${coverage}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono font-medium ${coverage === 100 ? 'text-primary' : 'text-accent-coral'}`}>
              {coverage}%
            </span>
          </div>
        </div>
      </div>

      {/* 배치 근거 */}
      <div className="px-3 py-2 border-t border-hairline space-y-1.5 flex-1">
        {/* 필수 스킬 커버리지 */}
        {requiredSkills.length > 0 && (
          <div>
            <div className="text-[9px] text-body font-mono uppercase tracking-wider mb-1">필수 스킬</div>
            <div className="flex flex-wrap gap-0.5">
              {coveredSkills.map(sid => {
                const best = memberIds.reduce((b, mid) => {
                  const lv = skillMatrix?.[mid]?.[sid] ?? 0
                  return lv > b.lv ? { mid, lv } : b
                }, { mid: null, lv: 0 })
                return (
                  <span key={sid} className="flex items-center gap-0.5 px-1 py-0.5 bg-primary-tint border border-primary/20 rounded-sm text-[9px] text-primary-dark">
                    ✓ {skillNameMap[sid] || sid}{best.lv > 0 && <span className="font-medium"> Lv{best.lv}</span>}
                  </span>
                )
              })}
              {missingSkills.map(sid => (
                <span key={sid} className="px-1 py-0.5 bg-accent-coral/10 border border-accent-coral/30 rounded-sm text-[9px] text-accent-coral">
                  ✗ {skillNameMap[sid] || sid}
                </span>
              ))}
            </div>
            {requiredSkills.length > 0 && (
              <p className="text-[9px] text-body mt-1">
                {coveredSkills.length}/{requiredSkills.length} 충족
              </p>
            )}
          </div>
        )}

        {/* 평균 레벨 미달 경고 */}
        {avgLevelWarnings.length > 0 && (
          <div className="pt-1 border-t border-hairline">
            <div className="text-[9px] text-accent-coral font-mono uppercase tracking-wider mb-0.5">평균 레벨 미달</div>
            {avgLevelWarnings.map((w, i) => (
              <p key={i} className="text-[9px] text-accent-coral leading-tight">{w.message}</p>
            ))}
          </div>
        )}

        {/* 보유자 없음 경고 */}
        {noHolderWarnings.length > 0 && (
          <div className="pt-1 border-t border-hairline">
            <div className="text-[9px] text-accent-coral font-mono uppercase tracking-wider mb-0.5">보유자 없음</div>
            {noHolderWarnings.map((w, i) => (
              <p key={i} className="text-[9px] text-body leading-tight">{w.message}</p>
            ))}
          </div>
        )}

        {/* 경고 없으면 충족 요약 */}
        {!hasWarning && requiredSkills.length === 0 && (
          <p className="text-[9px] text-body">필수 스킬 조건 없음</p>
        )}
        {!hasWarning && requiredSkills.length > 0 && missingSkills.length === 0 && avgLevelWarnings.length === 0 && (
          <p className="text-[9px] text-primary">모든 조건 충족</p>
        )}
      </div>

      {/* 선택 안내 — 카드 하단 고정 */}
      <div className={`px-3 py-1.5 border-t border-hairline text-[9px] text-center mt-auto ${isSelected ? 'bg-primary-tint text-primary' : 'text-body'}`}>
        {isSelected ? '← 구성원 패널 열림' : '클릭해서 구성원 보기'}
      </div>
    </div>
  )
}

// ─── TeamMemberPanel (중간 패널) ──────────────────────────────────────────────
function TeamMemberPanel({ teamId, memberIds, data, skillMatrix, skills, teams, members, warnings, onSelectMember, onClose }) {
  const teamName = getTeamLabel(teamId, teams, data.teamNames)
  const coverage = Math.round((data.scores?.coverage?.[teamId] ?? 0) * 100)
  const skillNameMap = (skills || []).reduce((acc, s) => { acc[s.id] = s.name; return acc }, {})

  const teamInfo = (teams || []).find(t => t.id === teamId)
  const requiredSkills = teamInfo?.requiredSkills || []

  const sortedMembers = [...memberIds].sort((a, b) =>
    (data.memberNames?.[a] || a).localeCompare(data.memberNames?.[b] || b, 'ko')
  )

  return (
    <>
      {/* 패널 헤더 */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-hairline shrink-0">
        <div>
          <div className="text-base font-semibold text-ink">{teamName}</div>
          <div className="text-sm text-body">{memberIds.length}명 · 커버리지 {coverage}%</div>
        </div>
        <button onClick={onClose} className="text-body hover:text-ink text-lg px-1">×</button>
      </div>

      {/* 경고 요약 */}
      {warnings.length > 0 && (
        <div className="px-4 py-2 bg-accent-coral/5 border-b border-accent-coral/20 shrink-0">
          {warnings.map((w, i) => (
            <p key={i} className="text-[10px] text-accent-coral leading-relaxed">⚠ {w.message}</p>
          ))}
        </div>
      )}

      {/* 구성원 목록 */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-2">
          {sortedMembers.map(mid => {
            const name = data.memberNames?.[mid] || mid
            const memberInfo = (members || []).find(m => m.id === mid)
            const topSkills = getTopSkills(mid, skillMatrix, skills, 3)
            const covers = requiredSkills.filter(sid => (skillMatrix?.[mid]?.[sid] ?? 0) > 0)
            const uniqueContribs = requiredSkills.filter(sid => {
              if ((skillMatrix?.[mid]?.[sid] ?? 0) === 0) return false
              return !memberIds.some(other => other !== mid && (skillMatrix?.[other]?.[sid] ?? 0) > 0)
            })

            return (
              <button
                key={mid}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-md border border-hairline hover:border-primary/40 hover:bg-primary-tint/30 transition-colors text-left"
                onClick={() => onSelectMember(mid)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium text-ink">{name}</span>
                    {uniqueContribs.length > 0 && (
                      <span className="text-[9px] bg-accent-yellow/20 text-accent-yellow-dark border border-accent-yellow/30 px-1 rounded-sm">핵심</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    {memberInfo?.role && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm text-ink font-medium">{memberInfo.role}</span>
                    )}
                    {memberInfo?.gender && (
                      <span className="text-[10px] text-body">{memberInfo.gender}</span>
                    )}
                    {memberInfo?.experience != null && memberInfo.experience > 0 && (
                      <span className="text-[10px] text-body font-mono">경력 {memberInfo.experience}년</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-0.5">
                    {topSkills.map(s => (
                      <span key={s.id} className="px-1 py-0.5 bg-muted text-body text-[9px] rounded-sm border border-hairline">
                        {s.name} <span className="text-primary-dark font-medium">Lv{s.level}</span>
                      </span>
                    ))}
                  </div>
                  {requiredSkills.length > 0 && (
                    <p className="text-[9px] text-body mt-1">
                      필수 스킬 {covers.length}/{requiredSkills.length} 보유
                      {uniqueContribs.length > 0 && <span className="text-accent-yellow-dark"> · {uniqueContribs.length}개 유일 기여</span>}
                    </p>
                  )}
                </div>
                <span className="text-[9px] text-body shrink-0 mt-1">상세 →</span>
              </button>
            )
          })}
        </div>
      </div>

    </>
  )
}

// ─── DistributionPanel ────────────────────────────────────────────────────────
const PIE_COLORS = ['#4D9EED', '#4DC2A8', '#FABF4B', '#485671', '#f87171', '#a78bfa']

function DistributionPanel({ teamId, memberIds, data, skillMatrix, skills, teams, members }) {
  const teamName = getTeamLabel(teamId, teams, data.teamNames)
  const teamInfo = (teams || []).find(t => t.id === teamId)
  const requiredSkills = teamInfo?.requiredSkills || []

  // 스킬 보유 현황
  const skillData = requiredSkills.map(sid => {
    const skillName = (skills || []).find(s => s.id === sid)?.name || sid
    const holders = memberIds.filter(mid => (skillMatrix?.[mid]?.[sid] ?? 0) > 0)
    const avg = holders.length > 0
      ? holders.reduce((s, mid) => s + (skillMatrix?.[mid]?.[sid] ?? 0), 0) / holders.length
      : 0
    return { name: skillName, 보유자: holders.length, 평균레벨: parseFloat(avg.toFixed(1)) }
  })

  // 직급 분포
  const roleCounts = {}
  memberIds.forEach(mid => {
    const role = (members || []).find(m => m.id === mid)?.role
    if (role) roleCounts[role] = (roleCounts[role] || 0) + 1
  })
  const roleData = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

  // 성별 분포
  const genderCounts = {}
  memberIds.forEach(mid => {
    const gender = (members || []).find(m => m.id === mid)?.gender
    if (gender) genderCounts[gender] = (genderCounts[gender] || 0) + 1
  })
  const genderData = Object.entries(genderCounts).map(([name, value]) => ({ name, value }))

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-4 py-4 border-b border-hairline shrink-0">
        <div className="text-base font-semibold text-ink">배치 현황</div>
        <div className="text-sm text-body">{memberIds.length}명</div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* 스킬 보유 현황 */}
        {skillData.length > 0 && (
          <div>
            <p className="text-xs font-mono text-body uppercase tracking-wider mb-3">필수 스킬 보유 현황</p>
            <ResponsiveContainer width="100%" height={skillData.length * 36 + 24}>
              <BarChart data={skillData} layout="vertical" margin={{ left: 4, right: 36, top: 8, bottom: 4 }}>
                <XAxis type="number" domain={[0, memberIds.length]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={100}
                  tick={({ x, y, payload }) => (
                    <foreignObject x={x - 100} y={y - 10} width={96} height={24}>
                      <div
                        xmlns="http://www.w3.org/1999/xhtml"
                        style={{ fontSize: 11, color: '#3f6856', lineHeight: '1.3', wordBreak: 'keep-all', textAlign: 'right', paddingRight: 4 }}
                      >
                        {payload.value}
                      </div>
                    </foreignObject>
                  )}
                />
                <Tooltip
                  formatter={(val, name) => [name === '보유자' ? `${val}명` : `Lv${val}`, name]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="보유자" fill="#2ECC87" radius={[0, 3, 3, 0]} barSize={14} label={{ position: 'right', fontSize: 11, fill: '#1A1A1A', formatter: (v) => `${v}명` }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 직급 분포 */}
        {roleData.length > 0 && (
          <div>
            <p className="text-xs font-mono text-body uppercase tracking-wider mb-3">직급 분포</p>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={roleData} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" paddingAngle={2}>
                  {roleData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(val, name) => [`${val}명`, name]} contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2">
              {roleData.map((d, i) => (
                <span key={d.name} className="flex items-center gap-1.5 text-xs text-body">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name} <span className="font-semibold text-ink">{d.value}명</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 성별 분포 */}
        {genderData.length > 0 && (
          <div>
            <p className="text-xs font-mono text-body uppercase tracking-wider mb-3">성별 분포</p>
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" innerRadius={32} outerRadius={54} dataKey="value" paddingAngle={2}>
                  {genderData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(val, name) => [`${val}명`, name]} contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-2">
              {genderData.map((d, i) => (
                <span key={d.name} className="flex items-center gap-1.5 text-xs text-body">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name} <span className="font-semibold text-ink">{d.value}명</span> ({Math.round(d.value / memberIds.length * 100)}%)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MemberDetailPopup ────────────────────────────────────────────────────────
function getTopSkills(memberId, skillMatrix, skills, n = 3) {
  const memberScores = skillMatrix?.[memberId] ?? {}
  const skillNameMap = (skills || []).reduce((acc, s) => { acc[s.id] = s.name; return acc }, {})
  return Object.entries(memberScores)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([sid, level]) => ({ id: sid, name: skillNameMap[sid] || sid, level }))
}

function MemberDetailPopup({ memberId, teamId, data, skillMatrix, skills, teams, members, onClose }) {
  const name = data.memberNames?.[memberId] || memberId
  const memberInfo = (members || []).find(m => m.id === memberId)
  const allSkills = getTopSkills(memberId, skillMatrix, skills, 999)
  const skillNameMap = (skills || []).reduce((acc, s) => { acc[s.id] = s.name; return acc }, {})

  const teamInfo = (teams || []).find(t => t.id === teamId)
  const requiredSkills = teamInfo?.requiredSkills || []
  const memberCovers = requiredSkills.filter(sid => (skillMatrix?.[memberId]?.[sid] ?? 0) > 0)
  const memberMisses = requiredSkills.filter(sid => (skillMatrix?.[memberId]?.[sid] ?? 0) === 0)

  const teamMemberIds = data.placement?.[teamId] || []
  const uniqueContributions = requiredSkills.filter(sid => {
    const myLevel = skillMatrix?.[memberId]?.[sid] ?? 0
    if (myLevel === 0) return false
    return !teamMemberIds.some(mid => mid !== memberId && (skillMatrix?.[mid]?.[sid] ?? 0) > 0)
  })

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
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
          <div>
            <div className="text-base font-semibold text-ink">{name}</div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {memberInfo?.role && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-sm text-ink font-medium">{memberInfo.role}</span>
              )}
              {memberInfo?.gender && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-sm text-body">{memberInfo.gender}</span>
              )}
              {memberInfo?.experience != null && memberInfo.experience > 0 && (
                <span className="text-xs text-body font-mono">경력 {memberInfo.experience}년</span>
              )}
              <span className="text-xs text-body">{data.memberNames?.[memberId] || memberId} · {getTeamLabel(teamId, teams, data.teamNames)}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-body hover:text-ink text-xl leading-none px-1">×</button>
        </div>

        <div className="flex-1 overflow-auto">
          {requiredSkills.length > 0 && (
            <div className="px-6 py-4 border-b border-hairline space-y-3">
              <p className="text-xs font-mono text-body uppercase tracking-wider">이 팀에 배치된 근거</p>
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
              {bestInTeam.length > 0 && (
                <div className="pt-2 border-t border-hairline">
                  <p className="text-[10px] text-body font-mono mb-1.5">팀 내 최고 레벨 보유 스킬</p>
                  <div className="flex flex-wrap gap-1">
                    {bestInTeam.map(s => (
                      <span key={s.id} className="px-2 py-0.5 bg-muted text-ink rounded-sm text-[10px] border border-hairline font-medium">
                        {s.name} <span className="text-primary-dark">Lv{s.level}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-body leading-relaxed bg-muted px-3 py-2 rounded-sm">
                {memberCovers.length === requiredSkills.length
                  ? `팀 필수 스킬 ${requiredSkills.length}개를 모두 보유합니다.`
                  : `팀 필수 스킬 ${requiredSkills.length}개 중 ${memberCovers.length}개 보유${uniqueContributions.length > 0 ? ` · ${uniqueContributions.length}개 스킬은 팀 내 유일` : ''}`
                }
              </p>
            </div>
          )}

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

// ─── ImpactChart ─────────────────────────────────────────────────────────────
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

// ─── ReplacementChangesPanel ─────────────────────────────────────────────────
function ReplacementChangesPanel({ changes, memberMap, teamNames, currentTeams }) {
  // 팀별로 그룹핑: 새로 합류한 팀 기준
  const byTeam = {}
  for (const c of changes) {
    if (!byTeam[c.to_team]) byTeam[c.to_team] = []
    byTeam[c.to_team].push(c)
  }

  const teamName = (tid) => teamNames[tid] || tid

  return (
    <div className="mb-4 rounded-lg border border-hairline overflow-hidden">
      <div className="px-5 py-3 bg-muted border-b border-hairline flex items-center gap-3">
        <span className="text-sm font-semibold text-ink">재배치 인원 현황</span>
        <span className="text-xs text-body font-mono">{changes.length}명 이동</span>
      </div>
      <div className="p-5 bg-surface">
        <div className="space-y-4">
          {Object.entries(byTeam).map(([toTeam, items]) => (
            <div key={toTeam}>
              <p className="text-xs font-mono text-body uppercase tracking-wider mb-2">
                → {teamName(toTeam)} 합류 ({items.length}명)
              </p>
              <div className="flex flex-wrap gap-2">
                {items.map(c => {
                  const m = memberMap[c.member_id]
                  return (
                    <div key={c.member_id}
                      className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 bg-primary/5 border border-primary/20 rounded-full">
                      <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-mono font-semibold shrink-0">
                        {(m?.name || c.member_id).slice(0, 2)}
                      </div>
                      <div className="leading-tight">
                        <div className="text-xs font-medium text-ink">
                          {m?.name || c.member_id}
                          {m?.role && <span className="ml-1 text-body font-normal">{m.role}</span>}
                        </div>
                        {c.from_team && (
                          <div className="text-[10px] text-body font-mono">
                            {teamName(c.from_team)} → {teamName(c.to_team)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── ReplacementImpactPanel ───────────────────────────────────────────────────
const PIE_COLORS_RE = ['#4D9EED', '#4DC2A8', '#FABF4B', '#485671', '#f87171', '#a78bfa']

function ReplacementImpactPanel({ changes, memberMap, members, currentTeams, currentAssignment, skillMatrix, skills, teamNames, conditions }) {
  const { PieChart: PC, Pie: P, Cell: CL, Tooltip: TT, ResponsiveContainer: RC } = { PieChart, Pie, Cell, Tooltip, ResponsiveContainer }
  const minLevel = conditions?.minSkillLevel ?? 2.8

  // 새로 합류한 인원이 있는 팀만 (to_team 기준)
  const affectedTeamIds = [...new Set(changes.map(c => c.to_team))]

  // 멤버 → 기존팀 맵
  const getMemberOrigTeam = (mid) => {
    const v = currentAssignment[mid]
    return typeof v === 'string' ? v : v?.currentTeamId ?? null
  }

  const skillName = (sid) => skills.find(s => s.id === sid)?.name ?? sid

  const makePie = (mems, keyFn) => {
    const counts = {}
    mems.forEach(m => { const k = keyFn(m) || '미입력'; counts[k] = (counts[k] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }

  return (
    <div className="rounded-lg border border-hairline overflow-hidden mb-4">
      <div className="px-5 py-3 bg-muted border-b border-hairline flex items-center gap-3">
        <span className="text-sm font-semibold text-ink">기존 팀 영향도 (영입 전/후)</span>
        <span className="text-xs text-body font-mono">{affectedTeamIds.length}개 팀 변동</span>
      </div>
      <div className="divide-y divide-hairline">
        {affectedTeamIds.map(toTeam => {
          const team = currentTeams.find(t => t.id === toTeam)
          const newMemberIds = changes.filter(c => c.to_team === toTeam).map(c => c.member_id)
          const newMembers = newMemberIds.map(mid => memberMap[mid]).filter(Boolean)

          // 기존 팀원 (영입 전)
          const beforeMembers = members.filter(m => getMemberOrigTeam(m.id) === toTeam)
          // 영입 후 = 기존 팀원 + 신규
          const afterMembers = [...beforeMembers, ...newMembers]

          const requiredSkills = team?.requiredSkills || []

          // 스킬별 평균 레벨 before/after
          const avgLevel = (mems, sid) => {
            if (!mems.length) return 0
            return mems.reduce((s, m) => s + (skillMatrix[m.id]?.[sid] ?? 0), 0) / mems.length
          }

          const tName = teamNames[toTeam] || toTeam
          const rolePieBefore = makePie(beforeMembers, m => m.role)
          const rolePieAfter = makePie(afterMembers, m => m.role)
          const genderPieBefore = makePie(beforeMembers, m => m.gender)
          const genderPieAfter = makePie(afterMembers, m => m.gender)

          return (
            <div key={toTeam} className="bg-surface">
              {/* 헤더 */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-hairline">
                <span className="text-base font-bold font-mono text-ink">{toTeam}</span>
                {team?.name && team.name !== toTeam && <span className="text-sm text-body">{team.name}</span>}
                <div className="ml-auto flex items-center gap-1.5 text-sm">
                  <span className="font-mono font-medium text-ink">{beforeMembers.length}</span>
                  <span className="text-body text-xs">명</span>
                  <span className="text-body mx-1">→</span>
                  <span className="font-mono font-medium text-ink">{afterMembers.length}</span>
                  <span className="text-body text-xs">명</span>
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    +{newMembers.length}명 합류
                  </span>
                </div>
              </div>

              {/* 신규 합류 인원 */}
              <div className="px-5 py-3 bg-primary/5 border-b border-hairline">
                <p className="text-[11px] font-mono text-primary uppercase tracking-wider mb-2">↗ 새로 합류한 인원</p>
                <div className="flex flex-wrap gap-2">
                  {newMembers.map(m => (
                    <div key={m.id} className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 bg-surface border border-primary/30 rounded-full">
                      <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-mono font-semibold shrink-0">
                        {(m.name || m.id)?.slice(0, 2)}
                      </div>
                      <div className="leading-tight">
                        <div className="text-xs font-medium text-ink">{m.name || m.id} <span className="text-body font-normal">{m.role}</span></div>
                        <div className="text-[10px] text-body font-mono">잉여 인력 → {tName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 스킬 커버리지 요약 */}
              {requiredSkills.length > 0 && (() => {
                const covBefore = requiredSkills.filter(sid => beforeMembers.some(m => (skillMatrix[m.id]?.[sid] ?? 0) > 0)).length
                const covAfter = requiredSkills.filter(sid => afterMembers.some(m => (skillMatrix[m.id]?.[sid] ?? 0) > 0)).length
                const pctBefore = Math.round(covBefore / requiredSkills.length * 100)
                const pctAfter = Math.round(covAfter / requiredSkills.length * 100)
                return (
                  <div className="px-5 py-3 border-b border-hairline bg-teal/5 flex items-center gap-6">
                    <span className="text-xs font-mono text-body uppercase tracking-wider">스킬 커버리지</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-body">{pctBefore}%</span>
                      <span className="text-body text-xs">({covBefore}/{requiredSkills.length})</span>
                      <span className="text-body mx-1">→</span>
                      <span className="text-sm font-mono font-bold text-teal">{pctAfter}%</span>
                      <span className="text-xs text-body">({covAfter}/{requiredSkills.length})</span>
                      {pctAfter > pctBefore && (
                        <span className="ml-1 px-2 py-0.5 rounded-full bg-teal/15 text-teal text-xs font-medium">
                          +{pctAfter - pctBefore}%p 개선
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* 스킬/분포 변화 */}
              <div className="px-5 py-4 grid grid-cols-5 gap-6">
                {/* 필수 스킬 평균 레벨 변화 */}
                <div className="col-span-3">
                  <p className="text-[11px] font-mono text-body uppercase tracking-wider mb-3">필수 스킬 평균 레벨 변화</p>
                  {requiredSkills.length === 0 ? (
                    <p className="text-xs text-body">필수 스킬 정보 없음</p>
                  ) : (
                    <div className="space-y-2.5">
                      {requiredSkills.map(sid => {
                        const before = avgLevel(beforeMembers, sid)
                        const after = avgLevel(afterMembers, sid)
                        const diff = after - before
                        const dropped = after < minLevel
                        return (
                          <div key={sid}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-ink truncate max-w-[60%]">{skillName(sid)}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-sm text-body">{before.toFixed(1)}</span>
                                <span className="text-body text-xs">→</span>
                                <span className={`font-mono text-sm font-bold ${dropped ? 'text-[#dc2626]' : 'text-ink'}`}>{after.toFixed(1)}</span>
                                <span className={`text-xs font-mono font-medium w-10 text-right ${diff < 0 ? 'text-[#dc2626]' : 'text-teal'}`}>
                                  {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                                </span>
                              </div>
                            </div>
                            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-muted-dark/30 rounded-full" style={{ width: `${Math.min(before/5*100,100)}%` }} />
                              <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${dropped ? 'bg-[#dc2626]' : 'bg-primary'}`} style={{ width: `${Math.min(after/5*100,100)}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 성별 분포 */}
                <div className="col-span-1">
                  <p className="text-[11px] font-mono text-body uppercase tracking-wider mb-2">성별 분포</p>
                  <MiniReBeforeAfterPie before={genderPieBefore} after={genderPieAfter} />
                </div>

                {/* 직급 분포 */}
                <div className="col-span-1">
                  <p className="text-[11px] font-mono text-body uppercase tracking-wider mb-2">직급 분포</p>
                  <MiniReBeforeAfterPie before={rolePieBefore} after={rolePieAfter} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MiniReBeforeAfterPie({ before, after }) {
  const allKeys = [...new Set([...before.map(d => d.name), ...after.map(d => d.name)])]
  const colorMap = Object.fromEntries(allKeys.map((k, i) => [k, PIE_COLORS_RE[i % PIE_COLORS_RE.length]]))

  return (
    <div className="space-y-3">
      {[{ label: '영입 전', data: before }, { label: '영입 후', data: after }].map(({ label, data }) => {
        const total = data.reduce((s, d) => s + d.value, 0)
        return (
          <div key={label}>
            <p className="text-[10px] font-mono text-body mb-1">{label}</p>
            <div className="flex items-center gap-2">
              <ResponsiveContainer width={60} height={60}>
                <PieChart>
                  <Pie data={data} cx="50%" cy="50%" outerRadius={28} dataKey="value" paddingAngle={2}>
                    {data.map((d) => <Cell key={d.name} fill={colorMap[d.name]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v}명`, n]} contentStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-0.5 min-w-0">
                {data.map(d => (
                  <span key={d.name} className="flex items-center gap-1 text-xs text-body">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorMap[d.name] }} />
                    <span className="truncate">{d.name}</span>
                    <span className="font-mono font-medium text-ink shrink-0">{d.value}명</span>
                    <span className="text-[10px] text-body shrink-0">({Math.round(d.value/total*100)}%)</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
