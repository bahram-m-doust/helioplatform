import React from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { COMMUNITY_URL } from '../../config/site';
import { useAuth } from '../../context/AuthContext';

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
  const isInternalCommunity = COMMUNITY_URL.startsWith('/');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" onClick={handleNavClick} aria-label="Go to home">
            <BrandLogo variant="header" imageClassName="h-10 w-auto sm:h-11" />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/services"
              onClick={handleNavClick}
              className="text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
            >
              Services
            </Link>
            <a href="#" className="text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors">
              Case Studies
            </a>
            <Link
              to="/agent-store"
              onClick={handleNavClick}
              className="text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
            >
              Agent Store
            </Link>
            {isInternalCommunity ? (
              <Link
                to={COMMUNITY_URL}
                onClick={handleNavClick}
                className="text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
              >
                Community
              </Link>
            ) : (
              <a
                href={COMMUNITY_URL}
                className="text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
              >
                Community
              </a>
            )}
            <a href="#" className="text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors">
              About Us
            </a>
          </nav>
          <div className="flex items-center gap-4">
            {resolvedIsAuthenticated ? (
              <span className="text-sm font-medium text-neutral-900 px-4">Admin</span>
            ) : (
              <button
                type="button"
                onClick={handleLoginClick}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all bg-yellow-400 text-neutral-900 hover:bg-yellow-500 h-9 px-4"
              >
                Log in
              </button>
            )}
            <button type="button" className="md:hidden p-2 text-neutral-700">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
