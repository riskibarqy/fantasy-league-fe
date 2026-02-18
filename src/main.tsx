import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AppRouter } from "./app/router";
import { DependenciesProvider } from "./app/dependencies/DependenciesProvider";
import { SessionProvider } from "./presentation/hooks/useSession";
import { AppSettingsProvider } from "./presentation/hooks/useAppSettings";
import { LeagueSelectionProvider } from "./presentation/hooks/useLeagueSelection";
import "sweetalert2/dist/sweetalert2.min.css";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
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
    </BrowserRouter>
  </React.StrictMode>
);
