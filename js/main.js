/* ══════════════════════════════════════════
   1760 Strategic AI — Main JavaScript
   ══════════════════════════════════════════ */

/* ── LOW-PERF DETECTION ─────────────────────────
   Apply .low-perf to <html> before anything else
   expensive starts, so the CSS fallbacks kick in
   immediately. Two paths:
     1. Static heuristics (hardware concurrency,
        deviceMemory, saveData, WebGL availability).
     2. Live FPS sampling for the first 2s — if the
        browser can't hit ~45fps on an idle page, we
        shut down videos, canvases, blur, cursor,
        and ambient animations.
   ──────────────────────────────────────────────── */
(function initPerfGate() {
  const html = document.documentElement;
  const flag = () => html.classList.add('low-perf');

  /* Static heuristics — decide before first paint if possible */
  try {
    const cores = navigator.hardwareConcurrency || 4;
    const mem   = navigator.deviceMemory || 8;
    const save  = navigator.connection && navigator.connection.saveData;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (save || cores <= 2 || mem <= 2) { flag(); return; }
    /* WebGL availability is a reasonable proxy for GPU acceleration */
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) { flag(); return; }
    /* On coarse-pointer devices with very few cores, play it safe */
    if (coarse && cores <= 4) { flag(); return; }
  } catch (e) { /* ignore */ }

  /* Live FPS sampling — catches HW accel disabled / overloaded CPU */
  let frames = 0, start = 0, samplingId = 0;
  function sample(ts) {
    if (!start) start = ts;
    frames++;
    const elapsed = ts - start;
    if (elapsed >= 1800) {
      const fps = (frames * 1000) / elapsed;
      if (fps < 42) flag();
      return;
    }
    samplingId = requestAnimationFrame(sample);
  }
  /* Start sampling after first paint so initial layout cost is excluded */
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => { samplingId = requestAnimationFrame(sample); }, { timeout: 500 });
  } else {
    setTimeout(() => { samplingId = requestAnimationFrame(sample); }, 300);
  }
})();

