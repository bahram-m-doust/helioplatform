import { NavLink } from 'react-router-dom';
import { useAuth } from './auth';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, signOut } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Helio Admin</h1>
        <nav>
          <NavLink to="/brands">Brands</NavLink>
          <NavLink to="/agents/image">Image agent</NavLink>
          <NavLink to="/agents/video">Video agent</NavLink>
          <NavLink to="/agents/storyteller">Storyteller</NavLink>
          <NavLink to="/agents/campaign">Campaign</NavLink>
          <NavLink to="/agents/soul-print">Soul Print</NavLink>
          <NavLink to="/runs">Runs</NavLink>
          <NavLink to="/usage">Usage / cost</NavLink>
        </nav>
        <div className="who">
          {session?.user.email}
          <button className="logout" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="page">{children}</main>
    </div>
  );
}
