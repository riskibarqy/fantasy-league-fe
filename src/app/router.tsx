import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useSession } from "../presentation/hooks/useSession";
import { DashboardPage } from "../presentation/pages/DashboardPage";
import { CustomLeagueStandingsPage } from "../presentation/pages/CustomLeagueStandingsPage";
import { CustomLeaguesPage } from "../presentation/pages/CustomLeaguesPage";
import { FixturesPage } from "../presentation/pages/FixturesPage";
import { LeaguesPage } from "../presentation/pages/LeaguesPage";
import { LoginPage } from "../presentation/pages/LoginPage";
import { NotFoundPage } from "../presentation/pages/NotFoundPage";
import { NewsPage } from "../presentation/pages/NewsPage";
import { SettingsPage } from "../presentation/pages/SettingsPage";
import { TeamBuilderPage } from "../presentation/pages/TeamBuilderPage";
import { TeamPlayerPickerPage } from "../presentation/pages/TeamPlayerPickerPage";
import { MainLayout } from "../presentation/components/MainLayout";

const ProtectedRoutes = () => {
  const { isAuthenticated } = useSession();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export const AppRouter = () => {
  const { isAuthenticated } = useSession();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />

      <Route element={<ProtectedRoutes />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/team" element={<TeamBuilderPage />} />
          <Route path="/team/pick" element={<TeamPlayerPickerPage />} />
          <Route path="/custom-leagues" element={<CustomLeaguesPage />} />
          <Route path="/custom-leagues/:groupId" element={<CustomLeagueStandingsPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/fixtures" element={<FixturesPage />} />
          <Route path="/leagues" element={<LeaguesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
