/* ──────────────────────────────────────────────────────────────
   article.js — shared enhancements for blog article pages:
     · builds a table of contents from the article's <h2>/<h3>
     · scroll-spy that highlights the current section
     · wires social share buttons (X, LinkedIn, copy link)

   Used by both post.html (after js/post.js injects content) and the
   static blog-post.html (content already in the DOM).

   Call window.ArticleUI.enhance() once the article body is populated.
   ────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  function slugify(text, used) {
    var base = String(text).toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'section';
    var slug = base, n = 2;
    while (used[slug]) { slug = base + '-' + n; n++; }
    used[slug] = true;
    return slug;
  }

  function buildToc(opts) {
    var body = document.getElementById(opts.bodyId);
    var aside = document.getElementById(opts.tocId);
    var list = document.getElementById(opts.tocListId);
    var shell = opts.shellSelector ? document.querySelector(opts.shellSelector) : null;
    if (!body || !aside || !list) return [];

    var headings = body.querySelectorAll('h2, h3');
    // Need at least 2 headings for a TOC to be useful.
    if (headings.length < 2) {
      aside.style.display = 'none';
      if (shell) shell.classList.add('no-toc');
      return [];
    }

    var used = {};
    var links = [];
    list.innerHTML = '';
    Array.prototype.forEach.call(headings, function (h) {
      if (!h.id) h.id = slugify(h.textContent, used);
      var li = document.createElement('li');
      if (h.tagName.toLowerCase() === 'h3') li.className = 'toc-h3';
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var top = h.getBoundingClientRect().top + global.pageYOffset - 96;
        global.scrollTo({ top: top, behavior: 'smooth' });
        if (global.history && history.replaceState) history.replaceState(null, '', '#' + h.id);
      });
      li.appendChild(a);
      list.appendChild(li);
      links.push({ heading: h, link: a });
    });

    initScrollSpy(links);
    return links;
  }

  function initScrollSpy(links) {
    if (!links.length) return;
    function onScroll() {
      var marker = global.pageYOffset + 140;
      var activeIdx = 0;
      for (var i = 0; i < links.length; i++) {
        if (links[i].heading.offsetTop <= marker) activeIdx = i;
      }
      for (var j = 0; j < links.length; j++) {
        links[j].link.classList.toggle('active', j === activeIdx);
      }
    }
    global.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initShare(opts) {
    var title = (opts && opts.title) || document.title;
    var url = global.location.href;
    var buttons = document.querySelectorAll('[data-share]');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.getAttribute('data-share');
        var u = encodeURIComponent(global.location.href);
        var t = encodeURIComponent(opts && opts.title ? opts.title : document.title);
        if (kind === 'x') {
          open('https://twitter.com/intent/tweet?text=' + t + '&url=' + u);
        } else if (kind === 'linkedin') {
          open('https://www.linkedin.com/sharing/share-offsite/?url=' + u);
        } else if (kind === 'copy') {
          copyLink(btn);
        }
      });
    });
    function open(href) { global.open(href, '_blank', 'noopener,noreferrer,width=600,height=540'); }
    function copyLink(btn) {
      var done = function () {
        var orig = btn.getAttribute('aria-label');
        btn.classList.add('copied');
        btn.setAttribute('aria-label', 'Link copied');
        setTimeout(function () { btn.classList.remove('copied'); btn.setAttribute('aria-label', orig); }, 1600);
      };
      if (global.navigator && navigator.clipboard) {
        navigator.clipboard.writeText(global.location.href).then(done, done);
      } else {
        done();
      }
    }
  }

  // Public entry point. Pass element ids; call after content is in the DOM.
  function enhance(opts) {
    opts = opts || {};
    buildToc({
      bodyId: opts.bodyId || 'articleBody',
      tocId: opts.tocId || 'articleToc',
      tocListId: opts.tocListId || 'tocList',
      shellSelector: opts.shellSelector || '.article-shell',
    });
    initShare({ title: opts.title });
  }

  global.ArticleUI = { enhance: enhance, buildToc: buildToc, initShare: initShare };
}(window));
