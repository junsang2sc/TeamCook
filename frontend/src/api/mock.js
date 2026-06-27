// Mock analysis result for frontend-first development
export function mockAnalyze({ members, skills, skillMatrix, teams, placementMode }) {
  const holderCounts = {}
  for (const skill of skills) {
    holderCounts[skill.id] = members.filter(
      (m) => (skillMatrix[m.id]?.[skill.id] ?? 0) > 0
    ).length
  }

  const totalMembers = members.length
  const rarityThresholdRare = Math.ceil(totalMembers * 0.1)
  const rarityThresholdCommon = Math.ceil(totalMembers * 0.5)

  const skillRarity = {}
  for (const skill of skills) {
    const count = holderCounts[skill.id] ?? 0
    skillRarity[skill.id] = {
      level: count <= rarityThresholdRare ? 'rare' : count >= rarityThresholdCommon ? 'common' : 'normal',
      holderCount: count,
    }
  }

  const memberTypes = {}
  for (const m of members) {
    const levels = skills.map((s) => skillMatrix[m.id]?.[s.id] ?? 0).filter((v) => v > 0)
    if (levels.length === 0) { memberTypes[m.id] = 'generalist'; continue }
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length
    const std = Math.sqrt(levels.reduce((acc, v) => acc + (v - avg) ** 2, 0) / levels.length)
    const top2avg = [...levels].sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0) / Math.min(2, levels.length)
    if (top2avg >= avg * 2) memberTypes[m.id] = 'specialist'
    else if (std < 0.8) memberTypes[m.id] = 'generalist'
    else memberTypes[m.id] = 't_shaped'
  }

  const spofSkills = skills.filter((s) => (holderCounts[s.id] ?? 0) <= 1).map((s) => s.id)

  const supplyDemand = {}
  const demandCount = placementMode === 'same' ? teams.length : 1
  for (const skill of skills) {
    const demand = teams.filter((t) => t.requiredSkills.includes(skill.id)).length
    supplyDemand[skill.id] = { demand, supply: holderCounts[skill.id] ?? 0 }
  }

  const teamDifficulty = {}
  for (const team of teams) {
    const score = team.requiredSkills.reduce((acc, sid) => {
      const rarity = skillRarity[sid]?.level
      return acc + (rarity === 'rare' ? 3 : rarity === 'normal' ? 2 : 1)
    }, 0)
    teamDifficulty[team.id] = score
  }

  return { skillRarity, memberTypes, spofSkills, supplyDemand, teamDifficulty }
}

/**
 * Mock 재배치 분석 결과
 * Returns: { extractable, blocked, currentTeamRisks, replacementScenario }
 */
export function mockReplacementAnalysis({ members, skills, skillMatrix, teams, currentAssignment, replacementScenario }) {
  const extractable = []
  const blocked = []
  const currentTeamRisks = {}

  const targets = members.filter((m) => currentAssignment[m.id]?.isTarget)

  for (const target of targets) {
    const currentTeamId = currentAssignment[target.id]?.currentTeamId
    if (!currentTeamId) {
      extractable.push(target.id)
      continue
    }

    const teamMemberIds = members
      .filter((m) => currentAssignment[m.id]?.currentTeamId === currentTeamId && m.id !== target.id)
      .map((m) => m.id)

    const soloSkills = skills.filter((s) => {
      const lvl = skillMatrix[target.id]?.[s.id] ?? 0
      if (lvl === 0) return false
      return !teamMemberIds.some((mid) => (skillMatrix[mid]?.[s.id] ?? 0) > 0)
    })

    if (soloSkills.length > 0) {
      blocked.push({ memberId: target.id, memberName: target.name, currentTeamId, soloSkills: soloSkills.map((s) => s.id), soloSkillNames: soloSkills.map((s) => s.name) })
    } else {
      extractable.push(target.id)
    }
  }

  // Assess risk for each team after extraction
  const teamIds = [...new Set(members.map((m) => currentAssignment[m.id]?.currentTeamId).filter(Boolean))]
  for (const teamId of teamIds) {
    const remaining = members.filter(
      (m) => currentAssignment[m.id]?.currentTeamId === teamId && !extractable.includes(m.id)
    )
    const extracted = members.filter(
      (m) => currentAssignment[m.id]?.currentTeamId === teamId && extractable.includes(m.id)
    )
    if (extracted.length === 0) continue

    const lostSkills = skills.filter((s) => {
      const hadBefore = members.filter((m) => currentAssignment[m.id]?.currentTeamId === teamId).some((m) => (skillMatrix[m.id]?.[s.id] ?? 0) > 0)
      const hasAfter = remaining.some((m) => (skillMatrix[m.id]?.[s.id] ?? 0) > 0)
      return hadBefore && !hasAfter
    })

    currentTeamRisks[teamId] = {
      extractedCount: extracted.length,
      lostSkills: lostSkills.map((s) => ({ id: s.id, name: s.name })),
      riskLevel: lostSkills.length === 0 ? 'low' : lostSkills.length <= 1 ? 'medium' : 'high',
    }
  }

  return { extractable, blocked, currentTeamRisks, replacementScenario }
}

