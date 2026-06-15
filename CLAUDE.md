# nenehome — Contexto do Projeto

## O Grupo

Somos um grupo de 8 amigos adultos, 4 casais, com filhos e cachorros. Em breve seremos 16 pessoas no total.

- **Dani & Leo** — filho: Joaquim (Joca / Cacá)
- **Malu & Grizante** — bebê na barriga (provavelmente Antônio)
- **Maiana & Rodrigo** (eu, o builder) — filha: Sarah
- **Milena & Thiago** — filha recém-nascida: Cecília

Algumas vezes ao ano realizamos **rolés nenequers**: encontros com todos os membros, filhos e cachorros em uma casa alugada no Airbnb.

---

## Visão do Produto

Um web app que gamifica os encontros, atividades e interações reais do grupo. Casual mas polido, construído em torno de um sistema unificado de pontos e conquistas.

### Princípios

- **Conteúdo gerado pelo grupo**: qualquer membro pode criar perguntas, desafios e submissões.
- **Fair play**: o builder (Rodrigo) participa como jogador comum, sem vantagem especial.
- **Validação democrática**: o grupo vota para confirmar submissões — sem algoritmos ou IA para verificação.
- **Sem moderação central**: o grupo é confiável para manter tudo justo e divertido.

---

## Categorias de Conteúdo

### 1. Perguntas & Enigmas

Membros submetem conteúdo para os outros responderem. Dois formatos:

- **Histórias**: um membro conta uma história sobre si ou sobre alguém do grupo; os outros adivinham de quem se trata.
- **Enigmas / Múltipla Escolha**: um membro escreve uma charada ou piada com alternativas; os outros escolhem a resposta certa.

**Pontos para**: o criador da pergunta (por submeter — ver "premium diário") + quem responder corretamente (payout dinâmico por dificuldade, liquidado quando todos respondem — ver "Sistema de Pontos").

### 2. Submissão de Fotos (com votação do grupo)

Membros submetem fotos como prova de atividades ou marcos. O grupo vota democraticamente para validar antes de conceder pontos.

**Exemplos**:
- Selfie com os quatro casais juntos
- Foto com todas as crianças ao mesmo tempo
- Passeio com os cachorros em grupo
- O grupo todo num rolé nenequer no Airbnb

**Conquistas completionistas** em cima disso:
- Foto com cada membro individualmente
- Foto com cada casal
- Foto do grupo completo (todos os 16)
- Os quatro cachorros numa foto só

### 3. Desafios

Atividades avulsas (não necessariamente baseadas em foto), estruturadas como:

- **Individual**: cada pessoa compete por conta própria
- **Casais**: os quatro casais competem entre si
- **Grupos aleatórios**: pares ou trios sorteados para variar

**Exemplos**: check-ins de fitness (km caminhados, corridos), competições de culinária (grupo vota no melhor prato), caça ao tesouro, apostas/dares.

### 4. Métricas de Engajamento no WhatsApp

Dados importados da ferramenta local de análise do grupo do WhatsApp, recompensando engajamento real:

- Mais mensagens enviadas
- Mais fotos compartilhadas
- Mensagens mais longas

**Pipeline**: exportar histórico do chat → processar no app local → output em formato importável → alimentar o web app para gerar relatórios semanais e conceder pontos.

---

## Sistema de Pontos & Conquistas

### Pontos

- Tudo alimenta um sistema único de pontos.
- Ganhos em: respostas certas, submissão de conteúdo, desafios, validações de fotos, atividade no WhatsApp.

#### Criação de perguntas — premium diário

- Cada membro tem **1 pergunta "premium" por dia** (fuso `America/Sao_Paulo`): a 1ª criada no dia vale **+20**; as seguintes valem o padrão **+5** (`create_question`).

#### Payout dinâmico por dificuldade (perguntas)

- Os pontos de quem acerta **não são concedidos na hora** — ficam pendentes até a pergunta ser **liquidada** (`settle_question`), o que ocorre quando **todos os elegíveis** responderam.
- A dificuldade é definida pelo **% de acertos** entre os respondentes, e define o payout por acerto: **Fácil 5 / Médio 12 / Difícil 20**.
- Pergunta **impossível** (0 acertos): o criador **perde o bônus de criação** (net zero, nunca negativo).
- Pergunta **difícil** (com acertos): o criador ganha **+10** (`question_hard_bonus`).
- No settle, todos os envolvidos recebem push (`question_settled`, gated pela pref `question_completed`); a seção "O que o grupo achou" mostra o tier e os pontos por acerto.

