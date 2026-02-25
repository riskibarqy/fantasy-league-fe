import { useEffect, type PropsWithChildren } from "react";
import {
  type AppLanguage,
  type AppSettings,
  type ThemePreference,
  useAppSettingsStore
} from "../stores/appSettingsStore";

type AppSettingsContextValue = {
  settings: AppSettings;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: AppLanguage) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setDeadlineReminderEnabled: (enabled: boolean) => void;
};

const resolveTheme = (theme: ThemePreference): "light" | "dark" => {
  if (theme === "light" || theme === "dark") {
    return theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const AppSettingsProvider = ({ children }: PropsWithChildren) => {
  const theme = useAppSettingsStore((state) => state.theme);

  useEffect(() => {
    const effectiveTheme = resolveTheme(theme);
    document.documentElement.setAttribute("data-theme", effectiveTheme);
    document.documentElement.setAttribute("data-density", "compact");
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      document.documentElement.setAttribute("data-theme", resolveTheme("system"));
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return <>{children}</>;
};

export const useAppSettings = (): AppSettingsContextValue => {
  const theme = useAppSettingsStore((state) => state.theme);
  const language = useAppSettingsStore((state) => state.language);
  const notificationsEnabled = useAppSettingsStore((state) => state.notificationsEnabled);
  const deadlineReminderEnabled = useAppSettingsStore((state) => state.deadlineReminderEnabled);
  const setTheme = useAppSettingsStore((state) => state.setTheme);
  const setLanguage = useAppSettingsStore((state) => state.setLanguage);
  const setNotificationsEnabled = useAppSettingsStore((state) => state.setNotificationsEnabled);
  const setDeadlineReminderEnabled = useAppSettingsStore((state) => state.setDeadlineReminderEnabled);

  return {
    settings: {
      theme,
      language,
      notificationsEnabled,
      deadlineReminderEnabled
    },
    setTheme,
    setLanguage,
    setNotificationsEnabled,
    setDeadlineReminderEnabled
  };
};

export type { AppLanguage };
