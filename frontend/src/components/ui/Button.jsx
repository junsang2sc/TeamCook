export default function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-primary text-white hover:bg-accent-coral',
    mint: 'bg-primary text-white hover:bg-accent-coral',
    ghost: 'bg-muted text-ink hover:bg-muted-dark',
    outline: 'bg-canvas text-ink border border-[rgba(0,0,0,0.12)] hover:bg-surface',
    danger: 'bg-[#dc2626] text-white hover:bg-[#b91c1c]',
  }

  const sizes = {
    sm: 'text-xs px-3 py-1.5 rounded-[3.25px]',
    md: 'text-sm px-6 py-1.5 rounded-sm',
    lg: 'text-base px-8 py-3 rounded-sm',
  }

  return (
    <button className={`${base} ${variants[variant] ?? variants.primary} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  )
}
