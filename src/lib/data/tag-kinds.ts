// Pure taxonomy constants + types — no server-only imports, so this is safe to
// import from client components (e.g. progress-photo-form). The server data
// layer (tags.ts) re-exports these.

export type TagKind = "block" | "level" | "area" | "activity";
export const TAG_KINDS: TagKind[] = ["block", "level", "area", "activity"];

export type ProjectTag = {
  id: string;
  kind: TagKind;
  label: string;
  approved: boolean;
};
