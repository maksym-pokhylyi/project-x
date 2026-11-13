import Link from "next/link";
import { FieldError, FieldHint } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CPV_DIVISIONS } from "@/features/procurement/domain/cpv";
import { UK_REGIONS } from "@/features/procurement/domain/regions";
import { outreachConfig } from "../config";
import { SEGMENT_PRESETS, segmentToParams, type OutreachSegment } from "../domain/segment";

const DIVISIONS = Object.entries(CPV_DIVISIONS).sort((a, b) => a[1].localeCompare(b[1]));
const REGIONS = Object.entries(UK_REGIONS);

const legend = "text-sm leading-5 font-semibold text-ink";

/** Error under a field, wired to it with aria-describedby (pass the same id to the control). */
function Problem({ id, messages }: { id: string; messages?: string[] }) {
  return messages?.length ? <FieldError id={id}>{messages[0]}</FieldError> : null;
}

/**
 * The segment builder: a plain GET form, so a preview has an address that can be reloaded
 * and nothing is stored by looking. `values` are what the form shows (the last valid segment
 * or the defaults); `raw` keeps what was typed into a field that failed validation.
 *
 * `namedAllowed` is false while no UK representative is appointed: the choice of named
 * addresses is then switched off here (and refused by the server whatever is sent).
 *
 * The page gives this form a `key` made from the segment in the address, so that following
 * a starting-point link shows that segment's ticks instead of the previous ones.
 */
