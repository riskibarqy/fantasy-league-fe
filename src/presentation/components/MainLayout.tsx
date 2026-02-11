import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { useSession } from "../hooks/useSession";

export const MainLayout = () => {
  const navigate = useNavigate();
  const { logout } = useContainer();
  const { session, setSession } = useSession();

  const onLogout = async () => {
    if (session) {
      await logout.execute(session.accessToken);
    }

    setSession(null);
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="small-label">Fantasy Nusantara</p>
          <h1>{session?.user.displayName ?? "Fantasy Manager"}</h1>
        </div>

        <button type="button" className="ghost-button" onClick={onLogout}>
          Logout
        </button>
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
      </nav>
    </div>
  );
};
