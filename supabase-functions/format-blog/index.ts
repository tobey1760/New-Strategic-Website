// format-blog Edge Function
// Two modes, one endpoint:
//   • Single post (publish hook):  POST { "id": "<uuid>" }
//   • Backfill all unformatted:    POST { "backfill": true }   (or empty body)
//
// "Unformatted" = body has no markers yet (looksFormatted() === false), so this
// is safe to re-run any time — already-structured posts are skipped.
//
// Writes use the service-role key (Edge Functions get it from the environment),
// so RLS does not block updates. Protect the endpoint with ADMIN_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";
import { formatArticleBody, looksFormatted } from "../_shared/format-body.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const LIVE_STATUSES = ["approved", "catalog"];

Deno.serve(async (req) => {
  // Optional shared-secret guard. Set ADMIN_SECRET via `supabase secrets set`.
  const required = Deno.env.get("ADMIN_SECRET");
  if (required && req.headers.get("x-admin-secret") !== required) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const payload = await req.json().catch(() => ({}));
    if (payload?.id) return json(await formatOne(String(payload.id)));
    return json({ mode: "backfill", ...(await backfill()) });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

async function formatOne(id: string) {
  const { data, error } = await supabase
    .from("blogs").select("id,body").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return { id, skipped: "not-found" };
  if (looksFormatted(data.body ?? "")) return { id, skipped: "already-formatted" };

  const res = await formatArticleBody(data.body ?? "");
  if (!res.changed) return { id, skipped: res.reason ?? "no-change" };

  const { error: upErr } = await supabase
    .from("blogs").update({ body: res.formatted }).eq("id", id);
  if (upErr) throw upErr;
  return { id, formatted: true };
}

async function backfill() {
  const { data, error } = await supabase
    .from("blogs").select("id,body").in("status", LIVE_STATUSES);
  if (error) throw error;

  const targets = (data ?? []).filter((r) => !looksFormatted(r.body ?? ""));
  let formatted = 0, skipped = 0, failed = 0;
  const log: unknown[] = [];

  for (const row of targets) {
    try {
      const res = await formatArticleBody(row.body ?? "");
      if (res.changed) {
        const { error: upErr } = await supabase
          .from("blogs").update({ body: res.formatted }).eq("id", row.id);
        if (upErr) throw upErr;
        formatted++; log.push({ id: row.id, formatted: true });
      } else {
        skipped++; log.push({ id: row.id, skipped: res.reason });
      }
    } catch (e) {
      failed++; log.push({ id: row.id, error: String((e as Error)?.message ?? e) });
    }
  }
  return { total: targets.length, formatted, skipped, failed, log };
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}
