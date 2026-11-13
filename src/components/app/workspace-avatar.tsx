import { cn } from "@/lib/utils";

/** Workspace logo, or its initial on a neutral tile. Logos are served by /api/files. */
export function WorkspaceAvatar({ name, logo, className }: { name: string; logo: string | null; className?: string }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated file route; next/image cannot fetch it
      <img src={logo} alt="" className={cn("size-6 shrink-0 rounded-control border border-line bg-surface object-cover", className)} />
    );
  }
  return (
    <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-control bg-brand-tint text-xs font-semibold text-brand", className)}>
      {name.trim().charAt(0).toUpperCase() || "W"}
    </span>
  );
}
