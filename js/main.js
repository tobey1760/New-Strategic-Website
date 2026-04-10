/* ══════════════════════════════════════════
   1760 Strategic AI — Main JavaScript
   ══════════════════════════════════════════ */

/* ── PAGE INTRO: grid block reveal ── */
(function initIntro() {
  const grid = document.getElementById('introGrid');
  if (!grid) return;

  const blocks = grid.querySelectorAll('.intro-block');

  /* Randomise stagger delay for each block */
  const indices = Array.from({ length: blocks.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  /* Start reveal after logo is visible */
  setTimeout(() => {
    grid.classList.add('reveal');
    blocks.forEach((block, i) => {
      block.style.animationDelay = (indices.indexOf(i) * 80) + 'ms';
    });

    /* Remove grid from DOM after animation completes, then reveal nav */
    setTimeout(() => {
      grid.remove();
      document.querySelector('nav')?.classList.add('nav-visible');
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



/* ── 3D NEURAL SPHERE ── */
(function initSphere() {
  if (typeof THREE === 'undefined') return;
  const canvas = document.getElementById('sphereCanvas');
  if (!canvas) return;

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

  const GOLD = 0xc9a84c;

  /* Group — float + mouse parallax applied here */
  const group = new THREE.Group();
  scene.add(group);

  /* Outer wireframe sphere */
  const outerMesh = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(2.2, 22, 22)),
    new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.3 })
  );
  group.add(outerMesh);

  /* Inner wireframe sphere (counter-rotates) */
  const innerMesh = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(1.15, 14, 14)),
    new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.52 })
  );
  group.add(innerMesh);

  /* Neural particles */
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
    pVel.push({
      vx: (Math.random() - 0.5) * 0.006,
      vy: (Math.random() - 0.5) * 0.006,
      vz: (Math.random() - 0.5) * 0.006,
    });
  }

  const dotAttr = new THREE.BufferAttribute(pPos, 3);
  dotAttr.setUsage(THREE.DynamicDrawUsage);
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', dotAttr);
  const dots = new THREE.Points(dotGeo,
    new THREE.PointsMaterial({ color: GOLD, size: 0.08, transparent: true, opacity: 0.9 }));
  group.add(dots);

  /* Neural connections — pre-allocated buffer */
  const lBuf     = new Float32Array(N * N * 6);
  const lineAttr = new THREE.BufferAttribute(lBuf, 3);
  lineAttr.setUsage(THREE.DynamicDrawUsage);
  const lineGeo  = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', lineAttr);
  lineGeo.setDrawRange(0, 0);
  const linesMesh = new THREE.LineSegments(lineGeo,
    new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.2 }));
  group.add(linesMesh);

  /* Mouse parallax */
  let mx = 0, my = 0;
  window.addEventListener('mousemove', e => {
    mx = e.clientX / window.innerWidth  - 0.5;
    my = e.clientY / window.innerHeight - 0.5;
  });

  let t = 0;

  (function tick() {
    requestAnimationFrame(tick);
    t += 0.007;

    /* Sphere rotations */
    outerMesh.rotation.y += 0.0022;
    outerMesh.rotation.x += 0.0009;
    innerMesh.rotation.y -= 0.004;
    innerMesh.rotation.z += 0.002;

    /* Breathing pulse on outer sphere */
    outerMesh.scale.setScalar(1 + Math.sin(t * 0.9) * 0.025);

    /* Float */
    group.position.y = Math.sin(t * 0.8) * 0.2;

    /* Mouse parallax (aggressive lerp) */
    group.rotation.y += (mx * 0.8 - group.rotation.y) * 0.1;
    group.rotation.x += (my * 0.6 - group.rotation.x) * 0.1;

    /* Move particles */
    for (let i = 0; i < N; i++) {
      const v = pVel[i];
      pPos[i * 3]     += v.vx;
      pPos[i * 3 + 1] += v.vy;
      pPos[i * 3 + 2] += v.vz;
      const x = pPos[i * 3], y = pPos[i * 3 + 1], z = pPos[i * 3 + 2];
      const d2 = x * x + y * y + z * z;
      if (d2 > 3.5 * 3.5 || d2 < 1.2 * 1.2) { v.vx *= -1; v.vy *= -1; v.vz *= -1; }
    }
    dotAttr.needsUpdate = true;

    /* Rebuild neural connection lines */
    const CONN2 = 1.6 * 1.6;
    let li = 0;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pPos[i*3]   - pPos[j*3];
        const dy = pPos[i*3+1] - pPos[j*3+1];
        const dz = pPos[i*3+2] - pPos[j*3+2];
        if (dx*dx + dy*dy + dz*dz < CONN2) {
          lBuf[li++] = pPos[i*3];   lBuf[li++] = pPos[i*3+1]; lBuf[li++] = pPos[i*3+2];
          lBuf[li++] = pPos[j*3];   lBuf[li++] = pPos[j*3+1]; lBuf[li++] = pPos[j*3+2];
        }
      }
    }
    lineAttr.needsUpdate = true;
    lineGeo.setDrawRange(0, li / 3);

    renderer.render(scene, camera);
  })();
})();


