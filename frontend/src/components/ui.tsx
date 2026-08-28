import {
  useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode,
} from 'react';
import { Loader2, Search, X, AlertCircle, RefreshCw, ChevronDown, Check } from 'lucide-react';
import { avatarTint, initials } from '../lib/format';

/* ------------------------------------------------------------------ avatar */

export function Avatar({
  name, src, size = 'md', className = '',
}: { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-xl',
  };
  if (src) {
    return <img src={src} alt="" className={`${sizes[size]} rounded-full object-cover ${className}`} />;
  }
  return (
    <span
      aria-hidden
      className={`${sizes[size]} ${avatarTint(name)} inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
    >
      {initials(name)}
    </span>
  );
}

/* --------------------------------------------------------------- stat card */

export function StatCard({
  label, value, icon, accent = 'brand', hint, onClick,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  accent?: 'brand' | 'amber' | 'blue' | 'emerald' | 'red' | 'ink' | 'blush' | 'cream';
  hint?: string;
  onClick?: () => void;
}) {
  /*
    Each accent is a pair: a soft wash for the icon tile and a matching hairline down
    the left edge, so a row of stat cards reads as a set of colours rather than five
    identical white boxes. The washes are backgrounds only — every number and label on
    top of them stays on white, which is what keeps the text contrast honest.
  */
  const accents = {
    brand: { tile: 'bg-brand-100 text-brand-700', edge: 'bg-brand-400' },
    blush: { tile: 'bg-blush-100 text-blush-700', edge: 'bg-blush-300' },
    cream: { tile: 'bg-cream-100 text-cream-700', edge: 'bg-cream-300' },
    amber: { tile: 'bg-amber-100 text-amber-700', edge: 'bg-amber-300' },
    blue: { tile: 'bg-blue-100 text-blue-700', edge: 'bg-blue-300' },
    emerald: { tile: 'bg-emerald-100 text-emerald-700', edge: 'bg-emerald-300' },
    red: { tile: 'bg-red-100 text-red-700', edge: 'bg-red-300' },
    ink: { tile: 'bg-ink-100 text-ink-600', edge: 'bg-ink-300' },
  };
  const a = accents[accent];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`card relative overflow-hidden p-4 sm:p-5 text-left w-full ${onClick ? 'card-hover cursor-pointer' : ''}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${a.edge}`} aria-hidden />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-500 truncate">{label}</p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-bold text-ink-900 tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-500 truncate">{hint}</p>}
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.tile}`}>
          {icon}
        </span>
      </div>
    </Tag>
  );
}

/* ------------------------------------------------------------ empty states */

export function EmptyState({
  icon, title, description, action,
}: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && (
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          {icon}
        </span>
      )}
      <p className="text-base font-semibold text-ink-800">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center" role="alert">
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
        <AlertCircle className="h-7 w-7" />
      </span>
      <p className="text-base font-semibold text-ink-800">Something went wrong</p>
      <p className="mt-1.5 max-w-md text-sm text-ink-500">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-5">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- loading */

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} aria-hidden />;
}

/**
 * The skeleton shown while a section is loading.
 *
 * `className` is where callers set a minimum height. Reserving roughly the space the
 * real content will take is what stops the page collapsing to the height of the
 * skeleton and springing back when the data lands — that jump is what reads as a
 * glitch, far more than the swap itself.
 */
