/*
 * MIRROR of music-collector-frontend/src/features/detail/useCopyEditorLogic.ts
 *
 * Both apps must parse a typed price and date identically, or the same input would store
 * different values depending on which one you used. Change both, in the same commit.
 */
import { useCallback, useState } from "react";
import { parseIsoDate, parseMoneyToCents } from "@/domain/money";
import type { Condition, Copy } from "@/domain/types";
import type { CopyDraft } from "@/local/copyWrites";

export interface EditorFields {
  condition: Condition | "";
  price: string;
  purchasedOn: string;
  purchasedAt: string;
  rating: number | null;
  notes: string;
}

function fieldsOf(copy: Copy): EditorFields {
  return {
    condition: copy.condition ?? "",
    price: copy.pricePaidCents === null ? "" : (copy.pricePaidCents / 100).toFixed(2),
    purchasedOn: copy.purchasedOn ?? "",
    purchasedAt: copy.purchasedAt ?? "",
    rating: copy.rating,
    notes: copy.notes ?? "",
  };
}

/**
 * Editing one copy.
 *
 * The patch is built from what actually changed, and `applyCopyPatch` restamps only those
 * fields — so saving a form where you only touched the price does not start winning
 * conflicts against another device's edit to the condition.
 */
export function useCopyEditorLogic(copy: Copy, onSave: (patch: Partial<CopyDraft>) => void) {
  const [fields, setFields] = useState<EditorFields>(() => fieldsOf(copy));
  const [priceInvalid, setPriceInvalid] = useState(false);
  const [dateInvalid, setDateInvalid] = useState(false);

  const set = useCallback(<K extends keyof EditorFields>(key: K, value: EditorFields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
    if (key === "price") setPriceInvalid(false);
    if (key === "purchasedOn") setDateInvalid(false);
  }, []);

  const reset = useCallback(() => {
    setFields(fieldsOf(copy));
    setPriceInvalid(false);
    setDateInvalid(false);
  }, [copy]);

  const submit = useCallback(() => {
    // A blank price means "not recorded", which is different from an unparseable one —
    // the second is a mistake worth surfacing rather than silently discarding.
    const price = fields.price.trim() === "" ? null : parseMoneyToCents(fields.price);
    if (fields.price.trim() !== "" && price === null) {
      setPriceInvalid(true);
      return;
    }
    const purchasedOn = fields.purchasedOn.trim() === "" ? null : parseIsoDate(fields.purchasedOn);
    if (fields.purchasedOn.trim() !== "" && purchasedOn === null) {
      setDateInvalid(true);
      return;
    }

    onSave({
      condition: fields.condition === "" ? null : fields.condition,
      pricePaidCents: price,
      purchasedOn,
      purchasedAt: fields.purchasedAt.trim() === "" ? null : fields.purchasedAt.trim(),
      rating: fields.rating,
      notes: fields.notes.trim() === "" ? null : fields.notes,
    });
  }, [fields, onSave]);

  return { fields, set, reset, submit, priceInvalid, dateInvalid };
}
