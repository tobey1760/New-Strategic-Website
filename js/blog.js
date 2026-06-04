/* ──────────────────────────────────────────────────────────────
   blog.html — fetch live posts from Supabase and render them:
     - a post flagged is_featured takes over the featured slot
     - the rest are injected as cards at the TOP of the blog grid,
       above the hand-written articles
   Cards link to post.html?id=<uuid>.

   Depends on js/supabase-blog.js (window.SupabaseBlog).
   ────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SB = window.SupabaseBlog;
  if (!SB) return;

  var ARROW =
    '<svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
    '<path d="M2 7H12M12 7L8 3M12 7L8 11" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var ARROW14 =
    '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
    '<path d="M2 7H12M12 7L8 3M12 7L8 11" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---- Standard grid card --------------------------------------------
  function cardHtml(row) {
    var title = SB.escapeHtml(row.title || 'Untitled');
    var excerpt = SB.escapeHtml(SB.excerptFor(row, 200));
    var date = SB.formatDate(SB.postDateValue(row));
    var meta = SB.escapeHtml((date ? date + ' · ' : '') + SB.readTime(row.body));
    var href = 'post.html?id=' + encodeURIComponent(row.id);
    var catAttr = SB.categoryAttr(row);
    var catLabel = SB.categoryLabel(row);
    var bg = SB.coverBackgroundStyle(row);
    var tags = SB.tagsFor(row);
    var tagsHtml = tags.length
      ? '<div class="blog-card-tags">' + tags.slice(0, 3).map(function (t) {
          return '<span class="blog-card-tag">#' + SB.escapeHtml(t) + '</span>';
        }).join('') + '</div>'
      : '';

    return '' +
      '<article class="blog-card reveal in" data-category="' + catAttr + '">' +
        '<a href="' + href + '" class="blog-card-img" data-cat="' + catAttr + '" ' +
            'aria-hidden="true" tabindex="-1" style="display:block;">' +
          '<div class="blog-card-img-inner" aria-hidden="true" style="' + bg + '"></div>' +
          '<div class="blog-card-img-line" aria-hidden="true"></div>' +
        '</a>' +
        '<div class="blog-card-body">' +
          '<div class="blog-card-top">' +
            '<span class="blog-tag">' + SB.escapeHtml(catLabel) + '</span>' +
          '</div>' +
          '<h3 class="blog-card-title">' + title + '</h3>' +
          '<p class="blog-card-excerpt">' + excerpt + '</p>' +
          tagsHtml +
          '<div class="blog-card-footer">' +
            '<span class="blog-card-meta">' + meta + '</span>' +
            '<a href="' + href + '" class="blog-card-link">Read ' + ARROW + '</a>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  // ---- Featured slot (mirrors the static .blog-featured markup) -------
  function featuredHtml(row) {
    var title = SB.escapeHtml(row.title || 'Untitled');
    var excerpt = SB.escapeHtml(SB.excerptFor(row, 280));
    var date = SB.formatDate(SB.postDateValue(row));
    var meta = SB.escapeHtml((date ? date + ' · ' : '') + SB.readTime(row.body));
    var href = 'post.html?id=' + encodeURIComponent(row.id);
    var catAttr = SB.categoryAttr(row);
    var catLabel = SB.categoryLabel(row);
    var bg = SB.coverBackgroundStyle(row);
    var tags = SB.tagsFor(row);
    var tagsHtml = tags.length
      ? '<div class="blog-card-tags">' + tags.slice(0, 4).map(function (t) {
          return '<span class="blog-card-tag">#' + SB.escapeHtml(t) + '</span>';
        }).join('') + '</div>'
      : '';

    return '' +
      '<article class="blog-featured reveal in reveal-d2" data-category="' + catAttr + '">' +
        '<a href="' + href + '" class="blog-featured-img" data-cat="' + catAttr + '" aria-hidden="true" tabindex="-1">' +
          '<div class="blog-featured-img-inner" style="' + bg + '"></div>' +
        '</a>' +
        '<div class="blog-featured-content">' +
          '<div class="blog-featured-eyebrow">' +
            '<span class="blog-featured-badge">Featured</span>' +
            '<span class="blog-tag">' + SB.escapeHtml(catLabel) + '</span>' +
          '</div>' +
          '<h2 class="blog-featured-title">' + title + '</h2>' +
          '<p class="blog-featured-excerpt">' + excerpt + '</p>' +
          tagsHtml +
          '<p class="blog-featured-meta"><span>' + meta + '</span></p>' +
          '<a href="' + href + '" class="btn-gold">Read Article ' + ARROW14 + '</a>' +
        '</div>' +
      '</article>';
  }

  function init() {
    var grid = document.querySelector('.blog-grid');
    if (!grid) return;

    SB.fetchLivePosts(50).then(function (rows) {
      if (!rows || !rows.length) return;

      // A Supabase post flagged is_featured replaces the static featured
      // block. rows are newest-first, so the first flagged one wins.
      var featuredRow = null;
      for (var i = 0; i < rows.length; i++) {
        if (SB.isFeatured(rows[i])) { featuredRow = rows[i]; break; }
      }

      var gridRows = rows;
      if (featuredRow) {
        var staticFeatured = document.querySelector('.blog-featured');
        if (staticFeatured) {
          staticFeatured.outerHTML = featuredHtml(featuredRow);
        }
        gridRows = rows.filter(function (r) { return r.id !== featuredRow.id; });
      }

      if (gridRows.length) {
        // Prepend so newest Supabase posts sit above the static articles.
        grid.insertAdjacentHTML('afterbegin', gridRows.map(cardHtml).join(''));
      }
    }).catch(function (err) {
      // Fail silently on the public site — static articles still render.
      if (window.console) console.warn('[blog] Supabase load failed:', err.message || err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
