import Link from "next/link";

export function Header() {
  return (
    <header className="w-full py-5 px-6 border-b border-border">
      <Link href="/">
        <h1 className="font-bold text-2xl tracking-tight">
          nene<span className="text-accent">home</span>
        </h1>
      </Link>
    </header>
  );
}
