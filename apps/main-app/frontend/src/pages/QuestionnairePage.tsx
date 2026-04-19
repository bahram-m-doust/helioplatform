import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SiteFooter } from '../components/layout/SiteFooter';
import { useAuth } from '../context/AuthContext';
import { QUESTIONNAIRE_SECTIONS } from '../config/questionnaire';
import { getOverallProgress } from '../services/questionnaireStore';

export default function QuestionnairePage() {
  const { isAuthenticated, openAuthModal, username } = useAuth();

  const progress = useMemo(() => getOverallProgress(username), [username]);

  const percent = Math.round(progress.ratio * 100);

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-yellow-400 selection:text-neutral-900">
      <SiteHeader isAuthenticated={isAuthenticated} onLoginClick={openAuthModal} />

      <main>
        <section className="relative overflow-hidden bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                <span className="text-sm font-medium text-neutral-700">Brand City Questionnaire</span>
              </div>
              <h1 className="mb-5 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
                Tell us about <span className="text-yellow-400">your brand</span>
              </h1>
              <p className="text-lg text-neutral-600">
                Complete the six sections below. Your answers are saved automatically as you type and when you leave a page.
              </p>
            </div>

            {/* Overall progress */}
            <div className="mt-10 mx-auto max-w-3xl">
              <div className="flex items-center justify-between mb-2 text-sm font-medium text-neutral-600">
                <span>Overall progress</span>
                <span className="tabular-nums text-neutral-900">
                  {progress.answered} / {progress.total} <span className="text-neutral-400">({percent}%)</span>
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-neutral-100 overflow-hidden ring-1 ring-inset ring-neutral-200">
                <div
                  className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>
          <div className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 blur-3xl pointer-events-none" aria-hidden="true">
            <div className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-yellow-100 to-yellow-50 opacity-30"></div>
          </div>
        </section>

        <section className="bg-neutral-50 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {QUESTIONNAIRE_SECTIONS.map((section, index) => {
                const sectionProgress = progress.perSection[section.id] ?? {
                  total: section.questions.length,
                  answered: 0,
                  ratio: 0,
                };
                const sectionPercent = Math.round(sectionProgress.ratio * 100);
                const isComplete = sectionProgress.total > 0 && sectionProgress.answered === sectionProgress.total;
                const Icon = section.icon;

                return (
                  <Link
                    key={section.id}
                    to={`/questionnaire/${section.slug}`}
                    className="group relative bg-white rounded-2xl p-6 shadow-sm border border-neutral-200 hover:shadow-lg hover:border-yellow-400/50 transition-all duration-300 flex flex-col"
                  >
                    <div className={`absolute inset-x-0 top-0 h-24 -z-0 rounded-t-2xl bg-gradient-to-b ${section.accent}`} />
                    <div className="relative z-10 flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex size-11 items-center justify-center rounded-xl bg-white ring-1 ring-neutral-200 shadow-sm">
                          <Icon className="size-5 text-neutral-900" />
                        </div>
                        <div className="text-xs font-semibold text-neutral-500 tabular-nums">
                          0{index + 1}
                        </div>
                      </div>
                      {isComplete && (
                        <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 className="size-4" />
                          Complete
                        </div>
                      )}
                    </div>

                    <h3 className="relative z-10 mt-5 text-lg font-semibold text-neutral-900">
                      {section.title}
                    </h3>
                    <p className="relative z-10 mt-1 text-sm text-neutral-600 leading-relaxed">
                      {section.subtitle}
                    </p>

                    <div className="relative z-10 mt-6">
                      <div className="flex items-center justify-between mb-2 text-xs font-medium text-neutral-500">
                        <span>{sectionProgress.answered} / {sectionProgress.total} answered</span>
                        <span className="tabular-nums">{sectionPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className="h-full bg-yellow-400 transition-all duration-500"
                          style={{ width: `${sectionPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="relative z-10 mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between text-sm font-semibold text-neutral-900">
                      <span className="group-hover:text-yellow-600 transition-colors">
                        {sectionProgress.answered > 0 ? 'Continue' : 'Start'}
                      </span>
                      <ArrowRight className="size-4 text-neutral-400 group-hover:text-yellow-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
