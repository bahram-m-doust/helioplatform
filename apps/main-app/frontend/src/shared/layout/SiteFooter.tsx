import React from 'react';
import { useLocation } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

interface SiteFooterProps {
  className?: string;
}

export function SiteFooter({ className = '' }: SiteFooterProps) {
  const { pathname } = useLocation();

  const hideOnAgentPages =
    pathname === '/image-generator' ||
    pathname === '/video-generator' ||
    pathname === '/soul-print' ||
    pathname === '/campaign-maker' ||
    pathname === '/storyteller';

  if (hideOnAgentPages) {
    return null;
  }

  const handleSubscribeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <footer className={`mt-16 w-full border-t border-[#e6e6e6] bg-white py-12 ${className}`.trim()}>
      <div className="mx-auto w-full max-w-[1280px] px-8">
        <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="pt-1">
            <BrandLogo variant="footer" />
          </div>

          <form
            onSubmit={handleSubscribeSubmit}
            className="flex w-full max-w-[400px] flex-col gap-4 sm:flex-row sm:items-start sm:gap-4"
          >
            <input
              type="email"
              placeholder="Enter your email"
              required
              className="h-[44px] flex-1 rounded-[8px] border border-[#cfd4dc] bg-white px-[14px] text-base text-[#344053] shadow-[0_1px_2px_rgba(16,24,40,0.05)] outline-none placeholder:text-[#344053]"
            />
            <button
              type="submit"
              className="h-[44px] rounded-[8px] bg-[#22ccee] px-[18px] text-base font-semibold text-black shadow-[0_1px_6px_rgba(10,30,33,0.05)] transition-colors hover:bg-[#1fb6d4]"
            >
              Subscribe
            </button>
          </form>
        </div>
        <div className="mt-8 flex w-full items-center justify-end">
          <p className="text-right text-base leading-6 text-neutral-900">&copy; 2026 Bextudio</p>
        </div>
      </div>
    </footer>
  );
}
