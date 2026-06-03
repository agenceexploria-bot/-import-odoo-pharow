// Shared UI components for Acticonvert
const { useState } = React;

// ---- Icon set (lucide-style, simple stroke paths) ----
const ICON_PATHS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/>',
  map: '<path d="M3 7v13l6-3 6 3 6-3V4l-6 3-6-3-6 3Z"/><path d="M9 4v13"/><path d="M15 7v13"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  play: '<path d="m6 4 14 8-14 8V4Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h6"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
  fileCheck: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>',
  merge: '<path d="M8 3v6a4 4 0 0 0 4 4 4 4 0 0 0 4-4V3"/><path d="M12 13v8"/><path d="m8 18 4 3 4-3"/>',
  convert: '<path d="M4 7h11"/><path d="m11 3 4 4-4 4"/><path d="M20 17H9"/><path d="m13 21-4-4 4-4"/>',
  upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14a0 0 0 0 0 0 0v-5"/><path d="M3 16v3a2 2 0 0 0 2 2"/>',
  uploadCloud: '<path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.5A4.5 4.5 0 0 0 17 8.5h-1.3A7 7 0 1 0 4 15"/>',
  sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  sparkles: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6 6 2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
};

function Icon({ name, size = 20, stroke = 2, className = '', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || '' }} />
  );
}

// ---- Status badge: never color-only — always icon + label ----
const STATUS_META = {
  success: { label: 'Succès', icon: 'check', cls: 'st-success' },
  partial: { label: 'Partiel', icon: 'alert', cls: 'st-partial' },
  error: { label: 'Échec', icon: 'x', cls: 'st-error' },
  synced: { label: 'Synchronisé', icon: 'check', cls: 'st-success' },
  pending: { label: 'En attente', icon: 'clock', cls: 'st-pending' },
  ok: { label: 'OK', icon: 'check', cls: 'st-success' },
  warn: { label: 'À vérifier', icon: 'alert', cls: 'st-partial' },
  info: { label: 'Info', icon: 'info', cls: 'st-info' },
  warn_log: { label: 'Avert.', icon: 'alert', cls: 'st-partial' },
};

function Badge({ status, label }) {
  const m = STATUS_META[status] || STATUS_META.info;
  return (
    <span className={'badge ' + m.cls}>
      <Icon name={m.icon} size={13} stroke={2.6} />
      {label || m.label}
    </span>
  );
}

function Btn({ children, variant = 'primary', icon, size = 'md', onClick, type = 'button', style = {} }) {
  return (
    <button type={type} onClick={onClick} style={style}
      className={`btn btn-${variant} btn-${size}`}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} stroke={2.4} />}
      {children}
    </button>
  );
}

function Card({ children, className = '', style = {}, pad = true }) {
  return <div className={'card ' + (pad ? 'card-pad ' : '') + className} style={style}>{children}</div>;
}

Object.assign(window, { Icon, Badge, Btn, Card, STATUS_META });
