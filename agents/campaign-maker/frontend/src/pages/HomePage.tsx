import { AgentAppShell } from '@helio/agent-shared-ui';

export function HomePage() {
  return (
    <AgentAppShell title="Campaign Maker" subtitle="Helio agent UI (scaffold)">
      <p>
        This shell is ready for campaign workflows. Configure{' '}
        <code>VITE_API_BASE_URL</code> when the backend exposes real endpoints.
      </p>
    </AgentAppShell>
  );
}
