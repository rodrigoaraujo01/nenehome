
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
              to="/"
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
                  A moeda do jogo. Você começa com 100 nenecoins e recebe mais
                  50 por semana automaticamente. Use para apostar em bolões e
                  nos jogos da Copa.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Firecoins</p>
                <p>
                  Nenecoins paradas por muito tempo viram firecoins — a
                  aposentadoria das moedas. Firecoins não podem ser gastas, então
                  use suas nenecoins enquanto pode!
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Presentes</p>
                <p>
                  Você pode dar nenecoins para outros membros a qualquer momento
                  pelo perfil deles.
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
              <Tag>1ª pergunta do dia = +20 pts</Tag>
              <Tag>Demais perguntas = +5 pts</Tag>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
              <div>
                <p className="font-semibold text-foreground mb-1">
                  Pergunta premium do dia
                </p>
                <p>
                  Toda pessoa tem 1 pergunta premium por dia. A primeira
                  pergunta criada no dia vale +20 pontos; as próximas valem +5.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">
                  Pontos por acerto
                </p>
                <p>
                  Toda pergunta fica 48h no ar. Quem acerta recebe pontos quando
                  todo mundo responder — ou quando o prazo vence, o que vier
                  primeiro. Aí a pergunta ganha uma dificuldade conforme a taxa
                  de acerto do grupo:
                </p>
                <div className="flex gap-2 flex-wrap mt-2">
                  <Tag>Fácil = +5 pts</Tag>
                  <Tag>Médio = +12 pts</Tag>
                  <Tag>Difícil = +20 pts</Tag>
                </div>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">
                  Bônus e perguntas impossíveis
                </p>
                <p>
                  Se a pergunta for difícil, quem criou ganha +10 pontos de
                  bônus. Se ninguém acertar, ela vira impossível e o criador
                  perde o bônus de criação da pergunta.
                </p>
                <p className="mt-2">
                  Quem deixa o prazo passar sem responder conta como erro no
                  cálculo da dificuldade — não perde pontos, mas deixa a
                  pergunta mais difícil pra quem acertou.
                </p>
              </div>
            </div>
          </Section>

          {/* Fotos */}
          <Section title="Fotos">
            <p>
              Desafios de foto criados pelos membros. Cada desafio é uma missão:
              tire a selfie certa, reúna as pessoas certas, registre o momento
              pedido. Envie a foto como prova e o grupo vota pra validar.
            </p>
            <p>
              São necessárias 4 aprovações para a foto ser aceita. Você
              não pode votar na sua própria foto.
            </p>
            <p>
              Exemplos: foto com cada membro individualmente, com cada casal, o
              grupo inteiro junto, os quatro cachorros numa foto só, selfie no
              rolé nenequer...
            </p>
            <div className="flex gap-2 flex-wrap">
              <Tag>Foto aprovada = +20 pts</Tag>
              <Tag>Desafio = +30 pts extras</Tag>
              <Tag>Criar desafio = até +32 pts</Tag>
            </div>
            <p className="text-xs">
              O criador do desafio define os pontos extras para quem completa
              (entre 5 e 200). O padrão é 30.
            </p>
            <p className="text-xs">
              Criar desafio também pontua: quando o prazo acaba, o criador ganha
              8 + 3 pontos por participante único que completou o desafio, com
              limite de 8 participantes.
            </p>
          </Section>

          {/* Notificações */}
          <Section title="Notificações">
            <p>
              Você pode receber avisos quando alguém cria conteúdo novo e quando
              uma pergunta é finalizada. No fim da pergunta, os pontos são
              liberados e todo mundo consegue ver a dificuldade e o resultado.
            </p>
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

          {/* Copa 2026 */}
          <Section title="Copa 2026">
            <p>
              Bolão da Copa do Mundo! Faça palpites nos jogos e aposte
              nenecoins. Ranking separado com pontos bônus pro ranking geral
              no final.
            </p>
            <Link
              to="/copa/regras"
              className="inline-flex items-center gap-2 bg-green/10 border border-green/30 rounded-xl px-4 py-2.5 text-sm font-semibold text-green hover:bg-green/15 transition-colors"
            >
              <span>&#9917;</span>
              Ver regras completas da Copa
            </Link>
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
