import { Suspense, lazy } from "react";
import { Navigate, Outlet, Route, Routes, useSearchParams } from "react-router-dom";
import { useSession } from "../presentation/hooks/useSession";
import { useOnboardingStatus } from "../presentation/hooks/useOnboardingStatus";
import { LoadingState } from "../presentation/components/LoadingState";

const DashboardPage = lazy(() =>
  import("../presentation/pages/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const CustomLeagueStandingsPage = lazy(() =>
  import("../presentation/pages/CustomLeagueStandingsPage").then((module) => ({
    default: module.CustomLeagueStandingsPage
  }))
);
const CustomLeaguesPage = lazy(() =>
  import("../presentation/pages/CustomLeaguesPage").then((module) => ({ default: module.CustomLeaguesPage }))
);
const FixturesPage = lazy(() =>
  import("../presentation/pages/FixturesPage").then((module) => ({ default: module.FixturesPage }))
);
const LeaguesPage = lazy(() =>
  import("../presentation/pages/LeaguesPage").then((module) => ({ default: module.LeaguesPage }))
);
const LoginPage = lazy(() =>
  import("../presentation/pages/LoginPage").then((module) => ({ default: module.LoginPage }))
);
const NotFoundPage = lazy(() =>
  import("../presentation/pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage }))
);
const NewsPage = lazy(() =>
  import("../presentation/pages/NewsPage").then((module) => ({ default: module.NewsPage }))
);
const OnboardingPage = lazy(() =>
  import("../presentation/pages/OnboardingPage").then((module) => ({ default: module.OnboardingPage }))
);
const SettingsPage = lazy(() =>
  import("../presentation/pages/SettingsPage").then((module) => ({ default: module.SettingsPage }))
);
const TeamBuilderPage = lazy(() =>
  import("../presentation/pages/TeamBuilderPage").then((module) => ({ default: module.TeamBuilderPage }))
);
const TeamPlayerPickerPage = lazy(() =>
  import("../presentation/pages/TeamPlayerPickerPage").then((module) => ({ default: module.TeamPlayerPickerPage }))
);
const MainLayout = lazy(() =>
  import("../presentation/components/MainLayout").then((module) => ({ default: module.MainLayout }))
);

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
    <Suspense
      fallback={
        <div className="centered-page">
          <LoadingState label="Loading page" />
        </div>
      }
    >
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
    </Suspense>
  );
};
