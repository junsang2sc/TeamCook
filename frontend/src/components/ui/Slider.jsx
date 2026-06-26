import { useState, useEffect, useCallback } from 'react'

export default function Slider({ min, max, step = 1, value, onChange, label, recommendedValue }) {
  // 드래그 중엔 raw 위치(부드럽게), 릴리즈 후엔 스냅된 값
  const [raw, setRaw] = useState(value)

  useEffect(() => { setRaw(value) }, [value])

  const snap = useCallback((v) => {
    const snapped = Math.round((v - min) / step) * step + min
    return Math.min(max, Math.max(min, Math.round(snapped * 1000) / 1000))
  }, [min, max, step])

  const pct = ((raw - min) / (max - min)) * 100

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">{label}</span>
          <div className="flex items-center gap-2">
            {recommendedValue !== undefined && (
              <span className="text-xs text-body">추천: {recommendedValue}</span>
            )}
            <span className="text-sm font-mono font-medium text-ink">{snap(raw)}</span>
          </div>
        </div>
      )}
      <div className="relative flex items-center" style={{ height: 28 }}>
        {/* 트랙 */}
        <div className="absolute w-full h-1.5 rounded-full bg-hairline" />
        <div className="absolute h-1.5 rounded-full bg-ink" style={{ width: `${pct}%` }} />
        {/* Thumb */}
        <div
          className="absolute w-5 h-5 rounded-full bg-ink shadow -translate-x-1/2 pointer-events-none"
          style={{ left: `${pct}%` }}
        />
        {/* 실제 input — step:any로 부드럽게, 스냅은 JS에서 */}
        <input
          type="range"
          min={min}
          max={max}
          step="any"
          value={raw}
          onChange={e => {
            const v = Number(e.target.value)
            setRaw(v)               // 시각적으로 부드럽게
            onChange(snap(v))       // 부모엔 스냅된 값
          }}
          onMouseUp={e  => { const s = snap(Number(e.target.value)); setRaw(s); onChange(s) }}
          onTouchEnd={e => { const s = snap(Number(e.target.value)); setRaw(s); onChange(s) }}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height: 28 }}
        />
      </div>
    </div>
  )
}
