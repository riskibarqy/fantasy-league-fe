import { Navigate, Outlet, Route, Routes, useSearchParams } from "react-router-dom";
import { useSession } from "../presentation/hooks/useSession";
import { useOnboardingStatus } from "../presentation/hooks/useOnboardingStatus";
import { DashboardPage } from "../presentation/pages/DashboardPage";
import { CustomLeagueStandingsPage } from "../presentation/pages/CustomLeagueStandingsPage";
import { CustomLeaguesPage } from "../presentation/pages/CustomLeaguesPage";
import { FixturesPage } from "../presentation/pages/FixturesPage";
import { LeaguesPage } from "../presentation/pages/LeaguesPage";
import { LoginPage } from "../presentation/pages/LoginPage";
import { NotFoundPage } from "../presentation/pages/NotFoundPage";
import { NewsPage } from "../presentation/pages/NewsPage";
import { OnboardingPage } from "../presentation/pages/OnboardingPage";
import { SettingsPage } from "../presentation/pages/SettingsPage";
import { TeamBuilderPage } from "../presentation/pages/TeamBuilderPage";
import { TeamPlayerPickerPage } from "../presentation/pages/TeamPlayerPickerPage";
import { MainLayout } from "../presentation/components/MainLayout";
import { LoadingState } from "../presentation/components/LoadingState";

const ProtectedRoutes = () => {
  const { isAuthenticated } = useSession();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const OnboardingRequiredRoutes = () => {
  const { status } = useOnboardingStatus();

  if (status === "checking") {
    return (
      <div className="centered-page">
        <LoadingState label="Checking onboarding status" />
      </div>
    );
  }

  if (status === "required") {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
};

const OnboardingEntryPage = () => {
  const { status } = useOnboardingStatus();
  const [searchParams] = useSearchParams();
  const forceOnboarding = searchParams.get("force") === "1" || searchParams.get("force") === "true";

  if (forceOnboarding) {
    return <OnboardingPage />;
  }

  if (status === "checking") {
    return (
      <div className="centered-page">
        <LoadingState label="Checking onboarding status" />
      </div>
    );
  }

  if (status === "completed") {
    return <Navigate to="/" replace />;
  }

  return <OnboardingPage />;
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
        <Route path="/onboarding" element={<OnboardingEntryPage />} />
        <Route path="/onboarding/pick" element={<TeamPlayerPickerPage />} />
        <Route element={<OnboardingRequiredRoutes />}>
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
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
