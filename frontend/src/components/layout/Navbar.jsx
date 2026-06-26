import { useNavigate } from 'react-router-dom'

const STEPS = ['데이터 입력', '개인별 적합도 산출', '최적 팀 배치 설정', '결과', '수동 조정']

export default function Navbar({ currentStep }) {
  const navigate = useNavigate()

  return (
    <nav className="fixed top-0 left-0 right-0 z-30 bg-white text-ink px-8 py-4 flex items-center justify-between border-b border-hairline">
      <button onClick={() => navigate('/')} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <img src="/TeamCook Icon.png" alt="" className="h-9 w-auto" />
        <img src="/TeamCooK Logo.png" alt="TeamCooK" className="h-8 w-auto" />
      </button>

      {currentStep === 0 && (
        <button onClick={() => navigate('/archive')} className="text-xs font-mono hover:opacity-70 transition-opacity text-body">
          내 배치 기록
        </button>
      )}

      {currentStep > 0 && (
        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => {
            const step = i + 1
            const active = step === currentStep
            const done = step < currentStep
            const clickable = done
            return (
              <div key={step} className="flex items-center gap-1">
                <div
                  onClick={clickable ? () => navigate(`/step/${step}`) : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs transition-opacity ${
                    active ? 'bg-[rgba(46,204,135,0.12)] text-ink' : done ? 'text-body' : 'text-body/50'
                  } ${clickable ? 'cursor-pointer hover:opacity-70' : 'cursor-default'}`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    done ? 'bg-primary text-white' : active ? 'bg-primary text-white' : 'bg-hairline text-body'
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
