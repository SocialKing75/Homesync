import './HomeSyncLogo.css';

export default function HomeSyncLogo({ compact = false }) {
  return <span className={`homesync-logo ${compact ? 'is-compact' : ''}`}>
    <span className="homesync-logo-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" focusable="false">
        <path d="M11 10v20M29 10v20M11 20h18" />
        <circle cx="29" cy="10" r="3" />
      </svg>
    </span>
    {!compact && <span className="homesync-logo-word">Home<span>Sync</span></span>}
  </span>;
}
