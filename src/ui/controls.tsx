import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../store';

export function Section({ title, children, right, defaultOpen = true }: { title: string; children: ReactNode; right?: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="section">
      <header onClick={() => setOpen(!open)}>
        <span className={'chev' + (open ? ' open' : '')}>›</span>
        <h3>{title}</h3>
        <div className="sp" />
        <div onClick={(e) => e.stopPropagation()}>{right}</div>
      </header>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

export function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="row" title={hint}>
      <span className="row-label">{label}</span>
      <div className="row-ctl">{children}</div>
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
  hint,
  gradient,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
  gradient?: string;
}) {
  return (
    <div className="slider" title={hint}>
      <div className="slider-top">
        <span>{label}</span>
        <NumberField value={value} step={step} min={min} max={max} onChange={onChange} display={format?.(value)} />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={gradient ? { background: gradient } : undefined}
        className={gradient ? 'grad' : ''}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

export function NumberField({ value, onChange, step = 1, min, max, display, suffix }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; display?: string; suffix?: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const shown = display ?? (Number.isInteger(step) ? String(Math.round(value)) : value.toFixed(step < 0.1 ? 2 : 1)) + (suffix ?? '');
  return (
    <input
      className="num"
      value={editing ?? shown}
      onFocus={() => setEditing(String(Math.round(value * 1000) / 1000))}
      onChange={(e) => setEditing(e.target.value)}
      onBlur={() => {
        const v = parseFloat(editing ?? '');
        if (!isNaN(v)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
        setEditing(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setEditing(null);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export function Seg<T extends string>({ value, options, onChange, small }: { value: T; options: { v: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className={'seg' + (small ? ' small' : '')}>
      {options.map((o) => (
        <button key={o.v} title={o.title} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" className={'toggle' + (value ? ' on' : '')} onClick={() => onChange(!value)}>
      <span className="knob" />
      {label && <span className="tl">{label}</span>}
    </button>
  );
}

export function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div className="color-field">
      <input type="color" value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => onChange(local)} onMouseUp={() => onChange(local)} />
      <input
        className="hex"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => /^#[0-9a-f]{6}$/i.test(local) && onChange(local)}
      />
    </div>
  );
}

export function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}

/** Distance formatting honouring the unit preference. */
export function useLen() {
  const units = useStore((s) => s.settings.units);
  const fmt = (m: number, digits = 1) => {
    if (units === 'metric') return `${m.toFixed(digits === 0 ? 0 : 2)} m`;
    const totalIn = m / 0.0254;
    const ft = Math.floor(totalIn / 12);
    const inch = Math.round(totalIn - ft * 12);
    return inch === 12 ? `${ft + 1}′ 0″` : `${ft}′ ${inch}″`;
  };
  const toDisplay = (m: number) => (units === 'metric' ? m : m / 0.3048);
  const fromDisplay = (v: number) => (units === 'metric' ? v : v * 0.3048);
  return { units, fmt, toDisplay, fromDisplay, unit: units === 'metric' ? 'm' : 'ft' };
}

/** Slider that edits a length (meters internally) in the user's display units. */
export function LenSlider({ label, value, min, max, onChange, hint }: { label: string; value: number; min: number; max: number; onChange: (m: number) => void; hint?: string }) {
  const { fmt, toDisplay, fromDisplay } = useLen();
  return (
    <Slider
      label={label}
      hint={hint}
      value={toDisplay(value)}
      min={toDisplay(min)}
      max={toDisplay(max)}
      step={0.01}
      format={() => fmt(value)}
      onChange={(v) => onChange(fromDisplay(v))}
    />
  );
}

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const p: Record<string, ReactNode> = {
    room: <path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    light: (
      <>
        <path d="M9 18h6M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z" />
      </>
    ),
    person: (
      <>
        <circle cx="12" cy="6" r="3" />
        <path d="M6 21v-5a6 6 0 0 1 12 0v5" />
      </>
    ),
    guitar: (
      <>
        <path d="m19 3 2 2-6.5 6.5" />
        <path d="M11 9a4 4 0 0 0-5.5 1.5 3.5 3.5 0 0 0-3 3A4.5 4.5 0 0 0 10.5 21a3.5 3.5 0 0 0 3-3A4 4 0 0 0 15 12.5" />
        <circle cx="10" cy="15" r="1.5" />
      </>
    ),
    flag: (
      <>
        <path d="M5 21V3" />
        <path d="M5 4h12l-2 4 2 4H5" />
      </>
    ),
    camera: (
      <>
        <rect x="2" y="7" width="14" height="11" rx="2" />
        <path d="m16 11 6-3v9l-6-3" />
      </>
    ),
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
    undo: <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />,
    redo: <path d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />,
    save: (
      <>
        <path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        <path d="M7 3v5h8M7 21v-7h10v7" />
      </>
    ),
    shot: (
      <>
        <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    move: <path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" />,
    rotate: <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />,
    orbit: (
      <>
        <circle cx="12" cy="12" r="2" />
        <ellipse cx="12" cy="12" rx="10" ry="4" />
      </>
    ),
    walk: (
      <>
        <circle cx="13" cy="4" r="2" />
        <path d="m9 21 3-7 3 3v4M7 12l3-4 4 1 3 3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />,
    lock: (
      <>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
    trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" />,
    copy: (
      <>
        <rect x="8" y="8" width="13" height="13" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
    home: <path d="M3 10 12 3l9 7M5 9v11h14V9" />,
    play: <path d="M7 4v16l13-8z" />,
    pause: <path d="M7 4h4v16H7zM13 4h4v16h-4z" />,
    sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />,
    plot: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="M15 7l3 3M14 16h4" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-5-5L5 21" />
      </>
    ),
    upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
    download: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    compass: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="m16 8-2.5 5.5L8 16l2.5-5.5z" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p[name]}
    </svg>
  );
}
