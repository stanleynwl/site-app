// Fixed work-breakdown template seeded onto every block's Progress tracker.
// Two levels: a category heading (A–L) and its leaf items. Some categories have
// no sub-items (the category itself is the leaf). Displayed as
// "<CATEGORY> - <item>" (or just "<CATEGORY>" when there's no item), e.g.
// "K. FLOOR FINISHES - Toilet & Kitchen tiles". These are operational labels the
// office controls; like trades they're stored as-is (not per-locale translated).
// No "server-only" so both server actions and client components can import.
export const PROGRESS_TEMPLATE: { category: string; items: string[] }[] = [
  { category: "A. PILING", items: ["Lump Sum"] },
  { category: "B. SUB-STRUCTURE", items: ["Footing & stump", "Ground beam", "Floor slab"] },
  { category: "C. RC FRAME", items: ["Column", "Roof Beam"] },
  { category: "D. ROOF", items: ["Roof truss", "Covering"] },
  { category: "E. WALL AND PARTITIONS", items: [] },
  { category: "F. DOORS AND WINDOW", items: ["Frames", "Leaves and glass"] },
  { category: "G. CEILING", items: [] },
  { category: "H. INTERNAL PLUMBING", items: ["Piping", "Sanitary fittings"] },
  { category: "I. ELECTRICAL INSTALL", items: ["Wiring", "Supply and Fixing"] },
  { category: "J. WALL FINISHES", items: ["Plastering", "Wall tiles", "Painting"] },
  { category: "K. FLOOR FINISHES", items: ["Toilet & Kitchen tiles", "Hall & bedrooms tiles"] },
  {
    category: "L. EXTERNAL WORKS",
    items: ["Apron, driveway & manhole", "Fencing and gate", "Site Clearing"],
  },
];

export type ProgressSeedRow = {
  category: string;
  name: string | null;
  sort_order: number;
};

// Flatten the template into seed rows (one row per leaf; categories with no
// items become a single row with name = null), with a stable sort order.
export function progressSeedRows(): ProgressSeedRow[] {
  const rows: ProgressSeedRow[] = [];
  let order = 0;
  for (const { category, items } of PROGRESS_TEMPLATE) {
    if (items.length === 0) {
      rows.push({ category, name: null, sort_order: order++ });
    } else {
      for (const name of items) rows.push({ category, name, sort_order: order++ });
    }
  }
  return rows;
}

// "K. FLOOR FINISHES - Toilet & Kitchen tiles" or just the category when no item.
export function progressItemLabel(category: string, name: string | null): string {
  return name ? `${category} - ${name}` : category;
}
