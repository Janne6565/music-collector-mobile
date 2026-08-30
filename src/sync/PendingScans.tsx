import { usePendingScans } from "@/sync/usePendingScans";

/**
 * Mount point for the pending-scan sweep.
 *
 * A component with no output, so the loop can sit in the tree above the tabs — the same
 * shape `RestoreSession` uses, and for the same reason: what it does is start something,
 * and what it draws is nothing.
 */
export function PendingScans(): null {
  usePendingScans();
  return null;
}
