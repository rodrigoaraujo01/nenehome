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

**Pontos para**: o criador da pergunta (por submeter) + quem responder corretamente.

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

### Conquistas (Achievements)

- Disparadas por marcos na plataforma.
- Exemplos: 10 respostas corretas seguidas, completar todas as metas de fotos completionistas, vencer um desafio.

### Leaderboards

- Ranking geral
- Ranking sazonal / mensal
- Rankings por categoria (mais perguntas respondidas, mais fotos submetidas, etc.)

---

## Plano de Lançamento

- **Fase 1**: funcionalidades básicas — perguntas, submissão de fotos, desafios, pontos, conquistas e leaderboards. Deixar o grupo se familiarizar com a mecânica.
- **Fase 2**: alguns meses depois, lançar o primeiro **Torneio de Trivia** em formato bracket, com rodadas eliminatórias e uma grande final.

---

## Ideias Originais (ainda relevantes)

- **Avatares customizados** por membro
- **Selfies por localização**: liberar a feature quando 1+ membros estiverem juntos; apenas uma selfie por encontro possível; encontros em datas especiais (aniversários, natal, ano novo, páscoa, rolés) têm fotos especiais
- **Áudios distorcidos**: membros gravam um áudio contando uma história aleatória de suas vidas; o áudio é distorcido e os demais têm que adivinhar de quem se trata

---

## Stack Técnica

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **Supabase** (auth + banco de dados)
- **Framer Motion** (animações)
- Deploy: a definir
