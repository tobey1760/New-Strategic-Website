/* ──────────────────────────────────────────────────────────────
   post.html — load a single live (approved) Supabase post by ?id=<uuid>,
   render it into the article template, and populate "Keep Reading"
   with up to 3 other live posts.

   Depends on js/supabase-blog.js (window.SupabaseBlog).
   ────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SB = window.SupabaseBlog;

  var ARROW =
    '<svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
    '<path d="M2 7H12M12 7L8 3M12 7L8 11" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function $(id) { return document.getElementById(id); }

  function getId() {
    var params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  function showError(message) {
    var body = $('articleBody');
    if (body) {
      body.innerHTML =
        '<h2>Article not found</h2>' +
        '<p>' + SB.escapeHtml(message) + '</p>' +
        '<p><a href="blog.html">← Back to all articles</a></p>';
    }
    $('postTitle').textContent = 'Article not found';
    $('postSub').textContent = '';
    $('postDate').textContent = '';
    $('postReadTime').textContent = '';
  }

  function renderPost(row) {
    var title = row.title || 'Untitled';
    var excerpt = SB.excerptFor(row, 180);
    var date = SB.formatDate(SB.postDateValue(row));
    var rt = SB.readTime(row.body);

    var catLabel = SB.categoryLabel(row);

    // Hero
    $('postTitle').textContent = title;
    $('postSub').textContent = excerpt;
    $('postDate').textContent = date || '';
    $('postReadTime').textContent = rt;
    $('postTag').textContent = catLabel;
    var crumb = $('crumbCategory'); if (crumb) crumb.textContent = catLabel;

    // Tags (multi-value, shown as pills below the title)
    var tagsEl = $('postTags');
    if (tagsEl) {
      var tags = SB.tagsFor(row);
      tagsEl.innerHTML = tags.map(function (t) {
        return '<span class="post-hero-tag">#' + SB.escapeHtml(t) + '</span>';
      }).join('');
      tagsEl.style.display = tags.length ? '' : 'none';
    }

    // Cover banner + hero background image
    var cover = SB.coverImageUrl(row);
    if (cover) {
      var coverWrap = $('articleCover');
      var coverImg = $('articleCoverImg');
      if (coverImg) coverImg.setAttribute('style', SB.coverBackgroundStyle(row));
      if (coverWrap) coverWrap.style.display = '';

      // Use the cover as the hero background (behind the dark overlay),
      // replacing the placeholder video.
      var heroBg = document.querySelector('.page-hero-bg');
      if (heroBg) {
        var safe = cover.replace(/["'()\\\s]/g, '');
        heroBg.style.backgroundImage = "url('" + safe + "')";
        heroBg.style.backgroundSize = 'cover';
        heroBg.style.backgroundPosition = 'center';
        var vid = heroBg.querySelector('.page-hero-video');
        if (vid) vid.style.display = 'none';
      }
    }

    // Body (parsed plain-text → structured HTML)
    $('articleBody').innerHTML = SB.parseBody(row.body) ||
      '<p>' + SB.escapeHtml(row.body || '') + '</p>';

    // Document / social metadata
    document.title = title + ' | 1760 Strategic AI';
    var pt = $('pageTitle'); if (pt) pt.textContent = document.title;
    setMeta('metaDescription', 'content', excerpt);
    setMeta('ogTitle', 'content', title);
    setMeta('ogDescription', 'content', excerpt);

    // Build TOC + scroll-spy + wire share buttons (content now in DOM).
    if (window.ArticleUI) window.ArticleUI.enhance({ title: title });
  }

  function setMeta(id, attr, value) {
    var el = $(id);
    if (el) el.setAttribute(attr, value);
  }

  function relatedCardHtml(row) {
    var title = SB.escapeHtml(row.title || 'Untitled');
    var excerpt = SB.escapeHtml(SB.excerptFor(row, 160));
    var date = SB.formatDate(SB.postDateValue(row));
    var meta = SB.escapeHtml((date ? date + ' · ' : '') + SB.readTime(row.body));
    var href = 'post.html?id=' + encodeURIComponent(row.id);
    var catAttr = SB.categoryAttr(row);
    var catLabel = SB.categoryLabel(row);
    var bg = SB.coverBackgroundStyle(row);

    return '' +
      '<article class="blog-card reveal in">' +
        '<a href="' + href + '" class="blog-card-img" data-cat="' + catAttr + '" ' +
            'aria-hidden="true" tabindex="-1" style="display:block;">' +
          '<div class="blog-card-img-inner" aria-hidden="true" style="' + bg + '"></div>' +
          '<div class="blog-card-img-line" aria-hidden="true"></div>' +
        '</a>' +
        '<div class="blog-card-body">' +
          '<div class="blog-card-top"><span class="blog-tag">' + SB.escapeHtml(catLabel) + '</span></div>' +
          '<h3 class="blog-card-title">' + title + '</h3>' +
          '<p class="blog-card-excerpt">' + excerpt + '</p>' +
          '<div class="blog-card-footer">' +
            '<span class="blog-card-meta">' + meta + '</span>' +
            '<a href="' + href + '" class="blog-card-link">Read ' + ARROW + '</a>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderRelated(rows, currentId) {
    var others = (rows || []).filter(function (r) { return r.id !== currentId; }).slice(0, 3);
    if (!others.length) return;
    var grid = $('relatedGrid');
    var section = $('relatedSection');
    if (!grid || !section) return;
    grid.innerHTML = others.map(relatedCardHtml).join('');
    section.style.display = '';
  }

  function init() {
    if (!SB) { showError('Blog system failed to load.'); return; }
    var id = getId();
    if (!id) { showError('No article specified.'); return; }

    SB.fetchPostById(id).then(function (row) {
      if (!row) { showError('This article may have been removed or is not yet published.'); return; }
      renderPost(row);
      // Load related posts (best-effort).
      SB.fetchLivePosts(6).then(function (rows) {
        renderRelated(rows, row.id);
      }).catch(function () {});
    }).catch(function (err) {
      showError(err.message || 'Could not load this article.');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
