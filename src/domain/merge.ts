/*
 * MIRROR of music-collector-frontend/src/domain/merge.ts
 *
 * The web and mobile apps must agree exactly on the clock, the domain shape, the write
 * path and the merge, or the same collection would converge differently depending on which
 * device synced last. These files are copied verbatim for now; phase 3+ extracts them into
 * a shared package. Until then: change both, in the same commit.
 */
import type { Copy } from "@/domain/types";
import { COPY_MERGEABLE_FIELDS } from "@/domain/types";

/**
 * Field-level last-write-wins merge for a copy.
 *
 * This function is the contract between three implementations — web, mobile and the Java
 * server — and all three are tested against the same hand-authored fixture
 * (`merge-fixture.json`). The fixture is the specification: it was written by hand rather
 * than generated from any one implementation, so no side's behaviour can silently become
 * the definition.
 *
 * Three properties matter, and the fixture checks all of them:
 *
 *   commutative   merge(a, b) equals merge(b, a)
 *   idempotent    merge(merge(a, b), b) equals merge(a, b)
 *   convergent    every peer that has seen the same edits agrees, in any order
 *
 * Clocks are compared as their encoded strings. The encoding is fixed-width, so
 * lexicographic order matches clock order exactly, and string comparison behaves
 * identically in JavaScript and Java.
 */
export function mergeCopies(local: Copy | undefined, remote: Copy | undefined): Copy {
  if (local === undefined && remote === undefined) {
    throw new Error("mergeCopies needs at least one side");
  }
  if (local === undefined) return remote as Copy;
  if (remote === undefined) return local;
  if (local.id !== remote.id) {
    throw new Error(`mergeCopies got two different copies: ${local.id} vs ${remote.id}`);
  }

  const merged: Record<string, unknown> = { id: local.id };
  const clocks: Record<string, string> = {};

  for (const field of COPY_MERGEABLE_FIELDS) {
    const localClock = local.fieldClocks[field];
    const remoteClock = remote.fieldClocks[field];
    const winner = pickWinner(localClock, remoteClock);

    merged[field] = winner === "remote" ? remote[field] : local[field];
    clocks[field] = (winner === "remote" ? remoteClock : localClock) as string;
  }

  // Not mergeable fields — both are derived from the two inputs, so every peer computes
  // the same answer without needing a clock of its own.
  //
  // The same record cannot have been created twice, so the earlier timestamp is the true
  // one: a device that learned about the copy later must not overwrite when it began.
  merged.createdAt = Math.min(local.createdAt, remote.createdAt);
  merged.notesConflict = losingNotes(local, remote, merged.notes as string | null);
  merged.fieldClocks = clocks;

  return merged as unknown as Copy;
}

/**
 * The other version of the notes this record currently knows about.
 *
 * A state, not an event: it means "some peer has different notes", and it survives until
 * the person edits the notes themselves (which clears it) or every peer converges on the
 * same text. Carrying an existing conflict forward is what makes the merge idempotent —
 * a client merges, pushes, pulls the same record back and merges again, and that round
 * trip must not quietly drop the marker.
 *
 * This is the honest limit of last-write-wins without causal history: the merge can see
 * that two versions differ, but not which one the person has already read. Version vectors
 * would answer that; they are not worth their weight for a single-user collection.
 */
function losingNotes(local: Copy, remote: Copy, winning: string | null): string | null {
  if (!isMeaningful(winning)) {
    return null;
  }
  // Exactly one of the two notes values can differ from the winner, so this is unaffected
  // by which side is passed first.
  const fromValues = [local.notes, remote.notes].find(
    (notes) => isMeaningful(notes) && notes !== winning,
  );
  if (fromValues !== undefined) {
    return fromValues;
  }

  // Neither side edited notes this round, so keep whatever conflict was already recorded.
  // Sorted rather than taken in argument order, so both peers pick the same one.
  const carried = [local.notesConflict, remote.notesConflict]
    .filter((notes): notes is string => isMeaningful(notes) && notes !== winning)
    .sort();
  return carried[0] ?? null;
}

function pickWinner(localClock: string | undefined, remoteClock: string | undefined): "local" | "remote" {
  if (remoteClock === undefined) return "local";
  if (localClock === undefined) return "remote";
  return remoteClock > localClock ? "remote" : "local";
}

function isMeaningful(notes: string | null | undefined): notes is string {
  return notes !== null && notes !== undefined && notes.trim() !== "";
}

/** Merges two whole collections, keyed by copy id. */
export function mergeCollections(local: readonly Copy[], remote: readonly Copy[]): Copy[] {
  const byId = new Map<string, { local?: Copy; remote?: Copy }>();
  for (const copy of local) byId.set(copy.id, { ...byId.get(copy.id), local: copy });
  for (const copy of remote) byId.set(copy.id, { ...byId.get(copy.id), remote: copy });
  return [...byId.values()].map((pair) => mergeCopies(pair.local, pair.remote));
}
