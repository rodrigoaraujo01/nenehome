import { MEMBERS } from "@/lib/constants";
import { ProfileClient } from "./ProfileClient";

export function generateStaticParams() {
  return MEMBERS.map((m) => ({ nickname: m.nickname.toLowerCase() }));
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ nickname: string }>;
}) {
  const { nickname } = await params;
  return <ProfileClient nickname={nickname} />;
}
