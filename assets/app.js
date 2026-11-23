// Portfolio: lekha data.json theke, GitHub theke live data (1 ghonta cache), animation.
(async function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const ago = iso => {
    const s = (new Date(iso) - Date.now()) / 1000, units = [['year', 31536e3], ['month', 2592e3], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [u, v] of units) if (Math.abs(s) >= v) return rtf.format(Math.round(s / v), u);
    return 'just now';
  };

  // ---------- theme ----------
  const themeBtn = $('#theme');
  const setTheme = m => { document.documentElement.dataset.theme = m; themeBtn.textContent = m === 'light' ? '🌙' : '☀️'; try { localStorage.setItem('theme', m); } catch (e) {} };
  let saved = null; try { saved = localStorage.getItem('theme'); } catch (e) {}
  setTheme(saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  themeBtn.onclick = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');

  // ---------- data.json ----------
  let D;
  try { D = await (await fetch('data.json', { cache: 'no-cache' })).json(); }
  catch (e) { console.warn('data.json load holo na', e); return; }   // HTML er static lekha thakbe

  $('#name').textContent = (D.short || D.name) + '.';
  $('#lead').innerHTML = D.lead;                              // data.json nijer (b tag thake)
  $('#about-text').innerHTML = D.about.map(p => `<p>${esc(p)}</p>`).join('');
  $('#stats').innerHTML = D.stats.map((s, i) => `<div class="stat"><b data-count="${s.value ?? ''}" id="stat${i}">${s.value ?? '–'}</b><span>${esc(s.label)}</span></div>`).join('');

  // projects + filter
  const types = { all: 'All', web: '🌐 Web', iot: '🔧 IoT & Robots' };
  $('#filters').innerHTML = Object.entries(types).map(([k, v], i) => `<button class="chip${i ? '' : ' on'}" data-f="${k}">${v}</button>`).join('');
  $('#projects-list').innerHTML = D.projects.map(p => `
    <article class="proj rv tilt" data-type="${esc(p.type)}">
      <div class="shot ${esc(p.imageStyle || '')}" style="background-image:url('${esc(p.image)}')" role="img" aria-label="${esc(p.name)}"></div>
      <div class="body">
        <span class="role ${esc(p.roleColor || 'blue')}">${esc(p.role)}</span>
        <h3>${esc(p.name)}</h3>
        ${p.repo ? `<div class="live" id="live-${esc(p.repo)}"></div>` : ''}
        <p>${esc(p.text)}</p>
        <ul>${p.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="tags">${p.tags.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>
        <div class="btns"><a class="btn pri" href="${esc(p.link.url)}" target="_blank" rel="noopener">${esc(p.link.text)}</a>
        ${p.demo ? '<a class="btn" href="#demo">▶ Try the live demo</a>' : ''}</div>
      </div>
    </article>`).join('');
  document.querySelectorAll('#filters .chip').forEach(b => b.onclick = () => {
    document.querySelectorAll('#filters .chip').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('#projects-list .proj').forEach(c => c.classList.toggle('hide', b.dataset.f !== 'all' && c.dataset.type !== b.dataset.f));
  });

  $('#skills-list').innerHTML = D.skills.map(s => `<div class="sk rv tilt"><h4>${esc(s.title)}</h4><div class="tags">${s.items.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div></div>`).join('');
  const C = D.contact;
  $('#contact-title').textContent = C.title;
  $('#contact-text').textContent = C.text;
  $('#contact-btns').innerHTML = `<a class="btn pri" href="mailto:${esc(C.email)}">✉️ Email</a>` + C.links.map(l => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${l.icon ? esc(l.icon) + ' ' : ''}${esc(l.text)}</a>`).join('');
  if (C.telegram) { $('#tg').href = 'https://t.me/' + encodeURIComponent(C.telegram); $('#tg b').textContent = '@' + C.telegram; }
  $('#mail').textContent = C.email; $('#mail').href = 'mailto:' + C.email;
  $('#year').textContent = new Date().getFullYear();
  document.dispatchEvent(new Event('portfolio:ready'));          // creative.js: nam er okkhor animation

  // ---------- typing effect ----------
  const tw = $('#typed');
  if (calm) tw.textContent = D.roles[0];
  else (async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; ; i = (i + 1) % D.roles.length) {
      const w = [...D.roles[i]];
      for (let k = 1; k <= w.length; k++) { tw.textContent = w.slice(0, k).join(''); await wait(70); }
      await wait(1700);
      for (let k = w.length; k >= 0; k--) { tw.textContent = w.slice(0, k).join(''); await wait(35); }
      await wait(350);
    }
  })();

  // ---------- reveal + count-up + tilt ----------
  const countUp = el => {
    const n = +el.dataset.count; if (!n || calm) { el.textContent = el.dataset.count || el.textContent; return; }
    const t0 = performance.now(), dur = 1100;
    const step = now => { const k = Math.min(1, (now - t0) / dur); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    e.target.querySelectorAll?.('[data-count]').forEach(countUp);
    io.unobserve(e.target);
  }), { threshold: 0.12 });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));
  // ---------- ✨ hover: alo mouse er pichone, card ektu kaat, button chumbok ----------
  // (ek jaygay shob - pore toiri hoya card e-o kaj kore, jemon GitHub repo)
  const FX = '.proj, .repo, .sk, .stat, .vb-guide button, .photo .badge, .btn, .talk';
  const markFx = () => document.querySelectorAll(FX).forEach(el => el.classList.add('fx'));
  markFx(); const mo = new MutationObserver(markFx); ['#repos', '#projects-list'].forEach(q => $(q) && mo.observe($(q), { childList: true }));
  if (!calm && matchMedia('(hover: hover)').matches) {
    let cur = null;
    const reset = el => { el.style.transform = ''; };
    document.addEventListener('pointermove', ev => {
      const el = ev.target.closest ? ev.target.closest('.fx') : null;
      if (cur && cur !== el) reset(cur);
      cur = el; if (!el) return;
      const r = el.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, nx = x / r.width - 0.5, ny = y / r.height - 0.5;
      el.style.setProperty('--mx', x + 'px'); el.style.setProperty('--my', y + 'px');
      if (el.classList.contains('tilt')) el.style.transform = `perspective(900px) rotateX(${(-ny * 5).toFixed(2)}deg) rotateY(${(nx * 5).toFixed(2)}deg) translateY(-4px)`;
      else if (el.matches('.btn, .talk')) el.style.transform = `translate(${(nx * 8).toFixed(1)}px, ${(ny * 6 - 3).toFixed(1)}px)`;   // 🧲 chumbok
    }, { passive: true });
    document.addEventListener('pointerleave', () => { if (cur) reset(cur); cur = null; });
  }

  // ---------- nav: pill ta link er pichone shore (hover + kon section e acho) ----------
  const nav = $('#navlinks'), ind = nav && nav.querySelector('.nav-ind');
  if (nav && ind) {
    const links = [...nav.querySelectorAll('a')];
    let active = links[0];
    const moveTo = a => {
      if (!a) { ind.style.opacity = 0; return; }
      const r = a.getBoundingClientRect(), pr = nav.getBoundingClientRect();
      ind.style.width = r.width + 'px'; ind.style.transform = `translateX(${r.left - pr.left}px)`; ind.style.opacity = 1;
    };
    links.forEach(a => a.addEventListener('pointerenter', () => moveTo(a)));
    nav.addEventListener('pointerleave', () => moveTo(active));
    const secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const spy = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      active = links.find(a => a.getAttribute('href') === '#' + e.target.id) || active;
      links.forEach(a => a.classList.toggle('on', a === active));
      if (!nav.matches(':hover')) moveTo(active);
    }), { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(sec => spy.observe(sec));
    addEventListener('resize', () => moveTo(active));
    requestAnimationFrame(() => moveTo(active));
  }

  // ---------- 🤖 Virtual PetBot ----------
  if (window.VirtualPetBot && $('#vbot')) {
    const bot = window.VirtualPetBot({ root: $('#vbot'), canvas: $('#vb-oled'), pad: $('#vb-pad'), body: $('#vb-body'),
                                       armL: $('#vb-arm-l'), armR: $('#vb-arm-r'), desk: $('#vb-desk') });
    window.petbot = bot;                                        // console theke khelte: petbot.tap(3)
    const EMO = { normal: '😊', happy: '😄', laugh: '🤣', love: '😍', wink: '😉', sad: '😢', cry: '😭', angry: '😠', surprised: '😲', scared: '😨',
                  confused: '😕', suspicious: '🤨', bored: '😑', excited: '🤩', sleepy: '🥱', sleep: '😴', dizzy: '😵‍💫', music: '🎵', plead: '🥺',
                  annoyed: '😒', sneeze: '🤧', stretch: '🙆', hum: '🎶', whistle: '😗' };
    const nowEl = $('#vb-now'); let lastTxt = '';
    bot.onState = R => {
      const t = R.qrUntil ? '🐙 GitHub QR' : R.game ? '🎬 animations' : R.clockMode ? '⏰ clock · ' + R.clockView : (EMO[R.mood] || '🙂') + ' ' + R.mood;
      if (t !== lastTxt) { nowEl.textContent = t; lastTxt = t; }
    };
    const soundBtn = $('#vb-sound'), langBtn = $('#vb-lang');
    const showSound = () => soundBtn.textContent = bot.sound() ? '🔊 Sound on' : '🔇 Sound off';
    const showLang = () => langBtn.textContent = 'Language: ' + (bot.lang() ? 'English' : 'বাংলা');
    bot.onLang = showLang; showSound(); showLang();
    soundBtn.onclick = () => { bot.sound(!bot.sound()); showSound(); };
    langBtn.onclick = () => bot.lang(!bot.lang());
    let busy = false;
    document.querySelectorAll('#vb-guide button').forEach(b => b.onclick = async () => {
      if (busy) return; busy = true; b.classList.add('run');
      try {
        if (b.dataset.tap) await bot.tap(+b.dataset.tap);
        else if (b.dataset.hold) await bot.hold(+b.dataset.hold);
        else if (b.dataset.act === 'shake') bot.shake();
        else if (b.dataset.act === 'knock') bot.knock();
      } finally { busy = false; b.classList.remove('run'); }
    });
  }

  // ---------- GitHub live data (1 ghonta cache) ----------
  const user = D.github;
  // github.json: GitHub Action protidin kayekbar banay. Live API er limit (60/ghonta) shesh hole eta dekhai.
  let snapP = null;
  const snap = () => snapP || (snapP = fetch('github.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null));
  const fromSnap = async (path, wantCount) => {
    const S = await snap(); if (!S) return undefined;
    const repo = (/^repos\/[^/]+\/([^/]+)\/commits/.exec(path) || [])[1];
    if (repo) return wantCount ? S.commitCount?.[repo] : S.commits?.[repo];
    if (path.includes('/repos')) return S.repos;
    if (path.startsWith('users/')) return S.user;
  };
  async function gh(path, wantCount = false) {
    try { return await ghLive(path, wantCount); }
    catch (e) { const v = await fromSnap(path, wantCount); if (v === undefined || v === null) throw e; return v; }
  }
  async function ghLive(path, wantCount) {
    const key = 'gh:' + path;
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < 3600e3) return c.v; } catch (e) {}
    const r = await fetch('https://api.github.com/' + path, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error('GitHub ' + r.status);
    let v = await r.json();
    if (wantCount) {                                         // commit gona: "last" page er nombor
      const m = /[?&]page=(\d+)>; rel="last"/.exec(r.headers.get('Link') || '');
      v = m ? +m[1] : (Array.isArray(v) ? v.length : 0);
    }
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch (e) {}
    return v;
  }
  const LANG = { C: '#555555', 'C++': '#f34b7d', HTML: '#e34c26', JavaScript: '#f1e05a', CSS: '#563d7c', Python: '#3572A5', PHP: '#4F5D95' };

  gh('users/' + user).then(u => {
    $('#gh-meta').innerHTML = `<span>📦 ${u.public_repos} public repos</span><span>👥 ${u.followers} followers</span>`;
  }).catch(() => {});

  gh(`users/${user}/repos?sort=pushed&per_page=100`).then(repos => {
    const list = repos.filter(r => !r.fork && !D.hideRepos.includes(r.name));
    if (list.length && list[0].pushed_at) $('#pulse').innerHTML = `<i></i>Last code push ${ago(list[0].pushed_at)}`;
    $('#repos').innerHTML = list.map(r => `
      <a class="repo rv in tilt" href="${esc(r.html_url)}" target="_blank" rel="noopener">
        <h4>📁 ${esc(r.name)}</h4>
        <p>${esc(r.description || '')}</p>
        <div class="rmeta">${r.language ? `<span><i style="background:${LANG[r.language] || '#8b949e'}"></i>${esc(r.language)}</span>` : ''}
          <span>⭐ ${r.stargazers_count}</span><span>🍴 ${r.forks_count}</span><span>updated ${ago(r.pushed_at)}</span></div>
      </a>`).join('') || '<p class="sub">No public repositories yet.</p>';
    for (const p of D.projects) if (p.repo) {
      const r = repos.find(x => x.name === p.repo), el = $('#live-' + p.repo);
      if (r && el) el.innerHTML = `<span class="dot"></span>⭐ ${r.stargazers_count} · updated ${ago(r.pushed_at)} · open source`;
    }
  }).catch(() => { $('#repos').innerHTML = `<p class="sub">GitHub is busy right now — <a href="https://github.com/${esc(user)}" target="_blank" rel="noopener">see my repositories on GitHub ↗</a></p>`; });

  const repoMain = (D.projects.find(p => p.repo) || {}).repo;
  if (repoMain) {
    gh(`repos/${user}/${repoMain}/commits?per_page=5`).then(cs => {
      $('#activity').innerHTML = cs.map(c => `
        <li><a href="${esc(c.html_url)}" target="_blank" rel="noopener"><b>${esc(c.commit.message.split('\n')[0])}</b></a>
        <span>${esc(repoMain)} · ${ago(c.commit.author.date)}</span></li>`).join('');
    }).catch(() => { $('#activity-wrap').style.display = 'none'; });
    D.stats.forEach((s, i) => {
      if (s.github !== 'commits') return;
      gh(`repos/${user}/${s.repo}/commits?per_page=1`, true).then(n => { const el = $('#stat' + i); el.dataset.count = n; el.textContent = n; if (el.closest('.in')) countUp(el); }).catch(() => {});
    });
  }
})();
