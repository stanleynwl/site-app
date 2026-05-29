// Default construction stages seeded onto every new block. Office can rename,
// add or remove stages per block afterwards, and site can add custom items
// (painting, fencing, piling…). Stored as plain text in block_stages.name — these
// are operational labels the office controls, so they are NOT translated the way
// trades/machines are. Kept here (no "server-only") so both server actions and
// client components can import the list.
export const DEFAULT_STAGES = [
  "Foundation",
  "RC structure",
  "Wall",
  "Roofing (water & electric)",
  "Plastering",
] as const;