/* ── PAGE INTRO: grid block reveal ── */
(function initIntro() {
  const grid = document.getElementById('introGrid');
  if (!grid) {
    /* Inner page — no intro grid, show nav immediately */
    document.querySelector('nav')?.classList.add('nav-visible');
    return;
  }

  const blocks = grid.querySelectorAll('.intro-block');

  /* Randomise stagger delay for each block */
  const indices = Array.from({ length: blocks.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  /* Reveal nav early with soft transition — independent of grid */
  setTimeout(() => {
    document.querySelector('nav')?.classList.add('nav-visible');
  }, 1800);

  /* Start reveal after logo is visible */
  setTimeout(() => {
    grid.classList.add('reveal');
    blocks.forEach((block, i) => {
      block.style.animationDelay = (indices.indexOf(i) * 80) + 'ms';
    });

    /* Remove grid from DOM after animation completes */
    setTimeout(() => {
      grid.remove();
    }, 2400);
  }, 900);
})();


/* ── MANIFESTO VIDEO: play 0:19–0:22 once then stop ── */
(function initManifestoVideo() {
  const video = document.getElementById('manifestoVideo');
  if (!video) return;
  const START = 19;
  const END = 22;
  video.addEventListener('loadedmetadata', function () {
    video.currentTime = START;
  });
  video.addEventListener('timeupdate', function () {
    if (video.currentTime >= END) {
      video.pause();
      video.currentTime = END;
    }
  });
})();


/* ── TESTIMONIALS VIDEO: start at 9s ── */
(function initTestiVideo() {
  const video = document.getElementById('testiVideo');
  if (!video) return;
  video.addEventListener('loadedmetadata', function () {
    video.currentTime = 9;
  });
  /* On loop, jump back to 9s instead of 0 */
  video.addEventListener('timeupdate', function () {
    if (video.duration && video.currentTime >= video.duration - 0.1) {
      video.currentTime = 9;
    }
  });
})();


/* ── TESTIMONIALS AUTO-SCROLL ── */
(function initTestiScroll() {
  const carousel = document.getElementById('testiCarousel');
  if (!carousel) return;

  carousel.style.scrollBehavior = 'auto';

  /* clone cards for seamless infinite loop */
  Array.from(carousel.children).forEach(card => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    carousel.appendChild(clone);
  });

  const BASE_SPEED = 0.6;
  let targetSpeed  = BASE_SPEED;
  let currentSpeed = BASE_SPEED;
  let pos          = 0;

  /* map mouse X position within carousel to speed:
     left 30%  → slow drift left (-0.3)
     middle     → nearly stopped (0.1)
     right 30%  → fast forward (2.2)               */
  carousel.addEventListener('mousemove', e => {
    const rel = (e.clientX - carousel.getBoundingClientRect().left) / carousel.offsetWidth;
    if      (rel < 0.30) targetSpeed = -0.3;
    else if (rel > 0.70) targetSpeed =  2.2;
    else                 targetSpeed =  0.1;
  });

  carousel.addEventListener('mouseleave', () => { targetSpeed = BASE_SPEED; });

  function tick() {
    /* lerp toward target for smooth speed transitions */
    currentSpeed += (targetSpeed - currentSpeed) * 0.06;

    pos += currentSpeed;
    const half = carousel.scrollWidth / 2;
    if (pos >= half) pos -= half;
    if (pos < 0)     pos += half;
    carousel.scrollLeft = pos;

    requestAnimationFrame(tick);
  }

  tick();
})();



/* ── 3D NEURAL SPHERE (Three.js lazy-loaded on scroll) ── */
(function() {
  const canvas = document.getElementById('sphereCanvas');
  if (!canvas) return;
  /* Skip on low-perf / reduced-motion: Three.js + WebGL is expensive */
  if (document.documentElement.classList.contains('low-perf')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* Load Three.js only when sphere is about to enter viewport */
  const loadIO = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    loadIO.disconnect();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/three@0.134.0/build/three.min.js';
    s.onload = buildSphere;
    document.head.appendChild(s);
  }, { rootMargin: '400px' });
  loadIO.observe(canvas);

  function buildSphere() {
    const section  = canvas.parentElement;
    const scene    = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    camera.position.z = 7;

    function resize() {
      const w = Math.round(section.offsetWidth * 0.52);
      const h = section.offsetHeight || 600;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    const GOLD       = 0xb8973f; /* gold-deep — richer, more saturated */
    const GOLD_LIGHT = 0xdbc078; /* warm gold highlight */
    const group = new THREE.Group();
    scene.add(group);

    const outerMesh = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(2.2, 22, 22)),
      new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.65 })
    );
    group.add(outerMesh);

    const innerMesh = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(1.15, 14, 14)),
      new THREE.LineBasicMaterial({ color: GOLD_LIGHT, transparent: true, opacity: 0.9 })
    );
    group.add(innerMesh);

    const N    = 80;
    const pPos = new Float32Array(N * 3);
    const pVel = [];
    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 1.5 + Math.random() * 1.8;
      pPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pPos[i * 3 + 2] = r * Math.cos(phi);
      pVel.push({ vx: (Math.random()-0.5)*0.006, vy: (Math.random()-0.5)*0.006, vz: (Math.random()-0.5)*0.006 });
    }
    const dotAttr = new THREE.BufferAttribute(pPos, 3);
    dotAttr.setUsage(THREE.DynamicDrawUsage);
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', dotAttr);
    group.add(new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: GOLD_LIGHT, size: 0.14, transparent: true, opacity: 1.0 })));

    const lBuf     = new Float32Array(N * N * 6);
    const lineAttr = new THREE.BufferAttribute(lBuf, 3);
    lineAttr.setUsage(THREE.DynamicDrawUsage);
    const lineGeo  = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', lineAttr);
    lineGeo.setDrawRange(0, 0);
    group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.55 })));

    let mx = 0, my = 0;
    window.addEventListener('mousemove', e => {
      mx = e.clientX / window.innerWidth  - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    });

    let t = 0, sphereVisible = true;
    new IntersectionObserver(e => { sphereVisible = e[0].isIntersecting; }, { rootMargin: '200px' }).observe(canvas);

    (function tick() {
      requestAnimationFrame(tick);
      if (!sphereVisible || document.hidden) return;
      t += 0.007;
      outerMesh.rotation.y += 0.0022; outerMesh.rotation.x += 0.0009;
      innerMesh.rotation.y -= 0.004;  innerMesh.rotation.z += 0.002;
      outerMesh.scale.setScalar(1 + Math.sin(t * 0.9) * 0.025);
      group.position.y = Math.sin(t * 0.8) * 0.2;
      group.rotation.y += (mx * 0.8 - group.rotation.y) * 0.1;
      group.rotation.x += (my * 0.6 - group.rotation.x) * 0.1;
      for (let i = 0; i < N; i++) {
        const v = pVel[i];
        pPos[i*3] += v.vx; pPos[i*3+1] += v.vy; pPos[i*3+2] += v.vz;
        const d2 = pPos[i*3]**2 + pPos[i*3+1]**2 + pPos[i*3+2]**2;
        if (d2 > 12.25 || d2 < 1.44) { v.vx *= -1; v.vy *= -1; v.vz *= -1; }
      }
      dotAttr.needsUpdate = true;
      const CONN2 = 2.56; let li = 0;
      for (let i = 0; i < N; i++) for (let j = i+1; j < N; j++) {
        const dx = pPos[i*3]-pPos[j*3], dy = pPos[i*3+1]-pPos[j*3+1], dz = pPos[i*3+2]-pPos[j*3+2];
        if (dx*dx+dy*dy+dz*dz < CONN2) {
          lBuf[li++]=pPos[i*3]; lBuf[li++]=pPos[i*3+1]; lBuf[li++]=pPos[i*3+2];
          lBuf[li++]=pPos[j*3]; lBuf[li++]=pPos[j*3+1]; lBuf[li++]=pPos[j*3+2];
        }
      }
      lineAttr.needsUpdate = true;
      lineGeo.setDrawRange(0, li / 3);
      renderer.render(scene, camera);
    })();
  }
})();