/* ── NEURAL HEAD ── */
(function initNeural() {
  const canvas = document.getElementById('dnaCanvas');
  if (!canvas) return;

  const section = canvas.parentElement;
  const ctx     = canvas.getContext('2d');
  const COUNT   = 140;
  const CONNECT = 260;

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
      r:  1.4 + Math.random() * 1.8,
      gold: Math.random() > 0.45
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

    /* lines */
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT) {
          const alpha = (1 - dist / CONNECT) * 0.32;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(219,192,120,${alpha})`;
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }
      }
    }

    /* dots */
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.gold
        ? 'rgba(219,192,120,0.55)'
        : 'rgba(247,247,242,0.38)';
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  draw();
})();


/* ── SEAMLESS VIDEO LOOP: forward then reverse (ping-pong) ── */
(function initVideoLoop() {
  const video = document.querySelector('.hero-video');
  if (!video) return;

  video.removeAttribute('loop');
  let reversing = false;
  let rafId;

  video.addEventListener('ended', function () {
    reversing = true;
    stepReverse();
  });

  function stepReverse() {
    if (!reversing) return;
    video.currentTime = Math.max(0, video.currentTime - (1 / 30));
    if (video.currentTime <= 0.05) {
      reversing = false;
      video.currentTime = 0;
      video.play();
      return;
    }
    rafId = requestAnimationFrame(stepReverse);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else if (reversing) {
      stepReverse();
    }
  });
})();


/* ── CUSTOM CURSOR ── */
(function initCursor() {
  const cursor = document.getElementById('cursor');
  const ring = document.getElementById('cursorRing');
  if (!cursor || !ring) return;

  let mouseX = 0, mouseY = 0;
  let ringX = 0, ringY = 0;
  let rafId;

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.left = mouseX + 'px';
    cursor.style.top = mouseY + 'px';
    document.body.classList.add('cursor-visible');
  });

  document.addEventListener('mouseleave', () => {
    document.body.classList.remove('cursor-visible');
  });

  function animateRing() {
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;
    ring.style.left = ringX + 'px';
    ring.style.top = ringY + 'px';
    rafId = requestAnimationFrame(animateRing);
  }
  animateRing();

  const interactives = document.querySelectorAll('a, button, [role="button"], .faq-q, .approach-card, .svc-card, .process-step');
  interactives.forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.style.width = '20px';
      cursor.style.height = '20px';
      ring.style.width = '60px';
      ring.style.height = '60px';
    });
    el.addEventListener('mouseleave', () => {
      cursor.style.width = '12px';
      cursor.style.height = '12px';
      ring.style.width = '40px';
      ring.style.height = '40px';
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


/* ── SCROLL REVEAL ── */
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => observer.observe(el));
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


/* ── HERO PARALLAX EXIT ── */
(function initHeroParallax() {
  const hero = document.querySelector('.hero');
  const heroInner = document.querySelector('.hero-inner');
  const heroDeco = document.querySelector('.hero-deco');
  if (!hero || !heroInner) return;

  let heroHeight = hero.offsetHeight;
  window.addEventListener('resize', () => { heroHeight = hero.offsetHeight; }, { passive: true });

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const progress = Math.min(window.scrollY / heroHeight, 1);
      heroInner.style.opacity = String(Math.max(0, 1 - progress * 2.2));
      heroInner.style.transform = `translateY(${-progress * 90}px)`;
      if (heroDeco) heroDeco.style.transform = `translateY(${progress * 40}px)`;
      ticking = false;
    });
  }, { passive: true });
})();


/* ── MANIFESTO WORD-BY-WORD REVEAL ── */
(function initWordReveal() {
  const quote = document.querySelector('.manifesto-quote');
  if (!quote) return;

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


/* ── THEME TOGGLE ── */
(function initThemeToggle() {
  const btn  = document.getElementById('themeToggle');
  const icon = btn ? btn.querySelector('.theme-icon') : null;
  const html = document.documentElement;
  if (!btn || !icon) return;

  /* Icons */
  const ICONS = { light: '🌙', dark: '☀️' };
  const LABELS = {
    light: 'Switch to dark mode',
    dark:  'Switch to light mode'
  };

  function getTheme() {
    return html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    icon.textContent  = ICONS[theme];
    btn.setAttribute('aria-label', LABELS[theme]);
    localStorage.setItem('theme', theme);
  }

  /* The inline <script> in <head> already set data-theme to avoid flash.
     Sync the button icon/label to match that initial state. */
  applyTheme(getTheme());

  btn.addEventListener('click', () => {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
  });

  /* Respect OS-level changes while the page is open */
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
})();


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


/* ── CTA DOTTED SURFACE (Three.js) ── */
(function initCtaDottedSurface() {
  if (typeof THREE === 'undefined') return;
  const canvas    = document.getElementById('ctaDottedSurface');
  const container = document.querySelector('.cta-section');
  if (!canvas || !container) return;

  const SEPARATION = 150;
  const AMOUNTX    = 40;
  const AMOUNTY    = 60;

  /* Palette: forest dots on cream (light) / gold dots on dark forest (dark) */
  const PALETTE = {
    light: [0.133, 0.204, 0.196], // forest #223432
    dark:  [0.902, 0.827, 0.627]  // gold-light #e6d3a0
  };
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 10000);
  camera.position.set(0, 355, 1220);

  const geometry  = new THREE.BufferGeometry();
  const positions = [];
  const colors    = [];

  const setColors = () => {
    const c = isDark() ? PALETTE.dark : PALETTE.light;
    for (let k = 0; k < AMOUNTX * AMOUNTY; k++) {
      colors[k * 3]     = c[0];
      colors[k * 3 + 1] = c[1];
      colors[k * 3 + 2] = c[2];
    }
  };

  for (let ix = 0; ix < AMOUNTX; ix++) {
    for (let iy = 0; iy < AMOUNTY; iy++) {
      positions.push(
        ix * SEPARATION - (AMOUNTX * SEPARATION) / 2,
        0,
        iy * SEPARATION - (AMOUNTY * SEPARATION) / 2
      );
      colors.push(0, 0, 0); // placeholder, set below
    }
  }
  setColors();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 8,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let count = 0;
  let visible = false;

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(container);
  }
  resize();

  /* Re-color on theme switch */
  const themeObserver = new MutationObserver(() => {
    const c = isDark() ? PALETTE.dark : PALETTE.light;
    const arr = geometry.attributes.color.array;
    for (let k = 0; k < AMOUNTX * AMOUNTY; k++) {
      arr[k * 3]     = c[0];
      arr[k * 3 + 1] = c[1];
      arr[k * 3 + 2] = c[2];
    }
    geometry.attributes.color.needsUpdate = true;
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* Pause when off-screen */
  const io = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
  }, { rootMargin: '100px' });
  io.observe(container);

  const animate = () => {
    requestAnimationFrame(animate);
    if (!visible) return;

    const arr = geometry.attributes.position.array;
    let i = 0;
    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        arr[i * 3 + 1] =
          Math.sin((ix + count) * 0.3) * 50 +
          Math.sin((iy + count) * 0.5) * 50;
        i++;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    count += 0.1;
  };
  animate();
})();