export function LoadingBlock({ label = 'Loading…', rows = 3, className = '' }: {
  label?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`p-6 ${className}`} aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-1/3" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-ink-400">
      <Spinner className="h-8 w-8" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/* ---------------------------------------------------------------- search */

export function SearchInput({
  value, onChange, placeholder = 'Search…', className = '',
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- modal */

export function Modal({
  open, onClose, title, description, children, footer, size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes, and the page behind is locked so the modal is the only thing
  // that scrolls while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-in-up relative w-full ${widths[size]} max-h-[92vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl outline-none flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && <div className="border-t border-ink-200 bg-ink-50 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ page header */

export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ select */

export interface SelectOption {
  value: string;
  label: string;
  /** Optional monospace prefix, e.g. a project key shown before the name. */
  badge?: string;
}

/**
 * A dropdown whose menu the app actually controls.
 *
 * A native `<select>` renders its option list through the operating system, which
 * paints its own highlight — that blue bar — and ignores every stylesheet. The popup is
 * the one part of the UI that CSS cannot reach, so matching the theme means not using
 * it. This is a listbox instead: the trigger keeps the `.input` appearance so forms
 * look unchanged, and the menu is styled like the sidebar, which is where the app's
 * navigation language already lives.
 *
 * Keyboard behaviour follows the WAI-ARIA listbox pattern rather than being
 * approximated. Replacing a native control means inheriting its obligations: arrows
 * move, Home/End jump, Enter selects, Escape closes and returns focus, and typing
 * letters jumps to a matching option.
 */
export function Select({
  value, onChange, options, id, placeholder = 'Select…', className = '', disabled, ariaLabel, invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const typed = useRef({ text: '', at: 0 });
  /*
    Enter and Space on a focused button fire a click as well as a keydown. Without
    this the keydown would select and close, and the click that followed would
    immediately reopen the menu.
  */
  const swallowClick = useRef(false);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  // Opening lands the highlight on the current value, so arrowing starts from what is
  // selected rather than from the top of the list.
  const openMenu = () => {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const commit = (index: number, fromKeyboard = false) => {
    const option = options[index];
    if (!option) return;
    if (fromKeyboard) swallowClick.current = true;
    onChange(option.value);
    close();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Keeps the highlighted row in view when arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    switch (e.key) {
      // Escape produces no click, so the swallow flag must not be set here — it
      // would eat the user's next genuine click on the trigger.
      case 'Escape': e.preventDefault(); close(); break;
      case 'Tab': setOpen(false); break;
      case 'Enter':
      case ' ': e.preventDefault(); commit(active, true); break;
      case 'ArrowDown': e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)); break;
      case 'ArrowUp': e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); break;
      case 'Home': e.preventDefault(); setActive(0); break;
      case 'End': e.preventDefault(); setActive(options.length - 1); break;
      default:
        // Type-ahead. The buffer resets after a pause so a new search does not append
        // to an abandoned one.
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const now = performance.now();
          typed.current.text = now - typed.current.at > 700 ? e.key : typed.current.text + e.key;
          typed.current.at = now;
          const needle = typed.current.text.toLowerCase();
          const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(needle));
          if (hit >= 0) setActive(hit);
        }
    }
  };

  const listId = id ? id + '-listbox' : undefined;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && id ? `${id}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => {
          if (swallowClick.current) { swallowClick.current = false; return; }
          if (open) close(false); else openMenu();
        }}
        onKeyDown={onKeyDown}
        className={`input flex items-center justify-between gap-2 text-left ${invalid ? 'input-error' : ''} ${
          open ? 'border-brand-500 bg-brand-50/30' : ''
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? 'text-ink-900' : 'text-ink-400'}`}>
          {selected ? (
            <>
              {selected.badge && <span className="mr-1.5 font-mono text-xs text-brand-700">{selected.badge}</span>}
              {selected.label}
            </>
          ) : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-brand-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="fade-in absolute z-50 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-brand-950/40 bg-brand-900 p-1 shadow-lg shadow-brand-950/30"
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-brand-200">No options</li>
          )}
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value}
                id={id ? `${id}-opt-${i}` : undefined}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); commit(i); }}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isSelected
                    ? 'bg-cream-200 font-semibold text-brand-950'
                    : i === active
                      ? 'bg-white/15 text-white'
                      : 'text-brand-200'
                }`}
              >
                {o.badge && (
                  <span className={`font-mono text-[11px] font-bold ${isSelected ? 'text-brand-800' : 'text-cream-200'}`}>
                    {o.badge}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
