import React from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '../../features/auth/AuthContext';

interface SiteHeaderProps {
  isAuthenticated?: boolean;
  onLoginClick?: () => void;
}

export function SiteHeader({ isAuthenticated, onLoginClick }: SiteHeaderProps) {
  const auth = useAuth();
  const resolvedIsAuthenticated = isAuthenticated ?? auth.isAuthenticated;
  const handleLoginClick = onLoginClick ?? auth.openAuthModal;

  const handleNavClick = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };
  const navBaseClass =
    'inline-flex h-11 items-center rounded-[10px] px-3 text-sm font-medium tracking-[-0.01em] leading-[1.6em] text-[rgba(28,22,41,0.9)] transition-colors hover:bg-[rgba(255,245,227,0.8)]';

  return (
    <>
      <header className="fixed left-1/2 top-[25px] z-50 w-[840px] max-w-full -translate-x-1/2 rounded-[10px] border border-white bg-[linear-gradient(180deg,rgba(246,241,252,0.5)_0%,rgba(255,255,255,0.5)_100%)] px-5 py-2.5 backdrop-blur-[5px] shadow-[0_0.8px_0.8px_-1px_rgba(0,0,0,0.04),0_2.4px_2.4px_-2px_rgba(0,0,0,0.04),0_6.4px_6.4px_-3px_rgba(0,0,0,0.03),0_20px_20px_-4px_rgba(0,0,0,0.01)]">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" onClick={handleNavClick} aria-label="Go to home" className="flex h-[35px] w-[58px] items-center">
            <BrandLogo variant="header" imageClassName="h-auto w-[55px]" />
          </Link>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-2.5 md:flex">
              <a href="https://platform.helio.ae/services" className={navBaseClass}>
                Services
              </a>
              <a href="https://platform.helio.ae/works" className={navBaseClass}>
                Works
              </a>
              <a href="https://platform.helio.ae/agent-store" className={navBaseClass}>
                Agent Store
              </a>
              <a href="https://api.helio.ae/brand-city" rel="noopener" className={navBaseClass}>
                Dashboard
              </a>
              <a href="https://api.helio.ae/heliogram" rel="noopener" className={navBaseClass}>
                Community
              </a>
              <a href="https://platform.helio.ae/pricing" className={navBaseClass}>
                Pricing
              </a>
            </nav>

            {resolvedIsAuthenticated ? (
              <span className="hidden h-11 items-center rounded-lg px-5 text-sm font-medium tracking-[-0.03em] text-neutral-900 md:inline-flex">
                Admin
              </span>
            ) : (
              <button
                type="button"
                onClick={handleLoginClick}
                className="hidden h-11 items-center justify-center whitespace-nowrap rounded-[8px] bg-[#fcb022] px-5 text-sm font-medium tracking-[-0.03em] text-black transition-colors hover:bg-[#e89e10] md:inline-flex"
              >
                Login
              </button>
            )}

            <button type="button" className="rounded-md p-2 text-neutral-700 md:hidden" aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div aria-hidden className="h-[96px]" />
    </>
  );
}
