export default function Slider({ min, max, step = 1, value, onChange, label, recommendedValue }) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">{label}</span>
          <div className="flex items-center gap-2">
            {recommendedValue !== undefined && (
              <span className="text-xs text-body">추천: {recommendedValue}</span>
            )}
            <span className="text-sm font-mono font-medium text-ink">{value}</span>
          </div>
        </div>
      )}
      <div className="relative h-5 flex items-center">
        <div className="w-full h-1 bg-[#e5e7eb] rounded-full">
          <div className="h-full bg-ink rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
        />
        <div
          className="absolute w-4 h-4 bg-ink rounded-full -translate-x-1/2"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  )
}
