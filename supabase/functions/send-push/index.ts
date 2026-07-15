// Supabase Edge Function: send-push
//
// Receives a row from the `notify_new_content` trigger (or a Database Webhook)
// and fans it out as a Web Push notification to every stored subscription,
// skipping the member who created the content. Dead endpoints (404/410) are
// pruned automatically.
//
// Deploy:  supabase functions deploy send-push --no-verify-jwt
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase)

import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:alf.rodrigo@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function truncate(text: string | null | undefined, n: number): string {
  const t = (text ?? "").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

interface Notif {
  title: string;
  body: string;
  url: string;
  tag: string;
}

// Columns of notification_prefs. The Edge Function only suppresses a message
// when a member's column is explicitly `false`; missing rows default to "send".
type PrefKey =
  | "new_question"
  | "new_challenge"
  | "new_photo"
  | "question_completed"
  | "photo_rejected"
  | "question_comment";

interface Built {
  notif: Notif;
  prefKey: PrefKey;
  // Broadcast to everyone except this user (new-content events)…
  excludeUserId: string | null;
  // …or deliver only to this single user (targeted events).
  targetUserId: string | null;
  // Some events target a set of members (for example, prior answerers).
  targetUserIds?: string[];
}

// deno-lint-ignore no-explicit-any
function buildFromTable(table: string, record: any, who: string): Built | null {
  switch (table) {
    case "questions":
      return {
        notif: {
          title: "Nova pergunta! ❓",
          body: `${who}: ${truncate(record.content, 90)}`,
          url: `/perguntas/${record.id}`,
          tag: `question-${record.id}`,
        },
        prefKey: "new_question",
        excludeUserId: (record.creator_id as string | undefined) ?? null,
        targetUserId: null,
      };
    case "photo_challenges":
      return {
        notif: {
          title: "Novo desafio de foto! 🏆",
          body: `${who}: ${truncate(record.title, 90)}`,
          url: `/fotos/desafios/${record.id}`,
          tag: `challenge-${record.id}`,
        },
        prefKey: "new_challenge",
        excludeUserId: (record.creator_id as string | undefined) ?? null,
        targetUserId: null,
      };
    case "photo_submissions":
      return {
        notif: {
          title: "Nova foto para votar! 📸",
          body: record.caption
            ? `${who}: ${truncate(record.caption, 90)}`
            : `${who} enviou uma foto`,
          url: `/fotos/${record.id}`,
          tag: `photo-${record.id}`,
        },
        prefKey: "new_photo",
        excludeUserId: (record.submitter_id as string | undefined) ?? null,
        targetUserId: null,
      };
    default:
      return null;
  }
}

// deno-lint-ignore no-explicit-any
function buildFromEvent(event: string, payload: any): Built | null {
  switch (event) {
    case "question_completed":
      return {
        notif: {
          title: "Todos responderam! ✅",
          body: payload.content
            ? `Sua pergunta "${truncate(payload.content, 80)}" foi respondida por todos. Veja o resultado!`
            : "Sua pergunta foi respondida por todos. Veja o resultado!",
          url: `/perguntas/${payload.question_id}`,
          tag: `question-done-${payload.question_id}`,
        },
        prefKey: "question_completed",
        excludeUserId: null,
        targetUserId: (payload.target_user_id as string | undefined) ?? null,
      };
    case "question_comment": {
      const result = payload.is_correct === true ? "acertar" : "errar";
      // o criador não responde a própria pergunta: não tem acerto/erro pra citar
      const body = payload.is_creator === true
        ? `${payload.commenter} comentou na própria pergunta`
        : `${payload.commenter} comentou na pergunta de ${payload.question_creator} depois de ${result}`;
      return {
        notif: {
          title: "Novo comentário 💬",
          body,
          url: `/perguntas/${payload.question_id}`,
          tag: `question-comment-${payload.comment_id ?? payload.question_id}`,
        },
        prefKey: "question_comment",
        excludeUserId: null,
        targetUserId: null,
        targetUserIds: Array.isArray(payload.target_user_ids)
          ? payload.target_user_ids as string[]
          : [],
      };
    }
    case "question_settled": {
      const q = payload.question_id;
      const content = payload.content as string | undefined;
      const familyOnly = payload.family_only === true;
      if (payload.role === "answerer") {
        const correct = payload.is_correct === true;
        const pts = (payload.points as number | undefined) ?? 0;
        return {
          notif: {
            title: correct
              ? familyOnly
                ? "Acertou, mas não valeu pontos 😬"
                : "Você acertou! 🎉"
              : "Resultado revelado 👀",
            body: correct && familyOnly
              ? `Só a família do criador acertou${content ? ` em "${truncate(content, 70)}"` : ""}, então a pergunta foi considerada impossível.`
              : correct
              ? `Ganhou ${pts} ${pts === 1 ? "ponto" : "pontos"}${content ? ` em "${truncate(content, 70)}"` : ""}.`
              : `A resposta foi revelada${content ? ` em "${truncate(content, 70)}"` : ""}. Veja como o grupo se saiu.`,
            url: `/perguntas/${q}`,
            tag: `question-done-${q}`,
          },
          prefKey: "question_completed",
          excludeUserId: null,
          targetUserId: (payload.target_user_id as string | undefined) ?? null,
        };
      }
      // role === "creator"
      const impossible = payload.difficulty === "impossible";
      return {
        notif: {
          title: impossible
            ? familyOnly
              ? "Só sua família acertou 😬"
              : "Ninguém acertou 😬"
            : "Pergunta finalizada! 🏁",
          body: impossible && familyOnly
            ? `Só sua família acertou a pergunta${content ? ` "${truncate(content, 70)}"` : ""} — ela foi considerada impossível e não rendeu pontos.`
            : impossible
            ? `Ninguém acertou sua pergunta${content ? ` "${truncate(content, 70)}"` : ""} — o bônus de criação foi devolvido.`
            : `Todos responderam sua pergunta${content ? ` "${truncate(content, 70)}"` : ""}. Veja o resultado!`,
          url: `/perguntas/${q}`,
          tag: `question-done-${q}`,
        },
        prefKey: "question_completed",
        excludeUserId: null,
        targetUserId: (payload.target_user_id as string | undefined) ?? null,
      };
    }
    case "photo_rejected":
      return {
        notif: {
          title: "Foto não passou 😬",
          body: payload.caption
            ? `Sua foto "${truncate(payload.caption, 80)}" foi rejeitada na votação.`
            : "Uma das suas fotos foi rejeitada na votação.",
          url: `/fotos/${payload.submission_id}`,
          tag: `photo-rejected-${payload.submission_id}`,
        },
        prefKey: "photo_rejected",
        excludeUserId: null,
        targetUserId: (payload.target_user_id as string | undefined) ?? null,
      };
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  // deno-lint-ignore no-explicit-any
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  let built: Built | null = null;

  if (payload.event) {
    built = buildFromEvent(payload.event as string, payload);
  } else if (payload.record) {
    const record = payload.record as Record<string, unknown>;
    const creatorId =
      (record.creator_id as string | undefined) ??
      (record.submitter_id as string | undefined) ??
      null;

    let who = "Alguém";
    if (creatorId) {
      const { data } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", creatorId)
        .single();
      if (data?.nickname) who = data.nickname;
    }
    built = buildFromTable((payload.table as string) ?? "", record, who);
  }

  if (!built) return new Response("ignored", { status: 200 });

  const { notif, prefKey, excludeUserId, targetUserId, targetUserIds } = built;

  let query = supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id");
  if (targetUserIds) {
    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, total: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    query = query.in("user_id", targetUserIds);
  } else if (targetUserId) query = query.eq("user_id", targetUserId);
  else if (excludeUserId) query = query.neq("user_id", excludeUserId);

  const { data: allSubs, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  // Drop subscriptions whose owner opted out of this event type.
  const userIds = [...new Set((allSubs ?? []).map((s) => s.user_id))];
  const optedOut = new Set<string>();
  if (userIds.length) {
    const { data: prefs } = await supabase
      .from("notification_prefs")
      .select(`user_id, ${prefKey}`)
      .in("user_id", userIds);
    for (const p of prefs ?? []) {
      // deno-lint-ignore no-explicit-any
      if ((p as any)[prefKey] === false) optedOut.add(p.user_id as string);
    }
  }
  const subs = (allSubs ?? []).filter((s) => !optedOut.has(s.user_id));

  const body = JSON.stringify(notif);
  const results = await Promise.allSettled(
    (subs ?? []).map((s) =>
      webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        )
        .catch(async (err: { statusCode?: number }) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", s.endpoint);
          }
          throw err;
        }),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return new Response(
    JSON.stringify({ sent, total: subs?.length ?? 0 }),
    { headers: { "Content-Type": "application/json" } },
  );
});
