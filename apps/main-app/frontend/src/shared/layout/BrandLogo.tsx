import React from 'react';
import footerLogoSrc from '../../assets/logo-footer.png';
import headerLogoSrc from '../../assets/logo.header.png';

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  variant?: 'header' | 'footer';
}

export function BrandLogo({
  className = '',
  imageClassName = '',
  variant = 'header',
}: BrandLogoProps) {
  const logoSrc = variant === 'footer' ? footerLogoSrc : headerLogoSrc;
  const sizeClass = variant === 'footer' ? 'h-[47px] w-[133px]' : 'h-[56px] w-[160px]';

  return (
    <div className={className}>
      <img
        src={logoSrc}
        alt="Bextudio"
        className={`block select-none object-contain ${sizeClass} ${imageClassName}`.trim()}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
