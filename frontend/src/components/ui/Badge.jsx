export default function Badge({ children, variant = 'neutral', className = '' }) {
  const variants = {
    neutral: 'bg-canvas text-ink border border-[rgba(0,0,0,0.08)]',
    dark: 'bg-surface-dark-soft text-on-dark',
    orange: 'bg-[#fdf0e8] text-primary border border-primary/20',
    magenta: 'bg-[#fdf0e8] text-primary border border-primary/20',
    periwinkle: 'bg-[#fef6e8] text-[#B8760A] border border-secondary/40',
    mint: 'bg-[#eef6ed] text-[#3A7D44] border border-[#A8D5A2]/40',
    red: 'bg-[#fee2e2] text-[#dc2626] border border-[#dc2626]/20',
    amber: 'bg-[#fef6e8] text-[#B8760A] border border-secondary/40',
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-sm ${variants[variant] ?? variants.neutral} ${className}`}>
      {children}
    </span>
  )
}