export const mockAnalysis = {
  memberTypes: { specialist: 8, t_shaped: 10, generalist: 9 },
  memberTypeMap: {
    '2026-001': 'specialist', '2026-002': 't_shaped', '2026-003': 'generalist',
    '2026-004': 'specialist', '2026-005': 't_shaped', '2026-006': 'generalist',
  },
  skillRarityMap: {
    'Skill-005': { level: 'rare', holderCount: 4 },
    'Skill-012': { level: 'rare', holderCount: 1 },
    'Skill-001': { level: 'common', holderCount: 20 },
    'Skill-002': { level: 'common', holderCount: 18 },
    'Skill-003': { level: 'normal', holderCount: 10 },
    'Skill-004': { level: 'normal', holderCount: 8 },
  },
  spofSkills: ['Skill-012'],
  supplyDemand: {
    'Skill-005': { demand: 6, supply: 4, gap: 2 },
    'Skill-012': { demand: 3, supply: 1, gap: 2 },
    'Skill-001': { demand: 5, supply: 20, gap: -15 },
    'Skill-003': { demand: 8, supply: 10, gap: -2 },
  },
  existingTeamStatus: {
    'T001': { name: 'Alpha팀', coverage: 0.85, riskLevel: 'safe' },
    'T002': { name: 'Beta팀', coverage: 0.52, riskLevel: 'danger' },
    'T003': { name: 'Gamma팀', coverage: 0.71, riskLevel: 'warning' },
  },
  matchingOpportunities: {
    surplusSkills: ['Skill-001', 'Skill-003'],
    teamGapSkills: { 'T002': ['Skill-001', 'Skill-005'], 'T003': ['Skill-003'] },
    matchCount: 3,
    teamCount: 2,
  },
}

export const mockFitnessMatrix = {
  members: [
    { id: '2026-001', name: '김민준', type: 'specialist' },
    { id: '2026-002', name: '이서연', type: 't_shaped' },
    { id: '2026-003', name: '박지호', type: 'generalist' },
    { id: '2026-004', name: '최수아', type: 'specialist' },
    { id: '2026-005', name: '정도윤', type: 't_shaped' },
    { id: '2026-006', name: '강하은', type: 'generalist' },
  ],
  teams: [
    { id: 'P001', name: 'AI플랫폼' },
    { id: 'P002', name: '데이터분석' },
    { id: 'P003', name: '서비스개선' },
  ],
  scores: {
    '2026-001': { 'P001': 0.94, 'P002': 0.71, 'P003': 0.55 },
    '2026-002': { 'P001': 0.62, 'P002': 0.88, 'P003': 0.79 },
    '2026-003': { 'P001': 0.45, 'P002': 0.60, 'P003': 0.91 },
    '2026-004': { 'P001': 0.88, 'P002': 0.55, 'P003': 0.62 },
    '2026-005': { 'P001': 0.70, 'P002': 0.82, 'P003': 0.48 },
    '2026-006': { 'P001': 0.58, 'P002': 0.77, 'P003': 0.85 },
  },
}

export const mockPlacementResult = {
  placement: {
    'P001': ['2026-001', '2026-004'],
    'P002': ['2026-002', '2026-005'],
    'P003': ['2026-003', '2026-006'],
  },
  scores: {
    conditionFulfillment: 0.87,
    coverage: { 'P001': 0.92, 'P002': 0.85, 'P003': 0.78 },
  },
  warnings: [
    { type: 'spof', teamId: 'P001', message: 'P001팀 Skill-012 보유자 1명' },
  ],
  beforeCoverage: { 'P001': 0.70, 'P002': 0.65, 'P003': 0.60 },
  memberNames: {
    '2026-001': '김민준', '2026-002': '이서연', '2026-003': '박지호',
    '2026-004': '최수아', '2026-005': '정도윤', '2026-006': '강하은',
  },
  memberTypes: {
    '2026-001': 'specialist', '2026-002': 't_shaped', '2026-003': 'generalist',
    '2026-004': 'specialist', '2026-005': 't_shaped', '2026-006': 'generalist',
  },
  teamNames: { 'P001': 'AI플랫폼', 'P002': '데이터분석', 'P003': '서비스개선' },
}

// Mock placement result
export function mockPlacement({ members, skills, teams, skillMatrix, analysisResult, conditions, flowType, currentAssignment }) {
  // 재배치 모드: N 인원 고정 + 해체팀 제외 후 Y 인원 분배
  if (flowType === 'replacement' && currentAssignment && Object.keys(currentAssignment).length > 0) {
    return mockReplacementPlacement({ members, skills, teams, skillMatrix, analysisResult, currentAssignment })
  }
  return mockNewPlacement({ members, skills, teams, skillMatrix, analysisResult })
}

