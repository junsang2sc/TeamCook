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
  } = useStore()

  const [tfResult, setTfResult] = useState(null)
  const [comments, setComments] = useState([])
  const [commentLoading, setCommentLoading] = useState(false)

  useEffect(() => {
    const result = buildMockTFResult({ members, skills, skillMatrix, currentAssignment, currentTeams, tfRequiredSkills })
    setTfResult(result)
    loadComments(result)
  }, [])

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
            <div className="space-y-2">
              {tfRequiredSkills.map((sid) => {
                const skill = skills.find((s) => s.id === sid)
                const cov = tfResult.skill_coverage[sid]
                const holders = (cov?.holders ?? []).map((mid) => members.find((m) => m.id === mid)?.name ?? mid)
                return (
                  <div key={sid} className="flex items-center gap-3 p-3 border border-[rgba(0,0,0,0.08)] rounded-sm">
                    <span className="text-sm font-medium w-32 truncate">{skill?.name ?? sid}</span>
                    <div className="flex-1 flex flex-wrap gap-1">
                      {holders.map((name) => (
                        <Badge key={name} variant="mint">{name}</Badge>
                      ))}
                      {holders.length === 0 && <span className="text-xs text-[#dc2626]">보유자 없음</span>}
                    </div>
                    <Badge variant={cov?.fulfilled ? 'mint' : 'red'}>
                      {cov?.fulfilled ? '충족' : '미충족'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </section>

          {/* 기존 팀 영향도 */}
          {Object.keys(tfResult.team_impact).length > 0 && (
            <section>
              <h2 className="text-xs font-mono text-body uppercase tracking-wider mb-3">기존 팀 영향도 (차출 전/후)</h2>
              <div className="space-y-3">
                {Object.entries(tfResult.team_impact).map(([teamId, impact]) => {
                  const team = currentTeams.find((t) => t.id === teamId)
                  return (
                    <div key={teamId} className={`p-4 border rounded-md ${impact.safe ? 'border-[rgba(0,0,0,0.08)]' : 'border-[#E8632A]/30 bg-[#FDF0E8]'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-medium">{team?.name ?? teamId}</span>
                        <Badge variant={impact.safe ? 'mint' : 'red'}>{impact.safe ? '안전' : '공백 발생'}</Badge>
                        <span className="text-xs text-body">{impact.extracted.length}명 차출</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(impact.before).map(([sid, beforeVal]) => {
                          const afterVal = impact.after[sid] ?? 0
                          const skillName = skills.find((s) => s.id === sid)?.name ?? sid
                          const dropped = afterVal < 2.8
                          return (
                            <div key={sid} className="text-xs">
                              <span className="text-body">{skillName}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono">{beforeVal.toFixed(1)}</span>
                                <span className="text-body">→</span>
                                <span className={`font-mono font-medium ${dropped ? 'text-[#dc2626]' : 'text-ink'}`}>{afterVal.toFixed(1)}</span>
                                {dropped && <span className="text-[#dc2626]">기준 미달</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* 경고 */}
          {tfResult.warnings.length > 0 && (
            <section>
              <div className="p-4 bg-[#FDF0E8] border border-[#E8632A]/20 rounded-md space-y-1">
                {tfResult.warnings.map((w, i) => (
                  <p key={i} className="text-sm text-accent-orange">⚠ {w.message}</p>
                ))}
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
