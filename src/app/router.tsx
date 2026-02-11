import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useSession } from "../presentation/hooks/useSession";
import { DashboardPage } from "../presentation/pages/DashboardPage";
import { FixturesPage } from "../presentation/pages/FixturesPage";
import { LeaguesPage } from "../presentation/pages/LeaguesPage";
import { LoginPage } from "../presentation/pages/LoginPage";
import { NotFoundPage } from "../presentation/pages/NotFoundPage";
import { TeamBuilderPage } from "../presentation/pages/TeamBuilderPage";
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
          <Route path="/fixtures" element={<FixturesPage />} />
          <Route path="/leagues" element={<LeaguesPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
