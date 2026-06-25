/**
 * 신규배치 불가 상황 감지
 * Returns: { errors: string[], warnings: string[] }
 *   errors  → 배치 자체를 막아야 하는 상황
 *   warnings → 경고만 (배치는 허용)
 */
export function validateNewPlacement({ members, skills, teams, skillMatrix, placementMode }) {
  const errors = []
  const warnings = []

  if (!members.length || !teams.length) return { errors, warnings }

  const totalRequired = teams.reduce((acc, t) => acc + t.size, 0)

  // 인원 부족
  if (totalRequired > members.length) {
    errors.push(
      `팀 인원수 합계(${totalRequired}명)가 전체 구성원 수(${members.length}명)를 초과합니다. 팀 수·인원을 줄이거나 구성원을 추가해주세요.`
    )
  }

  // 스킬 보유자 수 vs 요구 팀 수
  for (const skill of skills) {
    const holderCount = members.filter((m) => (skillMatrix[m.id]?.[skill.id] ?? 0) > 0).length
    const demandTeams = teams.filter((t) => t.requiredSkills.includes(skill.id))

    if (demandTeams.length === 0) continue

    // 모든 팀이 해당 스킬을 필수로 요구하는데 보유자가 팀 수보다 적을 때
    if (holderCount < demandTeams.length && holderCount > 0) {
      warnings.push(
        `"${skill.name}" 스킬 보유자가 ${holderCount}명뿐인데 ${demandTeams.length}개 팀이 필수로 요구합니다. 선택 조건으로 변경하거나 보유자를 추가해주세요.`
      )
    }

    // 보유자가 아예 없는데 필수 스킬로 지정된 경우
    if (holderCount === 0) {
      errors.push(
        `"${skill.name}" 스킬 보유자가 없습니다. 필수 스킬에서 제거하거나 해당 스킬 보유자를 추가해주세요.`
      )
    }
  }

  // 조건 충돌: 팀 균등 배분 시 나누어 떨어지지 않는 경우 (정보 제공)
  if (totalRequired < members.length) {
    warnings.push(
      `배치되지 않는 구성원이 ${members.length - totalRequired}명 발생합니다.`
    )
  }

  return { errors, warnings }
}

/**
 * 재배치 차출 불가 상황 감지
 * Returns: { errors, warnings, extractable, blocked }
 *   extractable: 차출 가능한 구성원 ID 목록
 *   blocked: { memberId, reason }[] — 차출 불가 인원과 사유
 */
export function validateReplacement({ members, skills, skillMatrix, teams, currentAssignment, replacementScenario }) {
  const errors = []
  const warnings = []
  const extractable = []
  const blocked = []

  if (!members.length) return { errors, warnings, extractable, blocked }

  // 재배치 대상 인원 목록
  const targets = members.filter((m) => currentAssignment[m.id]?.isTarget)

  if (targets.length === 0) {
    errors.push('재배치 대상(재배치대상여부=Y)으로 지정된 구성원이 없습니다.')
    return { errors, warnings, extractable, blocked }
  }

  // 현재 소속팀 기준으로 SPOF 체크
  // — 해당 팀에서 유일하게 보유한 스킬이 있는 인원은 차출 시 팀 기능 손상
  for (const target of targets) {
    const currentTeamId = currentAssignment[target.id]?.currentTeamId
    if (!currentTeamId) {
      // 소속팀 없음 = 잉여 인력, 즉시 차출 가능
      extractable.push(target.id)
      continue
    }

    const teamMemberIds = members
      .filter((m) => currentAssignment[m.id]?.currentTeamId === currentTeamId && m.id !== target.id)
      .map((m) => m.id)

    // 해당 팀에서 target만 보유한 스킬 목록
    const soloSkills = skills.filter((s) => {
      const targetLevel = skillMatrix[target.id]?.[s.id] ?? 0
      if (targetLevel === 0) return false
      const othersHave = teamMemberIds.some((mid) => (skillMatrix[mid]?.[s.id] ?? 0) > 0)
      return !othersHave
    })

    if (soloSkills.length > 0) {
      blocked.push({
        memberId: target.id,
        memberName: target.name,
        currentTeamId,
        reason: `차출 시 "${soloSkills.map((s) => s.name).join(', ')}" 스킬이 현재 팀에서 공백이 됩니다 (SPOF).`,
        soloSkills: soloSkills.map((s) => s.id),
      })
      warnings.push(
        `${target.name}: 차출 시 현재 팀의 "${soloSkills.map((s) => s.name).join(', ')}" 스킬 공백 발생.`
      )
    } else {
      extractable.push(target.id)
    }
  }

  if (extractable.length === 0 && targets.length > 0) {
    warnings.push('재배치 대상 전원이 현재 팀에서 SPOF 역할을 합니다. 즉시 차출 가능한 인원이 없습니다.')
  }

  return { errors, warnings, extractable, blocked }
}
