import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

// Phase 5.8 stripped this app down to just the onboarding questionnaire.
// The customer-facing site moved to Framer (``platform.helio.ae``); the
// agent test surfaces moved to the admin app (``admin.helio.ae``).
const QuestionnairePage = lazy(() => import('./features/questionnaire/QuestionnairePage'));
const QuestionnaireSectionPage = lazy(
  () => import('./features/questionnaire/QuestionnaireSectionPage'),
);
const RootRedirect = lazy(() => import('./features/RootRedirect'));

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/questionnaire" element={<QuestionnairePage />} />
        <Route path="/questionnaire/:sectionSlug" element={<QuestionnaireSectionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
