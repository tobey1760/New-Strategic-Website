/* ──────────────────────────────────────────────────────────────
   Shared Supabase blog helpers (used by blog.html and post.html).

   Depends on:
     - @supabase/supabase-js v2 UMD build (window.supabase)
     - js/config.js (window.SUPABASE_CONFIG)

   "Live" posts = status === 'approved'. Category & excerpt are not
   stored in the table, so the excerpt is derived from the body and
   posts carry a neutral 'perspectives' tag. Author is hardcoded.
   ────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var cfg = global.SUPABASE_CONFIG || {};
  var client = null;

  function getClient() {
    if (client) return client;
    if (!global.supabase || !cfg.url || !cfg.anonKey) return null;
    client = global.supabase.createClient(cfg.url, cfg.anonKey);
    return client;
  }

  // ---- HTML escaping -------------------------------------------------
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---- Body parser (mirrors admin tool's parseBody) ------------------
  // Plain text with light structural markers:
  //   blank line  -> paragraph break
  //   "# heading"   -> <h2>
  //   "## subhead"  -> <h3>
  //   "- item"      -> <ul><li>  (also "* item")
  //   "> quote"     -> <blockquote>
  //   inline [text](url) -> <a> (http/https/mailto/relative/.html only)
  // Keep this in sync with the builder's parseBody so previews match.
  var LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|\/[^\s)]+|[\w.\-]+\.html(?:#[^\s)]*)?)\)/g;

  // Apply inline formatting to an ALREADY html-escaped string.
  //   **bold** -> <strong>,  [text](url) -> <a>
  function inlineFormat(escaped) {
    return escaped
      .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
      .replace(LINK_RE, function (_, text, url) {
        var external = /^https?:\/\//i.test(url);
        var attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
        return '<a href="' + url + '"' + attrs + '>' + text + '</a>';
      });
  }

  function fmt(raw) { return inlineFormat(escapeHtml(raw)); }

  // Line-by-line parser (robust to standard markdown): a heading and its
  // following paragraph, or an intro line followed by bullets, are handled
  // even when they sit in the same blank-line-delimited block.
  function parseBody(text) {
    var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    var out = [], para = [], list = [], olist = [], quote = [];

    function flushPara() {
      if (para.length) { out.push('<p>' + fmt(para.join(' ')) + '</p>'); para = []; }
    }
    function flushList() {
      if (list.length) {
        out.push('<ul>' + list.map(function (li) { return '<li>' + fmt(li) + '</li>'; }).join('') + '</ul>');
        list = [];
      }
    }
    function flushOlist() {
      if (olist.length) {
        out.push('<ol>' + olist.map(function (li) { return '<li>' + fmt(li) + '</li>'; }).join('') + '</ol>');
        olist = [];
      }
    }
    function flushQuote() {
      if (quote.length) { out.push('<blockquote><p>' + fmt(quote.join(' ')) + '</p></blockquote>'); quote = []; }
    }
    function flushAll() { flushPara(); flushList(); flushOlist(); flushQuote(); }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) { flushAll(); continue; }                       // blank line -> break
      if (/^#{2,}\s+/.test(line)) {                              // ## (or more) -> H3
        flushAll(); out.push('<h3>' + fmt(line.replace(/^#{2,}\s+/, '')) + '</h3>'); continue;
      }
      if (/^#\s+/.test(line)) {                                  // # -> H2
        flushAll(); out.push('<h2>' + fmt(line.replace(/^#\s+/, '')) + '</h2>'); continue;
      }
      if (/^\d+\.\s+/.test(line)) {                              // "1." -> ordered list
        flushPara(); flushList(); flushQuote(); olist.push(line.replace(/^\d+\.\s+/, '')); continue;
      }
      if (/^[-*]\s+/.test(line)) {                               // - or * -> bullet
        flushPara(); flushOlist(); flushQuote(); list.push(line.replace(/^[-*]\s+/, '')); continue;
      }
      if (/^>\s?/.test(line)) {                                  // > -> quote
        flushPara(); flushList(); flushOlist(); quote.push(line.replace(/^>\s?/, '')); continue;
      }
      flushList(); flushOlist(); flushQuote(); para.push(line);  // plain paragraph text
    }
    flushAll();
    return out.join('\n');
  }

  // ---- Plain-text flatten of body (for excerpt + read time) ----------
  function bodyToText(body) {
    return String(body || '')
      .split('\n')
      .map(function (l) {
        return l.trim()
          .replace(/^#{1,6}\s+/, '')   // headings
          .replace(/^[-*]\s+/, '')      // bullets
          .replace(/^\d+\.\s+/, '')     // numbered list
          .replace(/^>\s?/, '')         // quotes
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links -> text
          .replace(/\*\*([^*]+?)\*\*/g, '$1')      // bold markers
          .replace(/[*_]{1,2}/g, '');              // stray emphasis marks
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function makeExcerpt(body, max) {
    max = max || 200;
    var text = bodyToText(body);
    if (text.length <= max) return text;
    var slice = text.slice(0, max);
    var lastSpace = slice.lastIndexOf(' ');
    if (lastSpace > 40) slice = slice.slice(0, lastSpace);
    return slice.replace(/[.,;:\-\s]+$/, '') + '…';
  }

  function readTime(body) {
    var words = bodyToText(body).split(' ').filter(Boolean).length;
    return Math.max(1, Math.round(words / 200)) + ' min read';
  }

  // ---- Date formatting -----------------------------------------------
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Parse a 'YYYY-MM-DD' (or ISO) date without timezone drift.
  function formatDate(value) {
    if (!value) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (!m) return '';
    var month = MONTHS[parseInt(m[2], 10) - 1] || '';
    var day = parseInt(m[3], 10);
    return month + ' ' + day + ', ' + m[1];
  }

  // Best available date for a live post.
  function postDateValue(row) {
    return row.posted_on || row.scheduled_for || row.created_at || null;
  }

  // Statuses considered publicly "live". Keep in sync with the RLS
  // policy on public.blogs.
  var LIVE_STATUSES = ['approved', 'catalog'];

  // Columns. `category` (migration 0007) and `cover_image_url` are
  // optional extras; if either has not been applied to this project yet,
  // queries fall back to the base column set so nothing breaks
  // (see runWithFallback below).
  var BASE_COLS = 'id,title,body,status,posted_on,scheduled_for,created_at';
  // Column tiers tried in order — each drops the newest optional column.
  // Lets the site keep working even if a migration (tags, etc.) hasn't
  // been applied to this project yet.
  var COL_TIERS = [
    BASE_COLS + ',category,excerpt,is_featured,cover_image_url,tags',
    BASE_COLS + ',category,excerpt,is_featured,cover_image_url',
    BASE_COLS,
  ];

  // PostgREST raises 42703 ("undefined_column") for any missing column.
  function isMissingColumn(err) {
    return !!err && (err.code === '42703' ||
      /does not exist/i.test(err.message || ''));
  }

  // Runs build(cols) -> PostgREST query, falling back through COL_TIERS
  // when a column is missing. Returns res.data (array or single object).
  function runWithFallback(build, tier) {
    tier = tier || 0;
    return build(COL_TIERS[tier]).then(function (res) {
      if (res.error) {
        if (isMissingColumn(res.error) && tier < COL_TIERS.length - 1) {
          return runWithFallback(build, tier + 1);
        }
        throw res.error;
      }
      return res.data;
    });
  }

  // ---- Fetch live posts, newest first --------------------------------
  function fetchLivePosts(limit) {
    var c = getClient();
    if (!c) return Promise.reject(new Error('Supabase client unavailable'));
    return runWithFallback(function (cols) {
      var q = c.from(cfg.table || 'blogs')
        .select(cols)
        .in('status', LIVE_STATUSES)
        .order('posted_on', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (limit) q = q.limit(limit);
      return q;
    }).then(function (data) { return data || []; });
  }

  // ---- Fetch a single live post by id --------------------------------
  function fetchPostById(id) {
    var c = getClient();
    if (!c) return Promise.reject(new Error('Supabase client unavailable'));
    return runWithFallback(function (cols) {
      return c.from(cfg.table || 'blogs')
        .select(cols)
        .eq('id', id)
        .in('status', LIVE_STATUSES)
        .maybeSingle();
    }).then(function (data) { return data || null; });
  }

  // ---- Category mapping (migration 0007) -----------------------------
  // Builder generates one of these slugs; they match the filter pills on
  // blog.html. Posts created before 0007 have category = null and fall
  // back to the neutral "Perspectives" tag (shown only under "All").
  var CATEGORY_LABELS = {
    'ai-strategy': 'AI Strategy',
    'revenue': 'Revenue',
    'operations': 'Operations',
    'authority': 'Authority',
    'health-tech': 'Health Tech',
  };
  var TAG_LABEL = 'Perspectives';
  var TAG_CATEGORY = 'perspectives';

  // Valid category slug for a row, or null if missing/unknown.
  function categorySlug(row) {
    var c = row && row.category;
    return (c && CATEGORY_LABELS.hasOwnProperty(c)) ? c : null;
  }
  // Human label for the tag chip ("AI Strategy", or "Perspectives" fallback).
  function categoryLabel(row) {
    var s = categorySlug(row);
    return s ? CATEGORY_LABELS[s] : TAG_LABEL;
  }
  // data-category attribute used by the filter ("ai-strategy", or "perspectives").
  function categoryAttr(row) {
    return categorySlug(row) || TAG_CATEGORY;
  }

  // ---- Tags (multi-value, separate from the single category) ---------
  // Handles Postgres text[] (array) or comma-separated text.
  function tagsFor(row) {
    var t = row && row.tags;
    if (!t) return [];
    var arr = Array.isArray(t) ? t : String(t).split(',');
    return arr.map(function (s) { return String(s).trim(); }).filter(Boolean);
  }

  // ---- Excerpt: prefer stored column, fall back to derived -----------
  function excerptFor(row, max) {
    var stored = row && row.excerpt;
    if (stored && String(stored).trim()) return String(stored).trim();
    return makeExcerpt(row && row.body, max);
  }

  // ---- Featured flag -------------------------------------------------
  function isFeatured(row) {
    return !!(row && row.is_featured);
  }

  // ---- Cover image ---------------------------------------------------
  // Branded gradient used when a post has no cover image.
  var COVER_PLACEHOLDER =
    "background:linear-gradient(135deg,#1a1813 0%,#2c2516 55%,#1d1a12 100%);";

  // Resolve cover_image_url into a usable src, handling all formats the
  // builder might store:
  //   - full URL            "https://.../x.jpg"  -> as-is
  //   - root/relative path  "/images/..", "images/blog/x.jpg" -> as-is
  //   - bare filename       "blog-revenue.jpg"   -> prefixed images/blog/
  function coverImageUrl(row) {
    var v = row && row.cover_image_url;
    if (!v) return null;
    v = String(v).trim();
    if (!v) return null;
    if (/^(https?:)?\/\//i.test(v) || v.charAt(0) === '/') return v;
    if (v.indexOf('/') !== -1) return v;
    return 'images/blog/' + v;
  }

  // Full CSS background declaration for a card/featured image inner.
  function coverBackgroundStyle(row) {
    var url = coverImageUrl(row);
    if (!url) return COVER_PLACEHOLDER;
    // Strip chars that could break out of the url('...') context.
    var safe = url.replace(/["'()\\\s]/g, '');
    return "background-image:url('" + safe + "');background-size:cover;background-position:center;";
  }

  global.SupabaseBlog = {
    getClient: getClient,
    escapeHtml: escapeHtml,
    parseBody: parseBody,
    bodyToText: bodyToText,
    makeExcerpt: makeExcerpt,
    readTime: readTime,
    formatDate: formatDate,
    postDateValue: postDateValue,
    fetchLivePosts: fetchLivePosts,
    fetchPostById: fetchPostById,
    categorySlug: categorySlug,
    categoryLabel: categoryLabel,
    categoryAttr: categoryAttr,
    tagsFor: tagsFor,
    excerptFor: excerptFor,
    isFeatured: isFeatured,
    coverImageUrl: coverImageUrl,
    coverBackgroundStyle: coverBackgroundStyle,
    CATEGORY_LABELS: CATEGORY_LABELS,
    COVER_PLACEHOLDER: COVER_PLACEHOLDER,
    TAG_LABEL: TAG_LABEL,
    TAG_CATEGORY: TAG_CATEGORY,
  };
}(window));
