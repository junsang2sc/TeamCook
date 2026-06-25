import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import useStore from '../store/useStore'
import { getComment } from '../api/index'
import TFDashboard from './TFDashboard'
import MemberPopup, { getTopSkills } from '../components/ui/MemberPopup'

const TYPE_LABELS = { specialist: '전문가형', t_shaped: 'T자형', generalist: '제너럴리스트형' }
const TYPE_COLORS = { specialist: 'orange', t_shaped: 'periwinkle', generalist: 'mint' }

export default function Step4Dashboard() {
  const navigate = useNavigate()
  const {
    placementResult, analysisResult, members, skills, teams, skillMatrix,
    setCurrentStep, adjustedPlacement, flowType, placementType, currentAssignment,
  } = useStore()

  const isReplacement = flowType === 'replacement'
  const isTF = placementType === 'tf'

  // TF 모드: 별도 컴포넌트로 분리
  if (isTF) return <TFDashboard />

  const [comments, setComments] = useState([])
  const [commentLoading, setCommentLoading] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [popupMember, setPopupMember] = useState(null)
  // 재배치: 'new' = 새 배치 결과 / 'before' = 기존 배치 현황
  const [compareView, setCompareView] = useState('new')

  const placement = adjustedPlacement || placementResult?.placement || {}

  // 해체 팀: currentAssignment에서 소속 인원 전원이 Y인 팀 → 대시보드에서 제거
  const dissolvedTeamIds = (() => {
    if (!isReplacement) return new Set()
    const stats = {}
    for (const info of Object.values(currentAssignment)) {
      if (!info.currentTeamId) continue
      if (!stats[info.currentTeamId]) stats[info.currentTeamId] = { total: 0, targets: 0 }
      stats[info.currentTeamId].total++
      if (info.isTarget) stats[info.currentTeamId].targets++
    }
    return new Set(
      Object.entries(stats)
        .filter(([, s]) => s.total > 0 && s.total === s.targets)
        .map(([id]) => id)
    )
  })()

  const visibleTeams = teams.filter((t) => !dissolvedTeamIds.has(t.id))

  // 기존 배치 현황: currentAssignment에서 팀별로 구성원 역산
  const beforePlacement = (() => {
    if (!isReplacement) return {}
    const result = {}
    for (const [memberId, info] of Object.entries(currentAssignment)) {
      if (!info.currentTeamId) continue
      if (!result[info.currentTeamId]) result[info.currentTeamId] = []
      result[info.currentTeamId].push(memberId)
    }
    return result
  })()

  const activePlacement = (isReplacement && compareView === 'before') ? beforePlacement : placement

  useEffect(() => {
    if (!placementResult) { navigate('/step/1'); return }
    setSelectedTeam(visibleTeams[0]?.id || null)
    loadComments()
  }, [])

  const loadComments = async () => {
    setCommentLoading(true)
    try {
      const payload = {
        placement_summary: placement,
        warnings: placementResult?.warnings || [],
        top_risks: analysisResult?.spofSkills || [],
      }
      const res = await getComment(payload)
      setComments(res.comments || [])
    } catch {
      if (isReplacement) {
        setComments([
          { team_id: null, message: '재배치 결과: 즉시 차출 가능 인원을 중심으로 팀을 구성했습니다. SPOF 주의 인원은 현재 팀 역할을 확인한 후 단계적으로 이동하세요.', type: 'suggestion' },
        ])
      } else {
        setComments([
          { team_id: null, message: '분석 결과: 전체적으로 스킬 커버리지가 양호합니다. SPOF 스킬 보유자의 팀 배치를 확인해 주세요.', type: 'suggestion' },
        ])
      }
    } finally {
      setCommentLoading(false)
    }
  }

  if (!placementResult) return null

  const overallCoverage = visibleTeams.map((t) => placementResult.scores?.coverage?.[t.id] ?? 0)
  const avgCoverage = overallCoverage.length ? overallCoverage.reduce((a, b) => a + b, 0) / overallCoverage.length : 0

  const getMemberById = (id) => members.find((m) => m.id === id)
  const getSkillById = (id) => skills.find((s) => s.id === id)

  const getTeamCoverage = (team, pl = activePlacement) => {
    const memberIds = pl[team.id] || []
    if (!team.requiredSkills.length) return 1
    const covered = team.requiredSkills.filter((sid) =>
      memberIds.some((mid) => (skillMatrix[mid]?.[sid] ?? 0) > 0)
    ).length
    return covered / team.requiredSkills.length
  }

  const getRadarData = (teamId, pl = activePlacement) => {
    const memberIds = pl[teamId] || []
    return skills.slice(0, 8).map((s) => ({
      skill: s.name.slice(0, 6),
      value: memberIds.length ? memberIds.reduce((acc, mid) => acc + (skillMatrix[mid]?.[s.id] ?? 0), 0) / memberIds.length : 0,
    }))
  }

  // 재배치: 구성원 이동 감지 (before → new)
  const getMovedMembers = (teamId) => {
    if (!isReplacement) return { added: [], removed: [] }
    const before = new Set(beforePlacement[teamId] || [])
    const after = new Set(placement[teamId] || [])
    return {
      added: [...after].filter((id) => !before.has(id)),
      removed: [...before].filter((id) => !after.has(id)),
    }
  }

  const exportCSV = () => {
    const rows = [['팀', '구성원', '직위', ...(isReplacement ? ['변경여부'] : [])]]
    for (const team of visibleTeams) {
      const memberIds = placement[team.id] || []
      const { added, removed } = getMovedMembers(team.id)
      for (const mid of memberIds) {
        const m = getMemberById(mid)
        if (!m) continue
        const change = added.includes(mid) ? '신규배치' : '유지'
        rows.push([team.name, m.name, m.role, ...(isReplacement ? [change] : [])])
      }
      if (isReplacement) {
        for (const mid of removed) {
          const m = getMemberById(mid)
          if (m) rows.push([team.name, m.name, m.role, '차출됨'])
        }
      }
    }
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'teamfit_result.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const selectedTeamData = visibleTeams.find((t) => t.id === selectedTeam)

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar currentStep={4} />

      {/* Summary bar */}
      <div className="bg-canvas-dark text-on-dark px-8 py-4 flex items-center gap-8 flex-wrap">
        {isReplacement && <Badge variant="periwinkle">재배치</Badge>}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-body uppercase tracking-wider">전체 커버리지</span>
          <span className="text-2xl font-mono font-medium gradient-brand">{Math.round(avgCoverage * 100)}%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-body uppercase tracking-wider">조건 충족률</span>
          <span className="text-2xl font-mono font-medium text-on-dark">
            {Math.round((placementResult.scores?.conditionFulfillment || 0) * 100)}%
          </span>
        </div>
        {placementResult.warnings?.length > 0 && (
          <div className="flex items-center gap-2">
            {placementResult.warnings.map((w, i) => (
              <Badge key={i} variant="red">⚠ {w.message}</Badge>
            ))}
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportCSV}>CSV 내보내기</Button>
          <Button variant="mint" size="sm" onClick={() => { setCurrentStep(5); navigate('/step/5') }}>수동 조정하기</Button>
        </div>
      </div>

      <div className="flex-1 flex gap-0">
        {/* Team list sidebar */}
        <div className="w-56 border-r border-[rgba(0,0,0,0.08)] flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
            <span className="text-xs font-mono text-body uppercase tracking-wider">팀 목록</span>
          </div>
          {visibleTeams.map((team) => {
            const cov = getTeamCoverage(team)
            const { added, removed } = getMovedMembers(team.id)
            const hasChange = added.length > 0 || removed.length > 0
            return (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team.id)}
                className={`px-4 py-3 text-left border-b border-[rgba(0,0,0,0.04)] hover:bg-[#f9fafb] transition-colors ${selectedTeam === team.id ? 'bg-[#f3f4f6] border-l-2 border-l-ink' : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="text-sm font-medium text-ink">{team.name}</div>
                  {isReplacement && hasChange && <span className="text-[10px] text-accent-periwinkle font-mono">변경</span>}
                </div>
                {team.taskName && <div className="text-xs text-body truncate">{team.taskName}</div>}
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[#e5e7eb] rounded-full">
                    <div className="h-full bg-ink rounded-full" style={{ width: `${cov * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono text-body">{Math.round(cov * 100)}%</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Main panel */}
        <div className="flex-1 p-6 overflow-auto">
          {selectedTeamData && (
            <div className="max-w-2xl">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-medium text-ink">{selectedTeamData.name}</h2>
                  {selectedTeamData.taskName && <p className="text-sm text-body mt-0.5">{selectedTeamData.taskName}</p>}
                </div>
                <Badge variant={getTeamCoverage(selectedTeamData) >= 0.8 ? 'mint' : getTeamCoverage(selectedTeamData) >= 0.5 ? 'periwinkle' : 'red'}>
                  커버리지 {Math.round(getTeamCoverage(selectedTeamData) * 100)}%
                </Badge>
              </div>

              {/* 재배치: 변경 전/후 탭 — 메인 패널 내부 */}
              {isReplacement && (
                <div className="flex items-center gap-0 border-b border-[rgba(0,0,0,0.08)] mb-5">
                  {[
                    { id: 'before', label: '변경 전' },
                    { id: 'new', label: '변경 후' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setCompareView(tab.id)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                        compareView === tab.id ? 'border-primary text-primary' : 'border-transparent text-body hover:text-ink'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                  {compareView === 'new' && (() => {
                    const { added, removed } = getMovedMembers(selectedTeam)
                    if (!added.length && !removed.length) return null
                    return (
                      <div className="ml-auto flex items-center gap-3 text-xs pb-2">
                        {added.length > 0 && <span className="text-[#3A7D44]">↑ 합류 {added.length}명</span>}
                        {removed.length > 0 && <span className="text-accent-orange">↓ 차출 {removed.length}명</span>}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* 재배치: 변경 전/후 비교 — 구성원 변동 */}
              {isReplacement && compareView === 'new' && (() => {
                const { added, removed } = getMovedMembers(selectedTeam)
                if (!added.length && !removed.length) return null
                return (
                  <div className="mb-6 p-4 bg-[#f0f9ff] border border-accent-periwinkle/30 rounded-md">
                    <p className="text-xs font-mono text-body uppercase tracking-wider mb-3">구성원 변동</p>
                    <div className="space-y-1">
                      {added.map((mid) => {
                        const m = getMemberById(mid)
                        return m ? (
                          <div key={mid} className="flex items-center gap-2 text-sm">
                            <span className="text-[#059669] font-mono w-4">↑</span>
                            <span className="font-medium">{m.name}</span>
                            <span className="text-body text-xs">합류 ({currentAssignment[mid]?.currentTeamId ? `${currentAssignment[mid].currentTeamId}에서 이동` : '잉여 인력'})</span>
                          </div>
                        ) : null
                      })}
                      {removed.map((mid) => {
                        const m = getMemberById(mid)
                        return m ? (
                          <div key={mid} className="flex items-center gap-2 text-sm">
                            <span className="text-accent-orange font-mono w-4">↓</span>
                            <span className="font-medium">{m.name}</span>
                            <span className="text-body text-xs">차출됨</span>
                          </div>
                        ) : null
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Members */}
              <div className="mb-6">
                <h3 className="text-xs font-mono text-body uppercase tracking-wider mb-3">
                  구성원 {compareView === 'before' ? '(기존)' : '(재배치 후)'}
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {(activePlacement[selectedTeam] || []).map((mid) => {
                    const m = getMemberById(mid)
                    if (!m) return null
                    const type = analysisResult?.memberTypes?.[mid] || 'generalist'
                    const { added } = getMovedMembers(selectedTeam)
                    const isNew = isReplacement && compareView === 'new' && added.includes(mid)
                    const topSkills = getTopSkills(mid, skillMatrix, skills, 6)
                    return (
                      <button
                        key={mid}
                        onClick={() => setPopupMember(m)}
                        className={`flex items-center gap-3 p-3 border rounded-sm text-left w-full hover:bg-surface transition-colors cursor-pointer ${isNew ? 'border-[#3A7D44]/30 bg-[#f0fdf4]' : 'border-[rgba(0,0,0,0.08)]'}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-canvas-dark text-on-dark flex items-center justify-center text-xs font-mono font-medium shrink-0">
                          {m.name.slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium">{m.name}</span>
                            {isNew && <span className="text-[10px] text-[#3A7D44] font-mono">NEW</span>}
                            <span className="text-xs text-body">{m.role}</span>
                            <Badge variant={TYPE_COLORS[type]}>{TYPE_LABELS[type]}</Badge>
                          </div>
                        </div>
                        {topSkills.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-end max-w-[180px] shrink-0">
                            {topSkills.map((s) => (
                              <span
                                key={s.id}
                                className="text-[10px] font-mono px-1.5 py-0.5 bg-[#f3f4f6] text-body rounded-sm border border-[rgba(0,0,0,0.06)] whitespace-nowrap"
                              >
                                {s.name} <span className="text-ink">{s.level}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Skill coverage */}
              <div className="mb-6">
                <h3 className="text-xs font-mono text-body uppercase tracking-wider mb-3">필수 스킬 커버리지</h3>

                {/* 재배치 전/후 커버리지 비교 */}
                {isReplacement && selectedTeamData.requiredSkills.length > 0 && (
                  <div className="mb-3 flex items-center gap-6 text-xs">
                    <span className="text-body">
                      기존: <strong className="text-ink">{Math.round(getTeamCoverage(selectedTeamData, beforePlacement) * 100)}%</strong>
                    </span>
                    <span className="text-body">→</span>
                    <span className="text-body">
                      재배치 후: <strong className={getTeamCoverage(selectedTeamData, placement) >= getTeamCoverage(selectedTeamData, beforePlacement) ? 'text-[#059669]' : 'text-accent-orange'}>
                        {Math.round(getTeamCoverage(selectedTeamData, placement) * 100)}%
                      </strong>
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  {selectedTeamData.requiredSkills.map((sid) => {
                    const skill = getSkillById(sid)
                    if (!skill) return null
                    const memberIds = activePlacement[selectedTeam] || []
                    const maxLevel = Math.max(0, ...memberIds.map((mid) => skillMatrix[mid]?.[sid] ?? 0))
                    const covered = maxLevel > 0
                    return (
                      <div key={sid} className="flex items-center gap-3">
                        <span className="text-sm w-24 truncate">{skill.name}</span>
                        <div className="flex-1 h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${covered ? 'bg-ink' : 'bg-[#dc2626]'}`} style={{ width: covered ? `${(maxLevel / 5) * 100}%` : '100%', opacity: covered ? 1 : 0.3 }} />
                        </div>
                        <span className="text-xs font-mono text-body w-12 text-right">
                          {covered ? `Lv.${maxLevel}` : '미달'}
                        </span>
                        {!covered && <Badge variant="red">미충족</Badge>}
                      </div>
                    )
                  })}
                  {selectedTeamData.requiredSkills.length === 0 && (
                    <p className="text-sm text-body">필수 스킬 없음</p>
                  )}
                </div>
              </div>

              {/* Radar chart — 재배치: 전/후 오버레이 */}
              {skills.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-mono text-body uppercase tracking-wider mb-3">팀 스킬 레이더</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={getRadarData(selectedTeam, activePlacement)}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                      <Radar name="현재" dataKey="value" stroke="#000" fill="#000" fillOpacity={0.1} />
                      {isReplacement && compareView === 'new' && (
                        <Radar
                          name="기존"
                          dataKey="before"
                          data={getRadarData(selectedTeam, beforePlacement).map((d, i) => ({
                            ...getRadarData(selectedTeam, activePlacement)[i],
                            before: d.value,
                          }))}
                          stroke="#C9A96E"
                          fill="#C9A96E"
                          fillOpacity={0.1}
                          strokeDasharray="4 2"
                        />
                      )}
                    </RadarChart>
                  </ResponsiveContainer>
                  {isReplacement && compareView === 'new' && (
                    <div className="flex gap-4 text-xs text-body mt-1 justify-center">
                      <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-ink inline-block" /> 재배치 후</span>
                      <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-accent-periwinkle inline-block border-dashed border-t border-accent-periwinkle" /> 기존</span>
                    </div>
                  )}
                </div>
              )}

              {/* SPOF warnings */}
              {analysisResult?.spofSkills?.some((sid) => selectedTeamData.requiredSkills.includes(sid)) && (
                <div className="p-4 bg-[#FDF0E8] border border-[#E8632A]/20 rounded-md text-sm text-accent-orange">
                  ⚡ 이 팀에 SPOF 스킬이 포함되어 있습니다. 해당 구성원 이탈 시 팀 기능에 영향이 있을 수 있습니다.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side panel: AI comments */}
        <div className="w-72 border-l border-[rgba(0,0,0,0.08)] flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-2">
            <span className="text-xs font-mono text-body uppercase tracking-wider">AI 코멘트</span>
            {commentLoading && <div className="w-3 h-3 border border-body border-t-transparent rounded-full animate-spin" />}
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {comments.map((c, i) => (
              <div key={i} className={`p-3 rounded-sm text-sm border ${
                c.type === 'risk' ? 'bg-[#FDF0E8] border-[#E8632A]/20 text-[#7A2A0F]' :
                c.type === 'positive' ? 'bg-[#e8fafb] border-accent-mint/40 text-[#1a5c5e]' :
                'bg-[#f9fafb] border-[rgba(0,0,0,0.08)] text-ink'
              }`}>
                {c.team_id && <div className="text-xs font-mono text-body mb-1">{teams.find((t) => t.id === c.team_id)?.name}</div>}
                {c.message}
              </div>
            ))}
            {commentLoading && (
              <div className="p-3 bg-[#f9fafb] border border-[rgba(0,0,0,0.08)] rounded-sm text-sm text-body animate-pulse">
                Claude가 분석 중입니다...
              </div>
            )}
          </div>
        </div>
      </div>

      {popupMember && (
        <MemberPopup
          member={popupMember}
          skills={skills}
          skillMatrix={skillMatrix}
          memberType={analysisResult?.memberTypes?.[popupMember.id]}
          onClose={() => setPopupMember(null)}
        />
      )}
    </div>
  )
}