/* ── NEURAL HEAD ── */
(function initNeural() {
  const canvas = document.getElementById('dnaCanvas');
  if (!canvas) return;
  /* Skip on low-perf / reduced-motion: canvas redraw at 60fps is costly */
  if (document.documentElement.classList.contains('low-perf')) { canvas.style.display = 'none'; return; }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { canvas.style.display = 'none'; return; }

  const section = canvas.parentElement;
  const ctx     = canvas.getContext('2d');
  const COUNT   = 80;   /* reduced from 140 — halves O(n²) line checks */
  const CONNECT = 220;

  /* head ellipse params — recomputed on resize */
  let cx, cy, rx, ry;

  function resize() {
    canvas.width  = section.offsetWidth;
    canvas.height = section.offsetHeight;
    /* right-side head: centred at ~78% across, ~50% down */
    cx = canvas.width  * 0.78;
    cy = canvas.height * 0.50;
    rx = canvas.width  * 0.16;   /* horizontal radius */
    ry = canvas.height * 0.40;   /* vertical radius — taller than wide */
  }

  /* point-in-ellipse check */
  function inHead(x, y) {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  function randInHead() {
    let x, y, tries = 0;
    do {
      x = cx + (Math.random() * 2 - 1) * rx;
      y = cy + (Math.random() * 2 - 1) * ry;
      tries++;
    } while (!inHead(x, y) && tries < 60);
    return { x, y };
  }

  resize();
  window.addEventListener('resize', resize);

  const particles = Array.from({ length: COUNT }, () => {
    const pt = randInHead();
    return {
      x: pt.x, y: pt.y,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r:  1.8 + Math.random() * 2.2,
      deep: Math.random() > 0.5 /* half deep-gold, half light-gold for depth */
    };
  });

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* move + bounce inside ellipse */
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (!inHead(p.x, p.y)) {
        p.vx *= -1;
        p.vy *= -1;
        p.x  += p.vx * 2;
        p.y  += p.vy * 2;
        if (!inHead(p.x, p.y)) {
          const pt = randInHead();
          p.x = pt.x; p.y = pt.y;
        }
      }
    });

    /* lines — deeper gold, higher alpha, slightly thicker */
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT) {
          const alpha = (1 - dist / CONNECT) * 0.7;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(184,151,63,${alpha})`; /* gold-deep */
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    }

    /* dots — all gold, two tones for depth, with soft glow */
    particles.forEach(p => {
      /* outer soft glow */
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.4);
      grad.addColorStop(0,   'rgba(219,192,120,0.55)');
      grad.addColorStop(0.5, 'rgba(219,192,120,0.15)');
      grad.addColorStop(1,   'rgba(219,192,120,0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3.4, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      /* core dot */
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.deep
        ? 'rgba(184,151,63,0.95)'    /* gold-deep */
        : 'rgba(230,211,160,0.95)';  /* gold-light */
      ctx.fill();
    });

    if (neuralVisible && !document.hidden) requestAnimationFrame(draw);
  }

  let neuralVisible = false;
  const neuralIO = new IntersectionObserver(e => {
    neuralVisible = e[0].isIntersecting;
    if (neuralVisible) requestAnimationFrame(draw);
  }, { rootMargin: '150px' });
  neuralIO.observe(canvas);
})();


/* ping-pong video removed — rAF-driven reverse decode was extremely CPU-intensive */




/* ── CUSTOM CURSOR (desktop / pointer: fine only, and not low-perf) ── */
(function initCursor() {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (document.documentElement.classList.contains('low-perf')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ring = document.getElementById('cursorRing');
  if (!ring) return;

  const CLICKABLE = 'a, button, [role="button"], label[for], input[type="submit"], input[type="button"], select, .cursor-pointer';

  document.addEventListener('mousemove', e => {
    ring.style.left = e.clientX + 'px';
    ring.style.top  = e.clientY + 'px';
    const hit = e.target && e.target.closest ? e.target.closest(CLICKABLE) : null;
    ring.classList.toggle('is-active', !!hit);
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    ring.classList.remove('is-active');
  });
})();


/* ── NAV DROPDOWNS: keyboard + click ── */
(function initDropdowns() {
  document.querySelectorAll('.nav-drop').forEach(drop => {
    const trigger = drop.querySelector('.nav-drop-trigger');
    const menu    = drop.querySelector('.nav-drop-menu');
    if (!trigger || !menu) return;

    trigger.addEventListener('click', () => {
      const open = drop.classList.toggle('open');
      trigger.setAttribute('aria-expanded', open);
    });

    document.addEventListener('click', e => {
      if (!drop.contains(e.target)) {
        drop.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });
})();

/* ── NAV: scroll shadow + active link + hamburger ── */
(function initNav() {
  const nav = document.querySelector('nav');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  const hamburger = document.getElementById('navHamburger');
  const drawer = document.getElementById('navDrawer');
  const drawerLinks = document.querySelectorAll('.nav-drawer a');

  // Scroll shadow
  window.addEventListener('scroll', () => {
    if (window.scrollY > 10) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }, { passive: true });

  // Active link tracking
  const sections = document.querySelectorAll('section[id]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => observer.observe(s));

  // Hamburger toggle
  if (hamburger && drawer) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('open');
      drawer.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', open);
    });

    // Close drawer on link click
    drawerLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        drawer.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (!nav.contains(e.target) && !drawer.contains(e.target)) {
        hamburger.classList.remove('open');
        drawer.classList.remove('open');
      }
    });
  }
})();


/* ── SCROLL REVEAL ──
   Triggers .in on any .reveal or .reveal-cascade as soon as ~15%
   of the element has crossed the viewport bottom. */
(function initReveal() {
  const els = document.querySelectorAll('.reveal, .reveal-cascade');
  if (!els.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  els.forEach(el => observer.observe(el));
})();


/* ── EPISODE HERO: thumbnail → inline iframe on click (delegated) ── */
(function initEpHero() {
  const hero = document.querySelector('.ep-hero');
  if (!hero) return;

  // Scroll-triggered entrance animation
  const obs = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { hero.classList.add('ep-hero--visible'); obs.disconnect(); }
  }, { threshold: 0.2 });
  obs.observe(hero);

  // Delegated play handler — survives hero media being replaced by initEpList
  const media = hero.querySelector('.ep-hero-media');
  if (!media) return;
  media.addEventListener('click', e => {
    const btn = e.target.closest('.ep-hero-play');
    if (!btn) return;
    const vid = btn.dataset.video;
    if (!vid) return;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&rel=0`;
    iframe.title = btn.getAttribute('aria-label') || 'Episode player';
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    iframe.setAttribute('allowfullscreen', '');
    btn.replaceWith(iframe);
  });
})();


