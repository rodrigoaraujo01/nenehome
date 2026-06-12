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

// deno-lint-ignore no-explicit-any
function buildNotification(table: string, record: any, who: string): Notif | null {
  switch (table) {
    case "questions":
      return {
        title: "Nova pergunta! ❓",
        body: `${who}: ${truncate(record.content, 90)}`,
        url: `/perguntas/${record.id}`,
        tag: `question-${record.id}`,
      };
    case "photo_challenges":
      return {
        title: "Novo desafio de foto! 🏆",
        body: `${who}: ${truncate(record.title, 90)}`,
        url: `/fotos/desafios/${record.id}`,
        tag: `challenge-${record.id}`,
      };
    case "photo_submissions":
      return {
        title: "Nova foto para votar! 📸",
        body: record.caption
          ? `${who}: ${truncate(record.caption, 90)}`
          : `${who} enviou uma foto`,
        url: `/fotos/${record.id}`,
        tag: `photo-${record.id}`,
      };
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  let payload: { table?: string; record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const table = payload.table ?? "";
  const record = payload.record;
  if (!record) return new Response("no record", { status: 200 });

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

  const notif = buildNotification(table, record, who);
  if (!notif) return new Response("ignored table", { status: 200 });

  let query = supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id");
  if (creatorId) query = query.neq("user_id", creatorId);

  const { data: subs, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

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
