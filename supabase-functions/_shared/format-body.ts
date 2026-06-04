// _shared/format-body.ts
// Publish-time "format pass": turns flat prose into the lightweight markers the
// public site renders (# H2, ## H3, - bullets, > pull-quote, [text](url) links)
// WITHOUT changing the author's wording. A strict post-check rejects any output
// that altered or dropped words, so a bad model response can never overwrite the
// original body.
import Anthropic from "npm:@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

// Mechanical transform. Swap to "claude-haiku-4-5" to cut cost ~5x at volume.
const MODEL = "claude-opus-4-8";

const SYSTEM = `You are a precise text formatter for a blog CMS. You receive the plain-text body of ONE article and return the SAME article with lightweight structural markers added. You are a formatter, not an editor or writer.

ABSOLUTE RULES — preserve the author's words:
- Reproduce every sentence of the original body VERBATIM. Do NOT reword, paraphrase, summarize, expand, shorten, fix spelling/grammar, change punctuation, translate, or reorder the author's sentences.
- The ONLY text you may ADD is short section heading labels (see below). Add nothing else.
- Never delete a sentence or merge two sentences.

MARKERS YOU MAY ADD (and nothing else):
- "# " at the start of a NEW line = section heading (renders as H2). Insert one before a group of related paragraphs to label the section. Short (3-8 words), Title Case, no trailing period. Aim for 3-6 per article.
- "## " at the start of a NEW line = sub-heading (H3), only when a section clearly has sub-parts.
- "- " at the start of consecutive lines = a bullet list. ONLY convert items the author already wrote as a list or as parallel points (e.g. "First... Second... Third..."). Use the author's exact words per bullet. Never invent items.
- "> " at the start of a line = a pull-quote. You MAY mark ONE or TWO of the author's existing standalone sentences as a pull-quote by prefixing that sentence (unchanged) with "> ". Do not write new quote text.
- [text](url) = inline link. ONLY when the author's text already contains a bare URL or an explicit "(https://...)". Wrap the author's anchor words. Never invent URLs.

MECHANICS:
- Separate every paragraph with a single blank line.
- Each heading/sub-heading/pull-quote sits on its own line, blank line before and after.
- No other markdown: no **bold**, no *italics*, no images, no tables, no code fences, no horizontal rules.

OUTPUT:
- Output ONLY the formatted article body. No preamble, no explanation, no code fences, no "Here is...". Begin directly with the first heading or paragraph.`;

const MARKER_RE = /(^|\n)\s*(#{1,2}\s|-\s|>\s)|\[[^\]\n]+\]\([^)\s]+\)/;

export function looksFormatted(body: string): boolean {
  return MARKER_RE.test(body ?? "");
}

export async function formatArticleBody(
  body: string,
): Promise<{ formatted: string; changed: boolean; reason?: string }> {
  const original = (body ?? "").trim();
  if (!original) return { formatted: body, changed: false, reason: "empty" };
  if (looksFormatted(original)) {
    return { formatted: body, changed: false, reason: "already-formatted" };
  }

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "low" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Article body to format:\n\n${original}` }],
  });

  let out = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();
  out = stripCodeFences(out);

  if (!out) return { formatted: body, changed: false, reason: "empty-output" };
  if (!preservesWording(original, out)) {
    return { formatted: body, changed: false, reason: "wording-mismatch" };
  }
  return { formatted: out, changed: out !== original };
}

function stripCodeFences(s: string): string {
  return s.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
}

// Every original word must still appear, in order, in the formatted output
// after removing ADDED heading lines and stripping markers/link syntax.
function preservesWording(original: string, formatted: string): boolean {
  const O = words(stripMarkers(original, false));
  const F = words(stripMarkers(formatted, true));
  let i = 0;
  for (const w of F) if (i < O.length && w === O[i]) i++;
  return i === O.length;
}

function stripMarkers(text: string, dropHeadings: boolean): string {
  return text
    .split("\n")
    .filter((line) => !(dropHeadings && /^\s*#{1,2}\s/.test(line)))
    .map((line) =>
      line
        .replace(/^\s*#{1,2}\s+/, "")
        .replace(/^\s*-\s+/, "")
        .replace(/^\s*>\s?/, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"),
    )
    .join(" ");
}

function words(s: string): string[] {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
}
