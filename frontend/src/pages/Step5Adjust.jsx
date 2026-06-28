import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import useStore from '../store/useStore'
import { mockPlacementResult } from '../api/mock'

export default function Step5Adjust() {
  const navigate = useNavigate()
  const {
    placementResult,
    adjustedPlacement, setAdjustedPlacement,
    undoAdjustment, resetAdjustment,
    history,
    skillMatrix,
    skills,
    teams,
  } = useStore()

  const base = placementResult || mockPlacementResult
  const [board, setBoard] = useState(adjustedPlacement || base.placement || {})
  const [search, setSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState(null) // mid
  const [highlightMid, setHighlightMid] = useState(null)

  useEffect(() => {
    setBoard(adjustedPlacement || base.placement || {})
  }, [adjustedPlacement, base.placement])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSelectedMember(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // placementResult에 memberNames가 있으면 우선 사용, 없으면 members store에서 생성
  const memberNames = base.memberNames
    || Object.fromEntries((useStore.getState().members || []).map(m => [m.id, m.name || m.id]))
  const teamNames = base.teamNames || {}
  // TF 플로우에서 allTeams를 넘긴 경우 그것을 사용, 없으면 teams store
  const effectiveTeams = base.allTeams || teams || []
  const skillNameMap = (skills || []).reduce((acc, s) => { acc[s.id] = s.name; return acc }, {})

  // 현재 보드 기준으로 구성원이 속한 팀 ID
  const memberTeamMap = {}
  Object.entries(board).forEach(([tid, mids]) => mids.forEach(mid => { memberTeamMap[mid] = tid }))

  // 배정 근거 스킬: 현재 팀 필수 스킬 중 본인이 보유한 것 (최대 3개)
  const getReasonSkills = (mid, n = 3) => {
    const tid = memberTeamMap[mid]
    const teamInfo = effectiveTeams.find(t => t.id === tid)
    const required = teamInfo?.requiredSkills || []
    return required
      .filter(sid => (skillMatrix?.[mid]?.[sid] ?? 0) > 0)
      .map(sid => ({ id: sid, name: skillNameMap[sid] || sid, level: skillMatrix[mid][sid] }))
      .sort((a, b) => b.level - a.level)
      .slice(0, n)
  }

  // 보유 스킬 전체 (레벨 내림차순)
  const getAllSkills = (mid) =>
    Object.entries(skillMatrix?.[mid] ?? {})
      .filter(([, lv]) => lv > 0)
      .map(([sid, lv]) => ({ id: sid, name: skillNameMap[sid] || sid, level: lv }))
      .sort((a, b) => b.level - a.level)

  const allMemberIds = Object.values(board).flat()

  // 이름/사번/스킬명 검색 — 빈 쿼리면 빈 배열
  const q = search.trim().toLowerCase()
  const searchResults = !q ? [] : allMemberIds.filter(mid => {
    const name = (memberNames[mid] || mid).toLowerCase()
    if (name.includes(q)) return true
    const memberSkills = Object.entries(skillMatrix?.[mid] ?? {})
      .filter(([, lv]) => lv > 0)
      .map(([sid]) => (skillNameMap[sid] || sid).toLowerCase())
    return memberSkills.some(sn => sn.includes(q))
  })

  const onDragEnd = (result) => {
    if (!result.destination) return
    const { source, destination, draggableId } = result
    if (source.droppableId === destination.droppableId) return

    const newBoard = JSON.parse(JSON.stringify(board))
    Object.keys(newBoard).forEach(tid => {
      newBoard[tid] = newBoard[tid].filter(mid => mid !== draggableId)
    })
    if (!newBoard[destination.droppableId]) newBoard[destination.droppableId] = []
    newBoard[destination.droppableId].splice(destination.index, 0, draggableId)

    // 원팀 필수 스킬 커버 해제 여부 검증
    const srcTeamInfo = effectiveTeams.find(t => t.id === source.droppableId)
    const srcRequired = srcTeamInfo?.requiredSkills || []
    const uncoveredSkills = srcRequired.filter(sid =>
      !newBoard[source.droppableId].some(mid => (skillMatrix?.[mid]?.[sid] ?? 0) > 0)
    )

    if (uncoveredSkills.length > 0) {
      const srcTeamName = teamNames[source.droppableId] || source.droppableId
      const skillLabels = uncoveredSkills.map(sid => skillNameMap[sid] || sid).join(', ')
      const ok = window.confirm(
        `⚠️ 이동을 차단합니다.\n\n${srcTeamName}의 필수 스킬 [${skillLabels}] 보유자가 없어집니다.\n\n그래도 이동하시겠습니까?`
      )
      if (!ok) return
    }

    setBoard(newBoard)
  }

  const handleApply = () => {
    const hasEmpty = Object.values(board).some(members => members.length === 0)
    if (hasEmpty) {
      const ok = window.confirm('일부 팀에 구성원이 없습니다. 계속하시겠습니까?')
      if (!ok) return
    }
    setAdjustedPlacement(board)
  }

  const handleUndo = () => {
    undoAdjustment()
    setBoard(adjustedPlacement || base.placement || {})
  }

  const handleReset = () => {
    resetAdjustment()
    setBoard(base.placement || {})
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar currentStep={5} />
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 69px)', marginTop: '69px' }}>

          {/* 왼쪽 사이드바: 검색 패널 */}
          <aside className="w-[260px] border-r border-hairline bg-surface flex flex-col shrink-0">
            <div className="p-3 border-b border-hairline space-y-2">
              <input
                placeholder="이름 · 사번 · 스킬명 검색"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full border border-hairline rounded-sm px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-primary"
              />
              {q && (
                <p className="text-[10px] text-body">{searchResults.length}명 검색됨</p>
              )}
            </div>

            {/* 검색 결과 — 드래그 불가, 클릭으로 세부정보 확인 */}
            <div className="flex-1 overflow-auto">
              {!q ? (
                <div className="p-4 text-center text-xs text-body mt-8">
                  이름, 사번 또는 스킬명을 입력하세요
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-body mt-8">검색 결과 없음</div>
              ) : (
                <div className="p-2 space-y-1.5">
                  {searchResults.map(mid => {
                    const reasonSkills = getReasonSkills(mid, 3)
                    const tid = memberTeamMap[mid]
                    const tName = tid ? (teamNames[tid] || tid) : '미배정'
                    return (
                      <button
                        key={mid}
                        className="w-full text-left p-2.5 border border-hairline rounded-md bg-surface hover:bg-muted/50 transition-colors"
                        onClick={() => setHighlightMid(mid)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm text-ink">{memberNames[mid] || mid}</span>
                          <span className="text-[10px] text-body bg-muted px-1.5 py-0.5 rounded-sm">{tName}</span>
                        </div>
                        {reasonSkills.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {reasonSkills.map(s => (
                              <span key={s.id} className="px-1.5 py-0.5 bg-primary-tint border border-primary/20 rounded-sm text-[10px] text-primary-dark">
                                {s.name} <span className="font-medium">Lv{s.level}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-body">팀 필수 스킬 없음</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* 오른쪽 팀 배치 보드 */}
          <main className="flex-1 flex flex-col overflow-hidden" onClick={() => highlightMid && setHighlightMid(null)}>
            {/* 상단 고정 액션 바 */}
            <div className="flex items-center justify-between bg-surface border-b border-hairline px-4 py-2.5 shrink-0">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate('/step/4')}>
                  ← 결과로 돌아가기
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  알고리즘 결과로 초기화
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleUndo} disabled={!history || history.length === 0}>
                  Undo
                </Button>
                <Button size="sm" onClick={handleApply}>변경사항 적용</Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3">
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                {Object.entries(board).map(([teamId, memberIds]) => (
                  <TeamDropZone
                    key={teamId}
                    teamId={teamId}
                    memberIds={memberIds}
                    teamNames={teamNames}
                    skillMatrix={skillMatrix}
                    skillNameMap={skillNameMap}
                    teams={effectiveTeams}
                    memberNames={memberNames}
                    getReasonSkills={getReasonSkills}
                    onSelectMember={setSelectedMember}
                    highlightMid={highlightMid}
                    onHighlightDone={() => setHighlightMid(null)}
                  />
                ))}
              </div>
            </div>
          </main>
        </div>
      </DragDropContext>

      {/* 구성원 세부정보 팝업 */}
      {selectedMember && (
        <MemberDetailPopup
          memberId={selectedMember}
          teamId={memberTeamMap[selectedMember]}
          memberNames={memberNames}
          teamNames={teamNames}
          skillMatrix={skillMatrix}
          skills={skills}
          teams={teams}
          board={board}
          skillNameMap={skillNameMap}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  )
}

function TeamDropZone({ teamId, memberIds, teamNames, skillMatrix, skillNameMap, teams, memberNames, getReasonSkills, onSelectMember, highlightMid, onHighlightDone }) {
  const [open, setOpen] = useState(true)
  const isHighlightTarget = highlightMid && memberIds.includes(highlightMid)

  useEffect(() => {
    if (!isHighlightTarget) return
    setOpen(true)
    const el = document.getElementById(`member-card-${highlightMid}`)
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    } else {
      onHighlightDone()
    }
  }, [highlightMid])

  const teamInfo = (teams || []).find(t => t.id === teamId)
  const requiredSkills = teamInfo?.requiredSkills || []
  const coveredCount = requiredSkills.filter(sid =>
    memberIds.some(mid => (skillMatrix?.[mid]?.[sid] ?? 0) > 0)
  ).length

  return (
    <Droppable droppableId={teamId}>
      {(provided, snap) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`border-2 rounded-md flex flex-col transition-colors ${snap.isDraggingOver ? 'border-primary bg-primary-tint' : 'border-hairline bg-surface'}`}
        >
          {/* 헤더 — 항상 표시 */}
          <button
            className="flex items-center justify-between px-2.5 py-2 hover:bg-muted/40 transition-colors text-left w-full"
            onClick={() => setOpen(o => !o)}
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold text-ink truncate">{teamNames[teamId] || teamId}</div>
              <div className="text-[10px] text-body">{memberIds.length}명{requiredSkills.length > 0 ? ` · 스킬 ${coveredCount}/${requiredSkills.length}` : ''}</div>
            </div>
            <span className="text-[10px] text-body ml-1 shrink-0">{open ? '▲' : '▼'}</span>
          </button>

          {/* 접히는 바디 */}
          {open && (
            <div className="px-2 pb-2 border-t border-hairline">
              {/* 필수 스킬 */}
              {requiredSkills.length > 0 && (
                <div className="flex flex-wrap gap-0.5 pt-2 pb-2 border-b border-hairline mb-1.5">
                  {requiredSkills.map(sid => {
                    const covered = memberIds.some(mid => (skillMatrix?.[mid]?.[sid] ?? 0) > 0)
                    return (
                      <span
                        key={sid}
                        className={`px-1 py-0.5 rounded-sm text-[9px] border leading-tight ${
                          covered
                            ? 'bg-primary-tint border-primary/20 text-primary-dark'
                            : 'bg-accent-coral-tint border-accent-coral/20 text-accent-coral-dark'
                        }`}
                      >
                        {skillNameMap[sid] || sid}
                      </span>
                    )
                  })}
                </div>
              )}

              {/* 구성원 목록 */}
              <div className="space-y-1">
                {[...memberIds].sort((a, b) => (memberNames[a] || a).localeCompare(memberNames[b] || b, 'ko')).map((mid, i) => {
                  const reasonSkills = getReasonSkills(mid, 2)
                  return (
                    <Draggable key={mid} draggableId={mid} index={i}>
                      {(p, snap) => (
                        <div
                          id={`member-card-${mid}`}
                          ref={p.innerRef}
                          {...p.draggableProps}
                          {...p.dragHandleProps}
                          className={`px-2 py-1.5 rounded-sm border cursor-grab transition-colors ${snap.isDragging ? 'border-primary bg-primary-tint shadow-md' : highlightMid === mid ? 'border-primary bg-primary-tint' : 'border-hairline bg-canvas'}`}
                          onClick={() => onSelectMember(mid)}
                        >
                          <div className="text-[11px] font-medium text-ink leading-tight">{memberNames[mid] || mid}</div>
                          {reasonSkills.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 mt-0.5">
                              {reasonSkills.map(s => (
                                <span key={s.id} className="px-1 py-0.5 bg-muted border border-hairline rounded-sm text-[9px] text-body leading-tight">
                                  {s.name} <span className="text-primary-dark font-medium">Lv{s.level}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  )
                })}
              </div>
              {provided.placeholder}
            </div>
          )}

          {/* 닫힌 상태에서도 placeholder 필요 */}
          {!open && <div style={{ display: 'none' }}>{provided.placeholder}</div>}
        </div>
      )}
    </Droppable>
  )
}

function MemberDetailPopup({ memberId, teamId, memberNames, teamNames, skillMatrix, skills, teams, board, skillNameMap, onClose }) {
  const name = memberNames[memberId] || memberId
  const tName = teamId ? (teamNames[teamId] || teamId) : '미배정'
  const teamInfo = (teams || []).find(t => t.id === teamId)
  const requiredSkills = teamInfo?.requiredSkills || []
  const teamMemberIds = board[teamId] || []

  const allSkills = Object.entries(skillMatrix?.[memberId] ?? {})
    .filter(([, lv]) => lv > 0)
    .map(([sid, lv]) => ({ id: sid, name: skillNameMap[sid] || sid, level: lv }))
    .sort((a, b) => b.level - a.level)

  const covers = requiredSkills.filter(sid => (skillMatrix?.[memberId]?.[sid] ?? 0) > 0)
  const misses = requiredSkills.filter(sid => (skillMatrix?.[memberId]?.[sid] ?? 0) === 0)
  const uniqueContribs = requiredSkills.filter(sid => {
    const myLv = skillMatrix?.[memberId]?.[sid] ?? 0
    if (myLv === 0) return false
    return teamMemberIds.filter(mid => mid !== memberId && (skillMatrix?.[mid]?.[sid] ?? 0) > 0).length === 0
  })

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
            <div className="text-xs text-body">{name || memberId} · {tName}</div>
          </div>
          <button onClick={onClose} className="text-body hover:text-ink text-xl leading-none px-1">×</button>
        </div>

        <div className="flex-1 overflow-auto">
          {/* 배정 근거 */}
          {requiredSkills.length > 0 && (
            <div className="px-6 py-4 border-b border-hairline space-y-3">
              <p className="text-xs font-mono text-body uppercase tracking-wider">이 팀에 배정된 근거</p>

              {covers.length > 0 && (
                <div>
                  <p className="text-[10px] text-primary-dark font-mono mb-1.5">내가 커버하는 팀 필수 스킬</p>
                  <div className="flex flex-wrap gap-1">
                    {covers.map(sid => {
                      const lv = skillMatrix?.[memberId]?.[sid] ?? 0
                      const isUnique = uniqueContribs.includes(sid)
                      return (
                        <span key={sid} className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] border ${isUnique ? 'bg-accent-yellow-tint border-accent-yellow/40 text-accent-yellow-dark' : 'bg-primary-tint border-primary/20 text-primary-dark'}`}>
                          {isUnique ? '★' : '✓'} {skillNameMap[sid] || sid} <span className="font-medium">Lv{lv}</span>
                        </span>
                      )
                    })}
                  </div>
                  {uniqueContribs.length > 0 && (
                    <p className="text-[10px] text-accent-yellow-dark mt-1.5">★ 팀 내 유일 보유 — 핵심 기여자</p>
                  )}
                </div>
              )}

              {misses.length > 0 && (
                <div>
                  <p className="text-[10px] text-body font-mono mb-1.5">미보유 팀 필수 스킬</p>
                  <div className="flex flex-wrap gap-1">
                    {misses.map(sid => (
                      <span key={sid} className="px-2 py-0.5 bg-muted border border-hairline rounded-sm text-[10px] text-body">
                        {skillNameMap[sid] || sid}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-body leading-relaxed bg-muted px-3 py-2 rounded-sm">
                {covers.length === requiredSkills.length
                  ? `팀 필수 스킬 ${requiredSkills.length}개를 모두 보유합니다.`
                  : `팀 필수 스킬 ${requiredSkills.length}개 중 ${covers.length}개 보유${uniqueContribs.length > 0 ? ` · ${uniqueContribs.length}개는 팀 내 유일` : ''}`
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
