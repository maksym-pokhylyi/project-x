import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { ProfileForm } from "@/components/app/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const ctx = await requireOrgForPage();
  return (
    <>
      <PageHeader level={2} title="Profile" description="Your personal account details." />
      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Shown to the other members of your workspaces.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm name={ctx.user.name} email={ctx.user.email} />
        </CardContent>
      </Card>
    </>
  );
}
