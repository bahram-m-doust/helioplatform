import React from 'react';
import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '../../features/auth/AuthContext';

interface SiteHeaderProps {
  isAuthenticated?: boolean;
  onLoginClick?: () => void;
}

export function SiteHeader({ isAuthenticated, onLoginClick }: SiteHeaderProps) {
  const auth = useAuth();
  const { pathname } = useLocation();
  const resolvedIsAuthenticated = isAuthenticated ?? auth.isAuthenticated;
  const handleLoginClick = onLoginClick ?? auth.openAuthModal;

  const hideOnAgentPages =
    pathname === '/image-generator' ||
    pathname === '/video-generator' ||
    pathname === '/soul-print' ||
    pathname === '/campaign-maker' ||
    pathname === '/storyteller';

  if (hideOnAgentPages) {
    return null;
  }

  const handleNavClick = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };
  const navBaseClass =
    'inline-flex h-10 items-center rounded-[10px] px-[14px] text-[14px] font-medium tracking-[-0.01em] leading-[1.6] text-black/90 transition-colors hover:bg-[#fff5e3]/70';

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 w-full">
        <div className="w-full overflow-hidden rounded-[10px] border border-white bg-[linear-gradient(180deg,rgba(237,249,250,0.5)_0%,rgba(255,255,255,0.5)_100%)] backdrop-blur-[5px] shadow-[0_0.796px_0.796px_-1px_rgba(0,0,0,0.04),0_2.414px_2.414px_-2px_rgba(0,0,0,0.04),0_6.383px_6.383px_-3px_rgba(0,0,0,0.03),0_20px_20px_-4px_rgba(0,0,0,0.01)]">
          <div className="mx-auto hidden w-full max-w-[1640px] items-center gap-8 px-5 py-[10px] md:flex">
            <div className="flex min-w-0 items-center gap-10">
              <a
                href="https://platform.helio.ae/"
                onClick={handleNavClick}
                aria-label="Go to home"
                className="flex min-h-[50px] min-w-[140px] items-center"
              >
                <BrandLogo variant="header" />
              </a>

              <nav className="flex min-w-0 items-center gap-5">
                <a href="https://platform.helio.ae/services" className={navBaseClass}>
                  Services
                </a>
                <a href="https://platform.helio.ae/agent-store" className={navBaseClass}>
                  Agent Store
                </a>
                <a href="https://platform.helio.ae/works" className={navBaseClass}>
                  Projects
                </a>
                <a href="https://platform.helio.ae/pricing" className={navBaseClass}>
                  Pricing
                </a>
                <a href="https://api.helio.ae/community" rel="noopener" className={navBaseClass}>
                  Community
                </a>
              </nav>
            </div>

            <div className="ml-auto flex items-center gap-5">
              <a href="https://api.helio.ae/dashboard" rel="noopener" className={navBaseClass}>
                Dashboard
              </a>

              {resolvedIsAuthenticated ? (
                <span className="inline-flex h-[43px] items-center rounded-[8px] px-5 text-[14px] font-medium leading-[1.6] tracking-[-0.01em] text-black">
                  Admin
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleLoginClick}
                  className="inline-flex h-[43px] items-center justify-center whitespace-nowrap rounded-[8px] bg-[#22ccee] px-6 text-[14px] font-medium tracking-[-0.03em] text-black transition-colors hover:bg-[#1fb6d4]"
                >
                  Login
                </button>
              )}
            </div>
          </div>

          <div className="mx-auto flex w-full items-center justify-between px-4 py-[10px] md:hidden">
            <a href="https://platform.helio.ae/" onClick={handleNavClick} aria-label="Go to home" className="flex items-center">
              <BrandLogo variant="header" imageClassName="h-[46px] w-[132px]" />
            </a>
            <button type="button" className="rounded-md p-2 text-neutral-700" aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div aria-hidden className="h-[96px] md:h-[104px]" />
    </>
  );
}
