import { Link } from "react-router-dom";

export function Header() {
  return (
    <header className="w-full py-5 px-6 border-b border-border flex items-center justify-between">
      <Link to="/">
        <h1 className="font-bold text-2xl tracking-tight">
          nene<span className="text-accent">home</span>
        </h1>
      </Link>
      <div className="flex items-center gap-2">
        <Link
          to="/loja"
          className="h-9 flex items-center gap-1.5 px-3 rounded-full border border-purple/30 text-sm font-semibold text-purple hover:bg-purple/10 transition-colors"
          aria-label="Loja"
        >
          <span>&#128722;</span>
          <span className="text-xs">Loja</span>
        </Link>
        <Link
          to="/copa"
          className="h-9 flex items-center gap-1.5 px-3 rounded-full border border-green/30 text-sm font-semibold text-green hover:bg-green/10 transition-colors"
          aria-label="Copa 2026"
        >
          <span>&#9917;</span>
          <span className="text-xs">Copa</span>
        </Link>
        <Link
          to="/regras"
          className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted hover:text-foreground hover:border-accent/40 transition-colors"
          aria-label="Regras do jogo"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <circle cx="12" cy="17" r=".5" fill="currentColor" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
