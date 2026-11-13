import Link from "next/link";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CPV_DIVISIONS } from "@/features/procurement/domain/cpv";
import { UK_REGIONS } from "@/features/procurement/domain/regions";
import { outreachConfig } from "../config";
import { SEGMENT_PRESETS, segmentToParams, type OutreachSegment } from "../domain/segment";

const DIVISIONS = Object.entries(CPV_DIVISIONS).sort((a, b) => a[1].localeCompare(b[1]));
const REGIONS = Object.entries(UK_REGIONS);

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-destructive">
      {messages[0]}
    </p>
  );
}

/**
 * The segment builder: a plain GET form, so a preview has an address that can be reloaded
 * and nothing is stored by looking. `values` are what the form shows (the last valid segment
 * or the defaults); `raw` keeps what was typed into a field that failed validation.
 */
export function SegmentForm({ values, raw, fieldErrors }: { values: OutreachSegment; raw: Record<string, string>; fieldErrors: Record<string, string[]> }) {
  const presetHref = (preset: (typeof SEGMENT_PRESETS)[number]) => {
    const params = segmentToParams({ ...values, cpvDivisions: preset.cpvDivisions, cpvGroups: preset.cpvGroups });
    params.set("preview", "1");
    return `/admin/outreach?${params.toString()}`;
  };
  return (
    <form method="get" action="/admin/outreach" className="space-y-5" data-testid="segment-form">
      <input type="hidden" name="preview" value="1" />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Trade</legend>
        <p className="text-xs text-muted-foreground">
          CPV divisions of the award. None ticked means every trade. Starting points:{" "}
          {SEGMENT_PRESETS.map((preset, index) => (
            <span key={preset.label}>
              {index > 0 ? " · " : ""}
              <Link className="underline underline-offset-4" href={presetHref(preset)} prefetch={false}>
                {preset.label}
              </Link>
            </span>
          ))}
        </p>
        <div className="grid max-h-56 grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3">
          {DIVISIONS.map(([division, label]) => (
            <label key={division} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="divisions" value={division} defaultChecked={values.cpvDivisions.includes(division)} className="mt-1" />
              <span>
                {label} <span className="text-xs text-muted-foreground">{division}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="max-w-md space-y-1.5">
          <Label htmlFor="segment-groups">Also these CPV groups</Label>
          <Input
            id="segment-groups"
            name="groups"
            defaultValue={raw.groups ?? values.cpvGroups.join(", ")}
            placeholder="797, 799"
            inputMode="numeric"
            aria-invalid={fieldErrors.cpvGroups ? true : undefined}
            aria-describedby="segment-groups-hint"
          />
          <p id="segment-groups-hint" className="text-xs text-muted-foreground">
            Three-digit groups, separated by commas — for a trade narrower than a division (797 is building cleaning).
          </p>
          <FieldError id="segment-groups-error" messages={fieldErrors.cpvGroups} />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Where the company is based</legend>
        <p className="text-xs text-muted-foreground">None ticked means anywhere in the UK.</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
          {REGIONS.map(([code, label]) => (
            <label key={code} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="regions" value={code} defaultChecked={values.regions.includes(code)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="segment-days">Award published in the last</Label>
          <div className="flex items-center gap-2">
            <Input id="segment-days" name="days" type="number" min={1} max={outreachConfig.publishedWithinDays.max} defaultValue={raw.days ?? values.publishedWithinDays} className="w-24" aria-invalid={fieldErrors.publishedWithinDays ? true : undefined} />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          <FieldError id="segment-days-error" messages={fieldErrors.publishedWithinDays} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="segment-min">Contract value from (£)</Label>
          <Input id="segment-min" name="min" defaultValue={raw.min ?? values.valueMin ?? ""} placeholder="any" inputMode="numeric" aria-invalid={fieldErrors.valueMin ? true : undefined} />
          <FieldError id="segment-min-error" messages={fieldErrors.valueMin} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="segment-max">Contract value up to (£)</Label>
          <Input id="segment-max" name="max" defaultValue={raw.max ?? values.valueMax ?? ""} placeholder="any" inputMode="numeric" aria-invalid={fieldErrors.valueMax ? true : undefined} />
          <FieldError id="segment-max-error" messages={fieldErrors.valueMax} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="segment-batch">Batch size</Label>
          <Input id="segment-batch" name="batch" type="number" min={1} max={outreachConfig.batchSize.max} defaultValue={raw.batch ?? values.batchSize} className="w-24" aria-invalid={fieldErrors.batchSize ? true : undefined} />
          <FieldError id="segment-batch-error" messages={fieldErrors.batchSize} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        With a value band, awards without a figure of their own (frameworks, shared values, no value published) are left out. A list holds at most {outreachConfig.batchSize.max} companies.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="segment-mailbox">Mailboxes</Label>
          <NativeSelect id="segment-mailbox" name="mailbox" defaultValue={values.mailbox} className="w-full">
            <option value="generic">Generic mailboxes only (info@, tenders@)</option>
            <option value="generic_and_named">Also named addresses still inside their one-month window</option>
          </NativeSelect>
          <p className="text-xs text-muted-foreground">Named addresses are personal data. Use them only once the UK representative is appointed and the legitimate-interests assessment is signed.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="segment-size">Company size</Label>
          <NativeSelect id="segment-size" name="size" defaultValue={values.smeOnly ? "sme" : "any"} className="w-full">
            <option value="sme">Small and medium-sized companies only</option>
            <option value="any">Any size</option>
          </NativeSelect>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">Preview list</Button>
        <Link href="/admin/outreach" className="text-sm text-muted-foreground underline underline-offset-4" prefetch={false}>
          Reset
        </Link>
        <span className="text-xs text-muted-foreground">A preview stores nothing.</span>
      </div>
    </form>
  );
}
