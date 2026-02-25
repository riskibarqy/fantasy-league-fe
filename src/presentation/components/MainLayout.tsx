import { NavLink, Outlet } from "react-router-dom";
import { CalendarDays, Home, Settings2, Shield, Waves } from "lucide-react";
import { useSession } from "../hooks/useSession";
import { useI18n } from "../hooks/useI18n";

export const MainLayout = () => {
  const { session } = useSession();
  const { t } = useI18n();

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-brand">
          <span className="brand-icon" aria-hidden="true">
            <Waves />
          </span>
          <div>
            <p className="small-label">Fantasy Nusantara</p>
            <h1>{session?.user.displayName ?? t("settings.account.fallbackName")}</h1>
          </div>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end>
          <Home className="nav-icon" aria-hidden="true" />
          <span className="nav-label">{t("nav.home")}</span>
        </NavLink>
        <NavLink to="/team">
          <Shield className="nav-icon" aria-hidden="true" />
          <span className="nav-label">{t("nav.team")}</span>
        </NavLink>
        <NavLink to="/fixtures">
          <CalendarDays className="nav-icon" aria-hidden="true" />
          <span className="nav-label">{t("nav.fixtures")}</span>
        </NavLink>
        <NavLink to="/settings">
          <Settings2 className="nav-icon" aria-hidden="true" />
          <span className="nav-label">{t("nav.settings")}</span>
        </NavLink>
      </nav>
    </div>
  );
};
