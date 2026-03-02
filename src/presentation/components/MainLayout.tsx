import { NavLink, Outlet, useLocation } from "react-router-dom";
import { CalendarDays, Home, Settings2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useI18n } from "../hooks/useI18n";

export const MainLayout = () => {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const { pathname } = useLocation();

  return (
    <div className="app-shell">
      <main className="content">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            className="route-motion-shell"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    duration: 0.2,
                    ease: [0.22, 1, 0.36, 1]
                  }
            }
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end>
          <Home className="nav-icon" aria-hidden="true" />
          <span className="nav-label">{t("nav.home")}</span>
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
