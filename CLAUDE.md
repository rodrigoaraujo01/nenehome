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

**Pontos para**: o criador da pergunta (por submeter — ver "premium diário") + quem responder corretamente (payout dinâmico por dificuldade, liquidado quando todos respondem ou no fim do prazo de 48h — ver "Sistema de Pontos").

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

#### Prazo de 48h (perguntas)

- `questions.deadline` = `created_at + 48h`, fixo e global (preenchido por `create_question`).
- Vencido o prazo, quem **não respondeu conta como erro** no cálculo da dificuldade: entra só no **denominador** (`v_no_shows = elegíveis − respostas`). Não perde pontos e não gera linha em `answers`.
- Caso especial: pergunta que vence com **zero respostas** vira `impossible`, mas o criador **mantém** o bônus de criação — ninguém tentou, então não é culpa dele.
- O settle pós-prazo é **preguiçoso**: `settle_expired_questions()` varre as vencidas e roda quando **alguém abre a Home** (antes de ler o ranking). Idempotente; a página da pergunta também chama `settle_question` ao abrir.

#### Payout dinâmico por dificuldade (perguntas)

- Os pontos de quem acerta **não são concedidos na hora** — ficam pendentes até a pergunta ser **liquidada** (`settle_question`), o que ocorre quando **todos os elegíveis** responderam **ou quando o prazo de 48h vence** (o que vier primeiro).
- A dificuldade é definida pelo **% de acertos** entre os respondentes, e define o payout por acerto: **Fácil 5 / Médio 12 / Difícil 20**.
- Pergunta **impossível** (0 acertos): o criador **perde o bônus de criação** (net zero, nunca negativo).
- Pergunta **difícil** (com acertos): o criador ganha **+10** (`question_hard_bonus`).
- No settle, todos os envolvidos recebem push (`question_settled`, gated pela pref `question_completed`); a seção "O que o grupo achou" mostra o tier e os pontos por acerto.

#### Criação de desafios de foto — prêmio escalado

- O criador ganha um prêmio **liquidado após o `deadline`** (`settle_challenge`, idempotente, disparada de forma preguiçosa ao abrir a página do desafio): **8 + 3 × submitters_únicos** (cap em 8 → 11 a 32), via reason `challenge_created`.

#### Votação da melhor foto — pontos dobrados

- Encerrado o desafio (`deadline`), abre uma janela de **48h** pra eleger a melhor entre as fotos **aprovadas** (`vote_best_photo`). Quem vence **dobra os pontos que recebeu naquele desafio**: `photo_approved` da foto vencedora + `challenge_completed` do desafio (20 + 30 → +50, via reason `challenge_best_photo`).
- A janela é **puramente temporal** (`deadline` → `deadline + 48h`), sem depender de settle: se ela só "abrisse" quando alguém abrisse a página, um desafio esquecido teria a votação aberta e fechada sem ninguém poder votar.
- 1 voto por pessoa por desafio (`challenge_best_votes`, unique `(challenge_id, voter_id)`); dá pra **trocar o voto** enquanto aberta. Não vota na própria foto.
- **Empate**: todos os empatados dobram. **Menos de 2 fotos aprovadas**: sem disputa, votação não abre e ninguém dobra. **Zero votos**: ninguém dobra.
- Apuração `settle_challenge_best` (idempotente, guardada por `best_settled_at`), preguiçosa: `settle_expired_challenge_bests()` roda na Home junto com o sweep de perguntas, e a página do desafio também chama a sua.
- Vencedora marcada em `photo_submissions.best_photo` (medalha na UI). Desafios que já tinham vencido há mais de 48h quando a feature subiu entraram com `best_settled_at` preenchido no backfill — nunca tiveram janela, e sem isso o primeiro sweep os apuraria com zero votos.