/* ── EPISODE LIST: click row → update hero at top + staggered reveal ── */
(function initEpList() {
  const rows = document.querySelectorAll('.ep-row');
  if (!rows.length) return;

  // Click row → swap hero content and scroll to it
  rows.forEach(row => {
    row.addEventListener('click', () => {
      const hero = document.querySelector('.ep-hero');
      if (!hero) return;

      const vid     = row.dataset.video || '';
      const cat     = row.dataset.cat   || '';
      const num     = row.querySelector('.ep-num')?.textContent     || '';
      const guest   = row.querySelector('.ep-guest')?.textContent   || '';
      const company = row.querySelector('.ep-company')?.textContent || '';
      const topic   = row.querySelector('.ep-topic')?.textContent   || '';
      const catLbl  = row.querySelector('.ep-cat')?.textContent     || '';

      // Category colour
      hero.dataset.cat = cat;

      // Reset media to thumbnail (stops any playing video)
      const media = hero.querySelector('.ep-hero-media');
      media.innerHTML =
        `<button class="ep-hero-play" type="button" aria-label="Play ${num} — ${guest}" data-video="${vid}">` +
        `<img src="https://img.youtube.com/vi/${vid}/maxresdefault.jpg" alt="" loading="lazy" />` +
        `<span class="ep-hero-play-icon" aria-hidden="true">` +
        `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M7 4.5L17 11L7 17.5V4.5Z" fill="currentColor"/></svg>` +
        `</span></button>`;

      // Update meta text
      hero.querySelector('.ep-hero-num').textContent = num;
      hero.querySelector('.ep-hero-guest').textContent = guest;
      const compEl = hero.querySelector('.ep-hero-company');
      if (company) { compEl.textContent = company; compEl.hidden = false; }
      else { compEl.hidden = true; }
      hero.querySelector('.ep-hero-topic').textContent = topic;
      hero.querySelector('.ep-hero-cat').textContent = catLbl;

      // Re-trigger entrance stagger
      hero.classList.remove('ep-hero--visible');
      void hero.offsetWidth;
      hero.classList.add('ep-hero--visible');

      // Scroll hero into view
      hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    rows.forEach(r => r.classList.add('is-in'));
    return;
  }

  // Above-fold rows: reveal on load with base 100ms + 40ms stagger
  const viewportH = window.innerHeight;
  let aboveFoldCount = 0;
  rows.forEach(row => {
    const rect = row.getBoundingClientRect();
    if (rect.top < viewportH && rect.bottom > 0) {
      const delay = 100 + aboveFoldCount * 40;
      aboveFoldCount++;
      setTimeout(() => row.classList.add('is-in'), delay);
      row.dataset.handled = '1';
    }
  });

  // Below-fold rows: IntersectionObserver with stagger per visibility batch
  let batchIndex = 0;
  let lastFireTime = 0;
  const observer = new IntersectionObserver(entries => {
    const becoming = entries
      .filter(e => e.isIntersecting && !e.target.classList.contains('is-in'));
    // Reset batch if it's been a while since last reveal
    const now = performance.now();
    if (now - lastFireTime > 300) batchIndex = 0;
    becoming.forEach(entry => {
      const delay = batchIndex * 40;
      batchIndex++;
      setTimeout(() => entry.target.classList.add('is-in'), delay);
      lastFireTime = now;
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  rows.forEach(row => {
    if (row.dataset.handled !== '1') observer.observe(row);
  });
})();



/* ── COUNTER ANIMATION ── */
(function initCounters() {
  const nums = document.querySelectorAll('.metric-num[data-count]');
  if (!nums.length) return;

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateCounter(el, target, decimals, duration) {
    const start = performance.now();
    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const current = easeOut(progress) * target;
      el.textContent = current.toFixed(decimals);
      if (progress < 1) requestAnimationFrame(update);
      else el.textContent = decimals > 0 ? target.toFixed(decimals) : target.toString();
    }
    requestAnimationFrame(update);
  }

  const metricsSection = document.querySelector('.hero-metrics');
  if (!metricsSection) return;

  let started = false;
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !started) {
      started = true;
      nums.forEach(el => {
        const target   = parseFloat(el.dataset.count);
        const decimals = parseInt(el.dataset.decimals || '0', 10);
        animateCounter(el, target, decimals, 2000);
      });
      observer.disconnect();
    }
  }, { threshold: 0.5 });

  observer.observe(metricsSection);
})();


/* ── FAQ ACCORDION ── */
(function initFaq() {
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');

      // Close all
      document.querySelectorAll('.faq-item.open').forEach(el => {
        el.classList.remove('open');
        el.querySelector('.faq-a').style.maxHeight = null;
      });

      // Open clicked (if it wasn't already open)
      if (!isOpen) {
        item.classList.add('open');
        const answer = item.querySelector('.faq-a');
        const inner = item.querySelector('.faq-a-inner');
        answer.style.maxHeight = inner.scrollHeight + 32 + 'px';
      }
    });

    // Keyboard accessibility
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });

  // Open first item by default
  const firstItem = document.querySelector('.faq-item');
  if (firstItem) {
    firstItem.classList.add('open');
    const answer = firstItem.querySelector('.faq-a');
    const inner = firstItem.querySelector('.faq-a-inner');
    if (answer && inner) {
      answer.style.maxHeight = inner.scrollHeight + 32 + 'px';
    }
  }
})();


/* ── PROCESS TIMELINE: animate dot on scroll ── */
(function initProcessTimeline() {
  const pvSteps = document.querySelectorAll('.pv-step');
  const processSteps = document.querySelectorAll('.process-step');
  if (!pvSteps.length || !processSteps.length) return;

  let currentActive = 0;

  function setActive(idx) {
    pvSteps.forEach((step, i) => {
      const dot = step.querySelector('.pv-dot');
      step.classList.toggle('active', i === idx);
      if (dot) dot.classList.toggle('active', i === idx);
    });
    currentActive = idx;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = Array.from(processSteps).indexOf(entry.target);
        if (idx !== -1) setActive(idx);
      }
    });
  }, { threshold: 0.5, rootMargin: '0px 0px -30% 0px' });

  processSteps.forEach(step => observer.observe(step));
})();


/* ── BACK TO TOP ── */
(function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });

  btn.addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();


/* ── TICKER pause on hover (already in CSS, but ensure JS fallback) ── */
(function initTicker() {
  const track = document.querySelector('.ticker-track');
  if (!track) return;

  // Duplicate content for seamless loop if not already doubled
  const items = track.innerHTML;
  if (!track.dataset.doubled) {
    track.innerHTML = items + items;
    track.dataset.doubled = 'true';
  }
})();


/* ── SMOOTH SCROLL for all anchor links ── */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const href = anchor.getAttribute('href');
      if (href === '#') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const navHeight = document.querySelector('nav')?.offsetHeight || 72;
        const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 16;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
})();


