import { redirect } from "next/navigation";

export default async function LapsPage({
  params,
}: {
  params: Promise<{ sessionKey: string }>;
}) {
  const { sessionKey } = await params;
  redirect(`/live?session=${sessionKey}`);
}
