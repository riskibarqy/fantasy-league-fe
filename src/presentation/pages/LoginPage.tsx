import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { appEnv } from "../../app/config/env";
import { LoadingState } from "../components/LoadingState";
import { useSession } from "../hooks/useSession";
import { appAlert } from "../lib/appAlert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type GoogleCredentialResponse = {
  credential: string;
};

type GoogleAccountsId = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "small" | "medium" | "large";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      width?: number;
    }
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId;
      };
    };
  }
}

const GOOGLE_SCRIPT_ID = "google-identity-services";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { loginWithPassword, loginWithGoogleIdToken } = useContainer();
  const { setSession } = useSession();

  const [email, setEmail] = useState("manager@fantasy.id");
  const [password, setPassword] = useState("password123");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientWarningShownRef = useRef(false);

  const handleGoogleLogin = async (idToken: string) => {
    setIsGoogleSubmitting(true);

    try {
      const session = await loginWithGoogleIdToken.execute(idToken);
      setSession(session);
      navigate("/", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google login failed.";
      void appAlert.error("Google Sign-in Failed", message);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  useEffect(() => {
    if (appEnv.useMocks || !appEnv.googleClientId) {
      if (!appEnv.useMocks && !appEnv.googleClientId && !googleClientWarningShownRef.current) {
        googleClientWarningShownRef.current = true;
        void appAlert.warning("Google Sign-in", "Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in.");
      }
      return;
    }

    let mounted = true;

    const renderGoogleButton = () => {
      if (!mounted || !window.google || !googleButtonRef.current) {
        return;
      }

      googleButtonRef.current.innerHTML = "";

      window.google.accounts.id.initialize({
        client_id: appEnv.googleClientId,
        callback: (response) => {
          void handleGoogleLogin(response.credential ?? "");
        }
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: Math.max(googleButtonRef.current.clientWidth, 260)
      });

      setGoogleReady(true);
    };

    if (window.google) {
      renderGoogleButton();
      return () => {
        mounted = false;
      };
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", renderGoogleButton);
      return () => {
        mounted = false;
        existingScript.removeEventListener("load", renderGoogleButton);
      };
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.head.appendChild(script);

    return () => {
      mounted = false;
      script.onload = null;
    };
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const session = await loginWithPassword.execute({ email, password });
      setSession(session);
      navigate("/", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed.";
      void appAlert.error("Sign-in Failed", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onMockGoogle = () => {
    void handleGoogleLogin("mock.google.id.token");
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <p className="small-label">Fantasy Nusantara</p>
        <h1>Manage your dream squad</h1>
        <p className="muted">
          Sign in with email/password or Google. Google flow is backed by Anubis
          <code> /v1/apps/:app_id/sessions/google</code>.
        </p>

        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Email
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="mt-2"
            />
          </label>

          <label>
            Password
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="mt-2"
            />
          </label>

          <Button type="submit" disabled={isSubmitting || isGoogleSubmitting} className="w-full">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        {appEnv.useMocks ? (
          <Button type="button" variant="secondary" className="secondary-button w-full" onClick={onMockGoogle}>
            {isGoogleSubmitting ? "Signing in with Google..." : "Sign in with Google (Mock)"}
          </Button>
        ) : (
          <>
            <div className="google-button-host" ref={googleButtonRef} />
            {!appEnv.googleClientId ? null : !googleReady ? (
              <LoadingState label="Loading Google sign-in" inline compact />
            ) : null}
          </>
        )}

        <p className="small-label">Demo password (mock mode): password123</p>
      </Card>
    </div>
  );
};
