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

    const registerSW = async () => {
      const SW_BUILD_VERSION = "2026-02-26-1";
      const swUrl = `/sw.js?v=${SW_BUILD_VERSION}`;

      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(async (registration) => {
            const scriptUrl = registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? "";
            if (scriptUrl.includes("/sw.js") && !scriptUrl.includes(SW_BUILD_VERSION)) {
              await registration.unregister();
              return;
            }

            await registration.update();
          })
        );

        const registration = await navigator.serviceWorker.register(swUrl, {
          updateViaCache: "none"
        });

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch {
        return;
      }
    };

    window.addEventListener("load", registerSW);
    return () => {
      window.removeEventListener("load", registerSW);
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
