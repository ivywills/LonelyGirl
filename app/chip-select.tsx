"use client";

import { useMemo, useState } from "react";
import type { Option } from "@/lib/profile-options";
import { chip, T } from "@/lib/profile-theme";

export const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 14px",
  borderRadius: 11,
  border: `1.5px solid ${T.tan}`,
  background: T.inputBg,
  fontSize: 14,
  color: T.ink,
};

/*
 * One chip selector for every list in the profile flow — onboarding and the
 * edit form both use this, so search behaves identically in both places.
 *
 * Anything already selected stays visible even when it doesn't match the
 * query. Otherwise typing makes your own picks disappear and it reads as if
 * they were cleared.
 *
 * Single-select callers pass `selected={value ? [value] : []}` and toggle in
 * their own handler; there's no separate mode to keep in sync.
 */
/*
 * Chip geometry, kept here so the scroll window can be expressed in rows
 * instead of a magic pixel height. Must match `chip()` in profile-theme:
 * 7px padding top and bottom + ~15px line + 1.5px border each side.
 */
const CHIP_H = 33;
const CHIP_GAP = 8;

/** Height that shows `rows` full rows plus a sliver of the next, so it reads as scrollable. */
function windowHeight(rows: number) {
  return rows * CHIP_H + (rows - 1) * CHIP_GAP + 14;
}

export default function SearchableChips({
  options,
  selected,
  onToggle,
  colors,
  placeholder,
  /** Lists this short are faster to scan than to search. */
  minToSearch = 10,
  /** Rows visible before the list scrolls. ~4 rows is roughly 8-10 chips. */
  rows = 4,
}: {
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
  colors: readonly [string, string];
  placeholder?: string;
  minToSearch?: number;
  rows?: number;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      q ? options.filter((o) => selected.includes(o.id) || o.label.toLowerCase().includes(q)) : options,
    [options, q, selected]
  );
  const matchCount = q ? visible.filter((o) => o.label.toLowerCase().includes(q)).length : visible.length;

  return (
    <>
      {options.length > minToSearch && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? "Search"}
          aria-label={placeholder ?? "Search options"}
          style={{ ...inputStyle, marginBottom: 12 }}
        />
      )}
      {/*
        A fixed window rather than the full list: the step stays a predictable
        height no matter how long these lists get, and the partial row at the
        bottom edge is the cue that there's more below.
      */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: CHIP_GAP,
          alignContent: "flex-start",
          maxHeight: windowHeight(rows),
          overflowY: "auto",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          marginRight: -6,
          paddingRight: 6,
        }}
      >
        {visible.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            aria-pressed={selected.includes(o.id)}
            style={chip(selected.includes(o.id), colors[0], colors[1])}
          >
            {o.emoji ? <span aria-hidden>{o.emoji}</span> : null} {o.label}
          </button>
        ))}
      </div>
      {q && matchCount === 0 && (
        <p style={{ fontSize: 13, color: T.faint, margin: "10px 0 0" }}>
          Nothing matches that — try a shorter search.
        </p>
      )}
    </>
  );
}
