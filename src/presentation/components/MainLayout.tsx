import { NavLink, Outlet } from "react-router-dom";
import { useSession } from "../hooks/useSession";

export const MainLayout = () => {
  const { session } = useSession();

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="small-label">Fantasy Nusantara</p>
          <h1>{session?.user.displayName ?? "Fantasy Manager"}</h1>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/team">Team</NavLink>
        <NavLink to="/fixtures">Fixtures</NavLink>
        <NavLink to="/leagues">Leagues</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
    </div>
  );
};