#### Criação de desafios de foto — prêmio escalado

- O criador ganha um prêmio **liquidado após o `deadline`** (`settle_challenge`, idempotente, disparada de forma preguiçosa ao abrir a página do desafio): **8 + 3 × submitters_únicos** (cap em 8 → 11 a 32), via reason `challenge_created`.

Reasons novos em `points_log`: `question_hard_bonus`, `challenge_created`. SQL canônico em `supabase/scoring_v2.sql` (rodar por último).

### Conquistas (Achievements)

- Disparadas por marcos na plataforma.
- Exemplos: 10 respostas corretas seguidas, completar todas as metas de fotos completionistas, vencer um desafio.

### Leaderboards

- Ranking geral
- Ranking sazonal / mensal
- Rankings por categoria (mais perguntas respondidas, mais fotos submetidas, etc.)

---

## Economia de Nenecoins

Moeda interna do app, separada dos pontos. Saldo de cada membro é derivado da soma de `nenecoins_ledger` (não há coluna de saldo). Tabela auxiliar `nenecoins_state` guarda atividade e flags por usuário.

### Como se ganha / gasta (tx_types)

- `initial` — saldo inicial concedido no primeiro acesso.
- `weekly_bonus` — bônus semanal (RPC `claim_weekly_bonuses`).
- `points_conversion` — converter pontos em nenecoins (RPC `convert_points_to_nenecoins`).
- `bet_placed` / `bet_won` / `bet_refund` — apostas nos bolões internos.
- `wc_bet_placed` / `wc_bet_won` / `wc_bet_refund` — apostas do Bolão da Copa.
- `gift_sent` / `gift_received` — presentear nenecoins entre membros (com mensagem).
- `fire_conversion_out` / `fire_conversion_in` — conversão de nenecoins ociosas em **firecoins**.

### Firecoins

- Nenecoins paradas por **3 meses** de inatividade viram firecoins (RPC `check_firecoin_conversion`), sinalizado por um popup (`FirecoinPopup` / `firecoin_popup_shown`).
- Conquista `nenecoin_fire` ("Aposentado") é concedida na conversão.

### UI

- Histórico de nenecoins visível em **todos os perfis** (não só o próprio), com labels pt-BR por `tx_type`.
- Apostas canceladas (`bet_placed` + `bet_refund` que se anulam) ficam ocultas do histórico.
- Perfil mostra **breakdown de pontos** por categoria de `reason`.

---

## Funcionalidades por Categoria (estado atual)

- **Perguntas**: criador não pode responder a própria pergunta; criador vê todas as respostas e o resultado; criador pode **deletar** a própria pergunta (wipe completo de respostas/pontos/conquistas).
- **Fotos / Desafios**: limiar de rejeição = **4** votos; fotos rejeitadas ficam visíveis na página do desafio; criador pode **deletar** um desafio de foto (wipe completo de pontos/conquistas, como se nunca tivesse existido); quem enviou uma foto pode **deletá-la** individualmente (mesmo wipe — pontos de aprovação/desafio, conquistas e arquivo no storage).
- **Apostas (bolões)**: criador pode **deletar** um bolão não resolvido (reembolso das apostas).
- **Princípio geral**: tudo que um membro cria (pergunta, foto, desafio, bolão) ele também pode deletar, sempre com reversão completa de pontos/conquistas via RPC `security definer`.

---

## Plano de Lançamento

- **Fase 1**: funcionalidades básicas — perguntas, submissão de fotos, desafios, pontos, conquistas e leaderboards. Deixar o grupo se familiarizar com a mecânica.
- **Fase 2**: alguns meses depois, lançar o primeiro **Torneio de Trivia** em formato bracket, com rodadas eliminatórias e uma grande final.

---

## Bolão da Copa 2026

Seção temporária do app para a Copa do Mundo 2026. Portado de um app Flask anterior (`copa_confra`).

### Mecânica

