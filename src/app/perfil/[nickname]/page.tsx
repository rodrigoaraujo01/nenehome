import Link from "next/link";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/ui/Card";
import { MEMBERS, COUPLES } from "@/lib/constants";

export function generateStaticParams() {
  return MEMBERS.map((m) => ({ nickname: m.nickname.toLowerCase() }));
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ nickname: string }>;
}) {
  const { nickname } = await params;
  const member = MEMBERS.find(
    (m) => m.nickname.toLowerCase() === nickname.toLowerCase()
  );

  if (!member) {
    return (
      <>
        <Header />
        <main className="flex-1 px-6 py-8">
          <p className="text-center text-muted mt-12">Membro não encontrado.</p>
        </main>
      </>
    );
  }

  const couple = COUPLES.find((c) => c.id === member.coupleGroup);
  const family = couple?.members.filter((m) => m.id !== member.id) ?? [];

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <section className="max-w-md mx-auto flex flex-col items-center gap-6">
          <Avatar spriteUrl={member.spriteUrl} nickname={member.nickname} size={160} />

          <div className="text-center">
            <h2 className="text-3xl font-bold">{member.nickname}</h2>
            <p className="text-muted mt-1">{member.name}</p>
          </div>

          {couple && (
            <Card className="w-full">
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                Família
              </p>
              <p className="text-lg font-bold">{couple.label}</p>
              <div className="flex gap-4 mt-4">
                {family.map((f) => (
                  <Link
                    key={f.id}
                    href={`/perfil/${f.nickname.toLowerCase()}`}
                    className="flex flex-col items-center gap-1.5 hover:opacity-80 transition-opacity"
                  >
                    <Avatar spriteUrl={f.spriteUrl} nickname={f.nickname} size={48} />
                    <span className="text-xs text-muted">{f.nickname}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <Link
            href="/"
            className="text-sm text-accent hover:text-accent-hover transition-colors mt-4"
          >
            ← voltar
          </Link>
        </section>
      </main>
    </>
  );
}
