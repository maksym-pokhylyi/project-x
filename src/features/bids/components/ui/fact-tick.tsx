import { Check } from "lucide-react";
import { ToggleButton } from "@/components/ui/toggle-button";

/**
 * "I have checked this" on a key fact: a person confirms they read it in the documents.
 * A plain control — the caller owns the state and what a toggle does.
 */
export function FactTick({ confirmed, pending, onToggle }: { confirmed: boolean; pending?: boolean; onToggle: () => void }) {
  return (
    <ToggleButton pressed={confirmed} disabled={pending} onClick={onToggle}>
      <Check aria-hidden className={confirmed ? "size-3" : "size-3 opacity-40"} />
      {confirmed ? "Confirmed by you" : "I have checked this"}
    </ToggleButton>
  );
}
