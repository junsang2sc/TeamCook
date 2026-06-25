const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '알 수 없는 오류' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const analyzeData = (payload) =>
  request('/api/analyze', { method: 'POST', body: JSON.stringify(payload) })

export const getPlacement = (payload) =>
  request('/api/placement', { method: 'POST', body: JSON.stringify(payload) })

export const validatePlacement = (payload) =>
  request('/api/validate', { method: 'POST', body: JSON.stringify(payload) })

export const recompute = (payload) =>
  request('/api/recompute', { method: 'POST', body: JSON.stringify(payload) })

export const getComment = (payload) =>
  request('/api/comment', { method: 'POST', body: JSON.stringify(payload) })

export const shareResult = (payload) =>
  request('/api/share', { method: 'POST', body: JSON.stringify(payload) })
