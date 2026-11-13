"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DropZone } from "@/components/ui/drop-zone";
import { FileButton } from "@/components/ui/file-button";
import { IconButton } from "@/components/ui/icon-button";
import { MenuButton } from "@/components/ui/menu-button";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";

/** Demos of the parts that need a function prop or state, for the styleguide's server page. */

export function DropZoneDemo() {
  const [names, setNames] = useState<string[]>([]);
  return (
    <div className="flex max-w-xl flex-col gap-2">
      <DropZone accept=".pdf,.docx,.xlsx,.zip" hint="PDF, Word, Excel or ZIP. Send everything the buyer sent, including appendices." onFiles={(files) => setNames(files.map((file) => file.name))} />
      <p role="status" className="text-13 text-ink-2">
        {names.length > 0 ? `Chosen: ${names.join(", ")}` : "Nothing chosen yet."}
      </p>
    </div>
  );
}

export function FileButtonDemo() {
  return (
    <FileButton accept="image/png,image/jpeg,image/webp" variant="outline" size="sm" onFiles={([file]) => toast.message(`Chosen: ${file?.name ?? ""}`)}>
      Upload logo
    </FileButton>
  );
}

export function MenuButtonDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuButton>Aldermoor &amp; Pike Building Services Ltd</MenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <div className="px-2.5 py-2.5">
          <p className="text-13 text-ink-2">Free plan</p>
          <p className="mt-1 text-13 text-ink-2">Every match and daily alerts from £29 a month.</p>
        </div>
        <DropdownMenuItem asChild variant="cta" className="mt-0">
          <Link href="#actions">Upgrade</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function IconButtonDemo() {
  return (
    <div className="flex items-center gap-3">
      <IconButton label="Open menu">
        <svg viewBox="0 0 20 20" aria-hidden className="size-[1.375rem] fill-none stroke-current stroke-[1.8] [stroke-linecap:round]">
          <path d="M3 6h14M3 10h14M3 14h14" />
        </svg>
      </IconButton>
      <IconButton label="Close" variant="outline">
        <svg viewBox="0 0 20 20" aria-hidden className="size-[1.375rem] fill-none stroke-current stroke-[1.8] [stroke-linecap:round]">
          <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />
        </svg>
      </IconButton>
      <IconButton label="Open account menu: Joanne Pike" shape="round">
        <span aria-hidden className="grid size-[2.125rem] place-items-center rounded-full bg-brand-tint text-13 font-semibold text-brand">
          JP
        </span>
      </IconButton>
    </div>
  );
}

export function SegmentedToggleDemo() {
  const [value, setValue] = useState<"month" | "year">("month");
  return (
    <SegmentedToggle
      aria-label="Billing period"
      value={value}
      onValueChange={setValue}
      options={[
        { value: "month", label: "Monthly" },
        { value: "year", label: "Annual" },
      ]}
    />
  );
}
