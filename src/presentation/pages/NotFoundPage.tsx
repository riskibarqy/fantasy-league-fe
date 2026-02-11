import { Link } from "react-router-dom";

export const NotFoundPage = () => {
  return (
    <div className="centered-page">
      <h1>404</h1>
      <p>Page not found.</p>
      <Link to="/">Back to home</Link>
    </div>
  );
};