/* ── HERO PARALLAX (background + content exit) ── */
(function initHeroParallax() {
  const hero      = document.querySelector('.hero');
  const heroInner = document.querySelector('.hero-inner');
  const heroDeco  = document.querySelector('.hero-deco');
  const heroVideo = document.getElementById('heroVideo');
  if (!hero || !heroInner) return;

  /* Respect low-perf + reduced-motion — skip all parallax writes */
  const isLowPerf = document.documentElement.classList.contains('low-perf');
  const reduced   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isLowPerf || reduced) return;

  let heroHeight = hero.offsetHeight;
  window.addEventListener('resize', () => { heroHeight = hero.offsetHeight; }, { passive: true });

  let ticking = false;
  let lastScroll = -1;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollY = window.scrollY;
      /* Skip if scroll hasn't changed (touchpad idle events) */
      if (scrollY === lastScroll) { ticking = false; return; }
      /* Don't animate once the hero is fully scrolled past */
      if (scrollY > heroHeight * 1.1) { ticking = false; lastScroll = scrollY; return; }
      lastScroll = scrollY;

      const progress = Math.min(scrollY / heroHeight, 1);
      heroInner.style.opacity   = String(Math.max(0, 1 - progress * 2.4));
      heroInner.style.transform = `translateY(${-progress * 80}px)`;
      if (heroVideo) {
        heroVideo.style.transform = `translate(-50%, calc(-50% + ${scrollY * 0.18}px))`;
      }
      if (heroDeco) heroDeco.style.transform = `translateY(${progress * 28}px)`;

      ticking = false;
    });
  }, { passive: true });
})();


/* ── MANIFESTO WORD-BY-WORD REVEAL ── */
(function initWordReveal() {
  const quote = document.querySelector('.manifesto-quote');
  if (!quote) return;
  /* On low-perf / reduced-motion: show all words fully lit, no per-scroll work */
  const low = document.documentElement.classList.contains('low-perf');
  const rm  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (low || rm) {
    quote.style.opacity = '1';
    return;
  }

  // Walk DOM tree, wrap each word in a span (preserves <strong>, <br> etc.)
  function wrapWords(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parts = node.textContent.split(/(\s+)/);
      const frag = document.createDocumentFragment();
      parts.forEach(part => {
        if (!part || /^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement('span');
          span.className = 'word-reveal';
          span.textContent = part;
          frag.appendChild(span);
        }
      });
      node.parentNode.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      Array.from(node.childNodes).forEach(wrapWords);
    }
  }

  wrapWords(quote);
  const words = Array.from(quote.querySelectorAll('.word-reveal'));
  const vh = window.innerHeight;

  function update() {
    const top = quote.getBoundingClientRect().top;
    const progress = (vh - top) / (vh * 0.9);
    words.forEach((word, i) => {
      word.classList.toggle('lit', progress > (i / words.length) * 0.85);
    });
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }, { passive: true });
  update();
})();


/* ── SERVICES CAROUSEL ── */
(function initServiceCarousel() {
  const carousel = document.getElementById('svcCarousel');
  if (!carousel) return;

  // Duplicate cards for seamless infinite loop (guard against double-init)
  if (!carousel.dataset.doubled) {
    carousel.innerHTML += carousel.innerHTML;
    carousel.dataset.doubled = 'true';
  }

  const dots     = Array.from(document.querySelectorAll('.svc-dot'));
  const prevBtn  = document.querySelector('.svc-nav-prev');
  const nextBtn  = document.querySelector('.svc-nav-next');

  const SLOW_SPEED   = 0.5;
  const FAST_SPEED   = 2.0;
  const PAUSE_MS     = 4000;
  const CARD_COUNT   = 5;
  let speed          = SLOW_SPEED;
  let paused         = false;
  let pauseTimer     = null;
  let dragging       = false;
  let dragStart      = 0;
  let dragScroll     = 0;

  // Cache layout values — only recompute on resize
  let cCardWidth = 0;
  let cHalfWidth = 0;
  function updateCache() {
    const card = carousel.querySelector('.svc-card');
    cCardWidth = card ? card.offsetWidth + 16 : 0;
    cHalfWidth = carousel.scrollWidth / 2;
  }
  updateCache();
  window.addEventListener('resize', updateCache, { passive: true });

  function currentIndex() {
    return Math.round((carousel.scrollLeft % cHalfWidth) / cCardWidth) % CARD_COUNT;
  }

  function updateDots() {
    const idx = currentIndex();
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  function pauseFor(ms = PAUSE_MS) {
    paused = true;
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => { paused = false; }, ms);
  }

  function goTo(idx) {
    // Wrap negative indices
    idx = ((idx % CARD_COUNT) + CARD_COUNT) % CARD_COUNT;
    let target = idx * cCardWidth;
    const sets = Math.floor(carousel.scrollLeft / cHalfWidth);
    target += sets * cHalfWidth;
    if (target < carousel.scrollLeft - cCardWidth * 0.5) target += cHalfWidth;

    pauseFor();
    carousel.style.scrollBehavior = 'smooth';
    carousel.scrollLeft = target;
    setTimeout(() => { carousel.style.scrollBehavior = ''; }, 600);
    updateDots();
  }

  function tick() {
    if (!paused && !dragging) {
      carousel.scrollLeft += speed;
      if (carousel.scrollLeft >= cHalfWidth) carousel.scrollLeft -= cHalfWidth;
      updateDots();
    }
    requestAnimationFrame(tick);
  }

  // Hover speeds up the glide
  carousel.addEventListener('mouseenter', () => { speed = FAST_SPEED; });
  carousel.addEventListener('mouseleave', () => { speed = SLOW_SPEED; });

  // Arrow buttons
  prevBtn?.addEventListener('click', () => goTo(currentIndex() - 1));
  nextBtn?.addEventListener('click', () => goTo(currentIndex() + 1));

  // Dot clicks
  dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));

  // Drag to scrub
  carousel.addEventListener('mousedown', e => {
    dragging   = true;
    dragStart  = e.pageX;
    dragScroll = carousel.scrollLeft;
    carousel.style.cursor = 'grabbing';
    pauseFor(4000);
  });
  carousel.addEventListener('mousemove', e => {
    if (!dragging) return;
    carousel.scrollLeft = dragScroll - (e.pageX - dragStart);
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    carousel.style.cursor = '';
  });

  requestAnimationFrame(tick);
})();


