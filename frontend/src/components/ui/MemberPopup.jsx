import { useEffect } from 'react'
import Badge from './Badge'

const TYPE_LABELS = { '집중형': '집중형', '제너럴리스트형': '제너럴리스트형', '혼합형': '혼합형', specialist: '집중형', t_shaped: '혼합형', generalist: '제너럴리스트형' }
const TYPE_COLORS = { '집중형': 'mint', '제너럴리스트형': 'coral', '혼합형': 'yellow', specialist: 'mint', t_shaped: 'yellow', generalist: 'coral' }

/** 스킬 레벨 도트 표시 (1~5) */
function LevelDots({ level }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${i <= level ? 'bg-primary' : 'bg-[#e5e7eb]'}`}
        />
      ))}
    </div>
  )
}

export default function MemberPopup({ member, skills, skillMatrix, memberType, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!member) return null

  const type = memberType || 'generalist'

  // 보유 스킬: level > 0인 것만, 레벨 내림차순
  const ownedSkills = skills
    .map((s) => ({ ...s, level: skillMatrix[member.id]?.[s.id] ?? 0 }))
    .filter((s) => s.level > 0)
    .sort((a, b) => b.level - a.level)

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-canvas rounded-md shadow-xl w-full max-w-md overflow-hidden">
        {/* 헤더 */}
        <div className="bg-canvas-dark text-on-dark px-6 py-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/80 text-white flex items-center justify-center text-base font-bold shrink-0">
            {(member.name || member.id)?.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold">{member.name || member.id}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {member.role && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-sm text-ink font-medium">{member.role}</span>
              )}
              {member.gender && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-sm text-body">{member.gender}</span>
              )}
              {member.experience != null && member.experience > 0 && (
                <span className="text-xs text-body font-mono">경력 {member.experience}년</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={TYPE_COLORS[type]}>{TYPE_LABELS[type]}</Badge>
            <button
              onClick={onClose}
              className="text-body hover:text-on-dark text-lg leading-none cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 스킬 목록 */}
        <div className="px-6 py-5">
          <div className="text-xs font-mono text-body uppercase tracking-wider mb-4">
            보유 스킬 ({ownedSkills.length}개)
          </div>
          {ownedSkills.length === 0 ? (
            <p className="text-sm text-body">등록된 스킬이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {ownedSkills.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-28 truncate shrink-0">{s.name}</span>
                  <LevelDots level={s.level} />
                  <span className="text-xs font-mono text-body ml-1">Lv.{s.level}</span>
                  {s.category && (
                    <span className="ml-auto text-[10px] text-body bg-muted px-1.5 py-0.5 rounded-sm">{s.category}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** 카드에 표시할 상위 N개 스킬 태그 */
export function getTopSkills(memberId, skillMatrix, skills, n = 6) {
  return skills
    .map((s) => ({ ...s, level: skillMatrix[memberId]?.[s.id] ?? 0 }))
    .filter((s) => s.level > 0)
    .sort((a, b) => b.level - a.level)
    .slice(0, n)
}
