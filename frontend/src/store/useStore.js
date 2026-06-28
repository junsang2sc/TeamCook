import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const SESSION_KEY = 'teamfit_session'

// placementType: 'new' | 're' | 'tf'
// flowType: 'new' | 'replacement' | 'tf'  (Step2/4/5에서 분기용)
function deriveFlowType(placementType) {
  return placementType === 're' ? 'replacement' : (placementType ?? 'new')
}

const useStore = create(
  persist(
    (set, get) => ({
      placementType: null,  // 'new' | 're' | 'tf'
      flowType: 'new',      // derived: 'new' | 'replacement' | 'tf'

      // Step 1: Input data
      skills: [],
      members: [],
      skillMatrix: {},
      teams: [],
      placementMode: null,

      // 재배치 전용
      replacementScenario: null,
      currentAssignment: {},
      surplusMembers: [],

      // TF 전용
      tfId: null,
      tfName: null,
      tfProject: null,
      tfRequiredSkills: [],
      tfSize: null,           // TF 목표 인원 수 (사용자 입력)
      currentTeams: [],
      tfResult: null,

      // Step 2
      analysisResult: null,
      replacementAnalysis: null,
      edaResult: null,       // { idf, kss, difficulty, talentTypes }
      selectedIdf: [],       // 카드1 사용자 선택 스킬 ID 리스트
      selectedKss: [],       // 카드2 사용자 선택 스킬 ID 리스트
      selectedDiff: [],      // 카드3 사용자 선택 스킬 ID 리스트
      fitMatrix: null,       // { matrix, stats, top5PerProject, ... }
      fitStats: null,        // { project_id: {max, min, mean, std} }
      phase1Info: null,      // { avgLevelRange:{min,max,mean}, lambdaValues, teamAvgLevels, infeasibleSkills }
      step2CurrentStep: 1,   // 1~4 스텝 인디케이터

      // Step 2 재배치 전용
      candidateTeams: [],    // 재배치 받을 팀 ID 목록 (사용자 선택)
      maxAddPerTeam: {},     // { team_id: int } 과제별 최대 재배치 인원

      // Step 3
      conditions: {
        equalSize: true,
        seniorityBalance: true,
        genderBalance: false,
        minSkillCoverage: 1,
        minSkillLevel: 2.8,
        distributeSpof: true,
        skillWeight: 0.6,
      },

      // Step 4
      placementResult: null,

      // Step 5
      adjustedPlacement: null,
      history: [],

      currentStep: 0,

      // ── Actions ────────────────────────────────────────────────
      setPlacementType: (placementType) => set({ placementType, flowType: deriveFlowType(placementType) }),

      // Legacy alias (Landing still uses this)
      setFlowType: (flowType) => {
        const pt = flowType === 'replacement' ? 're' : flowType
        set({ placementType: pt, flowType })
      },

      setSkills: (skills) => set({ skills }),
      setMembers: (members) => set({ members }),
      setSkillMatrix: (skillMatrix) => set({ skillMatrix }),
      setTeams: (teams) => set({ teams }),
      setPlacementMode: (mode) => set({ placementMode: mode }),
      setAnalysisResult: (result) => set({ analysisResult: result }),
      setReplacementAnalysis: (result) => set({ replacementAnalysis: result }),
      setEdaResult: (result) => set({ edaResult: result }),
      setSelectedIdf: (list) => set({ selectedIdf: list }),
      setSelectedKss: (list) => set({ selectedKss: list }),
      setSelectedDiff: (list) => set({ selectedDiff: list }),
      setFitMatrix: (matrix) => set({ fitMatrix: matrix, fitStats: matrix?.stats ?? null }),
      setPhase1Info: (info) => set({ phase1Info: info }),
      setCandidateTeams: (teams) => set({ candidateTeams: teams }),
      setMaxAddPerTeam: (map) => set({ maxAddPerTeam: map }),
      setTfSize: (size) => set({ tfSize: size }),
      setStep2CurrentStep: (step) => set({ step2CurrentStep: step }),
      setConditions: (conditions) => set({ conditions }),
      setPlacementResult: (result) => set({ placementResult: result }),

      setReplacementData: ({ replacementScenario, currentAssignment, surplusMembers, existingTeams }) =>
        set({
          replacementScenario,
          currentAssignment: currentAssignment || {},
          surplusMembers: surplusMembers || [],
          teams: existingTeams || [],
        }),

      setTFData: ({ tfId, tfName, tfProject, tfRequiredSkills, currentAssignment, currentTeams, tfResult }) =>
        set({ tfId, tfName, tfProject, tfRequiredSkills, currentAssignment, currentTeams, ...(tfResult !== undefined ? { tfResult } : {}) }),

      setTFResult: (tfResult) => set({ tfResult }),

      setAdjustedPlacement: (placement) => {
        const prev = get().adjustedPlacement
        if (prev) set((state) => ({ history: [...state.history, prev] }))
        set({ adjustedPlacement: placement })
      },
      undoAdjustment: () => {
        const history = get().history
        if (!history.length) return
        set({ adjustedPlacement: history[history.length - 1], history: history.slice(0, -1) })
      },
      resetAdjustment: () => set({ adjustedPlacement: get().placementResult?.placement, history: [] }),
      setCurrentStep: (step) => set({ currentStep: step }),

      reset: () => set({
        skills: [], members: [], skillMatrix: {}, teams: [],
        placementMode: null, analysisResult: null, replacementAnalysis: null,
        placementResult: null, adjustedPlacement: null,
        history: [], currentStep: 0,
        replacementScenario: null, currentAssignment: {}, surplusMembers: [],
        tfId: null, tfName: null, tfProject: null, tfRequiredSkills: [], currentTeams: [], tfResult: null,
        edaResult: null, selectedIdf: [], selectedKss: [], selectedDiff: [], fitMatrix: null, fitStats: null, phase1Info: null, step2CurrentStep: 1,
        candidateTeams: [], maxAddPerTeam: {},
      }),
    }),
    {
      name: SESSION_KEY,
      partialize: (state) => ({
        placementType: state.placementType,
        flowType: state.flowType,
        skills: state.skills,
        members: state.members,
        skillMatrix: state.skillMatrix,
        teams: state.teams,
        placementMode: state.placementMode,
        analysisResult: state.analysisResult,
        replacementAnalysis: state.replacementAnalysis,
        conditions: state.conditions,
        placementResult: state.placementResult,
        adjustedPlacement: state.adjustedPlacement,
        currentStep: state.currentStep,
        replacementScenario: state.replacementScenario,
        currentAssignment: state.currentAssignment,
        surplusMembers: state.surplusMembers,
        tfId: state.tfId,
        tfName: state.tfName,
        tfProject: state.tfProject,
        tfRequiredSkills: state.tfRequiredSkills,
        currentTeams: state.currentTeams,
        edaResult: state.edaResult,
        selectedIdf: state.selectedIdf,
        selectedKss: state.selectedKss,
        selectedDiff: state.selectedDiff,
        fitMatrix: state.fitMatrix,
        fitStats: state.fitStats,
        step2CurrentStep: state.step2CurrentStep,
      }),
    }
  )
)

export default useStore
