import * as XLSX from 'xlsx'

// ── 공통 유틸 ──────────────────────────────────────────────────
function normalizeHeader(h) {
  return String(h ?? '').trim().replace(/\s*\*$/, '').trim()
}

// headerRowIndex: 0-based row index of header row
function sheetToRows(ws, headerRowIndex) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const headers = (raw[headerRowIndex] ?? []).map(normalizeHeader)
  return raw
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((v) => v !== ''))
    .map((row) => {
      const obj = {}
      headers.forEach((h, i) => { if (h) obj[h] = row[i] ?? '' })
      return obj
    })
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = () => reject(new Error('파일 읽기에 실패했습니다.'))
    reader.readAsArrayBuffer(file)
  })
}

const PLACEMENT_MODE_MAP = { '동일과제': 'same', '다른과제': 'different', '혼합': 'mixed' }

// ── 구성원_정보 시트 파싱 (공통) ────────────────────────────────
// 구조: R1 타이틀, R2 주의사항, R3 안내, R4 헤더, R5+ 데이터
// 컬럼: 사번, 성 (Last), 이름 (First), 성별, 직위, 직책, 연차, 나이
function parseMemberInfo(ws) {
  const rows = sheetToRows(ws, 3) // R4 = index 3
  const members = []
  const errors = []
  const seenIds = new Set()

  for (const row of rows) {
    const memberId = String(row['사번'] ?? '').trim()
    if (!memberId) continue
    if (seenIds.has(memberId)) {
      errors.push(`사번 중복: "${memberId}"`)
      continue
    }
    seenIds.add(memberId)

    const lastName = String(row['성 (Last)'] ?? row['성'] ?? '').trim()
    const firstName = String(row['이름 (First)'] ?? row['이름'] ?? '').trim()
    const fullName = (lastName + firstName).trim() || memberId

    members.push({
      id: memberId,
      name: fullName,
      role: String(row['직위'] ?? '').trim() || '중간급',
      position: String(row['직책'] ?? '').trim(),
      experience: row['연차'] !== '' ? Number(row['연차']) : null,
      age: row['나이'] !== '' ? Number(row['나이']) : null,
      gender: String(row['성별'] ?? '').trim(),
    })
  }

  return { members, errors }
}

// ── Skill 역량 점수 시트 파싱 (공통, long format) ──────────────
// 구조: R1 타이틀, R2 주의사항, R3 안내, R4 헤더, R5+ 데이터
// 컬럼: 사번, 성명, 소속팀명, 소속과제코드, 스킬ID, 기술 레벨 (Score)
function parseSkillScores(ws) {
  const rows = sheetToRows(ws, 3) // R4 = index 3
  const skillMatrix = {}   // { memberId: { skillId: level } }
  const skillIds = new Set()
  const errors = []
  const warnings = []

  for (const row of rows) {
    const memberId = String(row['사번'] ?? '').trim()
    const skillId = String(row['스킬ID'] ?? '').trim()
    const levelRaw = row['기술 레벨 (Score)'] ?? row['기술 레벨'] ?? row['Score'] ?? ''

    if (!memberId || !skillId) continue

    const level = levelRaw === '' ? 0 : Number(levelRaw)
    if (isNaN(level) || level < 0 || level > 5) {
      warnings.push(`스킬 레벨 범위 오류: ${memberId} / ${skillId} = ${levelRaw}`)
      continue
    }

    if (!skillMatrix[memberId]) skillMatrix[memberId] = {}
    skillMatrix[memberId][skillId] = Math.round(level)
    skillIds.add(skillId)
  }

  return { skillMatrix, skillIds: [...skillIds], errors, warnings }
}

// ── 스킬_목록 시트 파싱 (공통) ─────────────────────────────────
// 구조: R1 타이틀, R2 주의사항, R3 안내, R4 헤더, R5+ 데이터
// 컬럼: 스킬ID, 스킬명, 설명
function parseSkillList(ws, skillIdsFromScores = []) {
  const rows = sheetToRows(ws, 3) // R4 = index 3
  const errors = []
  const warnings = []
  const skills = []
  const definedIds = new Set()

  for (const row of rows) {
    const skillId = String(row['스킬ID'] ?? '').trim()
    const skillName = String(row['스킬명'] ?? '').trim()
    if (!skillId) continue
    definedIds.add(skillId)

    skills.push({
      id: skillId,
      name: skillName || skillId,
      category: String(row['카테고리'] ?? '기타').trim() || '기타',
      importance: 1,
      description: String(row['설명'] ?? '').trim(),
    })
  }

  // Skill 역량 점수 시트에 있으나 스킬_목록에 없는 스킬 → 기본값 추가
  for (const sid of skillIdsFromScores) {
    if (!definedIds.has(sid)) {
      warnings.push(`스킬 "${sid}"이 스킬_목록 시트에 정의되어 있지 않습니다. 기본값으로 추가됩니다.`)
      skills.push({ id: sid, name: sid, category: '기타', importance: 1, description: '' })
    }
  }

  return { skills, errors, warnings }
}