function mockNewPlacement({ members, skills, teams, skillMatrix, analysisResult }) {
  const shuffled = [...members].sort(() => Math.random() - 0.5)
  const placement = {}
  let idx = 0
  for (const team of teams) {
    placement[team.id] = shuffled.slice(idx, idx + team.size).map((m) => m.id)
    idx += team.size
  }
  return buildResult({ placement, teams, skillMatrix, analysisResult })
}

function mockReplacementPlacement({ members, skills, teams, skillMatrix, analysisResult, currentAssignment }) {
  // Step 1: 모든 팀을 빈 배열로 초기화
  const placement = {}
  for (const team of teams) placement[team.id] = []

  // Step 2: N 인원은 현재 소속팀에 고정 배치 (해당 팀이 Sheet3에 있을 때만)
  for (const [memberId, info] of Object.entries(currentAssignment)) {
    if (!info.isTarget && info.currentTeamId && placement[info.currentTeamId] !== undefined) {
      placement[info.currentTeamId].push(memberId)
    }
  }

  // Step 3: 해체된 팀 감지
  // — currentAssignment에서 소속 인원 전원이 Y인 팀 = 해체 팀
  const teamStats = {}
  for (const info of Object.values(currentAssignment)) {
    if (!info.currentTeamId) continue
    if (!teamStats[info.currentTeamId]) teamStats[info.currentTeamId] = { total: 0, targets: 0 }
    teamStats[info.currentTeamId].total++
    if (info.isTarget) teamStats[info.currentTeamId].targets++
  }
  const dissolvedTeamIds = new Set(
    Object.entries(teamStats)
      .filter(([, s]) => s.total > 0 && s.total === s.targets)
      .map(([id]) => id)
  )

  // Step 4: 재배치 대상(Y) 인원 목록 — 스킬 합산 내림차순 정렬(고성과자 우선)
  const targetMembers = members
    .filter((m) => currentAssignment[m.id]?.isTarget)
    .sort((a, b) => {
      const sumA = Object.values(skillMatrix[a.id] ?? {}).reduce((acc, v) => acc + v, 0)
      const sumB = Object.values(skillMatrix[b.id] ?? {}).reduce((acc, v) => acc + v, 0)
      return sumB - sumA
    })

  // Step 5: 배치 가능 팀 (해체 팀 제외), 빈 자리 기준 정렬
  const availableTeams = teams
    .filter((t) => !dissolvedTeamIds.has(t.id))
    .sort((a, b) => {
      const capA = a.size - (placement[a.id]?.length ?? 0)
      const capB = b.size - (placement[b.id]?.length ?? 0)
      return capB - capA // 빈 자리 많은 팀 우선
    })

  // Step 6: Y 인원을 available 팀에 순서대로 배치 (team.size 상한)
  let memberIdx = 0
  for (const team of availableTeams) {
    if (memberIdx >= targetMembers.length) break
    const capacity = team.size - (placement[team.id]?.length ?? 0)
    if (capacity <= 0) continue
    const toAdd = targetMembers.slice(memberIdx, memberIdx + capacity)
    placement[team.id].push(...toAdd.map((m) => m.id))
    memberIdx += toAdd.length
  }

  // 남은 인원 경고 (정원 초과로 못 넣은 경우)
  const unplacedCount = targetMembers.length - memberIdx
  const extraWarnings = unplacedCount > 0
    ? [{ type: 'capacity', teamId: null, message: `정원 초과로 ${unplacedCount}명을 배치하지 못했습니다. 팀 정원을 늘려주세요.` }]
    : []

  return buildResult({ placement, teams, skillMatrix, analysisResult, extraWarnings })
}

function buildResult({ placement, teams, skillMatrix, analysisResult, extraWarnings = [] }) {
  const coverage = {}
  for (const team of teams) {
    const memberIds = placement[team.id] || []
    if (team.requiredSkills.length === 0) { coverage[team.id] = 1; continue }
    const covered = team.requiredSkills.filter((sid) =>
      memberIds.some((mid) => (skillMatrix[mid]?.[sid] ?? 0) > 0)
    ).length
    coverage[team.id] = covered / team.requiredSkills.length
  }

  const warnings = [
    ...(analysisResult.spofSkills?.length > 0
      ? [{ type: 'spof', teamId: null, message: `${analysisResult.spofSkills.length}개 스킬이 SPOF 상태입니다.` }]
      : []),
    ...extraWarnings,
  ]

  return {
    placement,
    scores: {
      conditionFulfillment: 0.87,
      coverage,
      fitness: Object.fromEntries(teams.map((t) => [t.id, Math.random() * 0.4 + 0.6])),
    },
    warnings,
  }
}
