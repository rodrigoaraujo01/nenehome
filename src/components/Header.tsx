import Link from "next/link";

export function Header() {
  return (
    <header className="w-full py-5 px-6 border-b border-border flex items-center justify-between">
      <Link href="/">
        <h1 className="font-bold text-2xl tracking-tight">
          nene<span className="text-accent">home</span>
        </h1>
      </Link>
      <Link
        href="/regras"
        className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted hover:text-foreground hover:border-accent/40 transition-colors"
        aria-label="Regras do jogo"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <circle cx="12" cy="17" r=".5" fill="currentColor" />
        </svg>
      </Link>
    </header>
  );
}
