"use client";

import Link from "next/link";
import { Header } from "@/components/Header";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent px-2 py-0.5 rounded-full">
      {children}
    </span>
  );
}

function CoinTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">
      {children}
    </span>
  );
}

export default function RegrasPage() {
  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-3 text-muted hover:text-foreground transition-colors"
            >
              <span>‹</span>
              <h1 className="text-xl font-bold text-foreground">
                Como funciona
              </h1>
            </Link>
          </div>

          {/* Regras Gerais */}
          <Section title="Regras Gerais">
            <div className="bg-surface border border-border rounded-2xl p-4 space-y-4">
              <div>
                <p className="font-semibold text-foreground mb-1">Pontos</p>
                <p>
                  Tudo no NeneHome gira em torno de pontos. Responder perguntas,
                  completar desafios de foto, criar conteúdo — tudo dá ponto. O
                  ranking geral mostra quem tá mandando bem.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Nenecoins</p>
                <p>
                  A moeda do jogo. Você recebe 50 nenecoins por semana
                  automaticamente e pode ganhar mais convertendo pontos. Use suas
                  nenecoins, porque senão, elas vão ficar para a aposentadoria.
                </p>
              </div>
            </div>
          </Section>

          {/* Perguntas */}
          <Section title="Perguntas">
            <p>
              Membros criam conteúdo pros outros responderem. Dois formatos:
            </p>
            <div className="space-y-2">
              <div className="bg-surface border border-border rounded-xl p-3">
                <p className="font-semibold text-foreground text-sm">
                  História
                </p>
                <p className="text-xs mt-0.5">
                  Alguém conta uma história sobre uma pessoa do grupo. Os outros
                  tentam adivinhar de quem é.
                </p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-3">
                <p className="font-semibold text-foreground text-sm">
                  Múltipla escolha
                </p>
                <p className="text-xs mt-0.5">
                  Uma charada com alternativas. Escolha a resposta certa.
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Tag>Acertar = pontos</Tag>
              <Tag>Criar pergunta = pontos</Tag>
            </div>
          </Section>

          {/* Fotos */}
          <Section title="Fotos">
            <p>
              Desafios de foto criados pelos membros. Cada desafio é uma missão:
              tire a selfie certa, reúna as pessoas certas, registre o momento
              pedido. Envie a foto como prova e o grupo vota pra validar — se a
              maioria aprovar, os pontos são seus.
            </p>
            <p>
              Exemplos: foto com cada membro individualmente, com cada casal, o
              grupo inteiro junto, os quatro cachorros numa foto só, selfie no
              rolé nenequer...
            </p>
            <div className="flex gap-2 flex-wrap">
              <Tag>Completar desafio = pontos</Tag>
            </div>
          </Section>

          {/* Bolões */}
          <Section title="Bolões">
            <p>
              Qualquer membro pode criar um bolão. Na criação, escolha o tipo de
              resposta:
            </p>
            <div className="space-y-2">
              <div className="bg-surface border border-border rounded-xl p-3">
                <p className="font-semibold text-foreground text-sm">
                  Múltipla escolha
                </p>
                <p className="text-xs mt-0.5">
                  Alternativas fixas (ex: &quot;quem vai chegar
                  atrasado?&quot;). Se ninguém acertar, todos recebem suas
                  nenecoins de volta.
                </p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-3">
                <p className="font-semibold text-foreground text-sm">Data</p>
                <p className="text-xs mt-0.5">
                  Cada um aposta numa data (ex: &quot;quando o Antônio vai
                  nascer?&quot;). Quem chegar mais perto leva.
                </p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-3">
                <p className="font-semibold text-foreground text-sm">Número</p>
                <p className="text-xs mt-0.5">
                  Cada um aposta num valor (ex: &quot;quantos km o grupo vai
                  andar no rolé?&quot;). Quem chegar mais perto leva.
                </p>
              </div>
            </div>
            <p>
              Cada participante aposta nenecoins na sua resposta. O criador
              revela o resultado quando quiser, e o montante é dividido
              proporcionalmente entre os vencedores — apostou mais, leva fatia
              maior.
            </p>
            <p>
              Em data/número, se houver empate de proximidade, divide
              proporcional ao que cada um apostou.
            </p>
            <p>
              O criador pode escolher se participa ou não do próprio bolão — se
              ele já sabe a resposta, marca que não pode apostar.
            </p>
            <div className="flex gap-2 flex-wrap">
              <CoinTag>Apostar custa nenecoins</CoinTag>
              <CoinTag>Vencer = nenecoins do montante</CoinTag>
            </div>
          </Section>

          {/* Conquistas */}
          <Section title="Conquistas">
            <p>
              Existem conquistas secretas escondidas no jogo. Você só descobre o
              que são quando desbloqueia uma. Cada conquista desbloqueada dá
              pontos. Fique atento — qualquer coisa pode ser uma conquista.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Tag>Desbloquear conquista = pontos</Tag>
            </div>
          </Section>

          {/* Regras de Ouro */}
          <Section title="Regras de Ouro">
            <div className="bg-surface border border-border rounded-2xl p-4 space-y-2">
              <p>Qualquer membro pode criar conteúdo.</p>
              <p>
                Ninguém tem vantagem — nem o Rodrigo que fez o app.
              </p>
              <p>
                Validação é democrática: o grupo vota, sem algoritmo decidindo
                nada.
              </p>
              <p>
                Sem moderação central — a gente confia no grupo pra manter tudo
                justo e divertido.
              </p>
            </div>
          </Section>

          <div className="h-8" />
        </div>
      </main>
    </>
  );
}
