import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import useStore from '../store/useStore'
import { buildMockTFResult } from '../api/tf'

const PIE_COLORS = ['#4D9EED', '#4DC2A8', '#FABF4B', '#485671', '#f87171', '#a78bfa']

export default function TFDashboard() {
  const navigate = useNavigate()
  const {
    members, skills, skillMatrix, currentTeams, currentAssignment,
    tfId, tfName, tfProject, tfRequiredSkills, conditions,
    analysisResult, setCurrentStep, setPlacementResult,
    tfResult: storedTfResult,
  } = useStore()

  const [tfResult, setTfResult] = useState(null)
  const [showUnsafeOnly, setShowUnsafeOnly] = useState(false)
  const [remainingPopup, setRemainingPopup] = useState(null) // { teamId, members }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setRemainingPopup(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const result = storedTfResult
      || buildMockTFResult({ members, skills, skillMatrix, currentAssignment, currentTeams, tfRequiredSkills, minSkillLevel: conditions?.minSkillLevel ?? 2.8 })
    setTfResult(result)
  }, [storedTfResult])

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
    <>
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar currentStep={4} />

      {/* 상단 요약 바 */}
      <div className="bg-canvas-dark text-on-dark px-8 py-4 flex items-center gap-8 flex-wrap" style={{ marginTop: '69px' }}>
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
          <Button variant="ghost" size="sm" onClick={() => {
            const tfTeamId = tfId || 'tf'
            const extractedSet = new Set(tfResult.tf_members)

            // 기존 팀별 잔류 인원 (차출된 인원 제외)
            const teamMemberMap = {}
            for (const m of members) {
              const tid = typeof currentAssignment[m.id] === 'string'
                ? currentAssignment[m.id]
                : currentAssignment[m.id]?.currentTeamId
              if (!tid) continue
              if (!teamMemberMap[tid]) teamMemberMap[tid] = []
              if (!extractedSet.has(m.id)) teamMemberMap[tid].push(m.id)
            }

            const placement = { [tfTeamId]: tfResult.tf_members, ...teamMemberMap }

            const teamNames = Object.fromEntries(
              (currentTeams || []).map(t => [t.id, t.name || t.id])
            )
            teamNames[tfTeamId] = tfName || 'TF'

            const memberNames = Object.fromEntries(members.map(m => [m.id, m.name || m.id]))

            // TF 팀 필수 스킬 정보도 teams에 포함시켜 커버리지 계산 가능하게
            const allTeamsForStep5 = [
              ...(currentTeams || []),
              { id: tfTeamId, name: tfName || 'TF', requiredSkills: tfRequiredSkills || [] },
            ]

            setPlacementResult({
              placement,
              teamNames,
              memberNames,
              allTeams: allTeamsForStep5,
              scores: tfResult.scores || {},
              warnings: tfResult.warnings || [],
            })
            setCurrentStep(5)
            navigate('/step/5')
          }}>수동 조정하기</Button>
          <Button variant="ghost" size="sm" onClick={exportCSV}>CSV 내보내기</Button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto space-y-6">

        {/* TF 선발 인원 + 분포 */}
        <section className="grid grid-cols-5 gap-6">
          {/* 선발 인원 카드 (3칸) */}
          <div className="col-span-3">
            <h2 className="text-xs font-mono text-body uppercase tracking-wider mb-3">
              TF 선발 인원 <span className="ml-1 text-ink font-semibold">{tfResult.tf_members.length}명</span>
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {tfResult.tf_members.map((mid) => {
                const m = members.find((m) => m.id === mid)
                if (!m) return null
                const teamId = typeof currentAssignment[mid] === 'string' ? currentAssignment[mid] : currentAssignment[mid]?.currentTeamId
                const originTeam = currentTeams.find((t) => t.id === teamId)
                const topSkills = tfRequiredSkills
                  .filter(sid => (skillMatrix[mid]?.[sid] ?? 0) > 0)
                  .sort((a, b) => (skillMatrix[mid]?.[b] ?? 0) - (skillMatrix[mid]?.[a] ?? 0))
                  .slice(0, 3)
                return (
                  <div key={mid} className="flex flex-col gap-2 p-3.5 border border-hairline rounded-lg bg-surface hover:border-primary/40 transition-colors">
                    <div>
                      <div className="text-sm font-bold text-ink">{m.name || m.id}</div>
                      {m.role && <div className="text-xs text-body mt-0.5">{m.role}</div>}
                      {originTeam && (
                        <div className="text-[11px] text-body font-mono mt-0.5 truncate">
                          ← {(originTeam.taskName && originTeam.taskName !== '') ? originTeam.taskName : (originTeam.name || teamId)}
                        </div>
                      )}
                    </div>
                    {topSkills.length > 0 && (
                      <div className="flex flex-col gap-1 pt-1.5 border-t border-hairline">
                        {topSkills.map(sid => (
                          <div key={sid} className="flex items-center justify-between gap-1">
                            <span className="text-[11px] text-ink truncate">{skills.find(s => s.id === sid)?.name ?? sid}</span>
                            <span className="text-[11px] font-mono font-semibold text-primary shrink-0">Lv{skillMatrix[mid]?.[sid]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {tfResult.tf_members.length === 0 && (
                <p className="col-span-4 text-sm text-body py-4">차출 가능한 인원이 없습니다.</p>
              )}
            </div>
          </div>

          {/* 분포 패널 (2칸) */}
          <div className="col-span-2">
            <h2 className="text-xs font-mono text-body uppercase tracking-wider mb-3">TF 구성 분포</h2>
            <TFDistributionPanel memberIds={tfResult.tf_members} members={members} skills={skills} skillMatrix={skillMatrix} tfRequiredSkills={tfRequiredSkills} />
          </div>
        </section>

        {/* 기존 팀 영향도 */}
        {Object.keys(tfResult.team_impact).length > 0 && (
          <section>
            <div className="flex items-center gap-4 mb-3">
              <h2 className="text-xs font-mono text-body uppercase tracking-wider">기존 팀 영향도 (차출 전/후)</h2>
              <label className="flex items-center gap-1.5 text-xs text-body cursor-pointer select-none">
                <input type="checkbox" checked={showUnsafeOnly} onChange={e => setShowUnsafeOnly(e.target.checked)}
                  className="w-3.5 h-3.5" style={{ accentColor: '#4D9EED' }} />
                공백 있는 팀만 보기
              </label>
            </div>
            <div className="space-y-5">
              {Object.entries(tfResult.team_impact)
                .filter(([, impact]) => !showUnsafeOnly || !impact.safe)
                .map(([teamId, impact]) => {
                const team = currentTeams.find((t) => t.id === teamId)

                const allInTeam = members.filter((m) => {
                  const tid = typeof currentAssignment[m.id] === 'string'
                    ? currentAssignment[m.id]
                    : currentAssignment[m.id]?.currentTeamId
                  return tid === teamId
                })
                const extractedSet = new Set(impact.extracted)
                const remaining = allInTeam.filter((m) => !extractedSet.has(m.id))
                const extracted = allInTeam.filter((m) => extractedSet.has(m.id))

                const tfSkillsOf = (m) => tfRequiredSkills.filter((sid) => (skillMatrix[m.id]?.[sid] ?? 0) > 0)
                const accent = impact.safe ? '#2ECC87' : '#FFABB5'

                return (
                  <div key={teamId} className="rounded-lg overflow-hidden bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                    style={{ border: `1.5px solid ${accent}` }}>

                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-hairline">
                      <span className="text-base font-bold text-ink tracking-tight">
                        {(team?.taskName && team.taskName !== '') ? team.taskName : (team?.name || teamId)}
                      </span>
                      <Badge variant={impact.safe ? 'mint' : 'red'}>{impact.safe ? '✓ 공백 없음' : '⚠ 공백 발생'}</Badge>
                      <button
                        onClick={() => setRemainingPopup({ teamId, teamName: team?.name || teamId, members: remaining })}
                        className="text-xs px-2.5 py-1 rounded border border-hairline text-body hover:text-ink hover:border-primary/40 transition-colors"
                      >
                        잔류 멤버 보기 ({remaining.length}명)
                      </button>
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
                                {(m.name || m.id)?.slice(0, 2)}
                              </div>
                              <div className="leading-tight">
                                <div className="text-xs font-medium text-ink">
                                  {m.name || m.id} <span className="text-body font-normal">{m.role}</span>
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

                    <div className="px-5 py-4 grid grid-cols-5 gap-6">
                      {/* 필수 스킬 레벨 변화 */}
                      <div className="col-span-3">
                        <p className="text-[11px] font-mono text-body uppercase tracking-wider mb-3">필수 스킬 평균 레벨 변화</p>
                        <div className="space-y-2.5">
                          {Object.entries(impact.before).map(([sid, beforeVal]) => {
                            const afterVal = impact.after[sid] ?? 0
                            const skillName = skills.find((s) => s.id === sid)?.name ?? sid
                            const dropped = afterVal < (conditions?.minSkillLevel ?? 2.8)
                            const diff = afterVal - beforeVal
                            return (
                              <div key={sid}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-ink truncate max-w-[60%]">{skillName}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono text-sm text-body">{beforeVal.toFixed(1)}</span>
                                    <span className="text-body text-xs">→</span>
                                    <span className={`font-mono text-sm font-bold ${dropped ? 'text-[#dc2626]' : 'text-ink'}`}>{afterVal.toFixed(1)}</span>
                                    <span className={`text-xs font-mono font-medium w-10 text-right ${diff < 0 ? 'text-[#dc2626]' : 'text-teal'}`}>
                                      {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                                    </span>
                                  </div>
                                </div>
                                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="absolute inset-y-0 left-0 bg-muted-dark/30 rounded-full" style={{ width: `${Math.min(beforeVal/5*100,100)}%` }} />
                                  <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${dropped ? 'bg-[#dc2626]' : 'bg-primary'}`} style={{ width: `${Math.min(afterVal/5*100,100)}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* 성별 분포 차트 */}
                      <div className="col-span-1">
                        <p className="text-[11px] font-mono text-body uppercase tracking-wider mb-2">성별 분포</p>
                        <MiniBeforeAfterPie
                          before={makePieData(allInTeam, m => m.gender || '미입력')}
                          after={makePieData(remaining, m => m.gender || '미입력')}
                        />
                      </div>

                      {/* 직급 분포 차트 */}
                      <div className="col-span-1">
                        <p className="text-[11px] font-mono text-body uppercase tracking-wider mb-2">직급 분포</p>
                        <MiniBeforeAfterPie
                          before={makePieData(allInTeam, m => m.role || '미입력')}
                          after={makePieData(remaining, m => m.role || '미입력')}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

      </div>
    </div>
    {/* 잔류 인원 팝업 */}
    {remainingPopup && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={() => setRemainingPopup(null)}>
        <div className="bg-canvas rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
            <div>
              <div className="text-base font-semibold text-ink">{remainingPopup.teamName} — 잔류 인원</div>
              <div className="text-sm text-body">{remainingPopup.members.length}명</div>
            </div>
            <button onClick={() => setRemainingPopup(null)} className="text-body hover:text-ink text-lg px-1">×</button>
          </div>
          <div className="overflow-auto p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-mono text-body uppercase tracking-wider border-b border-hairline">
                  <th className="text-left pb-2 font-normal">이름</th>
                  <th className="text-left pb-2 font-normal">직위</th>
                  <th className="text-left pb-2 font-normal">성별</th>
                  <th className="text-left pb-2 font-normal">보유 스킬 (상위 4개)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {remainingPopup.members.map(m => {
                  const topSkills = Object.entries(skillMatrix[m.id] || {})
                    .filter(([, lv]) => lv > 0)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 4)
                    .map(([sid]) => skills.find(s => s.id === sid)?.name ?? sid)
                  return (
                    <tr key={m.id} className="hover:bg-muted/40">
                      <td className="py-2 font-medium text-ink">{m.name || m.id}</td>
                      <td className="py-2 text-body">{m.role || '-'}</td>
                      <td className="py-2 text-body">{m.gender || '-'}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {topSkills.map(s => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary-dark rounded-sm">{s}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

function TFDistributionPanel({ memberIds, members, skills, skillMatrix, tfRequiredSkills }) {
  const roleCounts = {}
  const genderCounts = {}
  memberIds.forEach(mid => {
    const m = members.find(m => m.id === mid)
    if (!m) return
    if (m.role) roleCounts[m.role] = (roleCounts[m.role] || 0) + 1
    if (m.gender) genderCounts[m.gender] = (genderCounts[m.gender] || 0) + 1
  })
  const roleData = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  const genderData = Object.entries(genderCounts).map(([name, value]) => ({ name, value }))

  const skillData = tfRequiredSkills.map(sid => {
    const holders = memberIds.filter(mid => (skillMatrix?.[mid]?.[sid] ?? 0) > 0)
    return { name: skills.find(s => s.id === sid)?.name ?? sid, 보유자: holders.length }
  })

  const total = memberIds.length

  return (
    <div className="w-full border border-hairline rounded-lg bg-surface p-4 space-y-5 h-full">
      {/* 필수 스킬 보유 현황 */}
      {skillData.length > 0 && (
        <div>
          <p className="text-xs font-mono text-body uppercase tracking-wider mb-2">필수 스킬 보유 현황</p>
          <div className="space-y-2">
            {skillData.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ink font-medium truncate max-w-[70%]">{d.name}</span>
                  <span className="font-mono text-body shrink-0">{d.보유자}/{total}명</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: total > 0 ? `${d.보유자/total*100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 직급 · 성별 분포 가로 배치 */}
      <div className="grid grid-cols-2 gap-4 pt-1">
        {roleData.length > 0 && (
          <div>
            <p className="text-xs font-mono text-body uppercase tracking-wider mb-2">직급 분포</p>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={roleData} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" paddingAngle={2}>
                  {roleData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v}명`, n]} contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1 mt-1">
              {roleData.map((d, i) => (
                <span key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-body truncate">{d.name}</span>
                  <span className="font-semibold text-ink ml-auto shrink-0">{d.value}명</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {genderData.length > 0 && (
          <div>
            <p className="text-xs font-mono text-body uppercase tracking-wider mb-2">성별 분포</p>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" paddingAngle={2}>
                  {genderData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v}명`, n]} contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1 mt-1">
              {genderData.map((d, i) => (
                <span key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-body truncate">{d.name}</span>
                  <span className="font-semibold text-ink ml-auto shrink-0">{d.value}명</span>
                  <span className="text-body shrink-0">({Math.round(d.value/total*100)}%)</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function makePieData(members, keyFn) {
  const counts = {}
  members.forEach(m => { const k = keyFn(m); counts[k] = (counts[k] || 0) + 1 })
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}

function MiniBeforeAfterPie({ before, after }) {
  const allKeys = [...new Set([...before.map(d => d.name), ...after.map(d => d.name)])]
  const colorMap = Object.fromEntries(allKeys.map((k, i) => [k, PIE_COLORS[i % PIE_COLORS.length]]))

  return (
    <div className="space-y-3">
      {[{ label: '차출 전', data: before }, { label: '차출 후', data: after }].map(({ label, data }) => {
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
