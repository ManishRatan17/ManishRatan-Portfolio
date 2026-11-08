(() => {
  'use strict';
  window.__siteReady = true; // tells the safety net in <head> that the script is running

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let mx = 0, my = 0; // hero mouse position (declared early: onScroll uses it on load)

  /* ---------- Year ---------- */
  $('#year').textContent = new Date().getFullYear();

  /* ---------- Theme toggle ---------- */
  $('#themeToggle').addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  /* ---------- Split hero name into letters ---------- */
  $$('.split').forEach((el) => {
    const text = el.textContent;
    el.textContent = '';
    el.classList.add('is-split');
    [...text].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'ch';
      span.textContent = ch;
      el.appendChild(span);
    });
  });
  $$('.hero__name .ch').forEach((ch, i) => { ch.style.transitionDelay = `${0.35 + i * 0.045}s`; });

  /* ---------- Scroll reveal system ---------- */
  // Split section titles into words that rise out of a mask
  const splitWords = (el) => {
    const parts = [];
    el.childNodes.forEach((node) => {
      const cls = node.nodeType === 1 ? node.className : '';
      node.textContent.split(/(\s+)/).forEach((t) => {
        if (!t) return;
        if (/^\s+$/.test(t)) { parts.push(document.createTextNode(' ')); return; }
        const w = document.createElement('span');
        w.className = 'word';
        const inner = document.createElement('span');
        inner.textContent = t;
        if (cls) inner.className = cls;
        w.appendChild(inner);
        parts.push(w);
      });
    });
    el.textContent = '';
    parts.forEach((p) => el.appendChild(p));
    $$('.word > span', el).forEach((s, i) => s.style.setProperty('--wi', i));
  };

  // section heads: animate eyebrow + title separately instead of the whole block
  $$('.section__head').forEach((h) => {
    h.classList.remove('reveal');
    $$('.eyebrow', h).forEach((e) => e.classList.add('reveal'));
  });
  $$('.section__title').forEach((t) => {
    splitWords(t);
    t.classList.add('reveal');
    t.dataset.anim = 'words';
  });

  // give groups an animation style + automatic stagger
  const assign = (sel, anim, step = 0.12, base = 0) => {
    const groups = new Map();
    $$(sel).forEach((el) => {
      const key = el.parentElement;
      const i = groups.get(key) || 0;
      groups.set(key, i + 1);
      el.classList.add('reveal');
      el.dataset.anim = typeof anim === 'function' ? anim(el) : anim;
      el.style.setProperty('--d', `${base + i * step}s`);
    });
  };
  assign('.skill-card', 'rise', 0.13);
  assign('.project', 'rise', 0.15);
  assign('.fact', 'zoom', 0.08, 0.1);
  assign('.about__text > p', 'up', 0.12);
  assign('.tl-item', (el) => (el.matches(':nth-child(odd)') ? 'slide-r' : 'slide-l'), 0);
  assign('.code-card', 'flip');
  assign('.marquee', 'up');
  assign('.contact', 'zoom');
  assign('.contact__list li', 'up', 0.1, 0.3);

  // remaining elements fall back to their data-delay attribute
  $$('.reveal, .reveal-right').forEach((el) => {
    if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', `${parseFloat(el.dataset.delay || 0) * 0.1}s`);
  });

  const heroRevealEls = $$('.hero .reveal, .hero .reveal-right');
  // play once when the element enters, then stop observing it. (Replaying on every
  // pass made fast up/down scrolling restart dozens of animations at once → jank.)
  const pendingReveals = new Set();
  const revealEl = (el) => {
    el.classList.add('is-in');
    revealObserver.unobserve(el);
    pendingReveals.delete(el);
  };
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) revealEl(entry.target); });
  }, { threshold: 0, rootMargin: '0px 0px -8% 0px' }); // fires as soon as any part is on screen
  $$('.reveal, .reveal-right').forEach((el) => {
    if (heroRevealEls.includes(el)) return;
    pendingReveals.add(el);
    revealObserver.observe(el);
  });

  // A very fast fling or a jump (nav link, Home/End key) can carry an element from
  // below the viewport to above it between two observer checks, so it never
  // "intersects" and would stay hidden. Sweep for anything already scrolled past.
  let sweepTimer = 0;
  const sweepPassed = () => {
    sweepTimer = 0;
    // anything whose top is already above the bottom of the screen (passed or partly visible)
    const limit = innerHeight * 0.92;
    pendingReveals.forEach((el) => { if (el.getBoundingClientRect().top < limit) revealEl(el); });
    if (!pendingReveals.size) window.removeEventListener('scroll', scheduleSweep);
  };
  const scheduleSweep = () => { if (!sweepTimer) sweepTimer = setTimeout(sweepPassed, 200); };
  window.addEventListener('scroll', scheduleSweep, { passive: true });
  // a reload restores the old scroll position without a scroll event → sweep on load too
  window.addEventListener('load', scheduleSweep);
  window.addEventListener('pageshow', scheduleSweep);
  scheduleSweep();

  // sections get an "in-view" class for their divider-line + glow effect
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.classList.toggle('in-view', e.isIntersecting));
  }, { threshold: 0.08 });
  $$('.section').forEach((s) => sectionObserver.observe(s));

  function startHeroReveal() {
    heroRevealEls.forEach((el) => el.classList.add('is-in'));
    runCounters();
  }

  /* ---------- Counters ---------- */
  function runCounters() {
    $$('.counter').forEach((el) => {
      const target = +el.dataset.target;
      const duration = 1600;
      const start = performance.now() + 600;
      const tick = (now) => {
        const p = Math.min(Math.max((now - start) / duration, 0), 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- Typed role ---------- */
  const roles = ['Backend & Full-Stack Developer', 'API Architect', 'Problem Solver', 'Lifelong Learner'];
  const typedEl = $('#typed');
  let startTyping = () => {};
  if (!reduceMotion) {
    let r = 0, c = roles[0].length, deleting = true;
    const loop = () => {
      const word = roles[r];
      typedEl.textContent = word.slice(0, c);
      let delay = deleting ? 40 : 85;
      if (deleting && c === 0) { deleting = false; r = (r + 1) % roles.length; delay = 400; }
      else if (!deleting && c === roles[r].length) { deleting = true; delay = 2400; }
      c += deleting ? -1 : 1;
      if (!deleting && c > roles[r].length) c = roles[r].length;
      setTimeout(loop, delay);
    };
    startTyping = (delay) => setTimeout(loop, delay);
  }

  /* ---------- Header, progress bar, scroll spy ---------- */
  const header = $('#header');
  const progress = $('#scrollProgress');
  const timeline = $('#timeline');
  const timelineFill = $('#timelineFill');
  const heroFrame = $('#heroFrame');
  const sceneLayers = $$('.hero__scene .layer');          // inner SVG groups: mouse parallax
  const sceneSvgs = $$('.hero__scene [data-scroll-depth]'); // whole GPU layers: scroll parallax
  sceneSvgs.forEach((s) => { s._depth = +s.dataset.scrollDepth; });

  /* Performance: layout is measured only when it can change (resize / content
     size change), never inside the scroll handler. The handler itself is batched
     to one update per animation frame and only writes transforms. */
  let maxScroll = 1, tlTop = 0, tlHeight = 1, vh = innerHeight;
  const measure = () => {
    vh = innerHeight;
    maxScroll = Math.max(document.documentElement.scrollHeight - vh, 1);
    const r = timeline.getBoundingClientRect();
    tlTop = r.top + window.scrollY;
    tlHeight = Math.max(r.height, 1);
  };

  let ticking = false, lastY = -1, isScrolled = null;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    if (y === lastY) return;
    lastY = y;

    progress.style.transform = `scaleX(${y / maxScroll})`;

    const scrolled = y > 30;
    if (scrolled !== isScrolled) { isScrolled = scrolled; header.classList.toggle('scrolled', scrolled); }

    const p = Math.min(Math.max((y + vh * 0.65 - tlTop) / tlHeight, 0), 1);
    timelineFill.style.transform = `scaleY(${p})`;

    if (!reduceMotion && y < vh * 1.3) {
      sceneSvgs.forEach((s) => { s.style.transform = `translate3d(0, ${(y * s._depth).toFixed(1)}px, 0)`; });
    }
  };
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  const remeasure = () => { measure(); lastY = -1; onScroll(); };
  window.addEventListener('resize', remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);
  measure();
  update();

  // nav indicator
  const nav = $('#nav');
  const indicator = $('#navIndicator');
  const links = $$('.nav__link');
  const moveIndicator = (link) => {
    if (!link) return;
    indicator.style.width = `${link.offsetWidth}px`;
    indicator.style.transform = `translateX(${link.offsetLeft}px)`;
  };
  const setActive = (id) => {
    links.forEach((l) => l.classList.toggle('active', l.dataset.section === id));
    moveIndicator(links.find((l) => l.dataset.section === id));
  };
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach((s) => spy.observe(s));
  window.addEventListener('resize', () => moveIndicator($('.nav__link.active')));
  indicator.style.transition = 'none';
  moveIndicator($('.nav__link.active'));
  void indicator.offsetWidth; // commit position before re-enabling transitions
  indicator.style.transition = '';
  document.fonts && document.fonts.ready.then(() => moveIndicator($('.nav__link.active')));

  // mobile menu
  const menuToggle = $('#menuToggle');
  const setMenu = (open) => {
    nav.classList.toggle('open', open);
    header.classList.toggle('menu-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setMenu(!nav.classList.contains('open'));
  });
  links.forEach((l) => l.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('open') && !nav.contains(e.target)) setMenu(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  window.matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });

  /* ---------- Hero mouse parallax (rAF-batched) ---------- */
  function applySceneTransform() {
    sceneLayers.forEach((l) => {
      const d = +l.dataset.depth;
      l.style.transform = `translate(${(mx * d * -40).toFixed(1)}px, ${(my * d * -20).toFixed(1)}px)`;
    });
  }
  if (!reduceMotion && finePointer) {
    let heroRect = null, mouseQueued = false;
    heroFrame.addEventListener('mouseenter', () => { heroRect = heroFrame.getBoundingClientRect(); });
    heroFrame.addEventListener('mousemove', (e) => {
      if (!heroRect) heroRect = heroFrame.getBoundingClientRect();
      mx = (e.clientX - heroRect.left) / heroRect.width - 0.5;
      my = (e.clientY - heroRect.top) / heroRect.height - 0.5;
      if (!mouseQueued) { mouseQueued = true; requestAnimationFrame(() => { mouseQueued = false; applySceneTransform(); }); }
    });
    heroFrame.addEventListener('mouseleave', () => { heroRect = null; mx = my = 0; applySceneTransform(); });
    window.addEventListener('scroll', () => { heroRect = null; }, { passive: true });
  }

  /* ---------- Hero visibility: pause everything in the hero when off-screen ---------- */
  let heroVisible = true;
  new IntersectionObserver(([e]) => {
    heroVisible = e.isIntersecting;
    heroFrame.classList.toggle('is-paused', !heroVisible);
    if (heroVisible) startFireflies();
  }).observe(heroFrame);

  // the rotating border gradient must cover the frame's diagonal
  const sizeRing = () => {
    const r = heroFrame.getBoundingClientRect();
    heroFrame.style.setProperty('--ring', `${Math.ceil(Math.hypot(r.width, r.height)) + 4}px`);
  };
  sizeRing();
  if ('ResizeObserver' in window) new ResizeObserver(sizeRing).observe(heroFrame);

  /* ---------- Fireflies canvas ---------- */
  // Each firefly is a pre-rendered glow sprite stamped with drawImage — no per-frame
  // gradient objects. The loop stops completely while the hero is off-screen.
  const canvas = $('#fireflies');
  const ctx = canvas.getContext('2d');
  let flies = [], cw = 0, ch = 0, running = false, sprite = null, spriteTheme = '';
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const makeSprite = () => {
    const theme = document.documentElement.getAttribute('data-theme');
    if (sprite && theme === spriteTheme) return;
    spriteTheme = theme;
    const rgb = theme === 'light' ? '255,200,80' : '120,255,150';
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.25, `rgba(${rgb},0.55)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    sprite = s;
  };
  const sizeCanvas = () => {
    cw = canvas.clientWidth; ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(40, (cw * ch) / 13000));
    flies = Array.from({ length: count }, () => ({
      x: Math.random() * cw,
      y: ch * 0.35 + Math.random() * ch * 0.65,
      r: Math.random() * 1.8 + 0.6,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.25 - 0.05,
      phase: Math.random() * Math.PI * 2,
    }));
  };
  const draw = (t) => {
    if (!heroVisible || document.hidden) { running = false; return; }
    makeSprite();
    ctx.clearRect(0, 0, cw, ch);
    for (const f of flies) {
      f.x += f.vx + Math.sin(t / 1600 + f.phase) * 0.2;
      f.y += f.vy;
      if (f.y < ch * 0.2) { f.y = ch + 10; f.x = Math.random() * cw; }
      if (f.x < -10) f.x = cw + 10;
      else if (f.x > cw + 10) f.x = -10;
      const size = f.r * 12;
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t / 900 + f.phase));
      ctx.drawImage(sprite, f.x - size / 2, f.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  };
  function startFireflies() {
    if (reduceMotion || running || !cw) return;
    running = true;
    requestAnimationFrame(draw);
  }
  if (!reduceMotion) {
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) startFireflies(); });
    startFireflies();
  }

  /* ---------- Tilt + spotlight + magnetic (rect cached per hover, writes rAF-batched) ---------- */
  if (finePointer && !reduceMotion) {
    const hover = (el, onMove, onLeave) => {
      let rect = null, ev = null, queued = false;
      el.addEventListener('mouseenter', () => { rect = el.getBoundingClientRect(); });
      el.addEventListener('mousemove', (e) => {
        ev = e;
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          if (!rect) rect = el.getBoundingClientRect();
          onMove(ev, rect);
        });
      });
      el.addEventListener('mouseleave', () => { rect = null; onLeave && onLeave(); });
      window.addEventListener('scroll', () => { rect = null; }, { passive: true });
    };

    $$('.tilt').forEach((card) => hover(card, (e, r) => {
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transition = 'transform 0.1s linear, border-color .4s, box-shadow .4s';
      card.style.transform = `perspective(900px) rotateX(${(py * -8).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg) translateY(-6px)`;
    }, () => { card.style.transition = ''; card.style.transform = ''; }));

    $$('.spotlight').forEach((el) => hover(el, (e, r) => {
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    }));

    $$('.magnetic').forEach((el) => hover(el, (e, r) => {
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${(x * 0.25).toFixed(1)}px, ${(y * 0.35).toFixed(1)}px)`;
    }, () => { el.style.transform = ''; }));
  }

  /* ---------- Contact form → backend (server/server.js, POST /api/contact) ---------- */
  const form = $('#contactForm');
  const status = $('#formStatus');
  const submitBtn = $('#formSubmit');
  const submitLabel = $('.btn__label', submitBtn);
  const endpoint = form.dataset.endpoint || '/api/contact';
  const fallbackEmail = form.dataset.fallbackEmail;
  const formOpenedAt = Date.now();
  const field = (n) => form.elements.namedItem(n);
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const rules = {
    name: (v) => (v.length >= 2 && v.length <= 100 ? '' : 'Please enter your name.'),
    email: (v) => (EMAIL_RE.test(v) ? '' : 'Please enter a valid email address.'),
    message: (v) => (v.length >= 10 ? '' : 'Please write at least 10 characters.'),
  };
  const setFieldError = (n, msg) => {
    const input = field(n);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    $(`#${n}-error`).textContent = msg || '';
  };
  const setStatus = (html, isError = false) => {
    status.classList.toggle('error', isError);
    status.innerHTML = html;
  };
  const directEmailHtml = () =>
    fallbackEmail ? ` You can also email me directly at <a href="mailto:${fallbackEmail}">${fallbackEmail}</a>.` : '';

  // validate a field once the visitor leaves it, then live while they fix it
  Object.keys(rules).forEach((n) => {
    const input = field(n);
    input.addEventListener('blur', () => { if (input.value) setFieldError(n, rules[n](input.value.trim())); });
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') setFieldError(n, rules[n](input.value.trim()));
    });
  });

  let sending = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;

    const data = {
      name: field('name').value.trim(),
      email: field('email').value.trim(),
      message: field('message').value.trim(),
      website: field('website').value,           // honeypot
      elapsed: Date.now() - formOpenedAt,        // bots submit instantly
    };

    let firstInvalid = null;
    Object.keys(rules).forEach((n) => {
      const msg = rules[n](data[n]);
      setFieldError(n, msg);
      if (msg && !firstInvalid) firstInvalid = field(n);
    });
    if (firstInvalid) {
      setStatus('Please check the highlighted fields.', true);
      firstInvalid.focus();
      return;
    }

    sending = true;
    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;
    submitLabel.textContent = 'Sending…';
    setStatus('');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      // only show server messages we wrote ourselves (hosts can return {error:{code,…}} objects)
      if (typeof json.error !== 'string') delete json.error;

      if (res.ok && json.ok) {
        form.reset();
        Object.keys(rules).forEach((n) => setFieldError(n, ''));
        submitBtn.classList.add('is-sent');
        submitLabel.textContent = 'Message sent ✓';
        setStatus(`Thanks, ${data.name.split(' ')[0]}! Your message is on its way — I'll reply soon.`);
        setTimeout(() => { submitBtn.classList.remove('is-sent'); submitLabel.textContent = 'Send Message'; }, 4000);
      } else if (res.status === 400 && json.fields) {
        Object.entries(json.fields).forEach(([n, msg]) => setFieldError(n, msg));
        setStatus(json.error || 'Please check the highlighted fields.', true);
      } else {
        setStatus((json.error || 'Something went wrong while sending.') + directEmailHtml(), true);
      }
    } catch (err) {
      // offline, server down, timeout, or the page was opened as a local file
      setStatus("Couldn't reach the message service." + directEmailHtml(), true);
    } finally {
      clearTimeout(timeout);
      sending = false;
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
      if (!submitBtn.classList.contains('is-sent')) submitLabel.textContent = 'Send Message';
    }
  });

  /* =========================================================
     CINEMATIC INTRO — MR → Manish Ratan → homepage
     Animates the real hero <h1> (FLIP technique): every letter is
     measured in its final homepage position, then transformed so the
     initials form a centred monogram. The rest of the letters unfold
     out of them, and the whole name flies back to where it lives.
     Only transform / opacity / filter are animated → no layout shift.
     ========================================================= */
  const root = document.documentElement;
  const heroEl = $('.hero');
  const nameEl = $('.hero__name');

  const revealHomepage = () => {
    heroEl.classList.add('is-in');
    startHeroReveal();
  };

  const runIntro = () => {
    try { sessionStorage.setItem('mr-intro', '1'); } catch (e) {}
    window.scrollTo(0, 0);

    // the h1 now belongs to the intro instead of the generic reveal
    nameEl.classList.remove('reveal');
    nameEl.classList.add('intro-name');

    /* ---- measure the name where it really lives ---- */
    const chars = $$('.ch', nameEl);
    const words = $$('.split', nameEl).map((w) => $$('.ch', w));
    const box = nameEl.getBoundingClientRect();
    const rects = new Map(chars.map((c) => [c, c.getBoundingClientRect()]));
    const all = [...rects.values()];
    const L = Math.min(...all.map((r) => r.left)), Rt = Math.max(...all.map((r) => r.right));
    const T = Math.min(...all.map((r) => r.top)), B = Math.max(...all.map((r) => r.bottom));
    const textW = Rt - L, textH = B - T;
    const ox = (L + Rt) / 2 - box.left;          // visual centre of the text, local px
    const oy = (T + B) / 2 - box.top;
    const fs = parseFloat(getComputedStyle(nameEl).fontSize);
    const vw = innerWidth, vh = innerHeight;
    const tx = vw / 2 - (box.left + ox);           // move text centre → viewport centre
    const ty = vh / 2 - (box.top + oy);
    nameEl.style.transformOrigin = `${ox}px ${oy}px`;

    /* ---- monogram geometry: initials pulled together around the centre ---- */
    const initials = words.map((w) => w[0]);
    const gap = fs * 0.03;
    const monoW = initials.reduce((s, c) => s + rects.get(c).width, 0) + gap * (initials.length - 1);
    const lineH = rects.get(initials[0]).height;
    let cursor = ox - monoW / 2;
    const monoShift = initials.map((c) => {
      const r = rects.get(c);
      const shift = { x: cursor - (r.left - box.left), y: oy - (r.top - box.top + r.height / 2) };
      cursor += r.width + gap;
      return shift;
    });

    const TRACK = 0.12;                            // extra tracking while centred
    const spreadX = (c) => { const r = rects.get(c); return TRACK * (r.left - box.left + r.width / 2 - ox); };

    const sMono = Math.min((vw * 0.4) / monoW, (vh * 0.3) / lineH, 3.4);
    const sName = Math.min((vw * 0.84) / (textW * (1 + TRACK)), (vh * 0.34) / textH, 1.7);

    /* ---- timeline (ms) ---- */
    const t = { monoIn: 950, unfold: 1350, unfoldDur: 850, step: 55, flight: 2750, land: 3900 };
    const total = t.land;
    const off = (ms) => Math.min(ms / total, 1);
    const E = {
      out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
      fly: 'cubic-bezier(0.76, 0, 0.18, 1)',
    };
    const opts = { duration: total, fill: 'both' };
    const anims = [];
    const frames = (list) => list.map(([ms, f, easing]) => ({ offset: off(ms), easing: easing || 'linear', ...f }));

    /* ---- the h1: one element, centred → scaled → flown home ---- */
    const at = (x, y, s) => `translate(${x}px, ${y}px) scale(${s})`;
    anims.push(nameEl.animate(frames([
      [0, { transform: at(tx, ty + 12, sMono * 0.9) }, E.out],
      [t.monoIn, { transform: at(tx, ty, sMono) }],
      [t.unfold, { transform: at(tx, ty, sMono * 1.015) }, E.inOut],
      [t.unfold + t.unfoldDur + 5 * t.step, { transform: at(tx, ty, sName) }],
      [t.flight, { transform: at(tx, ty, sName * 1.012) }, E.fly],
      [t.land, { transform: at(0, 0, 1) }],
    ]), opts));

    /* ---- every letter ---- */
    const st = (x, y, o, blur, s = 1) => ({ transform: `translate(${x}px, ${y}px) scale(${s})`, opacity: o, filter: `blur(${blur}px)` });
    words.forEach((word, w) => {
      const init = word[0];
      const ir = rects.get(init);
      const sh = monoShift[w];
      word.forEach((c, i) => {
        const r = rects.get(c);
        const spread = st(spreadX(c), 0, 1, 0);
        const home = st(0, 0, 1, 0);
        let list;
        if (i === 0) {
          // initials: rise (M) / descend (R) softly into the monogram
          const dir = w === 0 ? 1 : -1;
          const delay = w * 140;
          list = [
            [0, st(sh.x, sh.y + dir * fs * 0.4, 0, 14)],
            [delay, st(sh.x, sh.y + dir * fs * 0.4, 0, 14), E.out],
            [t.monoIn - 140 + delay, st(sh.x, sh.y, 1, 0)],
            [t.unfold, st(sh.x, sh.y, 1, 0), E.inOut],
            [t.unfold + t.unfoldDur, spread],
          ];
        } else {
          // other letters: tucked behind their initial, then unfold outward one by one
          const tucked = st(sh.x + (ir.left - r.left) + ir.width * 0.25, sh.y + (ir.top - r.top), 0, 10, 0.55);
          const start = t.unfold + 120 + i * t.step;
          list = [
            [0, tucked],
            [start, tucked, E.out],
            [start + t.unfoldDur, spread],
          ];
        }
        list.push([t.flight, spread, E.fly], [t.land, home]);
        anims.push(c.animate(frames(list), opts));
      });
    });

    /* ---- atmosphere: soft glow + hairline under the type ---- */
    const glow = document.createElement('div');
    glow.className = 'intro-glow';
    const line = document.createElement('div');
    line.className = 'intro-line';
    const lineW = textW * (1 + TRACK) * sName;
    line.style.width = `${lineW}px`;
    line.style.marginLeft = `${-lineW / 2}px`;
    document.body.append(glow, line);
    const yMono = (lineH * sMono) / 2 + 16;
    const yName = (textH * sName) / 2 + 16;
    const lineAt = (y, sx) => `translateY(${y}px) scaleX(${sx})`;
    const monoRatio = (monoW * sMono) / lineW;
    anims.push(glow.animate(frames([
      [0, { opacity: 0, transform: 'scale(0.7)' }, E.out],
      [t.monoIn + 200, { opacity: 1, transform: 'scale(1)' }],
      [t.flight, { opacity: 1, transform: 'scale(1.05)' }, E.inOut],
      [t.land, { opacity: 0, transform: 'scale(1.2)' }],
    ]), opts));
    anims.push(line.animate(frames([
      [0, { opacity: 0, transform: lineAt(yMono, 0) }],
      [250, { opacity: 0, transform: lineAt(yMono, 0) }, E.out],
      [t.monoIn + 150, { opacity: 0.8, transform: lineAt(yMono, monoRatio) }],
      [t.unfold, { opacity: 0.8, transform: lineAt(yMono, monoRatio) }, E.inOut],
      [t.unfold + t.unfoldDur + 5 * t.step, { opacity: 0.8, transform: lineAt(yName, 1) }],
      [t.flight, { opacity: 0.8, transform: lineAt(yName, 1) }, E.out],
      [t.flight + 500, { opacity: 0, transform: lineAt(yName, 1.25) }],
      [t.land, { opacity: 0, transform: lineAt(yName, 1.25) }],
    ]), opts));

    // animations exist now → safe to show the h1 (no flash of the unanimated name)
    root.classList.add('intro-run');

    /* ---- reveal the homepage around the landing name ---- */
    let revealed = false, finished = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      root.classList.add('intro-reveal');
      revealHomepage();
      startTyping(2800);
    };
    const cleanup = () => {
      if (finished) return;
      finished = true;
      root.classList.remove('intro', 'intro-run', 'intro-reveal');
      anims.forEach((a) => a.cancel());   // final frame == natural layout, so nothing moves
      glow.remove();
      line.remove();
      nameEl.style.transformOrigin = '';
      window.removeEventListener('resize', skip);
    };
    const revealTimer = setTimeout(reveal, t.flight + 650);
    // reveal transitions run ≤ 2.4s; clean up only after they've all settled
    const cleanupTimer = setTimeout(cleanup, t.land + 2800);

    // skipping (user input, or a resize which invalidates the measurements) jumps to the end
    function skip() {
      if (finished) return;
      clearTimeout(revealTimer);
      clearTimeout(cleanupTimer);
      anims.forEach((a) => a.finish());
      reveal();
      setTimeout(cleanup, 2600);
    }
    window.addEventListener('resize', skip, { once: true });
    return skip;
  };

  if (root.classList.contains('intro')) {
    // The page must never feel stuck: the first scroll / tap / key press ends the intro
    // immediately (even while the font is still loading) and unlocks scrolling.
    let skipIntro = null;      // provided by runIntro once the animation exists
    let cancelled = false;
    const interactions = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const onInput = (e) => {
      interactions.forEach((ev) => window.removeEventListener(ev, onInput));
      if (!root.classList.contains('intro')) return;            // intro already over
      const wasLocked = !root.classList.contains('intro-reveal'); // scroll still blocked?
      if (skipIntro) {
        skipIntro();
      } else {
        // intro hadn't started yet → simply show the homepage
        cancelled = true;
        root.classList.remove('intro', 'intro-run', 'intro-reveal');
        revealHomepage();
        startTyping(1500);
      }
      // don't swallow the gesture: let that first wheel actually scroll the page
      if (e.type === 'wheel' && wasLocked) requestAnimationFrame(() => window.scrollBy(0, e.deltaY));
    };
    interactions.forEach((ev) => window.addEventListener(ev, onInput, { passive: true }));

    // wait for the web font so the measured letter positions are final
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))])
      .then(() => requestAnimationFrame(() => {
        if (!cancelled) skipIntro = runIntro();
      }));
  } else {
    revealHomepage();
    startTyping(reduceMotion ? 0 : 3600);
  }
})();
