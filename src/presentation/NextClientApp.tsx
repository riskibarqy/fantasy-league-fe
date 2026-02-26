"use client";

import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AppRouter } from "../app/router";
import { DependenciesProvider } from "../app/dependencies/DependenciesProvider";
import { AppQueryProvider } from "../app/query/QueryProvider";
import { SessionProvider } from "./hooks/useSession";
import { AppSettingsProvider } from "./hooks/useAppSettings";
import { LeagueSelectionProvider } from "./hooks/useLeagueSelection";

export const NextClientApp = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || typeof window === "undefined") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    const disableSW = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      } catch {
        return;
      }
    };

    window.addEventListener("load", disableSW);
    return () => {
      window.removeEventListener("load", disableSW);
    };
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <BrowserRouter>
      <AppQueryProvider>
        <DependenciesProvider>
          <SessionProvider>
            <LeagueSelectionProvider>
              <AppSettingsProvider>
                <AppRouter />
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
              </AppSettingsProvider>
            </LeagueSelectionProvider>
          </SessionProvider>
        </DependenciesProvider>
      </AppQueryProvider>
    </BrowserRouter>
  );
};
