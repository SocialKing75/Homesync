import './HomeSyncLogo.css';

export default function HomeSyncLogo({ compact = false }) {
  return <span className={`homesync-logo ${compact ? 'is-compact' : ''}`}>
    {compact ? <span className="homesync-logo-mark" aria-hidden="true">
      <svg viewBox="0 0 36 40" focusable="false">
        <path className="logo-pin" d="M18 2C9.7 2 3 8.7 3 17c0 11 15 20.5 15 20.5S33 28 33 17C33 8.7 26.3 2 18 2Z" />
        <path className="logo-house" d="m10.5 18 7.5-6.5 7.5 6.5v9H20v-6h-4v6h-5.5Z" />
      </svg>
    </span> : <img className="homesync-logo-image" src="/brand/homesync-logo.png" alt="HomeSync" />}
  </span>;
}
