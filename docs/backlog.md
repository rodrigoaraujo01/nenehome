# Backlog Técnico

## Hardening futuro de perguntas

Contexto: o grupo é pequeno e confiável, então não é prioridade bloquear usuários autenticados de inspecionar respostas via rede ou Supabase. Ainda assim, se o app crescer ou se o torneio de trivia exigir integridade mais forte, vale voltar nestes pontos.

- Não enviar respostas corretas de perguntas ativas para o cliente. Hoje `getQuestions`/`getQuestion` carregam `question_options.is_correct` e `questions.subject_id`, o que permite descobrir respostas antes de responder inspecionando as chamadas de rede.
- Restringir leitura de `question_options.is_correct` no banco. A policy atual de `question_options` permite `select` para qualquer usuário autenticado; uma opção futura é expor alternativas por view/RPC sem o campo `is_correct` e revelar a resposta apenas depois que a pessoa responde ou quando a pergunta fecha.
