/* ══════════════════════════════════════════════════
   1760 STRATEGIC AI — AI Readiness Scorecard
   Full client-side quiz. State machine, scoring,
   tiebreak, email gate, results.

   Wire ASSESSMENT_CONFIG.submitEndpoint to your
   n8n webhook → GHL pipeline.
   ══════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ────────── CONFIG ────────── */
  const ASSESSMENT_CONFIG = {
    submitEndpoint: 'https://services.leadconnectorhq.com/hooks/HpPBBmiW9DfyIwMJyEfq/webhook-trigger/13cbdcdf-ecb0-4a3a-a130-ff95f4cbdaed',
    resultsPermalinkBase: '',
    calcDurationMs: 4000,
    selectionDelayMs: 300,
  };

  /* ────────── QUESTIONS ────────── */
  const QUESTIONS = [
    // ─── Revenue Engine: Q1–3 ───
    {
      id: 'Q1', domain: 'revenue',
      text: 'How does most new business come in?',
      options: [
        { v: 1, text: 'Word of mouth only' },
        { v: 2, text: 'Referrals + some outreach' },
        { v: 3, text: 'Active pipeline system' },
        { v: 4, text: 'Consistent inbound flow' },
      ],
    },
    {
      id: 'Q2', domain: 'revenue',
      text: 'How predictable is your next 90 days of revenue?',
      options: [
        { v: 1, text: 'No real visibility' },
        { v: 2, text: 'Rough guess' },
        { v: 3, text: 'Reasonable forecast' },
        { v: 4, text: 'Tracked and reliable' },
      ],
    },
    {
      id: 'Q3', domain: 'revenue',
      text: 'How involved are you in closing new clients?',
      options: [
        { v: 1, text: 'Every single one' },
        { v: 2, text: 'Most of them' },
        { v: 3, text: 'Some, with team help' },
        { v: 4, text: 'Team closes without me' },
      ],
    },
    // ─── Operations Command Center: Q4–6 ───
    {
      id: 'Q4', domain: 'operations',
      text: 'How does work get handed off inside your team?',
      options: [
        { v: 1, text: 'Verbally, in the moment' },
        { v: 2, text: 'Loosely documented' },
        { v: 3, text: 'Documented but inconsistent' },
        { v: 4, text: 'Clear, consistent process' },
      ],
    },
    {
      id: 'Q5', domain: 'operations',
      text: 'How long could your team run well without you?',
      options: [
        { v: 1, text: 'Less than a day' },
        { v: 2, text: 'A few days' },
        { v: 3, text: 'A week or two' },
        { v: 4, text: 'Indefinitely' },
      ],
    },
    {
      id: 'Q6', domain: 'operations',
      text: 'Where do most decisions get stuck?',
      options: [
        { v: 1, text: 'Waiting on me' },
        { v: 2, text: 'Unclear ownership' },
        { v: 3, text: 'Slow process' },
        { v: 4, text: 'Decisions rarely get stuck' },
      ],
    },
    // ─── Founder Intelligence System: Q7–9 ───
    {
      id: 'Q7', domain: 'knowledge',
      text: 'Where does your core methodology live?',
      options: [
        { v: 1, text: 'In my head only' },
        { v: 2, text: 'In scattered notes' },
        { v: 3, text: 'Partially documented' },
        { v: 4, text: 'Fully systematized' },
      ],
    },
    {
      id: 'Q8', domain: 'knowledge',
      text: 'Can your team deliver your work without you present?',
      options: [
        { v: 1, text: 'No, not really' },
        { v: 2, text: 'For simple tasks only' },
        { v: 3, text: 'Most of the time' },
        { v: 4, text: 'Yes, consistently' },
      ],
    },
    {
      id: 'Q9', domain: 'knowledge',
      text: 'What happens when a new team member joins?',
      options: [
        { v: 1, text: 'I train them personally' },
        { v: 2, text: 'Informal shadowing' },
        { v: 3, text: 'Some docs, mostly ad hoc' },
        { v: 4, text: 'Clear onboarding system' },
      ],
    },
    // ─── Authority Engine: Q10–12 ───
    {
      id: 'Q10', domain: 'authority',
      text: 'How consistently does content go out under your brand?',
      options: [
        { v: 1, text: 'Rarely or never' },
        { v: 2, text: 'When I have time' },
        { v: 3, text: 'Inconsistently' },
        { v: 4, text: 'On a reliable schedule' },
      ],
    },
    {
      id: 'Q11', domain: 'authority',
      text: 'Who creates most of your content right now?',
      options: [
        { v: 1, text: 'Me, manually' },
        { v: 2, text: 'Me, with some help' },
        { v: 3, text: 'Team with my input' },
        { v: 4, text: 'Runs without me' },
      ],
    },
    {
      id: 'Q12', domain: 'authority',
      text: 'How would you describe your current market presence?',
      options: [
        { v: 1, text: 'Few people outside my network know what I do' },
        { v: 2, text: 'Known in my network' },
        { v: 3, text: 'Growing reputation' },
        { v: 4, text: 'Clear category authority' },
      ],
    },
  ];

  /* ────────── DOMAIN LABELS ────────── */
  const DOMAIN_LABELS = {
    revenue:    'Revenue Engine',
    operations: 'Operations Command Center',
    knowledge:  'Founder Intelligence System',
    authority:  'Authority Engine',
  };

  /* ────────── STATUS LABELS ────────── */
  function getStatusLabel(score) {
    if (score <= 5)  return 'Critical Gap';
    if (score <= 8)  return 'Needs Attention';
    if (score <= 10) return 'Solid Foundation';
    return 'Optimized';
  }

  /* ────────── TIEBREAK ORDER ────────── */
  // Per spec FIX F: Operations first, then Founder Intelligence, then Revenue, then Authority
  const TIEBREAK_ORDER = ['operations', 'knowledge', 'revenue', 'authority'];

  /* ────────── CONSTRAINT COPY (FIX H) ────────── */
  const QUESTION_DOMAIN_INDICES = {
    revenue:    [0, 1, 2],
    operations: [3, 4, 5],
    knowledge:  [6, 7, 8],
    authority:  [9, 10, 11],
  };

  function buildYouToldUs(systemKey, answers) {
    const indices = QUESTION_DOMAIN_INDICES[systemKey];
    const lowAnswers = indices
      .filter(i => answers[i] != null && answers[i] <= 2)
      .map(i => QUESTIONS[i].options[answers[i] - 1].text.toLowerCase());
    if (lowAnswers.length === 0) return null;
    return 'You told us: ' + lowAnswers.join('; ') + '.';
  }

  function getConstraintCopy(systemKey, answers) {
    const youToldUs = buildYouToldUs(systemKey, answers);

    const variants = {
      revenue: {
        title: 'Revenue Engine',
        sentence: 'New business relies too heavily on your relationships and your effort. That ceiling is your capacity.',
        body: youToldUs
          ? `<p>${youToldUs} That's a channel problem, not a relationship problem. Your network is producing clients because no system is. The ceiling is the size of your personal reach.</p><p>Founders in this pattern unlock a second revenue channel within 90 days when they remove themselves from the acquisition loop.</p>`
          : `<p>Your organization grows when you're active and slows when you're not. Referrals built this business, but referrals don't scale. Every new client conversation passes through you — which means growth is capped by your calendar, not your market.</p><p>A fix here means predictable pipeline that runs without you chasing it.</p>`,
        cta: 'Book an AI Audit, Revenue Focus. We\'ll find where the system should be doing the work you\'re doing.',
        pillarUrl: 'revenue-engine.html',
      },
      operations: {
        title: 'Operations Command Center',
        sentence: 'Your team is capable, but work can\'t move without you. Every decision is a bottleneck waiting to happen.',
        body: youToldUs
          ? `<p>${youToldUs} That is not a team problem. It is a missing layer. Verbal handoffs mean no system of record. Sub-week continuity means no decision rights. Stalled decisions mean no escalation protocol.</p><p>Founders in this pattern recover 8–12 hours per week within 60 days by installing one thing: a decision matrix with async escalation. Not documentation. Not process. Infrastructure.</p>`
          : `<p>Your team is capable but work can't move without you. Manual handoffs, unclear ownership, and decisions waiting on your approval are consuming the hours that should go toward growth.</p><p>A single infrastructure fix here could give you back 8–12 hours a week within 60 days.</p>`,
        cta: 'Book an AI Audit, Operations Focus. 30 minutes. We\'ll map your handoff and decision architecture and show you the highest-leverage fix.',
        pillarUrl: 'operations-command-center.html',
      },
      knowledge: {
        title: 'Founder Intelligence System',
        sentence: 'Your expertise is the product, but it only exists in your head. That makes you irreplaceable in the wrong way.',
        body: youToldUs
          ? `<p>${youToldUs} That is a transfer problem. Your expertise is real. The gap is that it only travels with you.</p><p>Until your methodology is systematized, your team can't deliver at your standard without you in the room. Until that changes, your capacity ceiling is your calendar.</p>`
          : `<p>Your methodology, your decision frameworks, your protocols — none of it exists in a form your team can access independently. Every judgment call waits for you.</p><p>Until your expertise is systematized, your capacity ceiling is your calendar.</p>`,
        cta: 'Book an AI Audit, Knowledge Transfer Focus. We\'ll show you how to make your expertise accessible without losing what makes it yours.',
        pillarUrl: 'founder-intelligence.html',
      },
      authority: {
        title: 'Authority Engine',
        sentence: 'You have expertise and results, but your market presence doesn\'t reflect it yet. Content is inconsistent because it depends on you.',
        body: youToldUs
          ? `<p>${youToldUs} That is a system problem, not a time problem. You do not have time to create content consistently because there is no engine.</p><p>Building one does not mean becoming a content creator. It means installing the infrastructure so your expertise reaches people without requiring your attention.</p>`
          : `<p>You have expertise and results, but your market presence doesn't reflect it. Prospects encounter you cold because your content is inconsistent and depends on you to produce it.</p><p>Inbound leads and category authority require a system, not a schedule.</p>`,
        cta: 'Book an AI Audit, Authority Focus. We\'ll map what a consistent content engine looks like without you doing the work.',
        pillarUrl: 'authority-engine.html',
      },
    };

    return variants[systemKey];
  }

  /* ────────── OPTIMIZED VARIANT (FIX G) ────────── */
  const OPTIMIZED_COPY = {
    title: 'Your Infrastructure Is Operating.',
    sentence: 'Across all four systems you\'re running at Solid Foundation or better. That\'s rare.',
    body: '<p>Most founders who reach out to 1760 are earlier in the build. The conversation we\'d have with you isn\'t about fixing gaps. It\'s about the compounding layer: where AI turns a well-run business into one that\'s genuinely hard to compete with.</p>',
    cta: 'Book an Infrastructure Leverage Session. Different conversation, different scope, different outcome.',
    ctaLabel: 'Book an Infrastructure Leverage Session',
  };

  /* ────────── TIERS ────────── */
  const TIERS = [
    { min: 12, max: 20, label: 'Foundation Stage',   cls: 'tier-foundation' },
    { min: 21, max: 30, label: 'Growth-Ready',       cls: '' },
    { min: 31, max: 40, label: 'Scaling',            cls: '' },
    { min: 41, max: 48, label: 'Infrastructure-Led', cls: '' },
  ];

  /* ────────── STATE ────────── */
  const state = {
    currentIndex: 0,
    answers: new Array(QUESTIONS.length).fill(null),
    startedAt: null,
    form: null,
    utm: captureUtms(),
    domainScores: null,
    overallScore: null,
    primary: null,
    secondary: null,
    tier: null,
    isOptimized: false,
    submissionId: null,
  };

  /* ────────── DOM REFS ────────── */
  const el = {
    app:          document.getElementById('assessmentApp'),
    screens:      document.querySelectorAll('.asmt-screen'),
    startBtn:     document.getElementById('asmtStartBtn'),
    progressFill: document.getElementById('asmtProgressFill'),
    stepCurrent:  document.getElementById('asmtStepCurrent'),
    domainTabs:   document.querySelectorAll('.asmt-domain-tab'),
    questionSlot: document.getElementById('asmtQuestionSlot'),
    continueBtn:  document.getElementById('asmtContinueBtn'),
    backBtn:      document.getElementById('asmtBackBtn'),
    calcBarFill:  document.getElementById('asmtCalcBarFill'),
    calcIcons:    document.querySelectorAll('.asmt-calc-icon'),
    leadForm:     document.getElementById('asmtLeadForm'),
    submitBtn:    document.getElementById('asmtSubmitBtn'),
    // Results
    scoreNum:           document.getElementById('asmtScoreNum'),
    gaugeFill:          document.getElementById('asmtGaugeFill'),
    resTier:            document.getElementById('asmtResTier'),
    domainBars:         document.getElementById('asmtDomainBars'),
    constraintTitle:    document.getElementById('asmtConstraintTitle'),
    constraintSentence: document.getElementById('asmtConstraintSentence'),
    constraintBody:     document.getElementById('asmtConstraintBody'),
    benchmarkText:      document.getElementById('asmtBenchmarkText'),
    steps:              document.getElementById('asmtSteps'),
    secondaryDomain:    document.getElementById('asmtSecondaryDomain'),
    secondarySentence:  document.getElementById('asmtSecondarySentence'),
    ctaConstraint:      document.getElementById('asmtCtaConstraint'),
    ctaConstraint2:     document.getElementById('asmtCtaConstraint2'),
    bookBtn:            document.getElementById('asmtBookBtn'),
    shareBtn:           document.getElementById('asmtShareBtn'),
    sentConfirm:        document.getElementById('asmtSentConfirm'),
  };

  if (!el.app) return;

  /* ────────── UTM CAPTURE ────────── */
  function captureUtms() {
    try {
      const params = new URLSearchParams(location.search);
      const utm = {};
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','ref','gclid','fbclid'].forEach(k => {
        const v = params.get(k);
        if (v) utm[k] = v;
      });
      if (Object.keys(utm).length) {
        try { sessionStorage.setItem('asmt_utm', JSON.stringify(utm)); } catch (_) {}
      } else {
        try {
          const saved = sessionStorage.getItem('asmt_utm');
          if (saved) return JSON.parse(saved);
        } catch (_) {}
      }
      utm.referrer = document.referrer || '';
      utm.landing_url = location.href;
      return utm;
    } catch (e) {
      return { referrer: '', landing_url: location.href };
    }
  }

  /* ────────── SCREEN MANAGER ────────── */
  function showScreen(key) {
    el.screens.forEach(s => {
      const match = s.dataset.key === key;
      s.hidden = !match;
      if (match) s.classList.add('is-active');
      else s.classList.remove('is-active');
    });
    el.app.dataset.screen = key;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ────────── QUESTION RENDERING ────────── */
  function renderQuestion(idx) {
    const q = QUESTIONS[idx];
    const selected = state.answers[idx];

    const block = document.createElement('div');
    block.className = 'asmt-question';
    block.innerHTML = `
      <div class="asmt-q-domain">${DOMAIN_LABELS[q.domain]}  ·  Question ${idx + 1} of 12</div>
      <div class="asmt-q-text">${q.text}</div>
      <div class="asmt-options" role="radiogroup" aria-label="Answer options">
        ${q.options.map((opt, oi) => `
          <button type="button"
                  class="asmt-option ${selected === opt.v ? 'is-selected' : ''}"
                  role="radio"
                  aria-checked="${selected === opt.v}"
                  data-value="${opt.v}"
                  data-index="${oi}">
            <span class="asmt-option-radio" aria-hidden="true"></span>
            <span class="asmt-option-text">${opt.text}</span>
          </button>
        `).join('')}
      </div>
    `;

    block.querySelectorAll('.asmt-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.value, 10);
        state.answers[idx] = val;
        block.querySelectorAll('.asmt-option').forEach(b => {
          b.classList.toggle('is-selected', b === btn);
          b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
        });
        el.continueBtn.classList.remove('is-ready');
        el.continueBtn.disabled = true;
        setTimeout(() => {
          el.continueBtn.disabled = false;
          el.continueBtn.classList.add('is-ready');
        }, ASSESSMENT_CONFIG.selectionDelayMs);
      });
    });

    el.questionSlot.innerHTML = '';
    el.questionSlot.appendChild(block);

    if (selected) {
      el.continueBtn.disabled = false;
      el.continueBtn.classList.add('is-ready');
    } else {
      el.continueBtn.disabled = true;
      el.continueBtn.classList.remove('is-ready');
    }

    el.backBtn.disabled = idx === 0;
    el.progressFill.style.width = ((idx + 1) / QUESTIONS.length * 100) + '%';
    el.stepCurrent.textContent = (idx + 1).toString();
    updateDomainTabs(q.domain, idx);
  }

  function updateDomainTabs(currentDomain, idx) {
    const domainState = {};
    QUESTIONS.forEach((q, i) => {
      if (!domainState[q.domain]) domainState[q.domain] = { total: 0, done: 0 };
      domainState[q.domain].total++;
      if (state.answers[i]) domainState[q.domain].done++;
    });
    el.domainTabs.forEach(tab => {
      const d = tab.dataset.domain;
      tab.classList.toggle('is-active', d === currentDomain);
      tab.classList.toggle('is-done', d !== currentDomain && domainState[d] && domainState[d].done === domainState[d].total);
    });
  }

  function goToQuestion(idx) {
    if (idx < 0 || idx >= QUESTIONS.length) return;
    state.currentIndex = idx;
    renderQuestion(idx);
  }

  /* ────────── CALCULATING SCREEN ────────── */
  function runCalculatingScreen() {
    showScreen('calc');
    requestAnimationFrame(() => {
      el.calcBarFill.style.width = '100%';
    });
    const iconStaggerMs = ASSESSMENT_CONFIG.calcDurationMs / 5;
    el.calcIcons.forEach((icon, i) => {
      setTimeout(() => icon.classList.add('is-done'), iconStaggerMs * (i + 1) - 200);
    });
    setTimeout(() => showScreen('gate'), ASSESSMENT_CONFIG.calcDurationMs);
  }

  /* ────────── SCORING ────────── */
  function computeScores() {
    const domains = { revenue: 0, operations: 0, knowledge: 0, authority: 0 };
    QUESTIONS.forEach((q, i) => {
      domains[q.domain] += (state.answers[i] || 0);
    });
    const overall = Object.values(domains).reduce((a, b) => a + b, 0);

    // FIX G: check optimized (all systems 9+)
    state.isOptimized = Object.values(domains).every(s => s >= 9);

    // Primary constraint = lowest score; tiebreak via TIEBREAK_ORDER (FIX F)
    const minScore = Math.min(...Object.values(domains));
    const lowestDomains = Object.keys(domains).filter(d => domains[d] === minScore);
    let primary = lowestDomains[0];
    if (lowestDomains.length > 1) {
      for (const d of TIEBREAK_ORDER) {
        if (lowestDomains.includes(d)) { primary = d; break; }
      }
    }

    // Secondary = next-lowest (excluding primary)
    const rest = Object.keys(domains).filter(d => d !== primary);
    const secondMin = Math.min(...rest.map(d => domains[d]));
    const secondLowest = rest.filter(d => domains[d] === secondMin);
    let secondary = secondLowest[0];
    if (secondLowest.length > 1) {
      for (const d of TIEBREAK_ORDER) {
        if (secondLowest.includes(d)) { secondary = d; break; }
      }
    }

    const tier = TIERS.find(t => overall >= t.min && overall <= t.max) || TIERS[0];

    state.domainScores = domains;
    state.overallScore = overall;
    state.primary = primary;
    state.secondary = secondary;
    state.tier = tier;
  }

  /* ────────── RESULTS RENDER ────────── */
  function renderResults() {
    computeScores();
    showScreen('results');

    animateNumber(el.scoreNum, 0, state.overallScore, 1400);

    const circumference = 553;
    const pct = state.overallScore / 48;
    requestAnimationFrame(() => {
      el.gaugeFill.style.strokeDashoffset = String(circumference * (1 - pct));
    });

    el.resTier.textContent = state.tier.label.toUpperCase();
    el.resTier.className = 'asmt-res-tier ' + state.tier.cls;

    renderDomainBars();

    if (state.isOptimized) {
      // FIX G: Optimized output
      if (el.constraintTitle)    el.constraintTitle.textContent  = OPTIMIZED_COPY.title;
      if (el.constraintSentence) el.constraintSentence.textContent = OPTIMIZED_COPY.sentence;
      if (el.constraintBody)     el.constraintBody.innerHTML     = OPTIMIZED_COPY.body;
      if (el.benchmarkText)      el.benchmarkText.textContent    = 'You\'re in the top tier. Most founders who reach this point are ready for a different conversation.';
      if (el.ctaConstraint)      el.ctaConstraint.textContent    = 'infrastructure optimization';
      if (el.ctaConstraint2)     el.ctaConstraint2.textContent   = 'Infrastructure Leverage';
      if (el.bookBtn) {
        el.bookBtn.textContent = OPTIMIZED_COPY.ctaLabel;
        el.bookBtn.href = buildCalendlyUrl();
      }
      if (el.steps) {
        el.steps.innerHTML = `
          <li class="asmt-step is-book">
            <span class="asmt-step-num">01</span>
            <div>
              <div class="asmt-step-title">${OPTIMIZED_COPY.ctaLabel}</div>
              <p class="asmt-step-body">${OPTIMIZED_COPY.cta}</p>
              <a class="asmt-cta-gold asmt-step-cta" href="${buildCalendlyUrl()}" target="_blank" rel="noopener noreferrer">${OPTIMIZED_COPY.ctaLabel}</a>
            </div>
          </li>`;
      }
      if (el.secondaryDomain)   el.secondaryDomain.textContent  = '—';
      if (el.secondarySentence) el.secondarySentence.textContent = 'No critical gaps detected across your four systems.';
    } else {
      // Standard constraint output (FIX H dynamic copy)
      const c = getConstraintCopy(state.primary, state.answers);
      if (el.constraintTitle)    el.constraintTitle.textContent  = c.title;
      if (el.constraintSentence) el.constraintSentence.textContent = c.sentence;
      if (el.constraintBody)     el.constraintBody.innerHTML     = c.body;
      if (el.benchmarkText)      el.benchmarkText.textContent    = 'Your ' + c.title + ' is your highest-leverage starting point.';
      if (el.ctaConstraint)      el.ctaConstraint.textContent    = c.title.toLowerCase();
      if (el.ctaConstraint2)     el.ctaConstraint2.textContent   = c.title;
      if (el.bookBtn)            el.bookBtn.href                 = buildCalendlyUrl();
      if (el.steps) {
        el.steps.innerHTML = `
          <li class="asmt-step is-book">
            <span class="asmt-step-num">01</span>
            <div>
              <div class="asmt-step-title">Book Your AI Audit</div>
              <p class="asmt-step-body">${c.cta}</p>
              <a class="asmt-cta-gold asmt-step-cta" href="${buildCalendlyUrl()}" target="_blank" rel="noopener noreferrer">Book Your AI Audit</a>
            </div>
          </li>`;
      }
      const sec = getConstraintCopy(state.secondary, state.answers);
      if (el.secondaryDomain)   el.secondaryDomain.textContent  = DOMAIN_LABELS[state.secondary];
      if (el.secondarySentence) el.secondarySentence.textContent = sec.sentence;
    }

    if (state.submissionId && state.form) {
      if (el.sentConfirm) el.sentConfirm.textContent = `Your breakdown has been sent to ${state.form.email}`;
    }

    if (el.shareBtn) el.shareBtn.addEventListener('click', onShareClick);
  }

  /* ────────── DOMAIN BARS ────────── */
  function renderDomainBars() {
    const domains = ['revenue', 'operations', 'knowledge', 'authority'];
    el.domainBars.innerHTML = domains.map(d => {
      const score = state.domainScores[d];
      const pct = (score / 12) * 100;
      const isPrimary = !state.isOptimized && d === state.primary;
      const statusLabel = getStatusLabel(score);
      return `
        <div class="asmt-domain-row ${isPrimary ? 'is-primary' : ''}">
          <div class="asmt-domain-row-top">
            <span class="asmt-domain-name">${DOMAIN_LABELS[d]}</span>
            <span class="asmt-domain-score">${score} / 12 &nbsp;<span class="asmt-domain-status asmt-status-${statusLabel.toLowerCase().replace(' ', '-')}">${statusLabel}</span></span>
          </div>
          <div class="asmt-domain-bar-track">
            <div class="asmt-domain-bar-fill" data-pct="${pct}"></div>
          </div>
        </div>
      `;
    }).join('');

    setTimeout(() => {
      el.domainBars.querySelectorAll('.asmt-domain-bar-fill').forEach((bar, i) => {
        setTimeout(() => { bar.style.width = bar.dataset.pct + '%'; }, i * 150);
      });
    }, 400);
  }

  /* ────────── ANIMATE NUMBER ────────── */
  function animateNumber(elem, from, to, durationMs) {
    if (!elem) return;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      elem.textContent = Math.round(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(tick);
      else elem.textContent = to;
    }
    requestAnimationFrame(tick);
  }

  /* ────────── CALENDLY URL ────────── */
  function buildCalendlyUrl() {
    const base = 'https://calendly.com/harry-1760ventures/ai-audit-1760-strategic-ai';
    try {
      const url = new URL(base);
      if (state.form && state.form.email) url.searchParams.set('email', state.form.email);
      if (state.primary && !state.isOptimized) {
        url.searchParams.set('a1', `Scorecard: ${DOMAIN_LABELS[state.primary]} · Score ${state.overallScore}/48 · Tier: ${state.tier.label}`);
      }
      Object.keys(state.utm || {}).forEach(k => {
        if (k.startsWith('utm_') && state.utm[k]) url.searchParams.set(k, state.utm[k]);
      });
      return url.toString();
    } catch (_) {
      return base;
    }
  }

  /* ────────── SHARE ────────── */
  function onShareClick() {
    const url = buildShareUrl();
    if (navigator.share) {
      navigator.share({
        title: '1760 AI Readiness Scorecard Results',
        text: state.isOptimized
          ? `My infrastructure is operating across all four systems. Score: ${state.overallScore}/48.`
          : `My primary constraint is ${DOMAIN_LABELS[state.primary]}. Score: ${state.overallScore}/48.`,
        url,
      }).catch(() => copyToClipboard(url));
    } else {
      copyToClipboard(url);
    }
  }

  function buildShareUrl() {
    if (ASSESSMENT_CONFIG.resultsPermalinkBase && state.submissionId) {
      return ASSESSMENT_CONFIG.resultsPermalinkBase + state.submissionId;
    }
    const payload = { a: state.answers };
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    return `${location.origin}${location.pathname}?r=${enc}`;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(showCopied);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showCopied(); } catch (_) {}
      document.body.removeChild(ta);
    }
  }

  function showCopied() {
    if (!el.shareBtn) return;
    const original = el.shareBtn.textContent;
    el.shareBtn.textContent = 'Link copied ✓';
    setTimeout(() => { el.shareBtn.textContent = original; }, 2200);
  }

  /* ────────── FORM SUBMISSION ────────── */
  function handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());

    let hasError = false;
    ['email', 'industry', 'teamSize', 'revenueRange'].forEach(k => {
      const field = form.querySelector(`[name="${k}"]`);
      if (!field) return;
      const wrapper = field.closest('.asmt-field');
      const val = (data[k] || '').trim();
      const ok = k === 'email' ? /^\S+@\S+\.\S+$/.test(val) : val.length > 0;
      if (wrapper) wrapper.classList.toggle('has-error', !ok);
      if (!ok) hasError = true;
    });
    if (hasError) return;

    state.form = data;
    computeScores();

    const payload = buildSubmitPayload();
    el.submitBtn.disabled = true;
    el.submitBtn.textContent = 'Sending...';

    postSubmission(payload)
      .then(resp => {
        state.submissionId = resp.id || generateLocalId();
        renderResults();
      })
      .catch(err => {
        console.warn('[scorecard] submission failed, rendering results anyway:', err);
        state.submissionId = generateLocalId();
        renderResults();
      });
  }

  function buildScorecardTags() {
    const tags = ['ai-readiness-scorecard', 'scorecard-lead'];
    if (state.tier) tags.push('scorecard-tier-' + state.tier.label.toLowerCase().replace(/\s+/g, '-'));
    if (!state.isOptimized && state.primary) tags.push('constraint-' + state.primary);
    return tags;
  }

  function buildSubmitPayload() {
    const answerDetail = QUESTIONS.map((q, i) => ({
      id: q.id,
      domain: q.domain,
      question: q.text,
      value: state.answers[i],
      choice: (q.options.find(o => o.v === state.answers[i]) || {}).text || '',
    }));

    const tags = buildScorecardTags();
    const primaryConstraintLabel = state.isOptimized ? 'Optimized' : DOMAIN_LABELS[state.primary];

    return {
      submittedAt: new Date().toISOString(),
      // Top-level contact fields — GHL workflow maps these directly
      email: state.form.email,
      firstName: state.form.firstName || '',
      source: 'AI Readiness Scorecard',
      tags: tags,
      industry: state.form.industry,
      teamSize: state.form.teamSize,
      revenueRange: state.form.revenueRange,
      biggestChallenge: state.form.biggestChallenge || null,
      howHeard: state.form.howHeard || null,
      // Flat GHL block — easy to reference in workflow custom field mapping
      ghl: {
        email: state.form.email,
        firstName: state.form.firstName || '',
        source: 'AI Readiness Scorecard',
        tags: tags,
        industry: state.form.industry,
        teamSize: state.form.teamSize,
        revenueRange: state.form.revenueRange,
        biggestChallenge: state.form.biggestChallenge || '',
        howHeard: state.form.howHeard || '',
        scorecardScore: state.overallScore,
        scorecardTier: state.tier.label,
        primaryConstraint: primaryConstraintLabel,
        revenueScore: state.domainScores.revenue,
        operationsScore: state.domainScores.operations,
        knowledgeScore: state.domainScores.knowledge,
        authorityScore: state.domainScores.authority,
        revenueStatus: getStatusLabel(state.domainScores.revenue),
        operationsStatus: getStatusLabel(state.domainScores.operations),
        knowledgeStatus: getStatusLabel(state.domainScores.knowledge),
        authorityStatus: getStatusLabel(state.domainScores.authority),
      },
      score: {
        overall: state.overallScore,
        domains: state.domainScores,
        domainStatuses: Object.fromEntries(
          Object.entries(state.domainScores).map(([k, v]) => [k, getStatusLabel(v)])
        ),
        tier: state.tier.label,
        isOptimized: state.isOptimized,
        primaryConstraint: primaryConstraintLabel,
        primaryConstraintKey: state.isOptimized ? null : state.primary,
      },
      answers: answerDetail,
      meta: {
        utm: state.utm,
        userAgent: navigator.userAgent,
        locale: navigator.language,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        durationMs: state.startedAt ? (Date.now() - state.startedAt) : null,
      },
    };
  }

  function postSubmission(payload) {
    if (!ASSESSMENT_CONFIG.submitEndpoint) {
      console.info('[scorecard] submitEndpoint not configured — payload:', payload);
      return Promise.resolve({ id: generateLocalId() });
    }
    return fetch(ASSESSMENT_CONFIG.submitEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(() => ({ id: generateLocalId() }))
    .catch(() => ({ id: generateLocalId() }));
  }

  function generateLocalId() {
    return 'local_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  /* ────────── WIRING ────────── */
  function init() {
    el.startBtn.addEventListener('click', () => {
      state.startedAt = Date.now();
      state.currentIndex = 0;
      showScreen('quiz');
      renderQuestion(0);
    });

    el.continueBtn.addEventListener('click', () => {
      if (state.answers[state.currentIndex] == null) return;
      if (state.currentIndex < QUESTIONS.length - 1) {
        goToQuestion(state.currentIndex + 1);
      } else {
        runCalculatingScreen();
      }
    });

    el.backBtn.addEventListener('click', () => {
      if (state.currentIndex > 0) goToQuestion(state.currentIndex - 1);
    });

    el.leadForm.addEventListener('submit', handleFormSubmit);

    document.addEventListener('keydown', e => {
      if (el.app.dataset.screen !== 'quiz') return;
      if (e.key === 'Enter' && !el.continueBtn.disabled) {
        e.preventDefault();
        el.continueBtn.click();
      } else if (e.key === 'ArrowRight' && !el.continueBtn.disabled) {
        el.continueBtn.click();
      } else if (e.key === 'ArrowLeft' && !el.backBtn.disabled) {
        el.backBtn.click();
      } else if (['1','2','3','4'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const opt = document.querySelectorAll('.asmt-option')[idx];
        if (opt) opt.click();
      }
    });

    // Deep-link: ?r=<encoded> loads shared results
    const params = new URLSearchParams(location.search);
    if (params.get('r')) {
      try {
        const payload = JSON.parse(decodeURIComponent(escape(atob(params.get('r')))));
        if (Array.isArray(payload.a) && payload.a.length === QUESTIONS.length) {
          state.answers = payload.a;
          state.form = { email: '' };
          renderResults();
          return;
        }
      } catch (_) {}
    }

    showScreen('intro');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
