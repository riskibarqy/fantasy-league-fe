"use client";

import { useEffect, useState } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AppRouter } from "../app/router";
import { DependenciesProvider } from "../app/dependencies/DependenciesProvider";
import { AppQueryProvider } from "../app/query/QueryProvider";
import { SessionProvider, useSession } from "./hooks/useSession";
import { AppSettingsProvider } from "./hooks/useAppSettings";
import { LeagueSelectionProvider } from "./hooks/useLeagueSelection";
import { AppRuntimeConfigProvider, useAppRuntimeConfig } from "./hooks/useAppRuntimeConfig";
import { MaintenancePage } from "./components/MaintenancePage";
import { LoadingState } from "./components/LoadingState";
import { shouldBlockForMaintenance } from "./lib/maintenanceMode";

const MaintenanceShell = () => {
  const location = useLocation();
  const { config, isLoading } = useAppRuntimeConfig();
  const { session, isHydrated } = useSession();

  if (!isHydrated || isLoading) {
    return (
      <div className="centered-page">
        <LoadingState label="Loading app configuration" />
      </div>
    );
  }

  if (shouldBlockForMaintenance({
    pathname: location.pathname,
    config,
    userId: session?.user.id
  })) {
    return <MaintenancePage config={config} />;
  }

  return (
    <LeagueSelectionProvider>
      <AppSettingsProvider>
        <AppRouter />
      </AppSettingsProvider>
    </LeagueSelectionProvider>
  );
};

export const NextClientApp = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <BrowserRouter>
      <AppQueryProvider>
        <DependenciesProvider>
          <SessionProvider>
            <AppRuntimeConfigProvider>
              <MaintenanceShell />
              <Toaster
                position="top-center"
                gutter={10}
                toastOptions={{
                  duration: 2600,
                  style: {
                    background: "#252A34",
                    color: "#EAEAEA",
                    border: "1px solid rgba(234, 234, 234, 0.2)",
                    borderRadius: "12px",
                    fontSize: "0.88rem",
                    fontWeight: "600",
                    maxWidth: "92vw"
                  },
                  success: {
                    iconTheme: {
                      primary: "#08D9D6",
                      secondary: "#252A34"
                    }
                  },
                  error: {
                    iconTheme: {
                      primary: "#FF2E63",
                      secondary: "#252A34"
                    }
                  }
                }}
              />
            </AppRuntimeConfigProvider>
          </SessionProvider>
        </DependenciesProvider>
      </AppQueryProvider>
    </BrowserRouter>
  );
};
