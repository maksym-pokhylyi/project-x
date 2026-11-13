import { cn } from "@/lib/utils";

/** Workspace logo, or its initial on a neutral tile. Logos are served by /api/files. */
export function WorkspaceAvatar({ name, logo, className }: { name: string; logo: string | null; className?: string }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated file route; next/image cannot fetch it
      <img src={logo} alt="" className={cn("size-6 shrink-0 rounded-md border object-cover", className)} />
    );
  }
  return (
    <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold", className)}>
      {name.trim().charAt(0).toUpperCase() || "W"}
    </span>
  );
}
