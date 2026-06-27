import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import WhiskLoader from '../components/ui/WhiskLoader'
import useStore from '../store/useStore'
import {
  parseNewPlacementTemplate,
  parseReplacementTemplate,
  parseTFTemplate,
} from '../utils/parseTemplate'

const CONFIG = {
  new: {
    label: '신규배치',
    badgeVariant: 'mint',
    filename: 'TeamCook_신규배치_v3.xlsx',
    downloadPath: '/templates/TeamCook_신규배치_v3.xlsx',
    desc: '구성원 스킬 데이터와 팀 정보를 엑셀 템플릿에 입력한 후 업로드해주세요.',
  },
  re: {
    label: '재배치',
    badgeVariant: 'periwinkle',
    filename: 'TeamCook_재배치_v3.xlsx',
    downloadPath: '/templates/TeamCook_재배치_v3.xlsx',
    desc: '구성원 스킬 데이터, 기존 팀 현황, 배치 현황을 입력한 후 업로드해주세요.',
  },
  tf: {
    label: 'TF 구성',
    badgeVariant: 'orange',
    filename: 'TeamCook_TF구성_v3.xlsx',
    downloadPath: '/templates/TeamCook_TF구성_v3.xlsx',
    desc: '구성원 스킬 데이터, 현재 팀 배치 현황, TF 요구 스킬을 입력한 후 업로드해주세요.',
  },
}