// ── 신규배치 파싱 ──────────────────────────────────────────────
// Sheet1: 구성원_정보
// Sheet2: Skill 역량 점수
// Sheet3: 스킬_목록
// Sheet4: 팀_과제정보 (B2=배치방식, R5 헤더, R6+ 데이터)
export async function parseNewPlacementTemplate(file) {
  const ab = await readFile(file)
  const wb = XLSX.read(ab, { type: 'array' })

  const allErrors = []
  const allWarnings = []

  // Sheet1: 구성원_정보
  const ws1 = wb.Sheets['구성원_정보'] ?? wb.Sheets[wb.SheetNames[0]]
  if (!ws1) return { errors: ['구성원_정보 시트를 찾을 수 없습니다.'], warnings: [] }
  const { members, errors: e1 } = parseMemberInfo(ws1)
  allErrors.push(...e1)
  if (members.length === 0) allErrors.push('구성원 데이터가 없습니다. 사번을 입력해주세요.')

  // Sheet2: Skill 역량 점수
  const ws2 = wb.Sheets['Skill 역량 점수'] ?? wb.Sheets[wb.SheetNames[1]]
  if (!ws2) return { errors: ['Skill 역량 점수 시트를 찾을 수 없습니다.'], warnings: allWarnings }
  const { skillMatrix, skillIds, errors: e2, warnings: w2 } = parseSkillScores(ws2)
  allErrors.push(...e2); allWarnings.push(...w2)

  // Sheet3: 스킬_목록
  const ws3 = wb.Sheets['스킬_목록'] ?? wb.Sheets[wb.SheetNames[2]]
  if (!ws3) return { errors: ['스킬_목록 시트를 찾을 수 없습니다.'], warnings: allWarnings }
  const { skills, errors: e3, warnings: w3 } = parseSkillList(ws3, skillIds)
  allErrors.push(...e3); allWarnings.push(...w3)

  // skillMatrix에 없는 구성원 → 빈 객체 초기화
  for (const m of members) {
    if (!skillMatrix[m.id]) {
      allWarnings.push(`구성원 "${m.name || m.id}"의 스킬 점수가 없습니다.`)
      skillMatrix[m.id] = {}
    }
  }

  // Sheet4: 팀_과제정보
  const ws4 = wb.Sheets['팀_과제정보'] ?? wb.Sheets[wb.SheetNames[3]]
  if (!ws4) return { errors: ['팀_과제정보 시트를 찾을 수 없습니다.'], warnings: allWarnings }

  // B2 = 배치방식
  const placementModeRaw = String(ws4['B2']?.v ?? '').trim()
  const placementMode = PLACEMENT_MODE_MAP[placementModeRaw] || 'different'
  if (!PLACEMENT_MODE_MAP[placementModeRaw]) {
    allWarnings.push(`배치방식 "${placementModeRaw}"을 인식할 수 없어 "다른과제"로 처리합니다.`)
  }

  // R5 헤더(index 4), R6+ 데이터
  const teamRows = sheetToRows(ws4, 4)
  const teams = []
  for (const row of teamRows) {
    const teamId = String(row['과제코드'] ?? '').trim()
    const teamName = String(row['팀명'] ?? '').trim()
    if (!teamId || !teamName) continue

    const requiredSkills = String(row['필수스킬'] ?? '').trim()
      .split(',').map((s) => s.trim()).filter(Boolean)

    teams.push({
      id: teamId,
      name: teamName,
      taskName: String(row['과제명'] ?? '').trim(),
      requiredSkills,
      sharedTask: String(row['공동과제여부'] ?? '').trim().toUpperCase() === 'Y',
      sharedTaskId: String(row['공동과제ID'] ?? '').trim(),
    })
  }

  if (teams.length === 0) allErrors.push('팀_과제정보 시트에 팀 데이터가 없습니다.')

  return { members, skills, skillMatrix, teams, placementMode, errors: allErrors, warnings: allWarnings }
}

