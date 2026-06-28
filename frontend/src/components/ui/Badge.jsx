export default function Badge({ children, variant = 'neutral', className = '' }) {
  const variants = {
    neutral:    'bg-muted text-ink border border-muted-dark/30',
    dark:       'bg-surface-dark text-on-dark',
    rare:       'bg-accent-coral-tint text-accent-coral-dark border border-accent-coral/40',
    orange:     'bg-accent-coral-tint text-accent-coral-dark border border-accent-coral/40',
    normal:     'bg-accent-yellow-tint text-accent-yellow-dark border border-accent-yellow/60',
    periwinkle: 'bg-accent-yellow-tint text-accent-yellow-dark border border-accent-yellow/60',
    amber:      'bg-accent-yellow-tint text-accent-yellow-dark border border-accent-yellow/60',
    common:     'bg-primary-tint text-primary-dark border border-primary/30',
    mint:       'bg-primary-tint text-primary-dark border border-primary/30',
    coral:      'bg-accent-coral-tint text-accent-coral-dark border border-accent-coral/40',
    yellow:     'bg-accent-yellow-tint text-accent-yellow-dark border border-accent-yellow/60',
    magenta:    'bg-accent-coral-tint text-accent-coral-dark border border-accent-coral/40',
    red:        'bg-[#fee2e2] text-[#dc2626] border border-[#dc2626]/20',
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-sm ${variants[variant] ?? variants.neutral} ${className}`}>
      {children}
    </span>
  )
}