Reasons novos em `points_log`: `question_hard_bonus`, `challenge_created`, `challenge_best_photo`. SQL canônico em `supabase/scoring_v2.sql`; melhor foto em `supabase/best_photo_vote.sql`. **Obs.:** `supabase/powerups.sql` agora redefine `submit_answer`/`settle_question` por cima — é o **último** arquivo a rodar (ver Loja de Power-ups).

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
- `powerup_purchase` — compra de power-ups na Loja (`RPC buy_powerup`).
- `question_bet_placed` / `question_bet_won` — aposta de nenecoins na pergunta (debitada no submit, paga no settle por multiplicador de dificuldade).
- `robin_hood_taxed` / `robin_hood_payout` — taxa e redistribuição da revanche Robin Hood (ver Loja de Power-ups).

### Loja de Power-ups (`/loja`)

Sink de nenecoins (motivado pelo acúmulo por causa do Bolão da Copa). Modelo **inventário**: compra na loja (`buy_powerup`) → fica no `powerup_ledger` (saldo derivado, RPC `get_powerup_inventory`) → usa em contexto. Catálogo server-authoritative na tabela `powerups`. Princípio: **vender variância/utilidade, não pontos garantidos** (sem pay-to-win).

- **Eliminar Alternativa** (`use_eliminate_option`, 30) — remove 1 alternativa errada de uma MC; cap 1/pergunta; marca a resposta como `assisted`.
- **Segunda Chance** (40) — ao confirmar, se errar, descarta a tentativa (não persiste, não liquida) e libera nova resposta; marca `assisted`. Implementado via flag em `submit_answer`.
- **Sabotagem** (`deploy_sabotage_multi`, 30) — injeta uma 5ª alternativa falsa (texto do saboteur) numa MC, só para alvos que ainda não responderam. **Multi-alvo**: dá pra sabotar vários membros de uma vez com o mesmo decoy, custando **1 token por alvo** (tudo-ou-nada — alvo inválido ou token faltando aborta tudo). 1 sabotagem por alvo/pergunta (`unique (question_id, target_user_id)`). Entregue via `get_question_sabotage` (não vaza que é falsa); ao escolhê-la conta como erro (`question_sabotages.hit`). **Contra-golpe**: quem foi sabotado ganha 1 crédito de revanche (`sabotage_revenge`) que dá **50% de desconto** na compra de Sabotagem (aplicado automático em `buy_powerup`). O crédito é gerado só quando a vítima **responde** (em `submit_answer`) — antes disso revelaria o decoy. Banner pós-resposta via `get_my_sabotage`; saldo de revanche via `get_sabotage_revenge`.
- **Revelar Distribuição** (`reveal_wc_distribution`, 30) — destrava a distribuição **anônima** dos palpites de um jogo da Copa antes do fechamento.
- **Robin Hood** (`commit_robin_hood_raid`, 40) — primeiro power-up **coletivo (raid)**. Abre uma **revanche** (lobby) que precisa de **4 membros** para disparar; cada participante gasta **1 token** (`robin_hood`). Quando o 4º entra, dispara na hora sobre **todos os saldos do grupo**: quem está **acima da média** paga **25% do excedente** acima dela (sem isenção — participantes ricos também pagam), e o bolo é redistribuído para quem está **abaixo da média**, **proporcional ao déficit** (mais pobre ganha mais). Limite: **1 revanche por semana** (grupo todo; semana `America/Sao_Paulo`, começa na segunda) — travada por `robin_hood_raids.week_start` + status `fired`. Lobby único por vez (índice parcial `where status='open'`); lobby que não junta 4 em **24h** expira e **devolve os tokens** (`settle_expired_robin_hood_raids`, sweep preguiçoso na Home e ao abrir a Loja). Estado via `get_robin_hood_state`; apuração snapshot em `robin_hood_raids.result` (mostrada na Loja). Enquanto o lobby está aberto e o membro ainda não entrou, aparece como **missão ativa** na Home (nudge 🏹 → `/loja`, prioridade no topo por causa da janela de 24h). Participantes ganham a conquista `robin_hood_raid`. **Obs.:** não emite push (o resultado aparece na Loja e no histórico de nenecoins) — push é um follow-up opcional.

