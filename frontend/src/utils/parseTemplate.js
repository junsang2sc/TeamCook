import * as XLSX from 'xlsx'

// ── 공통 유틸 ─────────────────────────────────────────────────
function normalizeHeader(h) {
  return String(h ?? '').trim().replace(/\s*\*$/, '').trim()
}

// headerRowIndex: 0-based
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

// 구성원_스킬현황 파싱 (신규배치 / 재배치 / TF 공통: R3 헤더, R4+ 데이터)
function parseMembers(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  // R3 = index 2 = 헤더
  const headers = (raw[2] ?? []).map(normalizeHeader)
  const skillCols = headers.filter((h) => h && /^S\d+$/.test(h))

  const members = []
  const skillMatrix = {}
  const errors = []
  const warnings = []
  const seenIds = new Set()

  const dataRows = raw.slice(3).filter((row) => row.some((v) => v !== ''))
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const get = (col) => {
      const idx = headers.indexOf(col)
      return idx >= 0 ? row[idx] ?? '' : ''
    }
    const memberId = String(get('구성원ID')).trim()
    if (!memberId) continue
    if (seenIds.has(memberId)) { errors.push(`구성원ID 중복: "${memberId}"`); continue }
    seenIds.add(memberId)

    members.push({
      id: memberId,
      name: String(get('이름')).trim() || memberId,
      role: String(get('역할')).trim() || '중간급',
      experience: get('연차') !== '' ? Number(get('연차')) : '',
      gender: String(get('성별')).trim(),
    })

    skillMatrix[memberId] = {}
    for (const col of skillCols) {
      const idx = headers.indexOf(col)
      const raw = idx >= 0 ? row[idx] : ''
      const val = raw === '' || raw === undefined || raw === null ? 0 : Number(raw)
      if (isNaN(val) || val < 0 || val > 5) {
        warnings.push(`스킬 레벨 범위 오류: ${memberId} / ${col} = ${raw}`)
        skillMatrix[memberId][col] = 0
      } else {
        skillMatrix[memberId][col] = Math.round(val)
      }
    }
  }

  return { members, skillMatrix, skillCols, errors, warnings }
}

// 스킬_목록 파싱 — headerRowIndex는 호출 측에서 지정
function parseSkills(ws, headerRowIndex, skillCols) {
  const rows = sheetToRows(ws, headerRowIndex)
  const errors = []
  const warnings = []
  const skills = []
  const definedIds = new Set()

  for (const row of rows) {
    const skillId = String(row['스킬ID'] ?? '').trim()
    const skillName = String(row['스킬명'] ?? '').trim()
    if (!skillId || !skillName) continue
    definedIds.add(skillId)

    // 중요도(1~5) or 중요도 (1~5)
    const impRaw = row['중요도(1~5)'] ?? row['중요도 (1~5)'] ?? row['중요도'] ?? ''
    const importance = impRaw !== '' ? Number(impRaw) : 1

    skills.push({
      id: skillId,
      name: skillName,
      category: String(row['카테고리'] ?? '기타').trim() || '기타',
      importance: isNaN(importance) || importance < 1 || importance > 5 ? 1 : Math.round(importance),
      description: String(row['설명'] ?? '').trim(),
    })
  }

  // Sheet1에 있으나 Sheet2에 없는 스킬 → 기본값으로 추가
  for (const col of skillCols) {
    if (!definedIds.has(col)) {
      warnings.push(`스킬 "${col}"이 스킬_목록 시트에 정의되어 있지 않습니다. 기본값으로 추가됩니다.`)
      skills.push({ id: col, name: col, category: '기타', importance: 1, description: '' })
    }
  }

  return { skills, errors, warnings }
}

