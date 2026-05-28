// Standard machine types pre-filled on the daily report's machinery section.
// Like trades (src/lib/trades.ts): the `canonical` value is STORED in
// machinery_entries.machine_type (English) so the same machine groups across
// languages for analytics/PDF; the `key` maps to i18n (Report.machineTypes.<key>)
// so the supervisor SEES it in their language. "Other" machines are free-text.
//
// Model: one machinery_entry = one machine + its hours. Two of the same type on
// different hours (e.g. one broke down) are just two rows: backhoe 8h + backhoe 4h.
export const DEFAULT_MACHINES = [
  { key: "excavator", canonical: "Excavator" },
  { key: "backhoe", canonical: "Backhoe" },
  { key: "backpusher", canonical: "Backpusher" },
] as const;

export type DefaultMachineKey = (typeof DEFAULT_MACHINES)[number]["key"];

const KEY_BY_CANONICAL: Record<string, DefaultMachineKey> = Object.fromEntries(
  DEFAULT_MACHINES.map((d) => [d.canonical, d.key]),
) as Record<string, DefaultMachineKey>;

// i18n key for a stored machine type if it's a known default, else null
// (caller displays the raw free-text type in that case).
export function defaultMachineKey(type: string): DefaultMachineKey | null {
  return KEY_BY_CANONICAL[type] ?? null;
}