export default function Step1Input() {
  const navigate = useNavigate()
  const {
    placementType,
    setSkills, setMembers, setSkillMatrix, setTeams, setPlacementMode,
    setReplacementData, setTFData, setCurrentStep, setPlacementType,
  } = useStore()

  const type = placementType || 'new'
  const cfg = CONFIG[type]

  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [result, setResult] = useState(null)
  const [errors, setErrors] = useState([])
  const [warnings, setWarnings] = useState([])

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setParsing(true)
    setResult(null)
    setErrors([])
    setWarnings([])

    try {
      let parsed
      if (type === 'new') parsed = await parseNewPlacementTemplate(f)
      else if (type === 're') parsed = await parseReplacementTemplate(f)
      else parsed = await parseTFTemplate(f)

      setErrors(parsed.errors || [])
      setWarnings(parsed.warnings || [])
      setResult(parsed)
    } catch (err) {
      setErrors([`파일 파싱 오류: ${err.message}`])
    } finally {
      setParsing(false)
    }
  }

  const handleNext = () => {
    if (!result) return

    if (type === 'new') {
      setMembers(result.members)
      setSkills(result.skills)
      setSkillMatrix(result.skillMatrix)
      setTeams(result.teams)
      setPlacementMode(result.placementMode)
    } else if (type === 're') {
      setMembers(result.members)
      setSkills(result.skills)
      setSkillMatrix(result.skillMatrix)
      setReplacementData({
        replacementScenario: result.replacementScenario,
        currentAssignment: result.currentAssignment,
        surplusMembers: result.surplusMembers,
        existingTeams: result.existingTeams,
      })
    } else {
      setPlacementType('tf')
      setMembers(result.members)
      setSkills(result.skills)
      setSkillMatrix(result.skillMatrix)
      setTFData({
        tfId: result.tfId,
        tfName: result.tfName,
        tfProject: result.tfProject,
        tfRequiredSkills: result.tfRequiredSkills,
        currentAssignment: result.currentAssignment,
        currentTeams: result.currentTeams,
      })
    }

    setTransitioning(true)
    const t0 = Date.now()
    const minDelay = 3000
    setTimeout(() => {
      setCurrentStep(2)
      navigate('/step/2')
    }, Math.max(0, minDelay - (Date.now() - t0)))
  }

  const hasErrors = errors.length > 0
  const canNext = result && !hasErrors

  const summary = (() => {
    if (!result) return null
    if (type === 'new') return [
      { label: '구성원', value: result.members?.length ?? 0, unit: '명' },
      { label: '스킬', value: result.skills?.length ?? 0, unit: '개' },
      { label: '팀', value: result.teams?.length ?? 0, unit: '개' },
      { label: '배치방식', value: { same: '동일과제', different: '다른과제', mixed: '혼합' }[result.placementMode] || '-', unit: '' },
    ]
    if (type === 're') {
      const targets = Object.values(result.currentAssignment || {}).filter((v) => v.isTarget).length
      return [
        { label: '구성원', value: result.members?.length ?? 0, unit: '명' },
        { label: '스킬', value: result.skills?.length ?? 0, unit: '개' },
        { label: '수용팀', value: result.existingTeams?.length ?? 0, unit: '개' },
        { label: '재배치 대상', value: targets, unit: '명' },
        { label: '잉여 인력', value: result.surplusMembers?.length ?? 0, unit: '명' },
        { label: '시나리오', value: result.replacementScenario || '-', unit: '' },
      ]
    }
    return [
      { label: '구성원', value: result.members?.length ?? 0, unit: '명' },
      { label: '스킬', value: result.skills?.length ?? 0, unit: '개' },
      { label: '현재 팀', value: result.currentTeams?.length ?? 0, unit: '개' },
      { label: 'TF명', value: result.tfName || '-', unit: '' },
      { label: 'TF 필수스킬', value: result.tfRequiredSkills?.length ?? 0, unit: '개' },
    ]
  })()

  if (transitioning) return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-6">
      <WhiskLoader fps={12} size={160} />
      <p className="text-sm text-body font-mono">데이터 분석 준비 중...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar currentStep={1} />

      <div className="max-w-2xl mx-auto w-full px-6 py-12" style={{ marginTop: '69px' }}>
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={cfg.badgeVariant}>{cfg.label}</Badge>
            <h1 className="text-2xl font-medium text-ink">데이터 입력</h1>
          </div>
          <p className="text-sm text-body">{cfg.desc}</p>
        </div>

        {/* Template download */}
        <div className="mb-6 p-4 border border-[rgba(0,0,0,0.08)] rounded-md flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink mb-0.5">엑셀 템플릿 다운로드</p>
            <p className="text-xs text-body">{cfg.filename}</p>
          </div>
          <a
            href={cfg.downloadPath}
            download
            className="px-4 py-2 text-xs font-mono border border-ink rounded-sm hover:bg-ink hover:text-canvas transition-colors"
          >
            다운로드
          </a>
        </div>

        {/* Upload drop zone */}
        <div
          className={`relative border-2 border-dashed rounded-md p-10 text-center transition-colors mb-6
            ${file ? 'border-ink bg-[#f9fafb]' : 'border-hairline hover:border-primary'}`}
        >
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFile}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {parsing ? (
            <div className="space-y-2">
              <div className="w-6 h-6 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-body">파싱 중...</p>
            </div>
          ) : file ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink">✓ {file.name}</p>
              <p className="text-xs text-body">다른 파일로 교체하려면 클릭하세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">엑셀 파일을 드래그하거나 클릭해서 업로드</p>
              <p className="text-xs text-body">.xlsx 파일만 지원합니다</p>
            </div>
          )}
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-4 p-4 bg-accent-coral-tint border border-accent-coral/20 rounded-md space-y-1">
            <p className="text-xs font-mono font-medium text-accent-coral-dark uppercase tracking-wider mb-2">
              파싱 오류 — 수정 후 다시 업로드해주세요
            </p>
            {errors.map((e, i) => <p key={i} className="text-sm text-[#7A2A0F]">• {e}</p>)}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mb-4 p-4 bg-accent-yellow-tint border border-accent-yellow/40 rounded-md space-y-1">
            <p className="text-xs font-mono font-medium text-accent-yellow-dark uppercase tracking-wider mb-2">주의사항</p>
            {warnings.map((w, i) => <p key={i} className="text-sm text-accent-yellow-dark">• {w}</p>)}
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div className="mb-8">
            <p className="text-xs font-mono text-body uppercase tracking-wider mb-3">파싱 결과 요약</p>
            <div className={`grid gap-3 ${summary.length <= 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {summary.map((s) => (
                <div key={s.label} className="p-4 border border-[rgba(0,0,0,0.08)] rounded-md">
                  <div className="text-xs text-body mb-1">{s.label}</div>
                  <div className="text-lg font-mono font-medium text-ink">
                    {s.value}
                    {s.unit && <span className="text-sm font-normal text-body ml-1">{s.unit}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* TF: 필수 스킬 목록 표시 */}
            {type === 'tf' && result.tfRequiredSkills?.length > 0 && (
              <div className="mt-3 p-3 bg-[#f9fafb] border border-[rgba(0,0,0,0.06)] rounded-md">
                <p className="text-xs text-body mb-2">TF 필수 스킬</p>
                <div className="flex flex-wrap gap-1">
                  {result.tfRequiredSkills.map((sid) => {
                    const skill = result.skills?.find((s) => s.id === sid)
                    return (
                      <Badge key={sid} variant="orange">{skill?.name ?? sid}</Badge>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 재배치: 잉여 인력 목록 */}
            {type === 're' && result.surplusMembers?.length > 0 && (
              <div className="mt-3 p-3 bg-[#f9fafb] border border-[rgba(0,0,0,0.06)] rounded-md">
                <p className="text-xs text-body mb-2">잉여 인력 (소속팀 없음)</p>
                <div className="flex flex-wrap gap-1">
                  {result.surplusMembers.map((mid) => {
                    const m = result.members?.find((m) => m.id === mid)
                    return <Badge key={mid} variant="periwinkle">{m?.name ?? mid}</Badge>
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!canNext}
          onClick={handleNext}
        >
          {hasErrors ? '오류를 수정해주세요' : !result ? '파일을 업로드해주세요' : '분석 시작하기 →'}
        </Button>
      </div>
    </div>
  )
}
