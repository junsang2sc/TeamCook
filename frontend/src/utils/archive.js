import { nanoid } from 'nanoid'

export const ARCHIVE_KEY = 'teamcook_archive'
const MAX_ITEMS = 20

export const getArchive = () => {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]') }
  catch { return [] }
}

export const saveToArchive = (snapshot) => {
  const items = getArchive()
  const item = { id: nanoid(), createdAt: Date.now(), ...snapshot }
  const updated = [item, ...items].slice(0, MAX_ITEMS)
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated))
  return item.id
}

export const deleteFromArchive = (id) => {
  const items = getArchive().filter(i => i.id !== id)
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(items))
}

export const TYPE_META = {
  new: { icon: '🍳', label: '신규배치' },
  re:  { icon: '🔄', label: '재배치'   },
  tf:  { icon: '⚡', label: 'TF 구성'  },
}
