import { Button } from "@/components/ui/button";
import { removeRadarSourceAction } from "../actions";

/**
 * "Remove this radar": takes a claimed company or a manual radar off the workspace
 * (workspace admins only; the Server Action checks the role again). Saved tenders stay.
 * The public page of a company is not touched.
 */
export function RemoveRadar({ sourceKey, name }: { sourceKey: string; name: string }) {
  return (
    <section aria-labelledby="remove-radar-h" className="mt-10 flex flex-col items-start gap-2 border-t border-line pt-6" data-testid="remove-radar">
      <h2 id="remove-radar-h" className="font-sans text-15 font-semibold text-ink">
        Remove this radar
      </h2>
      <p className="text-sm text-ink-2">
        {name} comes off this workspace’s radar. Tenders you saved stay saved, and the company’s public page is not changed. You can add it again at any time.
      </p>
      <form action={removeRadarSourceAction} className="pt-1">
        <input type="hidden" name="key" value={sourceKey} />
        <Button type="submit" variant="outline">
          Remove from this workspace
        </Button>
      </form>
    </section>
  );
}
