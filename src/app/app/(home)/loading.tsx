import { RadarSkeleton } from "@/features/procurement/components/radar-screen";

// Streaming boundary for this page. NOTE: a page under a loading.tsx always answers
// HTTP 200 (the shell is sent before the page finishes), so pages that must be able to
// answer 403 via forbidden() — Billing, /admin — deliberately have NO loading.tsx above them.
export default function Loading() {
  return <RadarSkeleton />;
}
