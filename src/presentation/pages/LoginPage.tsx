import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { useSession } from "../hooks/useSession";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { loginWithPassword } = useContainer();
  const { setSession } = useSession();

  const [email, setEmail] = useState("manager@fantasy.id");
  const [password, setPassword] = useState("password123");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const session = await loginWithPassword.execute({ email, password });
      setSession(session);
      navigate("/", { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-card">
        <p className="small-label">Fantasy Nusantara</p>
        <h1>Manage your dream squad</h1>
        <p className="muted">
          Mock login now. Production will integrate with Anubis account service.
        </p>

        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="small-label">Demo password: password123</p>
      </section>
    </div>
  );
};