// ── 신규배치 파싱 ──────────────────────────────────────────────
// 구성원_스킬현황: R3 헤더, R4+ 데이터
// 스킬_목록: R3 헤더, R4+ 데이터
// 팀_과제정보: B3=배치방식, R5 헤더, R6+ 데이터
export async function parseNewPlacementTemplate(file) {
  const ab = await readFile(file)
  const wb = XLSX.read(ab, { type: 'array' })

  const allErrors = []
  const allWarnings = []

  // 구성원_스킬현황 (Sheet1)
  const ws1 = wb.Sheets[wb.SheetNames[0]]
  if (!ws1) return { errors: ['구성원_스킬현황 시트를 찾을 수 없습니다.'], warnings: [] }
  const { members, skillMatrix, skillCols, errors: e1, warnings: w1 } = parseMembers(ws1)
  allErrors.push(...e1); allWarnings.push(...w1)

  // 스킬_목록 (Sheet2) — R3 헤더(index 2)
  const ws2 = wb.Sheets[wb.SheetNames[1]]
  if (!ws2) return { errors: ['스킬_목록 시트를 찾을 수 없습니다.'], warnings: [] }
  const { skills, errors: e2, warnings: w2 } = parseSkills(ws2, 2, skillCols)
  allErrors.push(...e2); allWarnings.push(...w2)

  // 팀_과제정보 (Sheet3) — B3=배치방식, R5 헤더(index 4), R6+ 데이터
  const ws3 = wb.Sheets[wb.SheetNames[2]]
  if (!ws3) return { errors: ['팀_과제정보 시트를 찾을 수 없습니다.'], warnings: [] }

  const placementModeRaw = String(ws3['B3']?.v ?? '').trim()
  const placementMode = PLACEMENT_MODE_MAP[placementModeRaw] || 'different'
  if (!PLACEMENT_MODE_MAP[placementModeRaw]) {
    allWarnings.push(`배치방식 "${placementModeRaw}"을 인식할 수 없어 "다른과제"로 처리합니다.`)
  }

  const teamRows = sheetToRows(ws3, 4) // R5 헤더 = index 4
  const teams = []
  for (const row of teamRows) {
    const teamId = String(row['팀ID'] ?? '').trim()
    const teamName = String(row['팀명'] ?? '').trim()
    const size = Number(row['팀인원수'] ?? 0)
    if (!teamId || !teamName || isNaN(size) || size <= 0) continue

    const requiredSkills = String(row['필수스킬'] ?? '').trim()
      .split(',').map((s) => s.trim()).filter(Boolean)

    teams.push({
      id: teamId,
      name: teamName,
      taskName: String(row['과제명'] ?? '').trim(),
      size,
      requiredSkills,
      sharedTask: String(row['공동과제여부'] ?? '').trim().toUpperCase() === 'Y',
      sharedTaskId: String(row['공동과제ID'] ?? '').trim(),
    })
  }

  const totalSize = teams.reduce((a, t) => a + t.size, 0)
  if (members.length > 0 && totalSize > members.length) {
    allWarnings.push(`팀 인원수 합계(${totalSize}명)가 전체 구성원 수(${members.length}명)를 초과합니다.`)
  }

  return { members, skills, skillMatrix, teams, placementMode, errors: allErrors, warnings: allWarnings }
}

// ── 재배치 파싱 ──────────────────────────────────────────────
// 구성원_스킬현황: R3 헤더, R4+ 데이터
// 스킬_목록: R2 헤더(index 1), R3+ 데이터
// 기존팀_현황: B3=재배치시나리오, R4 헤더(index 3), R5+ 데이터
// 기존_배치현황: R2 헤더(index 1), R3+ 데이터
export async function parseReplacementTemplate(file) {
  const ab = await readFile(file)
  const wb = XLSX.read(ab, { type: 'array' })

  const allErrors = []
  const allWarnings = []

  // 구성원_스킬현황 (Sheet1)
  const ws1 = wb.Sheets[wb.SheetNames[0]]
  if (!ws1) return { errors: ['구성원_스킬현황 시트를 찾을 수 없습니다.'], warnings: [] }
  const { members, skillMatrix, skillCols, errors: e1, warnings: w1 } = parseMembers(ws1)
  allErrors.push(...e1); allWarnings.push(...w1)

  // 스킬_목록 (Sheet2) — R2 헤더(index 1)
  const ws2 = wb.Sheets[wb.SheetNames[1]]
  if (!ws2) return { errors: ['스킬_목록 시트를 찾을 수 없습니다.'], warnings: [] }
  const { skills, errors: e2, warnings: w2 } = parseSkills(ws2, 1, skillCols)
  allErrors.push(...e2); allWarnings.push(...w2)

  // 기존팀_현황 (Sheet3) — B3=시나리오, R4 헤더(index 3), R5+ 데이터
  const ws3 = wb.Sheets[wb.SheetNames[2]]
  if (!ws3) return { errors: ['기존팀_현황 시트를 찾을 수 없습니다.'], warnings: [] }

  const scenarioRaw = String(ws3['B3']?.v ?? '').trim()
  const replacementScenario = scenarioRaw || '잉여인력흡수'
  if (!scenarioRaw) {
    allWarnings.push('재배치시나리오 값이 비어 있습니다. "잉여인력흡수"로 처리합니다.')
  }

  const existingTeamRows = sheetToRows(ws3, 3) // R4 헤더 = index 3
  const existingTeams = []
  for (const row of existingTeamRows) {
    const teamId = String(row['팀ID'] ?? '').trim()
    const teamName = String(row['팀명'] ?? '').trim()
    if (!teamId || !teamName) continue

    const requiredSkills = String(row['필수스킬'] ?? '').trim()
      .split(',').map((s) => s.trim()).filter(Boolean)

    existingTeams.push({
      id: teamId,
      name: teamName,
      taskName: String(row['과제명'] ?? '').trim(),
      currentSize: Number(row['현재인원'] ?? 0),
      extraCapacity: Number(row['추가수용가능인원'] ?? 0),
      requiredSkills,
      note: String(row['비고'] ?? '').trim(),
      // size = 현재인원 + 추가수용가능인원 (배치 알고리즘용)
      size: Number(row['현재인원'] ?? 0) + Number(row['추가수용가능인원'] ?? 0),
    })
  }

  // 기존_배치현황 (Sheet4) — R2 헤더(index 1), R3+ 데이터
  const ws4 = wb.Sheets[wb.SheetNames[3]]
  if (!ws4) return { errors: ['기존_배치현황 시트를 찾을 수 없습니다.'], warnings: [] }

  const assignmentRows = sheetToRows(ws4, 1) // R2 헤더 = index 1
  const currentAssignment = {}
  const surplusMembers = []
  let targetCount = 0

  for (const row of assignmentRows) {
    const memberId = String(row['구성원ID'] ?? '').trim()
    if (!memberId) continue

    const currentTeamId = String(row['현재소속팀ID'] ?? '').trim()
    const isTarget = String(row['재배치대상여부'] ?? '').trim().toUpperCase() === 'Y'
    const isSurplus = !currentTeamId // 소속팀 없음 = 잉여 인력

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
    existingTeams, replacementScenario, currentAssignment, surplusMembers,
    errors: allErrors, warnings: allWarnings,
  }
}

