// Standard trades pre-filled on every daily report. The `canonical` value is
// what gets STORED in manpower_entries.trade (always English) so the same trade
// groups across languages for analytics / PDF ("show all bar benders"). The
// `key` maps to i18n messages (Report.trades.<key>) so the supervisor SEES the
// trade in their own language. Custom "Add row" trades are free-text and stored
// as typed.
export const DEFAULT_TRADES = [
  { key: "general_worker", canonical: "General worker" },
  { key: "carpenter", canonical: "Carpenter" },
  { key: "bar_bender", canonical: "Bar bender" },
  { key: "bricklayer", canonical: "Bricklayer" },
  { key: "plasterer", canonical: "Plasterer" },
] as const;

export type DefaultTradeKey = (typeof DEFAULT_TRADES)[number]["key"];

const KEY_BY_CANONICAL: Record<string, DefaultTradeKey> = Object.fromEntries(
  DEFAULT_TRADES.map((d) => [d.canonical, d.key]),
) as Record<string, DefaultTradeKey>;

// Returns the i18n key for a stored trade if it's a known default, else null
// (caller should display the raw free-text trade in that case).
export function defaultTradeKey(trade: string): DefaultTradeKey | null {
  return KEY_BY_CANONICAL[trade] ?? null;
}