### Aposta de coins na pergunta (sem power-up)

Dinâmica nativa (estilo bolão): ao responder, o membro pode apostar nenecoins (`answers.coins_wagered`, debitado no submit via `question_bet_placed`). No settle, se acertou, recebe `stake × multiplicador da dificuldade` (`question_bet_won`): **Fácil 1.5× · Médio 2× · Difícil 3×**; **Impossível não paga** (consistente com os pontos). Errou → perde o stake. A aposta atrela-se à resposta final (Segunda Chance não cobra a tentativa descartada). Substituiu o antigo power-up "Dobro ou Nada".

Fair play: `answers.assisted` é **excluído** do %-de-acertos que define a dificuldade (Fácil/Médio/Difícil), então power-ups não distorcem o payout de todos. Tabelas auxiliares: `powerups`, `powerup_ledger`, `question_assists`, `question_sabotages`, `wc_distribution_reveals`, `robin_hood_raids`, `robin_hood_participants`. SQL em `supabase/powerups.sql` (depois de `scoring_v2.sql` — redefine `submit_answer` e `settle_question`), depois `limit_one_powerup_per_question.sql`, **`question_deadline_and_multi_sabotage.sql`** (redefine `create_question` e `settle_question`, adiciona `settle_expired_questions` e `deploy_sabotage_multi`) e por fim **`robin_hood.sql`** (power-up coletivo Robin Hood — só adiciona tabelas/RPCs, não redefine funções existentes; pode rodar por último sem conflito).

### Firecoins

- Nenecoins paradas por **3 meses** de inatividade viram firecoins (RPC `check_firecoin_conversion`), sinalizado por um popup (`FirecoinPopup` / `firecoin_popup_shown`).
- Conquista `nenecoin_fire` ("Aposentado") é concedida na conversão.

### UI

- Histórico de nenecoins visível em **todos os perfis** (não só o próprio), com labels pt-BR por `tx_type`.
- Apostas canceladas (`bet_placed` + `bet_refund` que se anulam) ficam ocultas do histórico.
- Perfil mostra **breakdown de pontos** por categoria de `reason`.

---

## Funcionalidades por Categoria (estado atual)

- **Perguntas**: no reveal ("O que o grupo achou"), quem caiu numa Sabotagem aparece com o **texto da alternativa-decoy** que escolheu (não mais "—") e um selo **"sabotado por <apelido>"** — `get_question_answers` expõe `sabotage_decoy_text`/`saboteur_nickname` (ver `supabase/sabotage_in_reveal.sql`, roda depois de `scoring_v2.sql`); criador não pode responder a própria pergunta; criador vê todas as respostas, o resultado e a **conversa** (comentários), e pode comentar — a discussão segue invisível pra quem ainda não respondeu (RLS em `question_comments`, ver `supabase/creator_sees_comments.sql`); criador pode **deletar** a própria pergunta (wipe completo de respostas/pontos/conquistas).
- **Fotos / Desafios**: limiar de rejeição = **4** votos; encerrado o desafio, 48h de votação da melhor foto (ver "Votação da melhor foto"); fotos rejeitadas ficam visíveis na página do desafio; criador pode **deletar** um desafio de foto (wipe completo de pontos/conquistas, como se nunca tivesse existido); quem enviou uma foto pode **deletá-la** individualmente (mesmo wipe — pontos de aprovação/desafio, conquistas e arquivo no storage).
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
| `/loja` | Loja de power-ups |
| `/regras` | Regras gerais |

### Variáveis de Ambiente

- `VITE_SUPABASE_URL` — URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` — chave anon do Supabase

## Documentos de Apoio

- [Backlog técnico](docs/backlog.md)
