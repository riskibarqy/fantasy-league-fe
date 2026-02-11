import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./app/router";
import { DependenciesProvider } from "./app/dependencies/DependenciesProvider";
import { SessionProvider } from "./presentation/hooks/useSession";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <DependenciesProvider>
        <SessionProvider>
          <AppRouter />
        </SessionProvider>
      </DependenciesProvider>
    </BrowserRouter>
  </React.StrictMode>
);