// ── 재배치 파싱 ──────────────────────────────────────────────
// Sheet1: 구성원_정보
// Sheet2: Skill 역량 점수
// Sheet3: 스킬_목록
// Sheet4: 기존팀_현황 (R4 헤더, R5+ 데이터)
// Sheet5: 기존_배치현황 (R4 헤더, R5+ 데이터)
export async function parseReplacementTemplate(file) {
  const ab = await readFile(file)
  const wb = XLSX.read(ab, { type: 'array' })

  const allErrors = []
  const allWarnings = []

  // Sheet1: 구성원_정보
  const ws1 = wb.Sheets['구성원_정보'] ?? wb.Sheets[wb.SheetNames[0]]
  if (!ws1) return { errors: ['구성원_정보 시트를 찾을 수 없습니다.'], warnings: [] }
  const { members, errors: e1 } = parseMemberInfo(ws1)
  allErrors.push(...e1)
  if (members.length === 0) allErrors.push('구성원 데이터가 없습니다.')

  // Sheet2: Skill 역량 점수
  const ws2 = wb.Sheets['Skill 역량 점수'] ?? wb.Sheets[wb.SheetNames[1]]
  if (!ws2) return { errors: ['Skill 역량 점수 시트를 찾을 수 없습니다.'], warnings: allWarnings }
  const { skillMatrix, skillIds, errors: e2, warnings: w2 } = parseSkillScores(ws2)
  allErrors.push(...e2); allWarnings.push(...w2)

  // Sheet3: 스킬_목록
  const ws3 = wb.Sheets['스킬_목록'] ?? wb.Sheets[wb.SheetNames[2]]
  if (!ws3) return { errors: ['스킬_목록 시트를 찾을 수 없습니다.'], warnings: allWarnings }
  const { skills, errors: e3, warnings: w3 } = parseSkillList(ws3, skillIds)
  allErrors.push(...e3); allWarnings.push(...w3)

  for (const m of members) {
    if (!skillMatrix[m.id]) skillMatrix[m.id] = {}
  }

  // Sheet4: 기존팀_현황 — R4 헤더(index 3), R5+ 데이터
  // 컬럼: 과제코드, 팀명, 과제명, 현재인원, 추가수용가능인원, 필수스킬, 비고
  const ws4 = wb.Sheets['기존팀_현황'] ?? wb.Sheets[wb.SheetNames[3]]
  if (!ws4) return { errors: ['기존팀_현황 시트를 찾을 수 없습니다.'], warnings: allWarnings }

  const existingTeamRows = sheetToRows(ws4, 3) // R4 헤더 = index 3
  const existingTeams = []
  for (const row of existingTeamRows) {
    const teamId = String(row['과제코드'] ?? '').trim()
    const teamName = String(row['팀명'] ?? '').trim()
    if (!teamId || !teamName) continue

    const currentSize = Number(row['현재인원'] ?? 0)
    const extraCapacity = Number(row['추가수용가능인원'] ?? 0)
    const requiredSkills = String(row['필수스킬'] ?? '').trim()
      .split(',').map((s) => s.trim()).filter(Boolean)

    existingTeams.push({
      id: teamId,
      name: teamName,
      taskName: String(row['과제명'] ?? '').trim(),
      currentSize,
      extraCapacity,
      requiredSkills,
      note: String(row['비고'] ?? '').trim(),
      size: currentSize + extraCapacity,
    })
  }

  if (existingTeams.length === 0) allErrors.push('기존팀_현황 시트에 팀 데이터가 없습니다.')

  // Sheet5: 기존_배치현황 — R4 헤더(index 3), R5+ 데이터
  // 컬럼: 사번, 현재소속과제코드, 재배치대상여부, 비고
  const ws5 = wb.Sheets['기존_배치현황'] ?? wb.Sheets[wb.SheetNames[4]]
  if (!ws5) return { errors: ['기존_배치현황 시트를 찾을 수 없습니다.'], warnings: allWarnings }

  const assignmentRows = sheetToRows(ws5, 3) // R4 헤더 = index 3
  const currentAssignment = {}
  const surplusMembers = []
  let targetCount = 0

  for (const row of assignmentRows) {
    const memberId = String(row['사번'] ?? '').trim()
    if (!memberId) continue

    const currentTeamId = String(row['현재소속과제코드'] ?? '').trim()
    const isTarget = String(row['재배치대상여부'] ?? '').trim().toUpperCase() === 'Y'
    const isSurplus = !currentTeamId

    if (isTarget) {
      targetCount++
      if (isSurplus) surplusMembers.push(memberId)
    }

    currentAssignment[memberId] = {
      currentTeamId: currentTeamId || null,
      isTarget,
      isSurplus,
      note: String(row['비고'] ?? '').trim(),
    }
  }

  if (targetCount === 0) {
    allWarnings.push('재배치대상여부=Y인 인원이 없습니다. 재배치 대상을 지정해주세요.')
  }

  return {
    members, skills, skillMatrix,
    existingTeams, replacementScenario: '잉여인력흡수', currentAssignment, surplusMembers,
    errors: allErrors, warnings: allWarnings,
  }
}

