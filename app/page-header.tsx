"use client";

import Link from "next/link";

/**
 * The app-wide header bar: circular back button, title, optional inline links,
 * and whatever actions the page passes as children (pinned right).
 *
 * The back button replaces the old "change the channel" / "← home" / "all
 * rooms" text links — the destination still varies per page, the shape no
 * longer does. Its wording lives in the tooltip so the icon can stay silent.
 *
 * Right padding clears the fixed settings gear (app/settings-menu.tsx), which
 * floats over the bar's right end by design.
 */
export default function PageHeader({
  title,
  backHref = "/",
  backLabel = "change the channel",
  links = [],
  onMenu,
  children,
  style,
}: {
  title: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  links?: { href: string; label: string; icon?: string }[];
  /** Chat pages pass the sidebar toggle here; it only shows on narrow screens. */
  onMenu?: (() => void) | null;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <header className="lg-topbar" style={style}>
      {onMenu && (
        <button
          type="button"
          className="lg-icon-btn lg-menu-btn"
          onClick={onMenu}
          title="Your chats"
          aria-label="Your chats"
        >
          <span className="msr" style={{ fontSize: 20 }} aria-hidden>
            menu
          </span>
        </button>
      )}
      <Link href={backHref} className="lg-icon-btn" title={backLabel} aria-label={backLabel}>
        <span className="msr" style={{ fontSize: 20 }} aria-hidden>
          arrow_back
        </span>
      </Link>
      <h1 className="lg-topbar-title">{title}</h1>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="lg-topbar-link">
          {l.icon && (
            <span className="msr" style={{ fontSize: 15 }} aria-hidden>
              {l.icon}
            </span>
          )}
          {l.label}
        </Link>
      ))}
      {children && <div className="lg-topbar-actions">{children}</div>}
    </header>
  );
}
