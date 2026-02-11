import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { buildContainer, type AppContainer } from "./container";

const DependenciesContext = createContext<AppContainer | null>(null);

export const DependenciesProvider = ({ children }: PropsWithChildren) => {
  const container = useMemo(() => buildContainer(), []);

  return (
    <DependenciesContext.Provider value={container}>{children}</DependenciesContext.Provider>
  );
};

export const useContainer = (): AppContainer => {
  const context = useContext(DependenciesContext);
  if (!context) {
    throw new Error("DependenciesProvider is missing in component tree.");
  }

  return context;
};
