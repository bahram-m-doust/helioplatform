import React, { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

const LandingPage = lazy(() => import('./features/marketing/LandingPage'));
const ServicesPage = lazy(() => import('./features/marketing/ServicesPage'));
const BrandCityPage = lazy(() => import('./features/brand-city/BrandCityPage'));
const QuestionnairePage = lazy(() => import('./features/questionnaire/QuestionnairePage'));
const QuestionnaireSectionPage = lazy(
  () => import('./features/questionnaire/QuestionnaireSectionPage'),
);
const AgentStorePage = lazy(() => import('./features/agents/AgentStorePage'));
const SoulPrintPage = lazy(() => import('./features/agents/soul-print/SoulPrintPage'));
const ImageGeneratorPage = lazy(
  () => import('./features/agents/image-generator/ImageGeneratorPage'),
);
const VideoGeneratorPage = lazy(
  () => import('./features/agents/video-generator/VideoGeneratorPage'),
);
const CampaignMakerPage = lazy(
  () => import('./features/agents/campaign-maker/CampaignMakerPage'),
);
const StorytellerPage = lazy(() => import('./features/agents/storyteller/StorytellerPage'));

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/brand-city" element={<BrandCityPage />} />
        <Route path="/questionnaire" element={<QuestionnairePage />} />
        <Route path="/questionnaire/:sectionSlug" element={<QuestionnaireSectionPage />} />
        <Route path="/agent-store" element={<AgentStorePage />} />
        <Route path="/soul-print" element={<SoulPrintPage />} />
        <Route path="/image-generator" element={<ImageGeneratorPage />} />
        <Route path="/video-generator" element={<VideoGeneratorPage />} />
        <Route path="/campaign-maker" element={<CampaignMakerPage />} />
        <Route path="/storyteller" element={<StorytellerPage />} />
      </Routes>
    </Suspense>
  );
}