// ── TF 구성 파싱 ──────────────────────────────────────────────
// Sheet1: 구성원_정보
// Sheet2: Skill 역량 점수
// Sheet3: 스킬_목록
// Sheet4: 현재팀_배치현황 (R4 헤더, R5+ 데이터)
// Sheet5: TF_요구스킬 (R4 헤더, R5+ TF 데이터)
export async function parseTFTemplate(file) {
  const ab = await readFile(file)
  const wb = XLSX.read(ab, { type: 'array' })

  const allErrors = []
  const allWarnings = []

  // Sheet1: 구성원_정보
  const ws1 = wb.Sheets['구성원_정보'] ?? wb.Sheets[wb.SheetNames[0]]
  if (!ws1) return { errors: ['구성원_정보 시트를 찾을 수 없습니다.'], warnings: [] }
  const { members, errors: e1 } = parseMemberInfo(ws1)
  allErrors.push(...e1)
  if (members.length === 0) allErrors.push('구성원 데이터가 없습니다.')

  // Sheet2: Skill 역량 점수
  const ws2 = wb.Sheets['Skill 역량 점수'] ?? wb.Sheets[wb.SheetNames[1]]
  if (!ws2) return { errors: ['Skill 역량 점수 시트를 찾을 수 없습니다.'], warnings: allWarnings }
  const { skillMatrix, skillIds, errors: e2, warnings: w2 } = parseSkillScores(ws2)
  allErrors.push(...e2); allWarnings.push(...w2)

  // Sheet3: 스킬_목록
  const ws3 = wb.Sheets['스킬_목록'] ?? wb.Sheets[wb.SheetNames[2]]
  if (!ws3) return { errors: ['스킬_목록 시트를 찾을 수 없습니다.'], warnings: allWarnings }
  const { skills, errors: e3, warnings: w3 } = parseSkillList(ws3, skillIds)
  allErrors.push(...e3); allWarnings.push(...w3)

  for (const m of members) {
    if (!skillMatrix[m.id]) skillMatrix[m.id] = {}
  }

  // Sheet4: 현재팀_배치현황 — R4 헤더(index 3), R5+ 데이터
  // 컬럼: 사번, 현재소속과제코드, 팀명, 현재팀_필수스킬
  const ws4 = wb.Sheets['현재팀_배치현황'] ?? wb.Sheets[wb.SheetNames[3]]
  if (!ws4) return { errors: ['현재팀_배치현황 시트를 찾을 수 없습니다.'], warnings: allWarnings }

  const teamAssignRows = sheetToRows(ws4, 3) // R4 헤더 = index 3
  const currentAssignment = {}   // { memberId: teamId }
  const currentTeamsMap = {}     // { teamId: { id, name, requiredSkills, size } }

  for (const row of teamAssignRows) {
    const memberId = String(row['사번'] ?? '').trim()
    const teamId = String(row['현재소속과제코드'] ?? '').trim()
    if (!memberId || !teamId) continue

    currentAssignment[memberId] = teamId

    if (!currentTeamsMap[teamId]) {
      const requiredSkills = String(row['현재팀_필수스킬'] ?? '').trim()
        .split(',').map((s) => s.trim()).filter(Boolean)
      currentTeamsMap[teamId] = {
        id: teamId,
        name: String(row['팀명'] ?? teamId).trim(),
        requiredSkills,
        size: 0,
        minSkillLevel: 2.8,
      }
    }
    currentTeamsMap[teamId].size++
  }

  const currentTeams = Object.values(currentTeamsMap)

  // Sheet5: TF_요구스킬 — R4 헤더(index 3), R5+ 데이터
  // 컬럼: 과제코드, TF명, 과제명, 필수스킬, 비고
  const ws5 = wb.Sheets['TF_요구스킬'] ?? wb.Sheets[wb.SheetNames[4]]
  if (!ws5) return { errors: ['TF_요구스킬 시트를 찾을 수 없습니다.'], warnings: allWarnings }

  const tfRows = sheetToRows(ws5, 3) // R4 헤더 = index 3
  // 첫 번째 TF 행만 사용
  const tfRow = tfRows[0] ?? {}
  const tfId = String(tfRow['과제코드'] ?? '').trim() || 'TF001'
  const tfName = String(tfRow['TF명'] ?? '').trim() || '신규 TF'
  const tfProject = String(tfRow['과제명'] ?? '').trim()
  const tfRequiredSkills = String(tfRow['필수스킬'] ?? '').trim()
    .split(',').map((s) => s.trim()).filter(Boolean)

  if (tfRequiredSkills.length === 0) {
    allWarnings.push('TF 필수스킬이 입력되지 않았습니다. TF_요구스킬 시트를 확인해주세요.')
  }

  return {
    members, skills, skillMatrix,
    currentAssignment, currentTeams,
    tfId, tfName, tfProject, tfRequiredSkills,
    errors: allErrors, warnings: allWarnings,
  }
}
