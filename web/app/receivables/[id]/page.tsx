import { Room } from "../../components/Room";

export default async function ReceivablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Room id={id} />;
}
