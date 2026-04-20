import React from 'react';
import headerLogo from '../../assets/helio-logo-header.png';
import footerLogo from '../../assets/helio-logo-footer.png';

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  variant?: 'header' | 'footer';
}

export function BrandLogo({
  className = '',
  imageClassName = 'h-10 w-auto sm:h-12',
  variant = 'header',
}: BrandLogoProps) {
  const logoSrc = variant === 'footer' ? footerLogo : headerLogo;

  return (
    <div className={className}>
      <img src={logoSrc} alt="Helio" className={`block object-contain ${imageClassName}`.trim()} />
    </div>
  );
}
