import ApostaDetailPage from "./ApostaDetailClient";

export function generateStaticParams() { return [{ id: "_" }]; }

export default function Page() {
  return <ApostaDetailPage />;
}