export function SegmentForm({
  values,
  raw,
  fieldErrors,
  namedAllowed,
}: {
  values: OutreachSegment;
  raw: Record<string, string>;
  fieldErrors: Record<string, string[]>;
  namedAllowed: boolean;
}) {
  const presetHref = (preset: (typeof SEGMENT_PRESETS)[number]) => {
    const params = segmentToParams({ ...values, cpvDivisions: preset.cpvDivisions, cpvGroups: preset.cpvGroups });
    params.set("preview", "1");
    return `/admin/outreach?${params.toString()}`;
  };
  const described = (key: string, id: string) => (fieldErrors[key] ? `${id}-error` : undefined);

  return (
    <form method="get" action="/admin/outreach" className="flex flex-col gap-7" data-testid="segment-form">
      <input type="hidden" name="preview" value="1" />

      <fieldset className="min-w-0">
        <legend className={legend}>Trade</legend>
        <FieldHint className="mt-1">
          CPV divisions of the award. None ticked means every trade. Starting points:{" "}
          {SEGMENT_PRESETS.map((preset, index) => (
            <span key={preset.label}>
              {index > 0 ? ", " : ""}
              <Link href={presetHref(preset)} prefetch={false}>
                {preset.label}
              </Link>
            </span>
          ))}
          .
        </FieldHint>
        <div className="mt-3 grid max-h-64 grid-cols-1 gap-x-6 overflow-y-auto rounded-control border border-line bg-paper px-3.5 py-2 sm:grid-cols-2 xl:grid-cols-3">
          {DIVISIONS.map(([division, label]) => (
            <div key={division} className="flex items-start gap-2.5 py-1.5">
              <Checkbox id={`division-${division}`} name="divisions" value={division} defaultChecked={values.cpvDivisions.includes(division)} />
              <Label htmlFor={`division-${division}`} className="block font-normal">
                {label} <span className="type-ref text-ink-2">{division}</span>
              </Label>
            </div>
          ))}
        </div>
        <div className="mt-4 flex max-w-md flex-col gap-2">
          <Label htmlFor="segment-groups">Also these CPV groups</Label>
          <Input
            id="segment-groups"
            name="groups"
            defaultValue={raw.groups ?? values.cpvGroups.join(", ")}
            placeholder="797, 799"
            inputMode="numeric"
            aria-invalid={fieldErrors.cpvGroups ? true : undefined}
            aria-describedby={described("cpvGroups", "segment-groups") ?? "segment-groups-hint"}
          />
          {fieldErrors.cpvGroups ? (
            <Problem id="segment-groups-error" messages={fieldErrors.cpvGroups} />
          ) : (
            <FieldHint id="segment-groups-hint">Three-digit groups, separated by commas, for a trade narrower than a division (797 is building cleaning).</FieldHint>
          )}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={legend}>Where the company is based</legend>
        <FieldHint className="mt-1">None ticked means anywhere in the UK.</FieldHint>
        <div className="mt-2 grid grid-cols-1 gap-x-6 min-[26rem]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {REGIONS.map(([code, label]) => (
            <div key={code} className="flex items-start gap-2.5 py-1.5">
              <Checkbox id={`region-${code}`} name="regions" value={code} defaultChecked={values.regions.includes(code)} />
              <Label htmlFor={`region-${code}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="segment-days">Award published in the last (days)</Label>
            <Input
              id="segment-days"
              name="days"
              type="number"
              min={1}
              max={outreachConfig.publishedWithinDays.max}
              defaultValue={raw.days ?? values.publishedWithinDays}
              aria-invalid={fieldErrors.publishedWithinDays ? true : undefined}
              aria-describedby={described("publishedWithinDays", "segment-days")}
            />
            <Problem id="segment-days-error" messages={fieldErrors.publishedWithinDays} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="segment-batch">Batch size</Label>
            <Input
              id="segment-batch"
              name="batch"
              type="number"
              min={1}
              max={outreachConfig.batchSize.max}
              defaultValue={raw.batch ?? values.batchSize}
              aria-invalid={fieldErrors.batchSize ? true : undefined}
              aria-describedby={described("batchSize", "segment-batch")}
            />
            <Problem id="segment-batch-error" messages={fieldErrors.batchSize} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="segment-min">Contract value from (£)</Label>
            <Input
              id="segment-min"
              name="min"
              defaultValue={raw.min ?? values.valueMin ?? ""}
              placeholder="any"
              inputMode="numeric"
              aria-invalid={fieldErrors.valueMin ? true : undefined}
              aria-describedby={described("valueMin", "segment-min")}
            />
            <Problem id="segment-min-error" messages={fieldErrors.valueMin} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="segment-max">Contract value up to (£)</Label>
            <Input
              id="segment-max"
              name="max"
              defaultValue={raw.max ?? values.valueMax ?? ""}
              placeholder="any"
              inputMode="numeric"
              aria-invalid={fieldErrors.valueMax ? true : undefined}
              aria-describedby={described("valueMax", "segment-max")}
            />
            <Problem id="segment-max-error" messages={fieldErrors.valueMax} />
          </div>
        </div>
        <FieldHint>
          With a value band, awards without a figure of their own (frameworks, shared values, no value published) are left out. A list holds at most {outreachConfig.batchSize.max} companies.
        </FieldHint>
      </div>

      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="segment-mailbox">Mailboxes</Label>
          <NativeSelect id="segment-mailbox" name="mailbox" defaultValue={namedAllowed ? values.mailbox : "generic"} className="w-full" aria-describedby="segment-mailbox-hint">
            <option value="generic">Generic mailboxes only</option>
            <option value="generic_and_named" disabled={!namedAllowed}>
              Generic and named addresses
            </option>
          </NativeSelect>
          <FieldHint id="segment-mailbox-hint">
            {namedAllowed
              ? "Generic: info@, tenders@ and the like. A named address is personal data and is listed only inside its one-month window; use it only once the legitimate-interests assessment is signed."
              : "Generic: info@, tenders@ and the like. Named addresses are switched off: no UK representative is appointed."}
          </FieldHint>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="segment-size">Company size</Label>
          <NativeSelect id="segment-size" name="size" defaultValue={values.smeOnly ? "sme" : "any"} className="w-full">
            <option value="sme">Small and medium-sized only</option>
            <option value="any">Any size</option>
          </NativeSelect>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" data-testid="preview-button">
          Preview list
        </Button>
        <ButtonLink href="/admin/outreach" variant="ghost" prefetch={false}>
          Reset
        </ButtonLink>
        <span className="text-13 text-ink-2">A preview stores nothing.</span>
      </div>
    </form>
  );
}
