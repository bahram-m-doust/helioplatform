import React from 'react';
import { BrandLogo } from './BrandLogo';

export function SiteFooter() {
  const handleSubscribeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <footer className="flex w-full flex-col items-center gap-10 bg-black py-12">
      <div className="w-full max-w-[1280px] px-8">
        <div className="flex w-full flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="h-10 w-[113px]">
            <BrandLogo variant="footer" imageClassName="h-full w-full object-contain" />
          </div>

          <form
            onSubmit={handleSubscribeSubmit}
            className="flex w-full max-w-[400px] flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4"
          >
            <input
              type="email"
              placeholder="Enter your email"
              required
              className="h-11 flex-1 rounded-[8px] border border-[#cfd4dc] bg-white px-3.5 text-base text-[#344053] shadow-[0_1px_2px_rgba(16,24,40,0.05)] outline-none placeholder:text-[#344053]"
            />
            <button
              type="submit"
              className="h-11 rounded-[8px] bg-[#fcb022] px-[18px] text-base font-semibold text-black shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-colors hover:bg-[#e89e10]"
            >
              Subscribe
            </button>
          </form>
        </div>
      </div>

      <div className="w-full max-w-[1280px] px-8">
        <div className="flex w-full items-center justify-end">
          <p className="text-right text-base leading-6 text-white">&copy; 2026 Helio</p>
        </div>
      </div>
    </footer>
  );
}
