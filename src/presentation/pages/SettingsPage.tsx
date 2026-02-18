import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { useSession } from "../hooks/useSession";
import { useAppSettings } from "../hooks/useAppSettings";
import { appAlert } from "../lib/appAlert";

const ToggleSwitch = ({
  checked,
  onToggle,
  ariaLabel
}: {
  checked: boolean;
  onToggle: (next: boolean) => void;
  ariaLabel: string;
}) => {
  return (
    <button
      type="button"
      className={`toggle-switch ${checked ? "on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onToggle(!checked)}
    >
      <span className="toggle-thumb" />
    </button>
  );
};

export const SettingsPage = () => {
  const {
    settings,
    setTheme,
    setNotificationsEnabled,
    setDeadlineReminderEnabled
  } = useAppSettings();
  const navigate = useNavigate();
  const { logout } = useContainer();
  const { session, setSession } = useSession();

  const notificationSupported = useMemo(() => {
    return typeof window !== "undefined" && "Notification" in window;
  }, []);

  const onToggleNotifications = async (enabled: boolean) => {
    if (enabled && !notificationSupported) {
      void appAlert.warning("Notifications", "Browser notifications are not supported on this device.");
      setNotificationsEnabled(false);
      return;
    }

    if (enabled && notificationSupported) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        void appAlert.warning("Notifications", "Notification permission denied by browser.");
        setNotificationsEnabled(false);
        return;
      }
      void appAlert.success("Notifications", "Notifications enabled for this browser.");
      setNotificationsEnabled(true);
      return;
    }

    void appAlert.info("Notifications", "Notifications disabled.");
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
      const message = error instanceof Error ? error.message : "Logout failed.";
      void appAlert.error("Logout Failed", message);
    }
  };

  return (
    <div className="page-grid settings-page">
      <section className="section-title">
        <h2>App Settings</h2>
        <p className="muted">Personalize the app for speed, focus, and comfort.</p>
      </section>

      <section className="card settings-section">
        <div className="settings-header">
          <h3>Appearance</h3>
          <p className="muted">Choose your preferred visual mode.</p>
        </div>
        <div className="segmented-control">
          <button
            type="button"
            className={`segment ${settings.theme === "system" ? "active" : ""}`}
            onClick={() => setTheme("system")}
          >
            System
          </button>
          <button
            type="button"
            className={`segment ${settings.theme === "light" ? "active" : ""}`}
            onClick={() => setTheme("light")}
          >
            Light
          </button>
          <button
            type="button"
            className={`segment ${settings.theme === "dark" ? "active" : ""}`}
            onClick={() => setTheme("dark")}
          >
            Dark
          </button>
        </div>
      </section>

      <section className="card settings-section">
        <div className="settings-header">
          <h3>Experience</h3>
          <p className="muted">Tune the interface behavior.</p>
        </div>

        <article className="settings-row">
          <div>
            <strong>Notifications</strong>
            <p className="muted">Enable browser notifications for important events.</p>
          </div>
          <ToggleSwitch
            checked={settings.notificationsEnabled}
            onToggle={onToggleNotifications}
            ariaLabel="Toggle notifications"
          />
        </article>

        <article className="settings-row">
          <div>
            <strong>Deadline Reminder</strong>
            <p className="muted">Remind before transfer deadline each gameweek.</p>
          </div>
          <ToggleSwitch
            checked={settings.deadlineReminderEnabled}
            onToggle={setDeadlineReminderEnabled}
            ariaLabel="Toggle deadline reminder"
          />
        </article>

      </section>

      <section className="card settings-section">
        <div className="settings-header">
          <h3>Account</h3>
          <p className="muted">Manage your active session.</p>
        </div>
        <article className="settings-row">
          <div>
            <strong>{session?.user.displayName ?? "Fantasy Manager"}</strong>
            <p className="muted">{session?.user.email ?? "-"}</p>
          </div>
          <div className="settings-actions">
            <button type="button" className="danger-button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </article>
      </section>
    </div>
  );
};
