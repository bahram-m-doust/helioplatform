import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Save } from 'lucide-react';
import { SiteHeader } from '../../shared/layout/SiteHeader';
import { SiteFooter } from '../../shared/layout/SiteFooter';
import { useAuth } from '../auth/AuthContext';
import {
  QUESTIONNAIRE_SECTIONS,
  getSectionBySlug,
  getSectionIndex,
} from './data';
import {
  loadSectionAnswers,
  saveSectionAnswers,
  type SectionAnswers,
} from './storage';

type SaveState = 'idle' | 'saving' | 'saved';

export default function QuestionnaireSectionPage() {
  const { sectionSlug = '' } = useParams<{ sectionSlug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal, username } = useAuth();

  const section = useMemo(() => getSectionBySlug(sectionSlug), [sectionSlug]);
  const sectionIndex = useMemo(() => getSectionIndex(sectionSlug), [sectionSlug]);

  const [answers, setAnswers] = useState<SectionAnswers>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const answersRef = useRef<SectionAnswers>({});
  const saveTimerRef = useRef<number | null>(null);
  const saveStateTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!section) return;
    const stored = loadSectionAnswers(username, section.id);
    setAnswers(stored);
    answersRef.current = stored;
  }, [section, username]);

  const persist = useCallback(
    (next: SectionAnswers) => {
      if (!section) return;
      setSaveState('saving');
      saveSectionAnswers(username, section.id, next);
      if (saveStateTimerRef.current) window.clearTimeout(saveStateTimerRef.current);
      saveStateTimerRef.current = window.setTimeout(() => {
        setSaveState('saved');
        saveStateTimerRef.current = window.setTimeout(() => setSaveState('idle'), 1500);
      }, 300);
    },
    [section, username],
  );

  const scheduleSave = useCallback(
    (next: SectionAnswers) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        persist(next);
      }, 600);
    },
    [persist],
  );

  const handleChange = (questionId: string, value: string) => {
    const next = { ...answersRef.current, [questionId]: value };
    answersRef.current = next;
    setAnswers(next);
    scheduleSave(next);
  };

  const handleBlur = () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    persist(answersRef.current);
  };

  // Save on unmount (e.g., navigating away via router) and on page hide/unload.
  useEffect(() => {
    const flushOnLeave = () => {
      if (!section) return;
      saveSectionAnswers(username, section.id, answersRef.current);
    };

    window.addEventListener('beforeunload', flushOnLeave);
    window.addEventListener('pagehide', flushOnLeave);

    return () => {
      window.removeEventListener('beforeunload', flushOnLeave);
      window.removeEventListener('pagehide', flushOnLeave);
      flushOnLeave();
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (saveStateTimerRef.current) window.clearTimeout(saveStateTimerRef.current);
    };
  }, [section, username]);

  if (!section) {
    return <Navigate to="/questionnaire" replace />;
  }

  const answeredCount = section.questions.filter(
    (q) => (answers[q.id] ?? '').trim().length > 0,
  ).length;
  const total = section.questions.length;
  const percent = total === 0 ? 0 : Math.round((answeredCount / total) * 100);
  const isComplete = total > 0 && answeredCount === total;

  const prevSection = sectionIndex > 0 ? QUESTIONNAIRE_SECTIONS[sectionIndex - 1] : null;
  const nextSection =
    sectionIndex >= 0 && sectionIndex < QUESTIONNAIRE_SECTIONS.length - 1
      ? QUESTIONNAIRE_SECTIONS[sectionIndex + 1]
      : null;

  const handleNext = () => {
    persist(answersRef.current);
    if (nextSection) {
      navigate(`/questionnaire/${nextSection.slug}`);
    } else {
      navigate('/questionnaire');
    }
  };

  const handlePrev = () => {
    persist(answersRef.current);
    if (prevSection) {
      navigate(`/questionnaire/${prevSection.slug}`);
    } else {
      navigate('/questionnaire');
    }
  };

  const Icon = section.icon;

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-yellow-400 selection:text-neutral-900">
      <SiteHeader isAuthenticated={isAuthenticated} onLoginClick={openAuthModal} />

      <main>
        <section className="relative overflow-hidden bg-white pt-12 pb-6 sm:pt-16">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
              <Link to="/questionnaire" className="hover:text-neutral-900 transition-colors">
                Questionnaire
              </Link>
              <span>/</span>
              <span className="text-neutral-900 font-medium">{section.title}</span>
            </div>

            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="inline-flex size-12 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/30">
                  <Icon className="size-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wider uppercase text-yellow-600">
                    Section {String(sectionIndex + 1).padStart(2, '0')} of {QUESTIONNAIRE_SECTIONS.length}
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900 mt-1">
                    {section.title}
                  </h1>
                  <p className="text-neutral-600 mt-1">{section.subtitle}</p>
                </div>
              </div>

              <div className="text-sm font-medium text-neutral-500 inline-flex items-center gap-2 min-h-[24px]">
                {saveState === 'saving' && (
                  <>
                    <Save className="size-4 animate-pulse text-neutral-400" />
                    <span>Saving…</span>
                  </>
                )}
                {saveState === 'saved' && (
                  <>
                    <CheckCircle2 className="size-4 text-yellow-500" />
                    <span>Saved</span>
                  </>
                )}
              </div>
            </div>

            {/* Per-section progress bar */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-2 text-sm font-medium text-neutral-600">
                <span>Section progress</span>
                <span className="tabular-nums text-neutral-900">
                  {answeredCount} / {total} <span className="text-neutral-400">({percent}%)</span>
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden ring-1 ring-inset ring-neutral-200">
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

        <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <div className="space-y-6">
              {section.questions.map((question, idx) => {
                const value = answers[question.id] ?? '';
                const isAnswered = value.trim().length > 0;
                return (
                  <div
                    key={question.id}
                    className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-neutral-200 hover:border-neutral-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600 tabular-nums mt-0.5">
                          {idx + 1}
                        </span>
                        <label
                          htmlFor={question.id}
                          className="text-lg font-semibold text-neutral-900 leading-snug"
                        >
                          {question.title}
                        </label>
                      </div>
                      {isAnswered && (
                        <CheckCircle2 className="size-5 text-yellow-500 shrink-0" />
                      )}
                    </div>

                    <textarea
                      id={question.id}
                      value={value}
                      onChange={(e) => handleChange(question.id, e.target.value)}
                      onBlur={handleBlur}
                      placeholder={question.guide}
                      rows={4}
                      className="w-full resize-y bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400/70 placeholder:italic focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/30 focus:bg-white transition-all leading-relaxed"
                    />
                  </div>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="mt-10 flex items-center justify-between gap-4 flex-wrap">
              <button
                type="button"
                onClick={handlePrev}
                className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-all border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 h-11 px-5"
              >
                <ArrowLeft className="size-4" />
                {prevSection ? prevSection.title : 'Back to overview'}
              </button>

              <div className="flex items-center gap-3">
                <Link
                  to="/questionnaire"
                  onClick={() => persist(answersRef.current)}
                  className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-all border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 h-11 px-5"
                >
                  Save & Exit
                </Link>
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-all bg-yellow-400 text-neutral-900 hover:bg-yellow-500 h-11 px-6 shadow-sm"
                >
                  {nextSection ? `Next: ${nextSection.title}` : isComplete ? 'Finish' : 'Back to overview'}
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
