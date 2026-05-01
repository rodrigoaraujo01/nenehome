import FotoDetailPage from "./FotoDetailClient";

// One placeholder path keeps static export happy.
// The 404.html SPA trick handles all real IDs at runtime.
export function generateStaticParams() { return [{ id: "_" }]; }

export default function Page() {
  return <FotoDetailPage />;
}
