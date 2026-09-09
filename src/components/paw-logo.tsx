export function PawLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" className={className} aria-hidden="true">
      <ellipse cx="32" cy="42" rx="14" ry="11" />
      <ellipse cx="13" cy="27" rx="6.5" ry="8.5" transform="rotate(-18 13 27)" />
      <ellipse cx="26" cy="15" rx="6.5" ry="9" transform="rotate(-7 26 15)" />
      <ellipse cx="41" cy="15" rx="6.5" ry="9" transform="rotate(7 41 15)" />
      <ellipse cx="53" cy="27" rx="6.5" ry="8.5" transform="rotate(18 53 27)" />
    </svg>
  );
}