- Cada membro faz um palpite de placar (home x away) para cada jogo da Copa.
- Palpites travam 10 minutos antes do jogo.
- Pontuação por acurácia do palpite (25/18/15/12/10/0 pts).
- Ranking separado do ranking geral do NeneHome.
- Top colocados ganham bônus no ranking principal ao final (1o=100, 2o=75, 3o=50, demais=25).

### Nenecoins

- Aposta opcional de nenecoins por jogo, com multiplicador baseado na pontuação:
  - 25 pts → 5x | 18 pts → 3x | 15 pts → 2.5x | 12 pts → 2x | 10 pts → 1.5x | 0 pts → perde

### Rotas

- `/copa` — dashboard (ranking, jogos de hoje/amanhã, stats)
- `/copa/jogos` — todos os jogos agrupados por data
- `/copa/jogo/[id]` — detalhe do jogo + formulário de palpite + aposta de coins
- `/copa/ranking` — leaderboard completo do bolão
- `/copa/regras` — regras de pontuação e multiplicadores

### Schema

- `supabase/worldcup.sql` — tabelas `wc_matches`, `wc_predictions`, view `wc_leaderboard`, RPCs `place_wc_prediction`, `score_wc_match`, `finalize_wc_tournament`
- Conquistas: `wc_first_prediction`, `wc_oracle`, `wc_streak_3`, `wc_champion`, `wc_all_in`

### Pendente

- Popular `wc_matches` com o calendário oficial da Copa 2026
- Mecanismo de atualização de placares ao vivo (API externa ou manual via admin)

---

## Ideias Originais (ainda relevantes)

- **Avatares customizados** por membro
- **Selfies por localização**: liberar a feature quando 1+ membros estiverem juntos; apenas uma selfie por encontro possível; encontros em datas especiais (aniversários, natal, ano novo, páscoa, rolés) têm fotos especiais
- **Áudios distorcidos**: membros gravam um áudio contando uma história aleatória de suas vidas; o áudio é distorcido e os demais têm que adivinhar de quem se trata

---

## Stack Técnica

- **React 19** + **Vite** + **React Router v7** + TypeScript + Tailwind CSS v4
- **Supabase** (auth + banco de dados + storage para fotos)
- **Framer Motion** (animações)
- **Deploy**: Vercel (auto-deploy do GitHub, configurado via `vercel.json`)

### Estrutura do Projeto

```
src/
  App.tsx          — rotas (React Router)
  main.tsx         — entrypoint do Vite
  globals.css      — Tailwind + variáveis de tema
  pages/           — uma página por rota
  components/      — componentes reutilizáveis (Card, Avatar, Header, BottomNav, etc.)
  hooks/           — hooks customizados (useAuth, useNudges)
  lib/
    constants.ts   — MEMBERS, COUPLES, ADULTS
    types.ts       — interfaces TypeScript (Db*, Wc*, etc.)
    supabase/
      client.ts    — singleton do Supabase client
      queries.ts   — todas as queries e RPCs
supabase/          — SQL de schema, seeds e migrações
```

### Rotas

| Rota | Página |
|------|--------|
| `/` | Home (ranking, nudges, grupo) |
| `/login` | Login com Supabase Auth |
| `/primeiro-acesso` | Onboarding |
| `/perguntas` | Lista de perguntas |
| `/perguntas/nova` | Criar pergunta |
| `/perguntas/:id` | Detalhe/responder pergunta |
| `/fotos` | Submissões de foto |
| `/fotos/nova` | Enviar foto |
| `/fotos/desafios` | Lista de desafios de foto |
| `/fotos/desafios/novo` | Criar desafio |
| `/fotos/desafios/:id` | Detalhe do desafio |
| `/fotos/:id` | Detalhe/votar foto |
| `/apostas` | Lista de bolões |
| `/apostas/nova` | Criar bolão |
| `/apostas/:id` | Detalhe do bolão |
| `/copa` | Dashboard Copa 2026 |
| `/copa/jogos` | Todos os jogos |
| `/copa/jogo/:id` | Detalhe do jogo + palpite |
| `/copa/ranking` | Ranking do bolão |
| `/copa/regras` | Regras de pontuação |
| `/perfil/:nickname` | Perfil do membro |
| `/regras` | Regras gerais |

### Variáveis de Ambiente

- `VITE_SUPABASE_URL` — URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` — chave anon do Supabase

## Documentos de Apoio

- [Backlog técnico](docs/backlog.md)
