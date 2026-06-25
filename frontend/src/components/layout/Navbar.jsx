import { useNavigate } from 'react-router-dom'

const STEPS = ['데이터 입력', '자동 분석', '배치 조건', '결과', '수동 조정']

export default function Navbar({ currentStep }) {
  const navigate = useNavigate()

  return (
    <nav className="bg-canvas-dark text-on-dark px-8 py-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)]">
      <button onClick={() => navigate('/')} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <img src="/TeamCook Icon.png" alt="" className="h-6 w-auto" />
        <img src="/TeamCooK Logo.png" alt="TeamCooK" className="h-5 w-auto" />
      </button>
      {currentStep > 0 && (
        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => {
            const step = i + 1
            const active = step === currentStep
            const done = step < currentStep
            return (
              <div key={step} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs ${
                  active ? 'bg-[rgba(77,158,237,0.2)] text-on-dark' : done ? 'text-[#9ca3af]' : 'text-[#6b7280]'
                }`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    done ? 'bg-accent-mint text-ink' : active ? 'bg-primary text-on-dark' : 'bg-surface-dark-soft text-[#9ca3af]'
                  }`}>{done ? '✓' : step}</span>
                  <span className="hidden sm:block">{label}</span>
                </div>
                {i < STEPS.length - 1 && <span className="text-[#4b5563] text-xs">›</span>}
              </div>
            )
          })}
        </div>
      )}
    </nav>
  )
}
