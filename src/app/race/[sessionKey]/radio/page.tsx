import { redirect } from "next/navigation";

export default async function TeamRadioPage({
  params,
}: {
  params: Promise<{ sessionKey: string }>;
}) {
  const { sessionKey } = await params;
  redirect(`/live?session=${sessionKey}`);
}
