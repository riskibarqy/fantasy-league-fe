import { useMemo } from "react";
import { useAppSettings } from "./useAppSettings";

type TranslationKey =
  | "nav.home"
  | "nav.team"
  | "nav.fixtures"
  | "nav.leagues"
  | "nav.settings"
  | "settings.title"
  | "settings.subtitle"
  | "settings.appearance.title"
  | "settings.appearance.subtitle"
  | "settings.appearance.system"
  | "settings.appearance.light"
  | "settings.appearance.dark"
  | "settings.language.title"
  | "settings.language.subtitle"
  | "settings.language.en"
  | "settings.language.id"
  | "settings.experience.title"
  | "settings.experience.subtitle"
  | "settings.experience.notifications.title"
  | "settings.experience.notifications.subtitle"
  | "settings.experience.deadline.title"
  | "settings.experience.deadline.subtitle"
  | "settings.account.title"
  | "settings.account.subtitle"
  | "settings.account.fallbackName"
  | "settings.account.logout"
  | "alert.notifications.title"
  | "alert.notifications.unsupported"
  | "alert.notifications.denied"
  | "alert.notifications.enabled"
  | "alert.notifications.disabled"
  | "alert.logout.title"
  | "alert.logout.failed";

const MESSAGES: Record<"en" | "id", Record<TranslationKey, string>> = {
  en: {
    "nav.home": "Home",
    "nav.team": "Team",
    "nav.fixtures": "Fixtures",
    "nav.leagues": "Leagues",
    "nav.settings": "Settings",
    "settings.title": "App Settings",
    "settings.subtitle": "Personalize the app for speed, focus, and comfort.",
    "settings.appearance.title": "Appearance",
    "settings.appearance.subtitle": "Choose your preferred visual mode.",
    "settings.appearance.system": "System",
    "settings.appearance.light": "Light",
    "settings.appearance.dark": "Dark",
    "settings.language.title": "Language",
    "settings.language.subtitle": "Select the app language.",
    "settings.language.en": "English",
    "settings.language.id": "Bahasa Indonesia",
    "settings.experience.title": "Experience",
    "settings.experience.subtitle": "Tune the interface behavior.",
    "settings.experience.notifications.title": "Notifications",
    "settings.experience.notifications.subtitle": "Enable browser notifications for important events.",
    "settings.experience.deadline.title": "Deadline Reminder",
    "settings.experience.deadline.subtitle": "Remind before transfer deadline each gameweek.",
    "settings.account.title": "Account",
    "settings.account.subtitle": "Manage your active session.",
    "settings.account.fallbackName": "Fantasy Manager",
    "settings.account.logout": "Logout",
    "alert.notifications.title": "Notifications",
    "alert.notifications.unsupported": "Browser notifications are not supported on this device.",
    "alert.notifications.denied": "Notification permission denied by browser.",
    "alert.notifications.enabled": "Notifications enabled for this browser.",
    "alert.notifications.disabled": "Notifications disabled.",
    "alert.logout.title": "Logout Failed",
    "alert.logout.failed": "Logout failed."
  },
  id: {
    "nav.home": "Beranda",
    "nav.team": "Tim",
    "nav.fixtures": "Jadwal",
    "nav.leagues": "Liga",
    "nav.settings": "Pengaturan",
    "settings.title": "Pengaturan Aplikasi",
    "settings.subtitle": "Atur aplikasi agar lebih cepat, fokus, dan nyaman dipakai.",
    "settings.appearance.title": "Tampilan",
    "settings.appearance.subtitle": "Pilih mode tampilan yang kamu inginkan.",
    "settings.appearance.system": "Sistem",
    "settings.appearance.light": "Terang",
    "settings.appearance.dark": "Gelap",
    "settings.language.title": "Bahasa",
    "settings.language.subtitle": "Pilih bahasa aplikasi.",
    "settings.language.en": "English",
    "settings.language.id": "Bahasa Indonesia",
    "settings.experience.title": "Pengalaman",
    "settings.experience.subtitle": "Atur perilaku antarmuka aplikasi.",
    "settings.experience.notifications.title": "Notifikasi",
    "settings.experience.notifications.subtitle": "Aktifkan notifikasi browser untuk event penting.",
    "settings.experience.deadline.title": "Pengingat Deadline",
    "settings.experience.deadline.subtitle": "Ingatkan sebelum deadline transfer setiap gameweek.",
    "settings.account.title": "Akun",
    "settings.account.subtitle": "Kelola sesi akun aktif.",
    "settings.account.fallbackName": "Fantasy Manager",
    "settings.account.logout": "Keluar",
    "alert.notifications.title": "Notifikasi",
    "alert.notifications.unsupported": "Notifikasi browser tidak didukung di perangkat ini.",
    "alert.notifications.denied": "Izin notifikasi ditolak oleh browser.",
    "alert.notifications.enabled": "Notifikasi berhasil diaktifkan untuk browser ini.",
    "alert.notifications.disabled": "Notifikasi dinonaktifkan.",
    "alert.logout.title": "Keluar Gagal",
    "alert.logout.failed": "Gagal keluar."
  }
};

export const useI18n = () => {
  const {
    settings: { language }
  } = useAppSettings();

  const t = useMemo(() => {
    return (key: TranslationKey): string => {
      return MESSAGES[language][key] ?? MESSAGES.en[key] ?? key;
    };
  }, [language]);

  return {
    language,
    t
  };
};
