import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import useStore from '../store/useStore'
import { buildMockTFResult } from '../api/tf'
import { getComment } from '../api/index'

const TYPE_LABELS = { specialist: '전문가형', t_shaped: 'T자형', generalist: '제너럴리스트형' }
const TYPE_COLORS = { specialist: 'orange', t_shaped: 'periwinkle', generalist: 'mint' }

export default function TFDashboard() {
  const navigate = useNavigate()
  const {
    members, skills, skillMatrix, currentTeams, currentAssignment,
    tfId, tfName, tfProject, tfRequiredSkills,
    analysisResult, setCurrentStep,
    tfResult: storedTfResult,
  } = useStore()

  const [tfResult, setTfResult] = useState(null)
  const [comments, setComments] = useState([])
  const [commentLoading, setCommentLoading] = useState(false)

  useEffect(() => {
    // 백엔드 결과가 store에 있으면 그걸 사용, 없으면 mock fallback
    const result = storedTfResult
      || buildMockTFResult({ members, skills, skillMatrix, currentAssignment, currentTeams, tfRequiredSkills })
    setTfResult(result)
    loadComments(result)
  }, [storedTfResult])

  const loadComments = async (result) => {
    setCommentLoading(true)
    try {
      const res = await getComment({ placement_summary: result, warnings: result?.warnings || [] })
      setComments(res.comments || [])
    } catch {
      setComments([
        { team_id: null, message: `TF "${tfName}" 구성 결과: ${result?.tf_members?.length ?? 0}명이 선발되었습니다. SPOF 스킬 보유자의 원팀 공백 여부를 반드시 확인하세요.`, type: 'suggestion' },
      ])
    } finally {
      setCommentLoading(false)
    }
  }

  const exportCSV = () => {
    if (!tfResult) return
    const rows = [['구성원ID', '이름', '역할', '원팀']]
    for (const mid of tfResult.tf_members) {
      const m = members.find((m) => m.id === mid)
      const teamId = typeof currentAssignment[mid] === 'string' ? currentAssignment[mid] : currentAssignment[mid]?.currentTeamId
      rows.push([mid, m?.name ?? mid, m?.role ?? '', teamId ?? ''])
    }
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${tfName}_구성결과.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (!tfResult) return null

  const coverageRate = tfRequiredSkills.length > 0
    ? tfRequiredSkills.filter((sid) => tfResult.skill_coverage[sid]?.fulfilled).length / tfRequiredSkills.length
    : 1

  const allTeamsSafe = Object.values(tfResult.team_impact).every((t) => t.safe)

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar currentStep={4} />

      {/* 상단 요약 바 */}
      <div className="bg-canvas-dark text-on-dark px-8 py-4 flex items-center gap-8 flex-wrap">
        <Badge variant="orange">TF 구성</Badge>
        <div>
          <div className="text-xs font-mono text-body uppercase tracking-wider">TF명</div>
          <div className="text-lg font-medium">{tfName}</div>
        </div>
        {tfProject && (
          <div>
            <div className="text-xs font-mono text-body uppercase tracking-wider">과제</div>
            <div className="text-base">{tfProject}</div>
          </div>
        )}
        <div>
          <div className="text-xs font-mono text-body uppercase tracking-wider">TF 인원</div>
          <div className="text-2xl font-mono font-medium gradient-brand">{tfResult.tf_members.length}명</div>
        </div>
        <div>
          <div className="text-xs font-mono text-body uppercase tracking-wider">스킬 커버리지</div>
          <div className="text-2xl font-mono font-medium text-on-dark">{Math.round(coverageRate * 100)}%</div>
        </div>
        <div>
          <div className="text-xs font-mono text-body uppercase tracking-wider">기존 팀 공백</div>
          <Badge variant={allTeamsSafe ? 'mint' : 'red'}>{allTeamsSafe ? '없음' : '발생'}</Badge>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportCSV}>CSV 내보내기</Button>
        </div>
      </div>

      <div className="flex-1 flex gap-0">
        {/* Main: TF 구성 결과 */}
        <div className="flex-1 p-6 overflow-auto space-y-6">

          {/* TF 구성원 카드 */}
          <section>
            <h2 className="text-xs font-mono text-body uppercase tracking-wider mb-3">TF 선발 인원</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {tfResult.tf_members.map((mid) => {
                const m = members.find((m) => m.id === mid)
                if (!m) return null
                const type = analysisResult?.memberTypes?.[m.id] || 'generalist'
                const teamId = typeof currentAssignment[mid] === 'string' ? currentAssignment[mid] : currentAssignment[mid]?.currentTeamId
                const originTeam = currentTeams.find((t) => t.id === teamId)
                return (
                  <div key={mid} className="flex items-center gap-3 p-3 border border-[rgba(0,0,0,0.08)] rounded-sm">
                    <div className="w-9 h-9 rounded-full bg-accent-orange text-canvas flex items-center justify-center text-xs font-mono font-medium">
                      {m.name.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-body">{m.role}</span>
                        {originTeam && <span className="text-[10px] text-body font-mono">({originTeam.name})</span>}
                      </div>
                      <Badge variant={TYPE_COLORS[type]}>{TYPE_LABELS[type]}</Badge>
                    </div>
                  </div>
                )
              })}
              {tfResult.tf_members.length === 0 && (
                <p className="col-span-3 text-sm text-body">차출 가능한 인원이 없습니다. 스킬 보유자와 기존 팀 공백 조건을 확인해주세요.</p>
              )}
            </div>
          </section>

          {/* 스킬 커버리지 테이블 */}
          <section>
            <h2 className="text-xs font-mono text-body uppercase tracking-wider mb-3">TF 필수 스킬 커버리지</h2>
            <div className="grid grid-cols-2 gap-2">
              {tfRequiredSkills.map((sid) => {
                const skill = skills.find((s) => s.id === sid)
                const cov = tfResult.skill_coverage[sid]
                const holderNames = (cov?.holders ?? []).map((mid) => members.find((m) => m.id === mid)?.name ?? mid)
                const count = holderNames.length
                const preview = holderNames.slice(0, 2).join(', ')
                const more = count > 2 ? ` 외 ${count - 2}명` : ''
                return (
                  <div key={sid} className={`flex items-start justify-between p-3 border rounded-sm gap-2 ${cov?.fulfilled ? 'border-[rgba(0,0,0,0.08)]' : 'border-[#dc2626]/20 bg-[#fff5f5]'}`}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{skill?.name ?? sid}</div>
                      <div className="text-xs text-body mt-0.5">
                        {count > 0
                          ? <span>{preview}{more}</span>
                          : <span className="text-[#dc2626]">보유자 없음</span>
                        }
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={cov?.fulfilled ? 'mint' : 'red'}>
                        {cov?.fulfilled ? '충족' : '미충족'}
                      </Badge>
                      <span className="text-xs font-mono text-body">{count}명</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* 기존 팀 영향도 */}
          {Object.keys(tfResult.team_impact).length > 0 && (
            <section>
              <h2 className="text-xs font-mono text-body uppercase tracking-wider mb-3">기존 팀 영향도 (차출 전/후)</h2>
              <div className="space-y-5">
                {Object.entries(tfResult.team_impact).map(([teamId, impact]) => {
                  const team = currentTeams.find((t) => t.id === teamId)

                  // 전체 팀원 / 차출된 인원 / 잔류 인원
                  const allInTeam = members.filter((m) => {
                    const tid = typeof currentAssignment[m.id] === 'string'
                      ? currentAssignment[m.id]
                      : currentAssignment[m.id]?.currentTeamId
                    return tid === teamId
                  })
                  const extractedSet = new Set(impact.extracted)
                  const remaining = allInTeam.filter((m) => !extractedSet.has(m.id))
                  const extracted = allInTeam.filter((m) => extractedSet.has(m.id))

                  // 성비 / 직급 계산
                  const isFemale = (m) => ['여','f','female'].includes((m.gender||'').toLowerCase())
                  const ROLE_W = { '부장':5,'차장':4,'과장':3,'대리':2,'사원':1,'팀장급':5,'중간급':3,'주니어':1 }
                  const rankOf = (m) => ROLE_W[m.role] ?? 3

                  const femBefore = allInTeam.length > 0 ? allInTeam.filter(isFemale).length / allInTeam.length : 0
                  const femAfter  = remaining.length  > 0 ? remaining.filter(isFemale).length  / remaining.length  : 0
                  const rkBefore  = allInTeam.length > 0 ? allInTeam.reduce((s,m)=>s+rankOf(m),0)/allInTeam.length : 0
                  const rkAfter   = remaining.length  > 0 ? remaining.reduce((s,m)=>s+rankOf(m),0)/remaining.length  : 0

                  // 차출 인원이 보유한 TF 필수 스킬
                  const tfSkillsOf = (m) => tfRequiredSkills.filter((sid) => (skillMatrix[m.id]?.[sid] ?? 0) > 0)

                  const accent = impact.safe ? '#2ECC87' : '#FFABB5'

                  return (
                    <div key={teamId} className="border border-[rgba(0,0,0,0.08)] rounded-lg overflow-hidden bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                      style={{ borderLeft: `3px solid ${accent}` }}>

                      {/* 헤더 */}
                      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-hairline">
                        <span className="text-base font-bold font-mono text-ink tracking-tight">{teamId}</span>
                        {team?.name && team.name !== teamId && (
                          <span className="text-sm text-body">{team.name}</span>
                        )}
                        <Badge variant={impact.safe ? 'mint' : 'red'}>{impact.safe ? '✓ 공백 없음' : '⚠ 공백 발생'}</Badge>
                        <div className="ml-auto flex items-center gap-1.5 text-sm">
                          <span className="font-mono font-medium text-ink">{allInTeam.length}</span>
                          <span className="text-body text-xs">명</span>
                          <span className="text-body mx-1">→</span>
                          <span className="font-mono font-medium text-ink">{remaining.length}</span>
                          <span className="text-body text-xs">명</span>
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-accent-coral-tint text-accent-coral-dark text-xs font-medium">
                            {extracted.length}명 차출
                          </span>
                        </div>
                      </div>

                      {/* 차출된 인원 */}
                      <div className="px-5 py-4 bg-accent-coral-tint/30">
                        <p className="flex items-center gap-1.5 text-[11px] font-mono text-accent-coral-dark uppercase tracking-wider mb-2.5">
                          <span className="text-sm">↗</span> TF로 차출된 인원
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {extracted.map((m) => {
                            const heldSkills = tfSkillsOf(m)
                            return (
                              <div key={m.id} className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 bg-surface border border-accent-coral/30 rounded-full">
                                <div className="w-7 h-7 rounded-full bg-accent-coral text-surface flex items-center justify-center text-[11px] font-mono font-semibold shrink-0">
                                  {m.name?.slice(0, 2)}
                                </div>
                                <div className="leading-tight">
                                  <div className="text-xs font-medium text-ink">
                                    {m.name} <span className="text-body font-normal">{m.role}</span>
                                  </div>
                                  {heldSkills.length > 0 && (
                                    <div className="text-[10px] text-accent-coral-dark font-mono">
                                      {heldSkills.map((sid) => skills.find((s) => s.id === sid)?.name ?? sid).join(' · ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          {extracted.length === 0 && <span className="text-xs text-body">차출 인원 없음</span>}
                        </div>
                      </div>

                      <div className="px-5 py-4 grid grid-cols-5 gap-5">
                        {/* 잔류 인원 + 구성 변화 */}
                        <div className="col-span-2">
                          <p className="text-[11px] font-mono text-body uppercase tracking-wider mb-2">잔류 인원 ({remaining.length}명)</p>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {remaining.map((m) => (
                              <span key={m.id} className="inline-flex items-center text-[11px] px-2 py-0.5 bg-muted rounded-sm text-ink">
                                {m.name}<span className="text-body ml-1">{m.role}</span>
                              </span>
                            ))}
                            {remaining.length === 0 && <span className="text-xs text-[#dc2626]">잔류 인원 없음</span>}
                          </div>
                          <div className="space-y-1.5 pt-2 border-t border-hairline">
                            <StatRow label="여성 비율"
                              before={`${Math.round(femBefore*100)}%`} after={`${Math.round(femAfter*100)}%`}
                              changed={Math.abs(femAfter - femBefore) > 0.1} />
                            <StatRow label="평균 직급"
                              before={rkBefore.toFixed(1)} after={rkAfter.toFixed(1)}
                              changed={Math.abs(rkAfter - rkBefore) > 0.5} />
                          </div>
                        </div>

                        {/* 스킬 평균 변화 */}
                        <div className="col-span-3">
                          <p className="text-[11px] font-mono text-body uppercase tracking-wider mb-2">필수 스킬 평균 레벨 변화</p>
                          <div className="space-y-2">
                            {Object.entries(impact.before).map(([sid, beforeVal]) => {
                              const afterVal = impact.after[sid] ?? 0
                              const skillName = skills.find((s) => s.id === sid)?.name ?? sid
                              const dropped = afterVal < 2.8
                              const delta = afterVal - beforeVal
                              return (
                                <div key={sid} className="flex items-center gap-3 text-xs">
                                  <span className="w-24 truncate text-ink">{skillName}</span>
                                  {/* 미니 막대 (5점 만점) */}
                                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative">
                                    <div className="absolute inset-y-0 left-0 bg-muted-dark/40 rounded-full" style={{ width: `${Math.min(beforeVal/5*100,100)}%` }} />
                                    <div className={`absolute inset-y-0 left-0 rounded-full ${dropped ? 'bg-[#dc2626]' : 'bg-primary'}`} style={{ width: `${Math.min(afterVal/5*100,100)}%` }} />
                                  </div>
                                  <span className="font-mono text-body w-7 text-right">{beforeVal.toFixed(1)}</span>
                                  <span className="text-body">→</span>
                                  <span className={`font-mono font-semibold w-7 ${dropped ? 'text-[#dc2626]' : 'text-ink'}`}>{afterVal.toFixed(1)}</span>
                                  <span className={`w-12 text-[10px] ${delta < 0 ? 'text-accent-coral-dark' : 'text-body'}`}>
                                    {delta !== 0 && `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
                                  </span>
                                  {dropped && <span className="text-[10px] text-[#dc2626] font-medium whitespace-nowrap">미달</span>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

        </div>

        {/* Side: AI 코멘트 */}
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
                {c.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// 차출 전/후 구성 통계 한 줄 (여성비율, 평균직급 등)
function StatRow({ label, before, after, changed }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-body">{label}</span>
      <div className="flex items-center gap-1.5 font-mono">
        <span className="text-body">{before}</span>
        <span className="text-body">→</span>
        <span className={`font-medium ${changed ? 'text-accent-coral-dark' : 'text-ink'}`}>{after}</span>
      </div>
    </div>
  )
}
