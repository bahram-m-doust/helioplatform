import React from 'react';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SiteFooter } from '../components/layout/SiteFooter';

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-yellow-400 selection:text-neutral-900 flex flex-col">
      <SiteHeader />

      <main className="flex-1 bg-neutral-50 py-12">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-neutral-900 mb-4">Community Service Is Not Connected Yet</h1>
            <p className="text-neutral-600 mb-6 leading-relaxed">
              برای اجرای Community باید HelioGram (frontend + backend) در حال اجرا باشد یا لینک Production آن را در
              `VITE_COMMUNITY_URL` تنظیم کنید.
            </p>

            <div className="space-y-4 text-sm text-neutral-700">
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                <p className="font-semibold mb-2">Local Run</p>
                <p>از ریشه پروژه اجرا کن:</p>
                <code className="block mt-2 rounded-md bg-neutral-900 text-neutral-100 px-3 py-2">npm run dev</code>
              </div>

              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                <p className="font-semibold mb-2">Production</p>
                <p>
                  مقدار `VITE_COMMUNITY_URL` را روی آدرس دیپلوی HelioGram بگذار (مثلاً `https://community.yourdomain.com`).
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="http://localhost:5050"
                className="inline-flex items-center justify-center rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-yellow-500 transition-colors"
              >
                Open Local Community
              </a>
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 transition-colors"
              >
                Back To Main Site
              </a>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
