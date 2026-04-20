import { QUESTIONNAIRE_SECTIONS, TOTAL_QUESTION_COUNT } from './data';

const STORAGE_ROOT = 'helio.questionnaire';
const GUEST_USERNAME = 'guest';

export type SectionAnswers = Record<string, string>;

export interface QuestionnaireStore {
  [sectionId: string]: SectionAnswers;
}

const canUseStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getStorageKey = (username: string | null | undefined): string => {
  const safeUsername = username && username.trim().length > 0 ? username.trim() : GUEST_USERNAME;
  return `${STORAGE_ROOT}.${safeUsername}`;
};

export function loadQuestionnaire(username: string | null): QuestionnaireStore {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(username));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as QuestionnaireStore;
    }
    return {};
  } catch {
    return {};
  }
}

export function loadSectionAnswers(username: string | null, sectionId: string): SectionAnswers {
  const store = loadQuestionnaire(username);
  return store[sectionId] ?? {};
}

export function saveSectionAnswers(
  username: string | null,
  sectionId: string,
  answers: SectionAnswers,
): void {
  if (!canUseStorage()) return;

  try {
    const store = loadQuestionnaire(username);
    const cleaned: SectionAnswers = {};
    for (const [key, value] of Object.entries(answers)) {
      const trimmed = (value ?? '').trim();
      if (trimmed.length > 0) {
        cleaned[key] = value;
      }
    }

    if (Object.keys(cleaned).length === 0) {
      delete store[sectionId];
    } else {
      store[sectionId] = cleaned;
    }

    window.localStorage.setItem(getStorageKey(username), JSON.stringify(store));
  } catch {
    /* noop */
  }
}

export interface SectionProgress {
  total: number;
  answered: number;
  ratio: number;
}

export function getSectionProgress(
  username: string | null,
  sectionId: string,
): SectionProgress {
  const section = QUESTIONNAIRE_SECTIONS.find((s) => s.id === sectionId);
  const answers = loadSectionAnswers(username, sectionId);
  const total = section ? section.questions.length : 0;
  const answered = Object.values(answers).filter((value) => (value ?? '').trim().length > 0).length;
  return {
    total,
    answered,
    ratio: total === 0 ? 0 : answered / total,
  };
}

export interface OverallProgress {
  total: number;
  answered: number;
  ratio: number;
  perSection: Record<string, SectionProgress>;
}

export function getOverallProgress(username: string | null): OverallProgress {
  const store = loadQuestionnaire(username);
  let answered = 0;
  const perSection: Record<string, SectionProgress> = {};

  for (const section of QUESTIONNAIRE_SECTIONS) {
    const sectionAnswers = store[section.id] ?? {};
    const sectionAnswered = Object.values(sectionAnswers).filter(
      (value) => (value ?? '').trim().length > 0,
    ).length;
    answered += sectionAnswered;
    perSection[section.id] = {
      total: section.questions.length,
      answered: sectionAnswered,
      ratio: section.questions.length === 0 ? 0 : sectionAnswered / section.questions.length,
    };
  }

  return {
    total: TOTAL_QUESTION_COUNT,
    answered,
    ratio: TOTAL_QUESTION_COUNT === 0 ? 0 : answered / TOTAL_QUESTION_COUNT,
    perSection,
  };
}
