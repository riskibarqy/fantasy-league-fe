type LoadingStateProps = {
  label?: string;
  inline?: boolean;
  compact?: boolean;
};

export const LoadingState = ({
  label = "Loading",
  inline = false,
  compact = false
}: LoadingStateProps) => {
  return (
    <div
      className={`loading-state ${inline ? "inline" : ""} ${compact ? "compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="loading-spinner" />
      <span>{label}</span>
      <span className="loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
};

