
import { Link } from "react-router-dom";
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

function ScoreExample({
  prediction,
  result,
  points,
  label,
}: {
  prediction: string;
  result: string;
  points: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-surface border border-border rounded-xl p-3">
      <div className="flex-1">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm mt-0.5">
          Palpite: <span className="font-bold text-foreground">{prediction}</span>
          {" "}&middot;{" "}
          Resultado: <span className="font-bold text-foreground">{result}</span>
        </p>
      </div>
      <span className={`text-lg font-bold ${points > 0 ? "text-green" : "text-red-400"}`}>
        +{points}
      </span>
    </div>
  );
}

export default function CopaRegrasPage() {
  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-8">
          <div className="flex items-center gap-3">
            <Link
              to="/copa"
              className="flex items-center gap-3 text-muted hover:text-foreground transition-colors"
            >
              <span>&#8249;</span>
              <h1 className="text-xl font-bold text-foreground">
                Regras do Bolao
              </h1>
            </Link>
          </div>

          <Section title="Como funciona">
            <p>
              Cada participante faz um palpite pro placar de cada jogo da Copa.
              Os palpites ficam abertos ate 10 minutos antes do jogo comecar.
              Depois disso, ta lacrado.
            </p>
            <p>
              Quanto mais perto do placar real, mais pontos voce ganha.
              O ranking do bolao e separado do ranking geral do NeneHome,
              mas os melhores colocados ganham pontos bonus no final.
            </p>
          </Section>

          <Section title="Tabela de Pontos">
            <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">Placar exato</span>
                <span className="font-bold text-green">25 pts</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">Acertou vencedor + gols do vencedor</span>
                <span className="font-bold text-green">18 pts</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">Acertou vencedor + saldo de gols</span>
                <span className="font-bold text-green">15 pts</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">Acertou vencedor + gols do perdedor</span>
                <span className="font-bold text-green">12 pts</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">Acertou resultado (V/E/D)</span>
                <span className="font-bold text-yellow-400">10 pts</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">Errou tudo</span>
                <span className="font-bold text-red-400">0 pts</span>
              </div>
            </div>
          </Section>

          <Section title="Exemplos">
            <div className="space-y-2">
              <ScoreExample
                prediction="2 x 1"
                result="2 x 1"
                points={25}
                label="Placar exato"
              />
              <ScoreExample
                prediction="2 x 0"
                result="2 x 1"
                points={18}
                label="Vencedor certo + gols do vencedor"
              />
              <ScoreExample
                prediction="4 x 3"
                result="2 x 1"
                points={15}
                label="Vencedor certo + saldo de gols"
              />
              <ScoreExample
                prediction="5 x 1"
                result="2 x 1"
                points={12}
                label="Vencedor certo + gols do perdedor"
              />
              <ScoreExample
                prediction="5 x 3"
                result="2 x 1"
                points={10}
                label="So acertou o vencedor"
              />
              <ScoreExample
                prediction="1 x 1"
                result="2 x 2"
                points={10}
                label="Empate certo (placar diferente)"
              />
              <ScoreExample
                prediction="0 x 2"
                result="2 x 1"
                points={0}
                label="Errou o resultado"
              />
            </div>
          </Section>

          <Section title="Apostas com Nenecoins">
            <p>
              Alem do palpite, voce pode apostar nenecoins em cada jogo.
              A aposta e opcional — se nao quiser arriscar, so faz o palpite
              normal.
            </p>
            <p>
              Se voce apostou nenecoins e acertou, o retorno depende da
              precisao do seu palpite:
            </p>
            <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">25 pts (placar exato)</span>
                <span className="font-bold text-yellow-400">5x o apostado</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">18 pts</span>
                <span className="font-bold text-yellow-400">3x o apostado</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">15 pts</span>
                <span className="font-bold text-yellow-400">2.5x o apostado</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">12 pts</span>
                <span className="font-bold text-yellow-400">2x o apostado</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">10 pts</span>
                <span className="font-bold text-yellow-400">1.5x o apostado</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">0 pts (errou)</span>
                <span className="font-bold text-red-400">Perdeu a aposta</span>
              </div>
            </div>
            <p>
              Exemplo: voce aposta 20 nenecoins e acerta o placar exato (5x).
              Recebe 100 nenecoins de volta.
            </p>
          </Section>

          <Section title="Bonus Final">
            <p>
              Quando a Copa terminar, os melhores colocados no bolao
              recebem pontos bonus no ranking geral do NeneHome:
            </p>
            <div className="bg-surface border border-border rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">1o lugar</span>
                <span className="font-bold text-accent">100 pts</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">2o lugar</span>
                <span className="font-bold text-accent">75 pts</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">3o lugar</span>
                <span className="font-bold text-accent">50 pts</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">Demais participantes</span>
                <span className="font-bold text-accent">25 pts</span>
              </div>
            </div>
          </Section>

          <div className="h-8" />
        </div>
      </main>
    </>
  );
}
