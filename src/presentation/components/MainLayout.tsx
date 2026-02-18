import { NavLink, Outlet } from "react-router-dom";
import { CalendarDays, Home, Settings2, Shield, Trophy, Waves } from "lucide-react";
import { useSession } from "../hooks/useSession";

export const MainLayout = () => {
  const { session } = useSession();

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-brand">
          <span className="brand-icon" aria-hidden="true">
            <Waves />
          </span>
          <div>
            <p className="small-label">Fantasy Nusantara</p>
            <h1>{session?.user.displayName ?? "Fantasy Manager"}</h1>
          </div>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end>
          <Home className="nav-icon" aria-hidden="true" />
          <span className="nav-label">Home</span>
        </NavLink>
        <NavLink to="/team">
          <Shield className="nav-icon" aria-hidden="true" />
          <span className="nav-label">Team</span>
        </NavLink>
        <NavLink to="/fixtures">
          <CalendarDays className="nav-icon" aria-hidden="true" />
          <span className="nav-label">Fixtures</span>
        </NavLink>
        <NavLink to="/leagues">
          <Trophy className="nav-icon" aria-hidden="true" />
          <span className="nav-label">Leagues</span>
        </NavLink>
        <NavLink to="/settings">
          <Settings2 className="nav-icon" aria-hidden="true" />
          <span className="nav-label">Settings</span>
        </NavLink>
      </nav>
    </div>
  );
};
