
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";

export default function NotFoundPage() {
  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="text-center">
          <p className="text-5xl mb-4">🤷</p>
          <h1 className="text-2xl font-bold mb-2">Página não encontrada</h1>
          <p className="text-muted text-sm mb-6">
            Essa página não existe no NeneHome.
          </p>
          <Link
            to="/"
            className="bg-accent hover:bg-accent-hover text-white text-sm font-bold px-6 py-3 rounded-xl transition-colors"
          >
            Voltar pro início
          </Link>
        </div>
      </main>
    </>
  );
}
