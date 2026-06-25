import { useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Toggle from '../components/ui/Toggle'
import Slider from '../components/ui/Slider'
import useStore from '../store/useStore'
import { mockPlacement } from '../api/mock'
import { getPlacement } from '../api/index'

const DEFAULT_CONDITIONS = {
  equalSize: true,
  seniorityBalance: true,
  genderBalance: false,
  minSkillCoverage: 1,
  minSkillLevel: 2.8,
  distributeSpof: true,
  skillWeight: 0.6,
}

export default function Step3Conditions() {
  const navigate = useNavigate()
  const {
    conditions, setConditions,
    analysisResult, members, skills, teams, skillMatrix, placementMode,
    setPlacementResult, setCurrentStep, flowType, placementType, currentAssignment,
    tfName, tfProject, tfRequiredSkills, currentTeams,
  } = useStore()
  const isTF = placementType === 'tf'

  const set = (key, val) => setConditions({ ...conditions, [key]: val })

  const handleReset = () => setConditions(DEFAULT_CONDITIONS)

  const handleGenerate = async () => {
    const payload = { analysis_result: analysisResult, conditions, members, skills, teams, skillMatrix, placement_mode: placementMode }
    let result
    try {
      result = await getPlacement(payload)
    } catch {
      result = mockPlacement({ members, skills, teams, skillMatrix, analysisResult, conditions, flowType, currentAssignment })
    }
    // TF 모드: tfResult는 Step2에서 이미 계산됨 — Step4로만 이동
    setPlacementResult(result)
    setCurrentStep(4)
    navigate('/step/4')
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar currentStep={3} />
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-medium text-ink">배치 조건 설정</h1>
              {isTF && <span className="text-xs font-mono px-2 py-0.5 bg-[#FDF0E8] text-accent-orange rounded-sm border border-[#E8632A]/20">TF 구성</span>}
            </div>
            {isTF && tfName && (
              <p className="text-sm text-body mt-1">TF: <strong>{tfName}</strong>{tfProject && ` — ${tfProject}`}</p>
            )}
            {!isTF && <p className="text-sm text-body mt-1">팀 배치에 적용할 조건과 가중치를 설정합니다.</p>}
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>추천 설정으로 초기화</Button>
        </div>

        <div className="space-y-6">
          {/* Basic conditions */}
          <Section title="기본 조건">
            <ConditionRow label="팀당 인원 균등 배분" desc="모든 팀의 인원 수를 최대한 동일하게 배분">
              <Toggle checked={conditions.equalSize} onChange={(v) => set('equalSize', v)} />
            </ConditionRow>
            <ConditionRow label="직위/연차 조화" desc="각 팀에 팀장급, 중간급, 주니어가 균형있게 포함">
              <Toggle checked={conditions.seniorityBalance} onChange={(v) => set('seniorityBalance', v)} />
            </ConditionRow>
            <ConditionRow label="성별 균형" desc="팀 내 성별 분포가 편향되지 않도록 조정">
              <Toggle checked={conditions.genderBalance} onChange={(v) => set('genderBalance', v)} />
            </ConditionRow>
          </Section>

          {/* Skill conditions */}
          <Section title="스킬 관련 조건">
            <div className="space-y-6">
              <Slider
                label="필수 스킬 최소 보유자 수"
                min={1} max={3} step={1}
                value={conditions.minSkillCoverage}
                onChange={(v) => set('minSkillCoverage', v)}
                recommendedValue={1}
              />
              <Slider
                label="스킬 평균 레벨 하한"
                min={1} max={5} step={0.1}
                value={conditions.minSkillLevel}
                onChange={(v) => set('minSkillLevel', Math.round(v * 10) / 10)}
                recommendedValue="조직 평균"
              />
            </div>
            <ConditionRow label="SPOF 스킬 분산 배치" desc="1명만 보유한 희귀 스킬 보유자를 같은 팀에 몰리지 않게">
              <Toggle checked={conditions.distributeSpof} onChange={(v) => set('distributeSpof', v)} />
            </ConditionRow>
          </Section>

          {/* Weight */}
          <Section title="최적화 가중치">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-body font-mono">
                <span>팀 균형 우선</span>
                <span>스킬 최적화 우선</span>
              </div>
              <Slider
                min={0} max={1} step={0.1}
                value={conditions.skillWeight}
                onChange={(v) => set('skillWeight', Math.round(v * 10) / 10)}
                recommendedValue={0.6}
              />
              <div className="flex justify-between text-xs text-body">
                <span>0 (팀 균형)</span>
                <span>현재: {conditions.skillWeight}</span>
                <span>1 (스킬 최적화)</span>
              </div>
            </div>
          </Section>

          {/* Mode-specific */}
          {placementMode === 'same' && (
            <Section title="배치 방식 ① 추가 조건">
              <ConditionRow label="에이스 분산" desc="고성과자(top 스킬 합산 기준)가 한 팀에 몰리지 않도록">
                <Toggle checked={conditions.distributeAce ?? true} onChange={(v) => set('distributeAce', v)} />
              </ConditionRow>
            </Section>
          )}
          {placementMode === 'different' && (
            <Section title="배치 방식 ② 추가 조건">
              <ConditionRow label="팀 난이도 반영" desc="어려운 과제에 더 강한 구성원을 배치">
                <Toggle checked={conditions.difficultyAware ?? true} onChange={(v) => set('difficultyAware', v)} />
              </ConditionRow>
            </Section>
          )}
        </div>

        <div className="pt-8 flex justify-between">
          <Button variant="outline" onClick={() => navigate('/step/2')}>← 분석 결과 다시 보기</Button>
          <Button size="lg" onClick={handleGenerate}>최적 배치 생성하기 →</Button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="border border-[rgba(0,0,0,0.08)] rounded-md overflow-hidden">
      <div className="px-5 py-3 bg-[#f9fafb] border-b border-[rgba(0,0,0,0.06)]">
        <h2 className="text-xs font-mono font-medium text-body uppercase tracking-wider">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function ConditionRow({ label, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        {desc && <div className="text-xs text-body mt-0.5">{desc}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}
