import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { BrandsListPage } from './pages/BrandsListPage';
import { BrandDetailPage } from './pages/BrandDetailPage';
import { ImageAgentPage } from './pages/agents/ImageAgentPage';
import { VideoAgentPage } from './pages/agents/VideoAgentPage';
import { StorytellerAgentPage } from './pages/agents/StorytellerAgentPage';
import { CampaignAgentPage } from './pages/agents/CampaignAgentPage';
import { SoulPrintAgentPage } from './pages/agents/SoulPrintAgentPage';
import { RunsPage } from './pages/RunsPage';
import { UsagePage } from './pages/UsagePage';
import { AppShell } from './shared/AppShell';
import { useAuth } from './shared/auth';

export function App() {
  const { ready, session, configured } = useAuth();

  if (!configured) {
    // Hard-fail with an actionable message rather than booting a half-
    // wired UI. The deployer needs to set VITE_SUPABASE_URL +
    // VITE_SUPABASE_ANON_KEY at build time.
    return (
      <div style={{ padding: 32, fontFamily: 'monospace' }}>
        <h2>Helio Admin — not configured.</h2>
        <p>
          Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> at build time, then rebuild this app.
        </p>
      </div>
    );
  }

  if (!ready) return <div style={{ padding: 32 }}>Loading…</div>;

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/brands" replace />} />
        <Route path="/login" element={<Navigate to="/brands" replace />} />
        <Route path="/brands" element={<BrandsListPage />} />
        <Route path="/brands/:slug" element={<BrandDetailPage />} />
        <Route path="/agents/image" element={<ImageAgentPage />} />
        <Route path="/agents/video" element={<VideoAgentPage />} />
        <Route path="/agents/storyteller" element={<StorytellerAgentPage />} />
        <Route path="/agents/campaign" element={<CampaignAgentPage />} />
        <Route path="/agents/soul-print" element={<SoulPrintAgentPage />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/usage" element={<UsagePage />} />
        <Route path="*" element={<Navigate to="/brands" replace />} />
      </Routes>
    </AppShell>
  );
}
