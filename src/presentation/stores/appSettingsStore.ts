import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemePreference = "system" | "light" | "dark";
export type AppLanguage = "en" | "id";

export type AppSettings = {
  theme: ThemePreference;
  language: AppLanguage;
  notificationsEnabled: boolean;
  deadlineReminderEnabled: boolean;
};

type AppSettingsState = AppSettings & {
  hasHydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: AppLanguage) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setDeadlineReminderEnabled: (enabled: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "system",
  language: "en",
  notificationsEnabled: false,
  deadlineReminderEnabled: true
};

const STORAGE_KEY = "fantasy-app-settings";

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_APP_SETTINGS,
      hasHydrated: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setDeadlineReminderEnabled: (deadlineReminderEnabled) => set({ deadlineReminderEnabled }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated })
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        notificationsEnabled: state.notificationsEnabled,
        deadlineReminderEnabled: state.deadlineReminderEnabled
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
