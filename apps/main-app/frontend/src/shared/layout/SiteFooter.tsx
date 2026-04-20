import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Linkedin, Github } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { COMMUNITY_URL } from '../config/site';

export function SiteFooter() {
  const isInternalCommunity = COMMUNITY_URL.startsWith('/');

  return (
    <footer className="bg-neutral-900 text-neutral-400">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="col-span-1 lg:col-span-2 flex flex-col items-start">
            <div className="mb-6">
              <BrandLogo variant="footer" imageClassName="h-12 w-auto sm:h-14" />
            </div>
            <p className="mb-8 text-sm leading-relaxed max-w-sm">
              Transforming businesses with innovative AI solutions and expert brand guidance. Empowering your
              identity across every touchpoint.
            </p>
            <div className="flex items-center gap-4 w-full max-w-md">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all placeholder:text-neutral-500"
              />
              <button
                type="button"
                className="bg-yellow-400 hover:bg-yellow-500 text-neutral-900 px-6 py-2.5 rounded-md text-sm font-semibold transition-colors shrink-0"
              >
                Subscribe
              </button>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-white uppercase tracking-wider">Services</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm hover:text-yellow-400 transition-colors">
                  Brand Integrator
                </a>
              </li>
              <li>
                <Link to="/soul-print" className="text-sm hover:text-yellow-400 transition-colors">
                  Soul Print
                </Link>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-yellow-400 transition-colors">
                  Brand Canvas
                </a>
              </li>
              <li>
                <Link to="/agent-store" className="text-sm hover:text-yellow-400 transition-colors">
                  Plug-in Agents
                </Link>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-yellow-400 transition-colors">
                  Content Factory
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-white uppercase tracking-wider">Company</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm hover:text-yellow-400 transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-yellow-400 transition-colors">
                  Case Studies
                </a>
              </li>
              <li>
                <Link to="/agent-store" className="text-sm hover:text-yellow-400 transition-colors">
                  Agent Store
                </Link>
              </li>
              <li>
                {isInternalCommunity ? (
                  <Link to={COMMUNITY_URL} className="text-sm hover:text-yellow-400 transition-colors">
                    Community
                  </Link>
                ) : (
                  <a href={COMMUNITY_URL} className="text-sm hover:text-yellow-400 transition-colors">
                    Community
                  </a>
                )}
              </li>
              <li>
                <a href="#" className="text-sm hover:text-yellow-400 transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-neutral-800 pt-8 sm:flex-row">
          <p className="text-sm">&copy; 2026 Helio. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-neutral-500 hover:text-yellow-400 transition-colors" aria-label="Twitter">
              <Twitter className="size-5" />
            </a>
            <a href="#" className="text-neutral-500 hover:text-yellow-400 transition-colors" aria-label="LinkedIn">
              <Linkedin className="size-5" />
            </a>
            <a href="#" className="text-neutral-500 hover:text-yellow-400 transition-colors" aria-label="GitHub">
              <Github className="size-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
