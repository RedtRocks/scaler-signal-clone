import { SettingsScreen } from "@/features/settings/SettingsScreen";

export default async function SettingsPage({ params }: PageProps<"/settings/[[...section]]">) {
  const { section } = await params;
  return <SettingsScreen section={section?.[0]} />;
}