/* ── TESTIMONIALS CAROUSEL ── */
(function initTestiCarousel() {
  const carousel = document.getElementById('testiCarousel');
  if (!carousel) return;

  if (!carousel.dataset.doubled) {
    carousel.innerHTML += carousel.innerHTML;
    carousel.dataset.doubled = 'true';
  }

  const dots    = Array.from(document.querySelectorAll('.testi-dot'));
  const prevBtn = document.querySelector('.testi-nav-prev');
  const nextBtn = document.querySelector('.testi-nav-next');

  const SLOW_SPEED = 0.4;
  const FAST_SPEED = 1.8;
  const PAUSE_MS   = 4000;
  const CARD_COUNT = 3;
  let speed      = SLOW_SPEED;
  let paused     = false;
  let pauseTimer = null;
  let dragging   = false;
  let dragStart  = 0;
  let dragScroll = 0;

  let cCardWidth = 0;
  let cHalfWidth = 0;
  function updateCache() {
    const card = carousel.querySelector('.svc-card');
    cCardWidth = card ? card.offsetWidth + 16 : 0;
    cHalfWidth = carousel.scrollWidth / 2;
  }
  updateCache();
  window.addEventListener('resize', updateCache, { passive: true });

  function currentIndex() {
    return Math.round((carousel.scrollLeft % cHalfWidth) / cCardWidth) % CARD_COUNT;
  }

  function updateDots() {
    const idx = currentIndex();
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  function pauseFor(ms = PAUSE_MS) {
    paused = true;
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => { paused = false; }, ms);
  }

  function goTo(idx) {
    idx = ((idx % CARD_COUNT) + CARD_COUNT) % CARD_COUNT;
    let target = idx * cCardWidth;
    const sets = Math.floor(carousel.scrollLeft / cHalfWidth);
    target += sets * cHalfWidth;
    if (target < carousel.scrollLeft - cCardWidth * 0.5) target += cHalfWidth;
    pauseFor();
    carousel.style.scrollBehavior = 'smooth';
    carousel.scrollLeft = target;
    setTimeout(() => { carousel.style.scrollBehavior = ''; }, 600);
    updateDots();
  }

  function tick() {
    if (!paused && !dragging) {
      carousel.scrollLeft += speed;
      if (carousel.scrollLeft >= cHalfWidth) carousel.scrollLeft -= cHalfWidth;
      updateDots();
    }
    requestAnimationFrame(tick);
  }

  carousel.addEventListener('mouseenter', () => { speed = FAST_SPEED; });
  carousel.addEventListener('mouseleave', () => { speed = SLOW_SPEED; });

  prevBtn?.addEventListener('click', () => goTo(currentIndex() - 1));
  nextBtn?.addEventListener('click', () => goTo(currentIndex() + 1));
  dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));

  carousel.addEventListener('mousedown', e => {
    dragging   = true;
    dragStart  = e.pageX;
    dragScroll = carousel.scrollLeft;
    carousel.style.cursor = 'grabbing';
    pauseFor(4000);
  });
  carousel.addEventListener('mousemove', e => {
    if (!dragging) return;
    carousel.scrollLeft = dragScroll - (e.pageX - dragStart);
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    carousel.style.cursor = '';
  });

  requestAnimationFrame(tick);
})();


/* ── CATEGORY NAV: active pill tracking ── */
(function initCatNav() {
  const pills = document.querySelectorAll('.cat-pill[data-section]');
  if (!pills.length) return;

  const sections = Array.from(pills).map(p => document.getElementById(p.dataset.section)).filter(Boolean);

  function setActive(id) {
    pills.forEach(p => p.classList.toggle('active', p.dataset.section === id));
    // Scroll active pill into view within the nav strip
    const active = document.querySelector(`.cat-pill[data-section="${id}"]`);
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) setActive(entry.target.id);
    });
  }, { rootMargin: '-30% 0px -65% 0px' });

  sections.forEach(s => observer.observe(s));
})();


/* ── SECTION SNAP (FAQ + CTA) ── */
(function initSectionSnap() {
  const targets = ['#faq', '#contact']
    .map(id => document.querySelector(id))
    .filter(Boolean);

  if (!targets.length) return;

  const nav   = document.querySelector('nav');
  const navH  = () => nav ? nav.offsetHeight : 72;

  let timer  = null;
  let locked = false;

  function trySnap() {
    if (locked) return;
    const vh = window.innerHeight;

    for (const el of targets) {
      /* Distance from the bottom of the nav to the section top */
      const gap = el.getBoundingClientRect().top - navH();

      /* Snap when the section has entered view but isn't aligned yet.
         Lower bound -60: allow snapping even if we've scrolled 60px past the top.
         Upper bound vh*0.5: only snap when the section is in the top half of viewport. */
      if (gap > -60 && gap < vh * 0.5 && Math.abs(gap) > 6) {
        locked = true;
        window.scrollTo({ top: window.scrollY + gap, behavior: 'smooth' });
        /* Unlock after the smooth scroll animation finishes (~700ms) */
        setTimeout(() => { locked = false; }, 750);
        return;
      }
    }
  }

  window.addEventListener('scroll', () => {
    if (locked) return;
    clearTimeout(timer);
    /* Wait for the scroll to naturally settle before snapping */
    timer = setTimeout(trySnap, 80);
  }, { passive: true });
})();


