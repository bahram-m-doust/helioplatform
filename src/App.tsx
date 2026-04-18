import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ServicesPage from './pages/ServicesPage';
import AgentStorePage from './pages/AgentStorePage';
import SoulPrintPage from './pages/SoulPrintPage';
import CommunityPage from './pages/CommunityPage';
import ImageGeneratorPage from './pages/ImageGeneratorPage';
import VideoGeneratorPage from './pages/VideoGeneratorPage';
import CampaignMakerPage from './pages/CampaignMakerPage';
import { ScrollToTop } from './components/navigation/ScrollToTop';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/agent-store" element={<AgentStorePage />} />
          <Route path="/soul-print" element={<SoulPrintPage />} />
          <Route path="/image-generator" element={<ImageGeneratorPage />} />
          <Route path="/video-generator" element={<VideoGeneratorPage />} />
          <Route path="/campaign-maker" element={<CampaignMakerPage />} />
          <Route path="/community" element={<CommunityPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
