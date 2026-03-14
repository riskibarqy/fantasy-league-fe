import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { appEnv } from "../../app/config/env";
import type { PublicAppConfig } from "../../domain/fantasy/entities/AppConfig";
import { buildEnvPublicAppConfig, normalizePublicAppConfig } from "../lib/maintenanceMode";

type AppRuntimeConfigContextValue = {
  config: PublicAppConfig;
  isLoading: boolean;
};

const AppRuntimeConfigContext = createContext<AppRuntimeConfigContextValue | null>(null);
const REFRESH_INTERVAL_MS = 60_000;

export const AppRuntimeConfigProvider = ({ children }: PropsWithChildren) => {
  const { getPublicAppConfig } = useContainer();
  const [config, setConfig] = useState<PublicAppConfig>(() => buildEnvPublicAppConfig(appEnv));
  const [isLoading, setIsLoading] = useState(appEnv.remoteAppConfigEnabled);

  useEffect(() => {
    const fallback = buildEnvPublicAppConfig(appEnv);

    if (!appEnv.remoteAppConfigEnabled) {
      setConfig(fallback);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const load = async (blocking: boolean) => {
      if (blocking) {
        setIsLoading(true);
      }

      try {
        const payload = await getPublicAppConfig.execute();
        if (!mounted) {
          return;
        }

        setConfig(normalizePublicAppConfig(payload, fallback));
      } catch {
        if (!mounted) {
          return;
        }

        setConfig(fallback);
      } finally {
        if (mounted && blocking) {
          setIsLoading(false);
        }
      }
    };

    void load(true);
    const timerId = window.setInterval(() => {
      void load(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(timerId);
    };
  }, [getPublicAppConfig]);

  const value = useMemo(
    () => ({
      config,
      isLoading
    }),
    [config, isLoading]
  );

  return (
    <AppRuntimeConfigContext.Provider value={value}>{children}</AppRuntimeConfigContext.Provider>
  );
};

export const useAppRuntimeConfig = (): AppRuntimeConfigContextValue => {
  const context = useContext(AppRuntimeConfigContext);
  if (!context) {
    throw new Error("AppRuntimeConfigProvider is missing in component tree.");
  }

  return context;
};
