# Blog format-pass Edge Function

These are **builder-side** files (a Supabase Edge Function) — copy them into your
blog-builder project's `supabase/functions/` directory and deploy. They make blog
post bodies render with structure (headings, sub-headings, bullets, pull-quotes,
links) on the public website by adding lightweight markers at publish time.

```
supabase/functions/
  _shared/format-body.ts     ← the formatter (calls Claude; preserves wording)
  format-blog/index.ts       ← the endpoint (single-post + backfill modes)
```

## What it does

- Sends a flat-prose body to Claude with strict instructions to add **only**
  `#`, `##`, `-`, `>`, and `[text](url)` markers — never to reword anything.
- A post-check rejects any output that changed or dropped words, so a bad model
  response can never overwrite the original.
- Skips posts that already have markers (safe to re-run).

## 1. Secrets

```sh
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ADMIN_SECRET=$(openssl rand -hex 16)   # protects the endpoint
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 2. Deploy

```sh
supabase functions deploy format-blog
```

## 3a. Backfill existing posts (on-demand)

Formats every live (`approved`/`catalog`) post that has no markers yet:

```sh
curl -X POST "https://<project-ref>.functions.supabase.co/format-blog" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "content-type: application/json" \
  -d '{ "backfill": true }'
```

Returns a per-post log: `{ total, formatted, skipped, failed, log }`.

## 3b. Auto-run on publish

In your existing publish/approve Edge Function, after you flip a draft to
`approved`/`catalog`, call the formatter directly (in-process — no HTTP hop):

```ts
import { formatArticleBody, looksFormatted } from "../_shared/format-body.ts";

// after the status update for `draft`:
if (draft.body && !looksFormatted(draft.body)) {
  const { formatted, changed } = await formatArticleBody(draft.body);
  if (changed) {
    await supabase.from("blogs").update({ body: formatted }).eq("id", draft.id);
  }
}
```

## Notes

- **Model**: defaults to `claude-opus-4-8`. For a high-volume mechanical task,
  switch `MODEL` in `_shared/format-body.ts` to `claude-haiku-4-5` to cut cost.
- **Idempotent**: re-running backfill skips already-formatted posts.
- **Encoding**: this function does not fix the `�` (mojibake) characters — those
  come from the body being saved as non-UTF-8 upstream. Fix that at the builder's
  save step so future posts store clean apostrophes/dashes.
