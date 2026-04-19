import type { ReactNode } from 'react';
import './AgentAppShell.css';

export type AgentAppShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function AgentAppShell({ title, subtitle, children }: AgentAppShellProps) {
  return (
    <div className="agent-app-shell">
      <header className="agent-app-shell__header">
        <h1 className="agent-app-shell__title">{title}</h1>
        {subtitle ? <p className="agent-app-shell__subtitle">{subtitle}</p> : null}
      </header>
      <main className="agent-app-shell__main">{children}</main>
    </div>
  );
}
