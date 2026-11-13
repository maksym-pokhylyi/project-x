import type { Metadata } from "next";
import { AccountDangerZone } from "@/components/app/danger-zone";
import { PageHeader } from "@/components/app/page-header";
import { ProfileForm } from "@/components/app/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyField } from "@/components/ui/copy-field";
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
          <CopyField className="mt-6 border-t border-line pt-6" label="User ID" value={ctx.user.id} hint="Identifies your account. Quote it when you write to support." data-testid="user-id" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>Remove your account and personal data.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountDangerZone email={ctx.user.email} />
        </CardContent>
      </Card>
    </>
  );
}