/* ── KINETIC HEADING ANIMATIONS ── */
(function initHeadingAnimations() {

  /* Split el's direct children into word-level spans.
     Text nodes  → one span per word (split on whitespace).
     Element nodes (em, span, etc.) → one span wrapping the whole element.
     BR nodes → left in place unchanged. */
  function splitWords(el, makeWrap) {
    let wi = 0;
    Array.from(el.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const parts = node.textContent.split(/(\s+)/);
        const frag  = document.createDocumentFragment();
        parts.forEach(part => {
          if (/^\s*$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else {
            frag.appendChild(makeWrap(part, null, wi++));
          }
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR') {
        node.parentNode.replaceChild(makeWrap(null, node.cloneNode(true), wi++), node);
      }
    });
  }

  /* Hero: flat .hw-word spans with blur cascade */
  const heroEl = document.querySelector('.hero-headline');
  if (heroEl) {
    splitWords(heroEl, (text, elem, i) => {
      const s = document.createElement('span');
      s.className = 'hw-word';
      s.style.setProperty('--wi', i);
      if (text !== null) s.textContent = text;
      else s.appendChild(elem);
      return s;
    });
    heroEl.setAttribute('data-split', '');
    requestAnimationFrame(() => heroEl.classList.add('hd-ready'));
  }

  /* Section headings + CTA: .sh-clip > .sh-inner clip-slide words */
  function splitClip(el) {
    splitWords(el, (text, elem, i) => {
      const outer = document.createElement('span');
      outer.className = 'sh-clip';
      outer.style.setProperty('--wi', i);
      const inner = document.createElement('span');
      inner.className = 'sh-inner';
      if (text !== null) inner.textContent = text;
      else inner.appendChild(elem);
      outer.appendChild(inner);
      return outer;
    });
    el.classList.remove('reveal');
    el.style.opacity = '0';
  }

  const headings = document.querySelectorAll('.section-heading');
  headings.forEach(splitClip);

  const ctaEl = document.querySelector('.cta-heading');
  if (ctaEl) splitClip(ctaEl);

  /* Kickers: blur fade-up — no split, just a class swap */
  const kickers = document.querySelectorAll('.section-kicker');
  kickers.forEach(el => {
    el.classList.remove('reveal');
    el.setAttribute('data-split', '');
  });

  /* IntersectionObserver: reveal on scroll */
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.style.opacity = '';
      el.classList.add('hd-ready');
      io.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

  headings.forEach(el => io.observe(el));
  kickers.forEach(el => io.observe(el));
  if (ctaEl) io.observe(ctaEl);

})();


/* Theme toggle removed — site is always dark */


/* ── NEWSLETTER FORM ── */
(function initNewsletter() {
  const form    = document.getElementById('newsletterForm');
  const success = document.getElementById('newsletterSuccess');
  if (!form || !success) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = form.querySelector('.newsletter-input');
    if (!input.value || !input.validity.valid) return;

    form.style.opacity = '0';
    form.style.transform = 'translateY(-8px)';
    form.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

    setTimeout(() => {
      form.hidden = true;
      success.hidden = false;
    }, 300);
  });
})();


/* CTA dotted surface is now pure CSS — no JS needed */


/* ── LAZY VIDEO LOAD ──
   Sources use data-src so the browser never downloads the file on page load.
   After window.load + idle, we inject the real src and fade in.
   The hero bg is already solid forest green, so there is no visual jump.     ── */
(function initLazyVideo() {
  function hydrateVideo(video) {
    const source = video.querySelector('source[data-src]');
    if (!source) return;
    source.src = source.dataset.src;
    video.load();
    video.addEventListener('canplay', function () {
      video.play().catch(() => {});
      video.classList.add('loaded');
    }, { once: true });
  }

  function loadAll() {
    document.querySelectorAll('video').forEach(hydrateVideo);
  }

  if (document.readyState === 'complete') {
    /* Already loaded — kick off after current paint */
    requestAnimationFrame(() => setTimeout(loadAll, 100));
  } else {
    window.addEventListener('load', () => {
      requestAnimationFrame(() => setTimeout(loadAll, 100));
    });
  }
})();

/* ══════════════════════════════════════════════════
   EXPLORE STEPPER
   Progressive disclosure — one page at a time.
   Left track: sticky numbered list (desktop).
   Right stage: animated panel with prev/next arrows.
══════════════════════════════════════════════════ */
(function initExploreStepper() {
  const stepper = document.getElementById('exploreStepper');
  if (!stepper) return;

  const trackSteps  = stepper.querySelectorAll('.stepper-step');
  const stageItems  = stepper.querySelectorAll('.stepper-item');
  const fill        = document.getElementById('stepperFill');
  const total       = stageItems.length;
  let current       = 0;

  /* Wire every set of prev/next arrows inside the stage */
  function bindArrows(item, idx) {
    item.querySelectorAll('.stepper-arrow-prev').forEach(btn => {
      btn.addEventListener('click', () => go(current - 1, -1));
    });
    item.querySelectorAll('.stepper-arrow-next').forEach(btn => {
      btn.addEventListener('click', () => go(current + 1,  1));
    });
  }
  stageItems.forEach(bindArrows);

  /* Left track clicks */
  trackSteps.forEach((step, i) => {
    step.addEventListener('click', () => go(i, i > current ? 1 : -1));
  });

  function go(idx, dir) {
    if (idx < 0 || idx >= total || idx === current) return;

    /* Hide current */
    const prev = stageItems[current];
    prev.classList.remove('is-active', 'dir-prev');

    /* Show next */
    current = idx;
    const next = stageItems[current];
    next.classList.remove('dir-prev'); // reset
    if (dir < 0) next.classList.add('dir-prev');
    next.classList.add('is-active');

    /* Update left track */
    trackSteps.forEach((s, i) => s.classList.toggle('is-active', i === current));

    /* Update progress bar */
    if (fill) fill.style.width = ((current + 1) / total * 100) + '%';

    /* Disable arrows at boundaries */
    syncArrowState();
  }

  function syncArrowState() {
    stageItems.forEach((item, i) => {
      item.querySelectorAll('.stepper-arrow-prev').forEach(b => { b.disabled = (i === 0); });
      item.querySelectorAll('.stepper-arrow-next').forEach(b => { b.disabled = (i === total - 1); });
    });
  }

  /* Initialise: show first item */
  stageItems[0].classList.add('is-active');
  trackSteps[0] && trackSteps[0].classList.add('is-active');
  syncArrowState();
})();


/* ══════════════════════════════════════════════════
   PAGE-WIDE DATA STREAMS
   Three fixed-position fiber-optic pulses travel
   downward through the whole page. Injected via JS
   so every page gets them without editing each HTML.
   ══════════════════════════════════════════════════ */
