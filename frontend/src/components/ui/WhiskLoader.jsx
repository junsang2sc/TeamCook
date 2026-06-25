import { useEffect, useState } from 'react'

// 1→2→...→12→1→2→... (단순 루프)
const FRAME_COUNT = 12
const FRAMES = Array.from({ length: FRAME_COUNT }, (_, i) => `/loading/Loading ${i + 1}.png`)

export default function WhiskLoader({ fps = 12, size = 120 }) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % FRAME_COUNT)
    }, Math.round(1000 / fps))
    return () => clearInterval(interval)
  }, [fps])

  return (
    <img
      src={FRAMES[frame]}
      alt="loading"
      width={size}
      height={size}
      style={{ imageRendering: 'auto' }}
      draggable={false}
    />
  )
}
