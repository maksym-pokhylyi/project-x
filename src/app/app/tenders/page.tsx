import { redirect } from "next/navigation";

/** There is no list of tenders of its own: a tender is reached from the radar, and its saved ones live there. */
export default function TendersIndexPage() {
  redirect("/app");
}
