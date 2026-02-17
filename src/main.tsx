import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./app/router";
import { DependenciesProvider } from "./app/dependencies/DependenciesProvider";
import { SessionProvider } from "./presentation/hooks/useSession";
import { AppSettingsProvider } from "./presentation/hooks/useAppSettings";
import { LeagueSelectionProvider } from "./presentation/hooks/useLeagueSelection";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <DependenciesProvider>
        <SessionProvider>
          <LeagueSelectionProvider>
            <AppSettingsProvider>
              <AppRouter />
            </AppSettingsProvider>
          </LeagueSelectionProvider>
        </SessionProvider>
      </DependenciesProvider>
    </BrowserRouter>
  </React.StrictMode>
);
