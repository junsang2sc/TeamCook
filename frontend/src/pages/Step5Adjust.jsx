import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import useStore from '../store/useStore'
import { recompute } from '../api/index'
import MemberPopup, { getTopSkills } from '../components/ui/MemberPopup'

const TYPE_COLORS = { specialist: 'orange', t_shaped: 'periwinkle', generalist: 'mint' }
const TYPE_LABELS = { specialist: '전문가형', t_shaped: 'T자형', generalist: '제너럴리스트형' }

export default function Step5Adjust() {
  const navigate = useNavigate()
  const {
    placementResult, analysisResult,
    members, skills, teams, skillMatrix, conditions,
    adjustedPlacement, setAdjustedPlacement, undoAdjustment, resetAdjustment, history,
    flowType, currentAssignment,
  } = useStore()

  // 해체 팀 제거
  const dissolvedTeamIds = (() => {
    if (flowType !== 'replacement') return new Set()
    const stats = {}
    for (const info of Object.values(currentAssignment || {})) {
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

  const [localPlacement, setLocalPlacement] = useState(null)
  const [pendingChanges, setPendingChanges] = useState(false)
  const [recalcResult, setRecalcResult] = useState(null)
  const [warning, setWarning] = useState(null)
  const [popupMember, setPopupMember] = useState(null)

  useEffect(() => {
    if (!placementResult) { navigate('/step/1'); return }
    const initial = adjustedPlacement || placementResult.placement
    setLocalPlacement(JSON.parse(JSON.stringify(initial)))
  }, [])

  const getMemberById = (id) => members.find((m) => m.id === id)

  const getTeamCoverage = (teamId, placement) => {
    const team = teams.find((t) => t.id === teamId)
    if (!team || !team.requiredSkills.length) return 1
    const memberIds = placement[teamId] || []
    const covered = team.requiredSkills.filter((sid) =>
      memberIds.some((mid) => (skillMatrix[mid]?.[sid] ?? 0) > 0)
    ).length
    return covered / team.requiredSkills.length
  }

  const onDragEnd = (result) => {
    if (!result.destination || !localPlacement) return
    const src = result.source.droppableId
    const dst = result.destination.droppableId
    if (src === dst) return

    const newPlacement = JSON.parse(JSON.stringify(localPlacement))
    const memberId = result.draggableId

    newPlacement[src] = (newPlacement[src] || []).filter((id) => id !== memberId)
    newPlacement[dst] = [...(newPlacement[dst] || []), memberId]

    // Check for condition violations (non-blocking warning)
    const srcCov = getTeamCoverage(src, newPlacement)
    const dstCov = getTeamCoverage(dst, newPlacement)
    if (srcCov < 0.5) {
      setWarning({ from: src, to: dst, newPlacement, message: `이동 후 ${teams.find((t) => t.id === src)?.name} 팀의 스킬 커버리지가 ${Math.round(srcCov * 100)}%로 낮아집니다. 계속하시겠습니까?` })
      return
    }

    applyMove(newPlacement)
  }

  const applyMove = (newPlacement) => {
    setLocalPlacement(newPlacement)
    setPendingChanges(true)
    setWarning(null)
  }

  const handleApply = async () => {
    setAdjustedPlacement(localPlacement)
    try {
      const payload = { adjusted_placement: localPlacement, conditions, members, skills, teams, skillMatrix }
      const res = await recompute(payload)
      setRecalcResult(res)
    } catch {
      setRecalcResult({ conditionFulfillment: null })
    }
    setPendingChanges(false)
  }

  const handleUndo = () => {
    undoAdjustment()
    setLocalPlacement(adjustedPlacement || placementResult.placement)
    setPendingChanges(false)
  }

  const handleReset = () => {
    resetAdjustment()
    setLocalPlacement(JSON.parse(JSON.stringify(placementResult.placement)))
    setPendingChanges(false)
    setRecalcResult(null)
  }

  if (!localPlacement) return null

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar currentStep={5} />

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-[rgba(0,0,0,0.08)] flex items-center gap-3 flex-wrap">
        <span className="text-sm text-body">구성원을 드래그해서 팀 간 이동하세요</span>
        <div className="ml-auto flex gap-2">
          {history.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleUndo}>↩ 실행취소</Button>
          )}
          <Button variant="outline" size="sm" onClick={handleReset}>알고리즘 결과로 초기화</Button>
          {pendingChanges && (
            <Button size="sm" onClick={handleApply}>변경사항 적용 및 재계산</Button>
          )}
          <Button variant="mint" size="sm" onClick={() => navigate('/step/4')}>← 결과 보기</Button>
        </div>
      </div>

      {/* Recalc result banner */}
      {recalcResult && recalcResult.conditionFulfillment !== null && (
        <div className="px-6 py-2 bg-[#e8fafb] border-b border-accent-mint/30 text-sm text-[#1a5c5e] flex items-center gap-2">
          ✓ 재계산 완료 — 전체 조건 충족률 변경 완료
        </div>
      )}

      {/* Warning modal */}
      {warning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-canvas rounded-md p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-base font-medium mb-2">⚠ 조건 위반 경고</h3>
            <p className="text-sm text-body mb-4">{warning.message}</p>
            <div className="flex gap-3">
              <Button variant="primary" onClick={() => applyMove(warning.newPlacement)}>계속 이동</Button>
              <Button variant="outline" onClick={() => setWarning(null)}>취소</Button>
            </div>
          </div>
        </div>
      )}

      {/* Drag and drop boards */}
      <div className="flex-1 p-6 overflow-auto">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleTeams.map((team) => {
              const memberIds = localPlacement[team.id] || []
              const cov = getTeamCoverage(team.id, localPlacement)
              return (
                <div key={team.id} className="border border-[rgba(0,0,0,0.08)] rounded-md overflow-hidden">
                  {/* Team header */}
                  <div className="px-4 py-3 bg-[#f9fafb] border-b border-[rgba(0,0,0,0.06)]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-ink">{team.name}</span>
                      <span className="text-xs font-mono text-body">{memberIds.length}명</span>
                    </div>
                    {team.taskName && <div className="text-xs text-body truncate">{team.taskName}</div>}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-[#e5e7eb] rounded-full">
                        <div className={`h-full rounded-full ${cov >= 0.8 ? 'bg-[#059669]' : cov >= 0.5 ? 'bg-accent-periwinkle' : 'bg-[#dc2626]'}`} style={{ width: `${cov * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-body">{Math.round(cov * 100)}%</span>
                    </div>
                  </div>

                  {/* Droppable area */}
                  <Droppable droppableId={team.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-32 p-3 space-y-2 transition-colors ${snapshot.isDraggingOver ? 'bg-[#f0f9ff]' : 'bg-canvas'}`}
                      >
                        {memberIds.map((mid, index) => {
                          const m = getMemberById(mid)
                          if (!m) return null
                          const type = analysisResult?.memberTypes?.[mid] || 'generalist'
                          return (
                            <Draggable key={mid} draggableId={mid} index={index}>
                              {(provided, snapshot) => {
                                const topSkills = getTopSkills(mid, skillMatrix, skills, 6)
                                return (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`p-2 rounded-xs border select-none cursor-grab active:cursor-grabbing transition-shadow ${
                                      snapshot.isDragging ? 'shadow-lg border-ink bg-canvas' : 'border-[rgba(0,0,0,0.08)] bg-[#f9fafb]'
                                    }`}
                                  >
                                    {/* 상단: 아바타 + 이름 + 유형 + 상세 버튼 */}
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-canvas-dark text-on-dark flex items-center justify-center text-[10px] font-mono font-medium shrink-0">
                                        {m.name.slice(0, 2)}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs font-medium truncate">{m.name}</div>
                                        <Badge variant={TYPE_COLORS[type]}>{TYPE_LABELS[type]}</Badge>
                                      </div>
                                      <button
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={(e) => { e.stopPropagation(); setPopupMember(m) }}
                                        className="text-[10px] text-body hover:text-ink cursor-pointer shrink-0 px-1"
                                        title="상세 보기"
                                      >
                                        ⓘ
                                      </button>
                                    </div>
                                    {/* 하단: 스킬 태그 */}
                                    {topSkills.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {topSkills.map((s) => (
                                          <span
                                            key={s.id}
                                            className="text-[9px] font-mono px-1 py-0.5 bg-canvas border border-[rgba(0,0,0,0.08)] text-body rounded-sm whitespace-nowrap"
                                          >
                                            {s.name} <span className="text-ink">{s.level}</span>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              }}
                            </Draggable>
                          )
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </DragDropContext>

        {/* History panel */}
        {history.length > 0 && (
          <div className="mt-6 border border-[rgba(0,0,0,0.08)] rounded-md p-4">
            <h3 className="text-xs font-mono text-body uppercase tracking-wider mb-3">변경 히스토리</h3>
            <p className="text-sm text-body">{history.length}개의 이전 상태가 저장되어 있습니다.</p>
          </div>
        )}
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
