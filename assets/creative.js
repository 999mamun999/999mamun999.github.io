// ✨ Creative layer: hero er OLED pixel grid, nam er okkhor animation, mouse ring, scroll bar.
// Shob kichu "kom animation" setting e bondho thake, ar touch phone e mouse ring thake na.
(function () {
  const $ = s => document.querySelector(s);
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---------- 1) scroll progress bar ----------
  const bar = $('#progress');
  if (bar) {
    const upd = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`; };
    addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
  }

  // ---------- 2) nam er okkhor gulo ek ek kore uthe, hover e lafay ----------
  let split = false;
  function splitName() {
    const em = $('#name'); if (!em || split || calm) return; split = true;
    const txt = em.textContent;
    em.setAttribute('aria-label', txt);
    em.innerHTML = [...txt].map((c, i) => `<span class="ch" aria-hidden="true" style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
    em.querySelectorAll('.ch').forEach(ch => ch.addEventListener('animationend', () => ch.classList.add('done'), { once: true }));
    // contact title: shesh shobdo italic komla
    const ct = $('#contact-title');
    if (ct && !ct.querySelector('em')) { const w = ct.textContent.trim().split(' '); const last = w.pop(); ct.innerHTML = (w.length ? w.join(' ') + ' ' : '') + `<em>${last}</em>`; }
  }
  document.addEventListener('portfolio:ready', splitName);
  setTimeout(splitName, 2500);                                    // data.json na ashle-o

  // ---------- 3) hero background: OLED er moto pixel grid ----------
  const cv = $('#hero-grid'), hero = $('.hero');
  if (cv && hero && !calm) {
    const ctx = cv.getContext('2d'), G = 24;
    let W = 0, H = 0, dpr = 1, visible = true, mouse = null, ripples = [], acc = [254, 127, 45], base = [120, 150, 170];
    const readColors = () => {
      const light = document.documentElement.dataset.theme === 'light';
      base = light ? [35, 61, 77] : [120, 150, 170];
    };
    const resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); readColors();
    };
    resize(); addEventListener('resize', resize);
    new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    hero.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; });
    hero.addEventListener('pointerleave', () => mouse = null);
    hero.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }); if (ripples.length > 4) ripples.shift(); });
    new IntersectionObserver(es => es.forEach(e => visible = e.isIntersecting)).observe(hero);
    const start = performance.now();
    function frame(t) {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      ctx.clearRect(0, 0, W, H);
      // mouse na thakle ekta "alo" nijei aste aste ghure bedায় (phone e-o jibonto lage)
      const auto = { x: W * (0.5 + 0.32 * Math.sin(t / 3100)), y: H * (0.5 + 0.3 * Math.sin(t / 2300 + 1)) };
      const L = mouse && t - mouse.t < 4000 ? mouse : auto, R = mouse ? 190 : 230, boost = mouse ? 1 : 0.55;
      const intro = Math.min(1, (t - start) / 1600);             // shuru te dhire dhire jole uthe
      ripples = ripples.filter(r => t - r.t < 1800);
      for (let y = G / 2; y < H; y += G) for (let x = G / 2; x < W; x += G) {
        const dx = x - L.x, dy = y - L.y, d = Math.sqrt(dx * dx + dy * dy);
        let k = Math.max(0, 1 - d / R); k = k * k * boost;
        let band = 0;
        for (const r of ripples) { const rr = (t - r.t) * 0.5, dd = Math.hypot(x - r.x, y - r.y); band = Math.max(band, Math.max(0, 1 - Math.abs(dd - rr) / 34) * (1 - (t - r.t) / 1800)); }
        const wave = (Math.sin(x * 0.018 + t * 0.0011) + Math.sin(y * 0.022 - t * 0.0009)) * 0.25 + 0.5;
        const hot = Math.min(1, k + band);
        const a = (0.05 + 0.06 * wave + hot * 0.85) * intro;
        const s = 2 + hot * 3.2;
        const c = hot > 0.04 ? acc : base;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
    requestAnimationFrame(frame);
  }

  // ---------- 4) mouse er pichone komla ring ----------
  if (finePointer && !calm) {
    const ring = document.createElement('div'); ring.className = 'cursor'; ring.setAttribute('aria-hidden', 'true'); ring.innerHTML = '<span></span>';
    document.body.append(ring);
    const label = ring.querySelector('span');
    let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, shown = false;
    addEventListener('pointermove', e => {
      tx = e.clientX; ty = e.clientY; if (!shown) { x = tx; y = ty; shown = true; ring.classList.add('on'); }
      const t = e.target.closest ? e.target : null;
      const view = t && t.closest('.repo');
      const big = t && t.closest('a, button, .fx, .chip, .vb-pad, .vb-desk, input, label');
      ring.classList.toggle('big', !!big && !view);
      ring.classList.toggle('view', !!view);
      label.textContent = view ? 'View' : '';
    }, { passive: true });
    document.addEventListener('pointerleave', () => { ring.classList.remove('on'); shown = false; });
    addEventListener('pointerdown', () => ring.classList.add('press')); addEventListener('pointerup', () => ring.classList.remove('press'));
    (function loop() { x += (tx - x) * 0.2; y += (ty - y) * 0.2; ring.style.transform = `translate(${x}px, ${y}px)`; requestAnimationFrame(loop); })();
  }
})();