(function injectDataStreams() {
  if (document.querySelector('.page-data-streams')) return;
  if (document.documentElement.classList.contains('low-perf')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const wrap = document.createElement('div');
  wrap.className = 'page-data-streams';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML =
    '<div class="data-stream data-stream-1"><span class="data-pulse"></span></div>' +
    '<div class="data-stream data-stream-2"><span class="data-pulse"></span></div>' +
    '<div class="data-stream data-stream-3"><span class="data-pulse"></span></div>';
  document.body.appendChild(wrap);
})();


/* ══════════════════════════════════════════════════
   MOUSE PARALLAX
   Subtle translate (≤12px) on wireframe + ring +
   arc elements based on cursor position. Uses
   translate: property so it composes with the
   existing transform-based rotations.
   ══════════════════════════════════════════════════ */
(function initMouseParallax() {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (document.documentElement.classList.contains('low-perf')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const MAX = 12;
  let targetX = 0, targetY = 0;
  let px = 0, py = 0;
  let ticking = false;

  function onMove(e) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    /* normalised −1 … +1 */
    targetX = (e.clientX / w - 0.5) * 2;
    targetY = (e.clientY / h - 0.5) * 2;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(tick);
    }
  }

  function tick() {
    /* lerp toward target for a smooth follow */
    px += (targetX * MAX - px) * 0.08;
    py += (targetY * MAX - py) * 0.08;
    document.documentElement.style.setProperty('--px', px.toFixed(2) + 'px');
    document.documentElement.style.setProperty('--py', py.toFixed(2) + 'px');
    if (Math.abs(targetX * MAX - px) > 0.1 || Math.abs(targetY * MAX - py) > 0.1) {
      requestAnimationFrame(tick);
    } else {
      ticking = false;
    }
  }

  window.addEventListener('mousemove', onMove, { passive: true });
})();


/* ══════════════════════════════════════════════════
   GENERALISED COUNT-UP
   Any element with [data-count] animates from 0 to
   its target when it enters the viewport. Optional
   [data-duration] (ms) and [data-decimals] attrs.
   If target === 0, the element pulses instead.
   ══════════════════════════════════════════════════ */
(function initCountUpGeneric() {
  const targets = document.querySelectorAll('[data-count]');
  if (!targets.length) return;

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function animate(el, target, duration) {
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const start = performance.now();
    (function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      const current = easeOut(p) * target;
      el.textContent = decimals > 0
        ? current.toFixed(decimals)
        : Math.round(current).toString();
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = decimals > 0 ? target.toFixed(decimals) : target.toString();
    })(start);
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      if (el.dataset.counted) return;
      el.dataset.counted = '1';
      const target = parseFloat(el.dataset.count);
      const duration = parseInt(el.dataset.duration || '1400', 10);
      if (target === 0) {
        el.textContent = '0';
        el.classList.add('has-pulsed');
      } else {
        animate(el, target, duration);
      }
      io.unobserve(el);
    });
  }, { threshold: 0.5 });

  targets.forEach(t => io.observe(t));
})();


/* ══════════════════════════════════════════════════
   NAV — FROSTED BLUR BOOST PAST HERO
   Adds .is-past-hero once the user has scrolled
   beyond the hero/page-hero height. Works on all
   pages regardless of which hero variant they use.
   ══════════════════════════════════════════════════ */
(function initNavBlurBoost() {
  const nav = document.querySelector('nav');
  if (!nav) return;

  const heroEl = document.querySelector('.hero, .page-hero');
  const threshold = () => heroEl ? heroEl.offsetHeight - 80 : 240;

  let past = false;
  function check() {
    const over = window.scrollY > threshold();
    if (over !== past) {
      past = over;
      nav.classList.toggle('is-past-hero', over);
    }
  }

  window.addEventListener('scroll', check, { passive: true });
  check();
})();


/* ══════════════════════════════════════════════════
   FILTER PILLS — case studies + podcast
   Buttons with [data-filter] toggle visibility on
   sibling cards with matching [data-category].
   "all" shows everything.
   ══════════════════════════════════════════════════ */
(function initFilterPills() {
  const pills = document.querySelectorAll('.filter-pill[data-filter]');
  if (!pills.length) return;

  /* Find the cards container — the .filter-bar's next .*-grid sibling, or any
     element on the page containing matching [data-category] children. */
  function getCards() {
    return document.querySelectorAll('[data-category]');
  }

  function applyFilter(filter) {
    const cards = getCards();
    cards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      if (match) {
        card.style.display = '';
        card.removeAttribute('aria-hidden');
      } else {
        card.style.display = 'none';
        card.setAttribute('aria-hidden', 'true');
      }
    });
  }

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.toggle('active', p === pill));
      applyFilter(pill.dataset.filter);
    });
    pill.setAttribute('type', 'button');
  });
})();


/* ══════════════════════════════════════════════════
   ACTIVE NAV LINK
   Marks the nav link (both desktop + mobile drawer)
   that matches the current page. If the current page
   sits inside a Services/Systems dropdown, the parent
   trigger button also gets .is-active.
   ══════════════════════════════════════════════════ */
(function initActiveNavLink() {
  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  /* Treat empty / "/" as index */
  const current = here === '' ? 'index.html' : here;

  /* Match every link by its href filename (ignore querystrings + anchors) */
  const allLinks = document.querySelectorAll('.nav-links a, .nav-drawer a');
  allLinks.forEach(link => {
    const raw = (link.getAttribute('href') || '').split(/[?#]/)[0];
    if (!raw || raw.startsWith('http')) return;            /* skip external + Calendly */
    if (link.classList.contains('nav-cta-pill')) return;   /* skip Book a Call */
    const file = (raw.split('/').pop() || '').toLowerCase();
    if (!file) return;
    if (file === current) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
      /* If inside a .nav-drop, mark the trigger active too */
      const drop = link.closest('.nav-drop');
      if (drop) {
        const trigger = drop.querySelector('.nav-drop-trigger');
        if (trigger) trigger.classList.add('is-active');
      }
    }
  });
})();

