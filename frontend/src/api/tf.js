const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const mockTFResult = {
  tf_members: [],
  skill_coverage: {},
  team_impact: {},
  warnings: [],
}

export function buildMockTFResult({ members, skills, skillMatrix, currentAssignment, currentTeams, tfRequiredSkills, tfSize, minSkillLevel = 2.8 }) {
  // TF 구성: tfRequiredSkills 보유자를 추출 가능한 인원 중에서 선발
  const tfMemberIds = []
  const skillCoverage = {}
  const teamImpact = {}

  // 스킬별 보유자 파악
  for (const sid of tfRequiredSkills) {
    const holders = members.filter((m) => (skillMatrix[m.id]?.[sid] ?? 0) > 0).map((m) => m.id)
    skillCoverage[sid] = {
      required: true,
      holders,
      fulfilled: holders.length > 0,
    }
  }

  // 팀별 스킬 현황 → 차출 가능 여부 판단
  const teamMemberMap = {}
  for (const [mid, teamId] of Object.entries(currentAssignment)) {
    if (!teamMemberMap[teamId]) teamMemberMap[teamId] = []
    teamMemberMap[teamId].push(mid)
  }

  const extractedSet = new Set()
  const targetSize = tfSize ?? tfRequiredSkills.length ?? 1

  // 스킬 보유자 우선 선발
  for (const sid of tfRequiredSkills) {
    if (extractedSet.size >= targetSize) break
    const { holders } = skillCoverage[sid]
    for (const mid of holders) {
      if (extractedSet.has(mid)) continue
      const teamId = currentAssignment[mid]
      if (!teamId) { extractedSet.add(mid); tfMemberIds.push(mid); break }

      const teamMembers = teamMemberMap[teamId] || []
      const remaining = teamMembers.filter((id) => id !== mid && !extractedSet.has(id))
      const stillCovered = remaining.some((id) => (skillMatrix[id]?.[sid] ?? 0) > 0)

      if (stillCovered) {
        extractedSet.add(mid)
        tfMemberIds.push(mid)
        if (!teamImpact[teamId]) {
          const team = currentTeams.find((t) => t.id === teamId)
          const before = {}
          const after = {}
          for (const s of (team?.requiredSkills ?? [])) {
            const allInTeam = teamMembers.map((id) => skillMatrix[id]?.[s] ?? 0)
            const remainingLevels = remaining.map((id) => skillMatrix[id]?.[s] ?? 0)
            before[s] = allInTeam.length ? allInTeam.reduce((a, b) => a + b, 0) / allInTeam.length : 0
            after[s] = remainingLevels.length ? remainingLevels.reduce((a, b) => a + b, 0) / remainingLevels.length : 0
          }
          teamImpact[teamId] = { extracted: [], before, after, safe: true }
        }
        teamImpact[teamId].extracted.push(mid)
        break
      }
    }
  }

  // 목표 인원 미달 시 나머지 차출 가능 인원에서 추가 선발
  if (extractedSet.size < targetSize) {
    for (const m of members) {
      if (extractedSet.size >= targetSize) break
      if (extractedSet.has(m.id)) continue
      const teamId = currentAssignment[m.id]
      if (!teamId) { extractedSet.add(m.id); tfMemberIds.push(m.id); continue }

      const teamMembers = teamMemberMap[teamId] || []
      const remaining = teamMembers.filter((id) => id !== m.id && !extractedSet.has(id))
      // 팀에 최소 1명 남아야 차출 가능
      if (remaining.length === 0) continue

      extractedSet.add(m.id)
      tfMemberIds.push(m.id)
      if (!teamImpact[teamId]) {
        teamImpact[teamId] = { extracted: [], before: {}, after: {}, safe: true }
      }
      teamImpact[teamId].extracted.push(m.id)
    }
  }

  // 경고: 미충족 스킬
  const warnings = []
  for (const [sid, info] of Object.entries(skillCoverage)) {
    if (!info.fulfilled) {
      const skill = skills?.find((s) => s.id === sid)
      warnings.push({ type: 'spof', message: `"${skill?.name ?? sid}" 스킬 보유자가 없습니다.` })
    }
  }

  // 차출 후 팀 안전 여부 검증
  for (const [teamId, impact] of Object.entries(teamImpact)) {
    const team = currentTeams.find((t) => t.id === teamId)
    for (const sid of team?.requiredSkills ?? []) {
      if ((impact.after[sid] ?? 0) < minSkillLevel) {
        impact.safe = false
        warnings.push({
          type: 'team_risk',
          message: `${impact.extracted.join(', ')} 차출 시 ${teamId}팀의 "${sid}" 평균 레벨이 ${impact.after[sid]?.toFixed(1)}로 기준 미달.`,
        })
      }
    }
  }

  return {
    tf_members: tfMemberIds,
    skill_coverage: skillCoverage,
    team_impact: teamImpact,
    warnings,
  }
}

export async function composeTF(payload) {
  const res = await fetch(`${BASE_URL}/api/tf-compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`TF 구성 API 오류: ${res.status}`)
  return res.json()
}
