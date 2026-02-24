import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Languages, LogOut, Palette, UserRound } from "lucide-react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { useSession } from "../hooks/useSession";
import { useAppSettings } from "../hooks/useAppSettings";
import { appAlert } from "../lib/appAlert";
import { useI18n } from "../hooks/useI18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const SettingsPage = () => {
  const {
    settings,
    setTheme,
    setLanguage,
    setNotificationsEnabled,
    setDeadlineReminderEnabled
  } = useAppSettings();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { logout } = useContainer();
  const { session, setSession } = useSession();

  const notificationSupported = useMemo(() => {
    return typeof window !== "undefined" && "Notification" in window;
  }, []);

  const onToggleNotifications = async (enabled: boolean) => {
    if (enabled && !notificationSupported) {
      void appAlert.warning(t("alert.notifications.title"), t("alert.notifications.unsupported"));
      setNotificationsEnabled(false);
      return;
    }

    if (enabled && notificationSupported) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        void appAlert.warning(t("alert.notifications.title"), t("alert.notifications.denied"));
        setNotificationsEnabled(false);
        return;
      }
      void appAlert.success(t("alert.notifications.title"), t("alert.notifications.enabled"));
      setNotificationsEnabled(true);
      return;
    }

    void appAlert.info(t("alert.notifications.title"), t("alert.notifications.disabled"));
    setNotificationsEnabled(enabled);
  };

  const onLogout = async () => {
    try {
      if (session) {
        await logout.execute(session.accessToken);
      }
      setSession(null);
      navigate("/login", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("alert.logout.failed");
      void appAlert.error(t("alert.logout.title"), message);
    }
  };

  return (
    <div className="page-grid settings-page">
      <section className="section-title">
        <h2>{t("settings.title")}</h2>
        <p className="muted">{t("settings.subtitle")}</p>
      </section>

      <Card className="card settings-section">
        <div className="settings-header">
          <h3 className="section-icon-title">
            <Palette className="inline-icon" aria-hidden="true" />
            {t("settings.appearance.title")}
          </h3>
          <p className="muted">{t("settings.appearance.subtitle")}</p>
        </div>
        <div className="segmented-control">
          <Button
            type="button"
            variant={settings.theme === "system" ? "default" : "ghost"}
            size="sm"
            className={`segment ${settings.theme === "system" ? "active" : ""}`}
            onClick={() => setTheme("system")}
          >
            {t("settings.appearance.system")}
          </Button>
          <Button
            type="button"
            variant={settings.theme === "light" ? "default" : "ghost"}
            size="sm"
            className={`segment ${settings.theme === "light" ? "active" : ""}`}
            onClick={() => setTheme("light")}
          >
            {t("settings.appearance.light")}
          </Button>
          <Button
            type="button"
            variant={settings.theme === "dark" ? "default" : "ghost"}
            size="sm"
            className={`segment ${settings.theme === "dark" ? "active" : ""}`}
            onClick={() => setTheme("dark")}
          >
            {t("settings.appearance.dark")}
          </Button>
        </div>
      </Card>

      <Card className="card settings-section">
        <div className="settings-header">
          <h3 className="section-icon-title">
            <Languages className="inline-icon" aria-hidden="true" />
            {t("settings.language.title")}
          </h3>
          <p className="muted">{t("settings.language.subtitle")}</p>
        </div>
        <label>
          {t("settings.language.title")}
          <Select
            value={settings.language}
            onChange={(event) => setLanguage(event.target.value === "id" ? "id" : "en")}
          >
            <option value="en">{t("settings.language.en")}</option>
            <option value="id">{t("settings.language.id")}</option>
          </Select>
        </label>
      </Card>

      <Card className="card settings-section">
        <div className="settings-header">
          <h3 className="section-icon-title">
            <Bell className="inline-icon" aria-hidden="true" />
            {t("settings.experience.title")}
          </h3>
          <p className="muted">{t("settings.experience.subtitle")}</p>
        </div>

        <article className="settings-row">
          <div>
            <strong>{t("settings.experience.notifications.title")}</strong>
            <p className="muted">{t("settings.experience.notifications.subtitle")}</p>
          </div>
          <Switch
            checked={settings.notificationsEnabled}
            onCheckedChange={onToggleNotifications}
            ariaLabel="Toggle notifications"
          />
        </article>

        <article className="settings-row">
          <div>
            <strong>{t("settings.experience.deadline.title")}</strong>
            <p className="muted">{t("settings.experience.deadline.subtitle")}</p>
          </div>
          <Switch
            checked={settings.deadlineReminderEnabled}
            onCheckedChange={setDeadlineReminderEnabled}
            ariaLabel="Toggle deadline reminder"
          />
        </article>

      </Card>

      <Card className="card settings-section">
        <div className="settings-header">
          <h3 className="section-icon-title">
            <UserRound className="inline-icon" aria-hidden="true" />
            {t("settings.account.title")}
          </h3>
          <p className="muted">{t("settings.account.subtitle")}</p>
        </div>
        <article className="settings-row">
          <div>
            <strong>{session?.user.displayName ?? t("settings.account.fallbackName")}</strong>
            <p className="muted">{session?.user.email ?? "-"}</p>
          </div>
          <div className="settings-actions">
            <Button type="button" variant="destructive" className="danger-button" onClick={onLogout}>
              <LogOut className="inline-icon" aria-hidden="true" />
              {t("settings.account.logout")}
            </Button>
          </div>
        </article>
      </Card>
    </div>
  );
};
