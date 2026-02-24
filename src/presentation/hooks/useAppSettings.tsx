import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

type ThemePreference = "system" | "light" | "dark";
export type AppLanguage = "en" | "id";

type AppSettings = {
  theme: ThemePreference;
  language: AppLanguage;
  notificationsEnabled: boolean;
  deadlineReminderEnabled: boolean;
};

type AppSettingsContextValue = {
  settings: AppSettings;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: AppLanguage) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setDeadlineReminderEnabled: (enabled: boolean) => void;
};

const STORAGE_KEY = "fantasy-app-settings";

const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  language: "en",
  notificationsEnabled: false,
  deadlineReminderEnabled: true
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

const readStoredSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      theme:
        parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system"
          ? parsed.theme
          : DEFAULT_SETTINGS.theme,
      language:
        parsed.language === "en" || parsed.language === "id"
          ? parsed.language
          : DEFAULT_SETTINGS.language,
      notificationsEnabled:
        typeof parsed.notificationsEnabled === "boolean"
          ? parsed.notificationsEnabled
          : DEFAULT_SETTINGS.notificationsEnabled,
      deadlineReminderEnabled:
        typeof parsed.deadlineReminderEnabled === "boolean"
          ? parsed.deadlineReminderEnabled
          : DEFAULT_SETTINGS.deadlineReminderEnabled
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const resolveTheme = (theme: ThemePreference): "light" | "dark" => {
  if (theme === "light" || theme === "dark") {
    return theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const AppSettingsProvider = ({ children }: PropsWithChildren) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(readStoredSettings());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    const effectiveTheme = resolveTheme(settings.theme);
    document.documentElement.setAttribute("data-theme", effectiveTheme);
    document.documentElement.setAttribute("data-density", "compact");
  }, [settings]);

  useEffect(() => {
    if (settings.theme !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      document.documentElement.setAttribute("data-theme", resolveTheme("system"));
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [settings.theme]);

  const setTheme = useCallback((theme: ThemePreference) => {
    setSettings((previous) => ({ ...previous, theme }));
  }, []);

  const setLanguage = useCallback((language: AppLanguage) => {
    setSettings((previous) => ({ ...previous, language }));
  }, []);

  const setNotificationsEnabled = useCallback((enabled: boolean) => {
    setSettings((previous) => ({ ...previous, notificationsEnabled: enabled }));
  }, []);

  const setDeadlineReminderEnabled = useCallback((enabled: boolean) => {
    setSettings((previous) => ({ ...previous, deadlineReminderEnabled: enabled }));
  }, []);

  const value = useMemo(
    () => ({
      settings,
      setTheme,
      setLanguage,
      setNotificationsEnabled,
      setDeadlineReminderEnabled
    }),
    [setDeadlineReminderEnabled, setLanguage, setNotificationsEnabled, setTheme, settings]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export const useAppSettings = (): AppSettingsContextValue => {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error("AppSettingsProvider is missing in component tree.");
  }

  return context;
};