// ── TF 구성 파싱 ──────────────────────────────────────────────
// 구성원_스킬현황: R3 헤더, R4+ 데이터
// 스킬_목록: R2 헤더(index 1), R3+ 데이터
// 현재팀_배치현황: R3 헤더(index 2), R4+ 데이터
// TF_요구스킬: R3 헤더(index 2), R4 = TF 1행
export async function parseTFTemplate(file) {
  const ab = await readFile(file)
  const wb = XLSX.read(ab, { type: 'array' })

  const allErrors = []
  const allWarnings = []

  // 구성원_스킬현황 (Sheet1)
  const ws1 = wb.Sheets[wb.SheetNames[0]]
  if (!ws1) return { errors: ['구성원_스킬현황 시트를 찾을 수 없습니다.'], warnings: [] }
  const { members, skillMatrix, skillCols, errors: e1, warnings: w1 } = parseMembers(ws1)
  allErrors.push(...e1); allWarnings.push(...w1)

  // 스킬_목록 (Sheet2) — R2 헤더(index 1)
  const ws2 = wb.Sheets[wb.SheetNames[1]]
  if (!ws2) return { errors: ['스킬_목록 시트를 찾을 수 없습니다.'], warnings: [] }
  const { skills, errors: e2, warnings: w2 } = parseSkills(ws2, 1, skillCols)
  allErrors.push(...e2); allWarnings.push(...w2)

  // 현재팀_배치현황 (Sheet3) — R3 헤더(index 2), R4+ 데이터
  const ws3 = wb.Sheets[wb.SheetNames[2]]
  if (!ws3) return { errors: ['현재팀_배치현황 시트를 찾을 수 없습니다.'], warnings: [] }

  const teamAssignRows = sheetToRows(ws3, 2) // R3 헤더 = index 2
  const currentAssignment = {}   // { memberId: teamId }
  const currentTeamsMap = {}     // { teamId: { name, requiredSkills } }

  for (const row of teamAssignRows) {
    const memberId = String(row['구성원ID'] ?? '').trim()
    const teamId = String(row['현재소속팀ID'] ?? '').trim()
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
        minSkillLevel: 2.8, // 기본값
      }
    }
    currentTeamsMap[teamId].size++
  }

  const currentTeams = Object.values(currentTeamsMap)

  // TF_요구스킬 (Sheet4) — R3 헤더(index 2), R4 = TF 단일 행
  const ws4 = wb.Sheets[wb.SheetNames[3]]
  if (!ws4) return { errors: ['TF_요구스킬 시트를 찾을 수 없습니다.'], warnings: [] }

  const tfRaw = XLSX.utils.sheet_to_json(ws4, { header: 1, defval: '' })
  // R3(index 2) = 헤더, R4(index 3) = TF 데이터 1행
  const tfHeaders = (tfRaw[2] ?? []).map(normalizeHeader)
  const tfDataRow = tfRaw[3] ?? []
  const tfGet = (col) => {
    const idx = tfHeaders.indexOf(col)
    return idx >= 0 ? String(tfDataRow[idx] ?? '').trim() : ''
  }

  const tfId = tfGet('팀ID') || 'TF001'
  const tfName = tfGet('팀명') || '신규 TF'
  const tfProject = tfGet('과제명')
  const tfRequiredSkills = tfGet('필수스킬')
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
