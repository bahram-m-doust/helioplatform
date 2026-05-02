interface WordmarkLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function WordmarkLogo({ className = '', size = 'md' }: WordmarkLogoProps) {
  const sizeClass = size === 'lg' ? 'w-[188px]' : size === 'sm' ? 'w-[124px]' : 'w-[148px]'
  const logoSrc = `${import.meta.env.BASE_URL}heliogram-logo.png`

  return (
    <img
      src={logoSrc}
      alt="Bextudio"
      className={`h-auto object-contain ${sizeClass} ${className}`.trim()}
      loading="lazy"
      decoding="async"
    />
  )
}
