// 🤖 Virtual PetBot: asol robot er moto touch, mood, haat, shobdo, gaan, ghori - browser e.
// Niyom gulo robot er firmware (handleTouch, setMood, armTargets, drawFrame, drawBand, drawClock) theke port kora.
// Shomoy gulo robot er-i, shudhu "keu khele na" golpo ta website er jonno chhoto kora (3 min -> 45 s).
(function () {
  const D = window.PB_DATA, Oled = window.PBOled, SCENES = window.PBScenes;
  if (!D || !Oled || !D.fsb9) return;

  const W = 128, H = 64, BAND_H = 16;
  const EYE_W = 30, EYE_H = 30, EYE_R = 8, EYE_GAP = 16;
  const LEFT_CX = W / 2 - EYE_GAP / 2 - EYE_W / 2, RIGHT_CX = W / 2 + EYE_GAP / 2 + EYE_W / 2;
  const EYE_CY = 33, MOUTH_Y = 54, MAX_LX = 20, MAX_LY = 3;
  const ARM_MIN = 20, ARM_MAX = 160, BLINK_MS = 160, PAGE_MS = 3000, SLIDE_MS = 400;
  // "keu khele na" golpo (robot e 180 s theke, ekhane chhoto)
  const PLEAD_AFTER = 45000, ANNOY_AFTER = 52000, ANGRY_AFTER = 59000, BORED_AFTER = 66000, SLEEPY_AFTER = 73000, SLEEP_AFTER = 80000;
  const { sin, cos, abs, round, trunc, min, max, PI } = Math;
  const fl = Math.floor, clamp = (v, a, b) => max(a, min(b, v));
  const rnd = (a, b) => b === undefined ? fl(Math.random() * a) : a + fl(Math.random() * (b - a));
  const DAY_NAME = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const DAY_TITLE = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON_NAME = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const MON_FULL = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const CLOCK_VIEWS = ['home', 'date', 'day', 'timer'];          // robot e aro ache (weather, namaz...) - ogulo ghorer data
  const CV_TITLE = { date: 'DATE', day: 'DAY', timer: 'TIMER' };
  const SCENE_LIST = Object.keys(SCENES || {});
  const LABEL = {}; D.moods.forEach((m, i) => LABEL[m] = D.labels[i]);
  const MOOD_SND = { happy: 'S_HAPPY', laugh: 'S_LAUGH', love: 'S_LOVE', wink: 'S_WINK', sad: 'S_SAD', cry: 'S_CRY', angry: 'S_ANGRY',
    surprised: 'S_SURPRISE', scared: 'S_SCARED', confused: 'S_CONFUSED', suspicious: 'S_SUSP', excited: 'S_EXCITED', sleepy: 'S_YAWN',
    dizzy: 'S_DIZZY', plead: 'S_PLEAD', annoyed: 'S_ANNOYED', bored: 'S_SIGH', sneeze: 'S_SNEEZE', stretch: 'S_STRETCH', whistle: 'S_WHISTLE' };
  const BN = {}; for (const [k, v] of Object.entries(D.bn)) BN[k] = { w: v.w, h: v.h, en: v.en, b: Uint8Array.from(v.b.match(/../g), x => parseInt(x, 16)) };

  // =====================================================================
  //  🔊 Buzzer (WebAudio square wave) - robot er playSound / updateSound er moto
  // =====================================================================
  const S = { ctx: null, osc: null, gain: null, on: true, notes: null, idx: 0, nextAt: 0 };
  try { S.on = localStorage.getItem('vb-sound') !== '0'; } catch (e) {}
  function audioInit() {
    if (S.ctx) { if (S.ctx.state === 'suspended') S.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    S.ctx = new AC(); S.osc = S.ctx.createOscillator(); S.gain = S.ctx.createGain();
    S.osc.type = 'square'; S.gain.gain.value = 0; S.osc.connect(S.gain).connect(S.ctx.destination); S.osc.start();
  }
  function tone(f, ms) {
    if (!S.ctx || !S.on || document.hidden) return;
    const t = S.ctx.currentTime;
    S.osc.frequency.setValueAtTime(f, t);
    S.gain.gain.cancelScheduledValues(t); S.gain.gain.setValueAtTime(0.03, t); S.gain.gain.setValueAtTime(0, t + ms / 1000);
  }
  function noTone() { if (S.ctx) { const t = S.ctx.currentTime; S.gain.gain.cancelScheduledValues(t); S.gain.gain.setValueAtTime(0, t); } }
  function play(notes) { if (!notes) return; S.notes = notes; S.idx = 0; S.nextAt = now; }
  const PLAY = name => play(D.snd[name] || D.fx[name]);
  function updateSound() {
    if (!S.notes || now < S.nextAt) return;
    if (S.idx >= S.notes.length) { noTone(); S.notes = null; return; }
    const [f, d] = S.notes[S.idx++];
    if (f) tone(f, d > 80 ? d - 30 : d); else noTone();
    S.nextAt += d;
    if (now - S.nextAt > 300) S.nextAt = now + d;
  }

  // =====================================================================
  //  State (robot er global variable gulor moto)
  // =====================================================================
  let now = 0;
  const R = {
    mood: 'normal', moodSince: 0, moodUntil: 0, moodSound: true, cryAfterDizzy: false, lastDizzyAt: 0,
    openness: 1, scale: 1, lookX: 0, lookY: 0, tLookX: 0, tLookY: 0, tRoll: 0, nextSaccade: 0,
    eyeL: { x: 0, y: 0, vx: 0, vy: 0 }, eyeR: { x: 0, y: 0, vx: 0, vy: 0 },
    blinking: false, blinkStart: 0, blinkK: 1, nextBlink: 2000,
    band: null, bandUntil: 0, bandBn: null, bandBnUntil: 0,
    arm: [ARM_MIN, ARM_MIN],
    lastActivity: 0, idleAngry: false, pleadRepeated: false, nextRandomMood: 10000,
    songIdx: -1, songStartAt: 0, lyricShown: -1, lyricSince: 0, lastFunny: -1,
    clockMode: false, clockView: 'home', viewChangedAt: 0, use24: false, fmtShowUntil: 0, peekClockUntil: 0,
    timerRunning: false, timerAlarm: false, timerLeftMs: 0, timerEndAt: 0, alarmStart: 0,
    game: false, scIdx: 0, scSince: 0, qrUntil: 0, qrShownAt: 0, langEn: false,
    welcomeStep: -1, welcomeNext: 0,
    pointer: null, pointerAt: -1e9, shakeScore: 0,
  };
  try { R.langEn = localStorage.getItem('vb-lang') === 'en'; } catch (e) {}

  function setMood(m, ms) {
    if (m !== R.mood && R.moodSound && MOOD_SND[m]) PLAY(MOOD_SND[m]);
    if (m !== R.mood && R.moodSound && m === 'hum') PLAY(rnd(2) ? 'S_HUM1' : 'S_HUM2');
    if (m !== R.mood) R.moodSince = now;
    R.mood = m; R.moodUntil = ms ? now + ms : 0;
  }
  const quiet = (m, ms) => { R.moodSound = false; setMood(m, ms); R.moodSound = true; };
  const showBand = (s, ms) => { R.band = s; R.bandUntil = now + ms; };
  const showBandBn = (id, ms) => { R.bandBn = id; R.bandBnUntil = now + ms; };
  const canBlink = () => !['sleep', 'dizzy', 'laugh', 'wink'].includes(R.mood);
  const waitingToPlay = () => ['plead', 'annoyed', 'bored'].includes(R.mood) || (R.mood === 'angry' && R.idleAngry);

  // =====================================================================
  //  ✏️ Drawing helpers (Adafruit GFX er moto)
  // =====================================================================
  let o;
  const adv = (s, f) => o.textW(s, f);
  function bmp(b, x, y, v = 1) {
    const rb = (b.w + 7) >> 3;
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) if (b.b[j * rb + (i >> 3)] & (0x80 >> (i & 7))) o.px(x + i, y + j, v);
  }
  function drawCircle(x0, y0, r, v = 1) {
    let f = 1 - r, ddx = 1, ddy = -2 * r, x = 0, y = r;
    o.px(x0, y0 + r, v); o.px(x0, y0 - r, v); o.px(x0 + r, y0, v); o.px(x0 - r, y0, v);
    while (x < y) {
      if (f >= 0) { y--; ddy += 2; f += ddy; } x++; ddx += 2; f += ddx;
      o.px(x0 + x, y0 + y, v); o.px(x0 - x, y0 + y, v); o.px(x0 + x, y0 - y, v); o.px(x0 - x, y0 - y, v);
      o.px(x0 + y, y0 + x, v); o.px(x0 - y, y0 + x, v); o.px(x0 + y, y0 - x, v); o.px(x0 - y, y0 - x, v);
    }
  }
  const drawLabel = (s, xoff = 0, v = 1) => { if (s) o.text(s, trunc((W - adv(s, D.fsb9)) / 2) + xoff, 13, D.fsb9, v); };
  const sW = s => adv(s, D.small);
  const sTxt = (x, yTop, s, v = 1) => o.text(s, x, yTop + D.small.cap, D.small, v);
  const sTxtC = (cx, yTop, s, v = 1) => sTxt(cx - trunc(sW(s) / 2), yTop, s, v);
  function drawCurve(cx, cy, hw, bend, tilt) {
    let px = cx - hw, py = round(cy - tilt);
    for (let i = -hw + 1; i <= hw; i++) {
      const u = i / hw, y = round(cy + bend * (1 - u * u) + tilt * u);
      o.line(px, py, cx + i, y); o.line(px, py + 1, cx + i, y + 1); px = cx + i; py = y;
    }
  }
  function drawWave(cx, cy, hw, amp, ph) {
    let px = cx - hw, py = cy + round(amp * sin(-hw * 0.9 + ph));
    for (let i = -hw + 1; i <= hw; i++) {
      const y = cy + round(amp * sin(i * 0.9 + ph));
      o.line(px, py, cx + i, y); o.line(px, py + 1, cx + i, y + 1); px = cx + i; py = y;
    }
  }
  const drawRing = (cx, cy, r) => { o.circle(cx, cy, r, 1); if (r > 2) o.circle(cx, cy, r - 2, 0); };
  function drawHeart(cx, cy, s, v = 1) {
    const r = s >> 1;
    o.circle(cx - r, cy - (r >> 1), r, v); o.circle(cx + r, cy - (r >> 1), r, v);
    o.tri(cx - 2 * r + 1, cy - (r >> 1) + 2, cx + 2 * r - 1, cy - (r >> 1) + 2, cx, cy + s, v);
  }
  const drawBlush = (x, y) => { for (let i = 0; i < 3; i++) o.line(x + i * 4 - 4, y + 2, x + i * 4 - 2, y - 1); };
  const drawNoteIcon = (x, y) => { o.circle(x, y, 2); o.vline(x + 2, y - 7, 7); o.line(x + 2, y - 7, x + 5, y - 4); };
  function drawFloatingNotes() {
    for (let i = 0; i < 3; i++) {
      const t = (now + i * 1000) % 3000, y = H + 2 - fl(t * 44 / 3000), x = (i % 2 ? 116 : 7) + trunc(sin((now + i * 600) / 280) * 3);
      if (y > BAND_H + 8) drawNoteIcon(x, y);
    }
  }
  function drawFloatingHearts() {
    for (let i = 0; i < 3; i++) {
      const t = (now + i * 1100) % 3300, y = H + 4 - fl(t * 52 / 3300), x = (i % 2 ? 119 : 9) + trunc(sin((now + i * 700) / 300) * 3);
      if (y > BAND_H + 4) drawHeart(x, y, 4 + (i === 1 ? 1 : 0));
    }
  }
  const drawDrop = (x, y) => { o.circle(x, y, 2); o.tri(x - 2, y - 1, x + 2, y - 1, x, y - 5); };
  function drawChevron(cx, cy, dir) {
    for (let t = -1; t <= 1; t++) { o.line(cx - dir * 8, cy - 7 + t, cx + dir * 8, cy + t); o.line(cx + dir * 8, cy + t, cx - dir * 8, cy + 7 + t); }
  }
  function drawSpiral(cx, cy, ph) {
    let px = cx, py = cy;
    for (let t = 0; t < 4 * PI; t += 0.25) {
      const r = t * 0.95, x = cx + r * cos(t + ph), y = cy + r * sin(t + ph);
      o.line(trunc(px), trunc(py), trunc(x), trunc(y)); o.line(trunc(px) + 1, trunc(py), trunc(x) + 1, trunc(y)); px = x; py = y;
    }
  }
  const drawSparkle = (x, y, s) => { o.line(x - s, y, x + s, y); o.line(x, y - s, x, y + s); };
  function drawZ(x, y, s) { for (let t = 0; t < 2; t++) { o.line(x - s, y - s + t, x + s, y - s + t); o.line(x + s - t, y - s, x - s - t, y + s); o.line(x - s, y + s - t, x + s, y + s - t); } }
  function drawSleepZ(sx, sy) {
    for (let i = 0; i < 3; i++) {
      const p = ((now - R.moodSince + i * 1000) % 3000) / 3000, s = 2 + trunc(p * 4);
      const x = sx + trunc(p * 12) + trunc(sin(p * 7 + i) * 2), y = sy - trunc(p * 22);
      if (y - s > BAND_H + 1) drawZ(x, y, s);
    }
  }
  const sleepBreath = () => sin(now / 600);
  const drawSleepEye = (cx, cy, hw) => { for (let t = 0; t < 2; t++) drawCurve(cx, cy + t, hw, 3, 0); };
  function drawAngerMark(x, y) {
    const k = fl(now / 250) % 2 ? 4 : 3;
    o.line(x - k, y - 1, x - 1, y - 1); o.line(x - 1, y - 1, x - 1, y - k); o.line(x + 1, y - k, x + 1, y - 1); o.line(x + 1, y - 1, x + k, y - 1);
    o.line(x - k, y + 1, x - 1, y + 1); o.line(x - 1, y + 1, x - 1, y + k); o.line(x + 1, y + 1, x + k, y + 1); o.line(x + 1, y + 1, x + 1, y + k);
  }
  function drawSteam(cy) {
    for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 2; i++) {
      const t = (now + i * 450) % 900, r = 1 + fl(t * 3 / 900), x = (side < 0 ? 7 : 120) + side * fl(t * 4 / 900), y = cy + 4 - fl(t * 16 / 900);
      if (y - r > BAND_H) drawCircle(x, y, r);
    }
  }
  function drawTears(lx, rx, cy, w, h) {
    for (let side = -1; side <= 1; side += 2) {
      const ex = (side < 0 ? lx : rx) - side * trunc(w / 2 - 4), start = cy + trunc(h / 2) + 3, fall = (fl(now / 45) + (side > 0 ? 7 : 0)) % 14;
      drawDrop(ex, start + fall);
    }
  }
  function drawPageDots(page, count, x, y) { for (let i = 0; i < count; i++) i === page ? o.circle(x + i * 7, y, 2) : drawCircle(x + i * 7, y, 2); }

  // =====================================================================
  //  😊 Mukh (drawEye / drawMouth / drawFrame)
  // =====================================================================
  function drawEye(cx, cy, w, h, side) {
    const m = R.mood, iw = max(2, trunc(w)), ih = max(2, trunc(h)), x = cx - (iw >> 1), y = cy - (ih >> 1);
    let r = ['surprised', 'scared', 'plead'].includes(m) ? min(iw, ih) >> 1 : EYE_R;
    r = min(r, min(iw >> 1, ih >> 1));
    o.rrect(x, y, iw, ih, r, 1);
    const cut = trunc(ih * 0.45);
    if (['happy', 'music', 'stretch', 'hum'].includes(m) || (m === 'wink' && side < 0)) {
      const Rr = trunc(iw * 0.72); o.circle(cx, y + trunc(ih * 0.55) + Rr, Rr, 0);
    } else if (m === 'sad' || m === 'cry') {
      side < 0 ? o.tri(x - 1, y - 1, x + iw, y - 1, x - 1, y + cut, 0) : o.tri(x - 1, y - 1, x + iw, y - 1, x + iw, y + cut, 0);
    } else if (m === 'angry') {
      const c2 = trunc(ih * 0.32);
      side < 0 ? o.tri(x - 1, y - 1, x + iw, y - 1, x + iw, y + c2, 0) : o.tri(x - 1, y - 1, x + iw, y - 1, x - 1, y + c2, 0);
    } else if (m === 'plead' && ih > 14) {
      const pr = iw >> 2, px = cx, py = cy + 1;
      o.circle(px, py, pr, 0); o.circle(px - trunc(side * pr / 3), py - trunc(pr / 3), 2, 1); o.px(px + trunc(side * pr / 3), py + trunc(pr / 3), 1);
      const c2 = trunc(ih * 0.18);
      side < 0 ? o.tri(x - 1, y - 1, x + iw, y - 1, x - 1, y + c2, 0) : o.tri(x - 1, y - 1, x + iw, y - 1, x + iw, y + c2, 0);
    } else if (m === 'whistle' && side > 0) {
      const Rr = trunc(iw * 0.72); o.circle(cx, y + trunc(ih * 0.55) + Rr, Rr, 0);
    } else if (m === 'annoyed') {
      o.rect(x - 1, y - 1, iw + 2, trunc(ih * 0.5) + 1, 0);
    } else if (m === 'bored' || m === 'suspicious') {
      const lid = m === 'bored' ? 0.5 : (side > 0 ? 0.55 : 0.40); o.rect(x - 1, y - 1, iw + 2, trunc(ih * lid) + 1, 0);
    } else if (m === 'love' && ih > 14) {
      const s = (iw < 30 ? 6 : 8) + fl(now / 300) % 2, hy = cy - 2, rr = s >> 1;
      drawHeart(cx, hy, s, 0); o.rect(cx - rr - 1, hy - (rr >> 1) - 2, 2, 2, 1);
    } else if (m === 'excited' && ih > 12) {
      const pr = trunc(iw / 5), s = fl(now / 150) % 2 ? 2 : 1;
      o.circle(cx, cy, pr, 0); o.line(cx - side * 2 - s, cy - 2, cx - side * 2 + s, cy - 2, 1); o.line(cx - side * 2, cy - 2 - s, cx - side * 2, cy - 2 + s, 1);
    }
  }
  function drawMouth() {
    const m = R.mood, mx = W / 2 + trunc(R.lookX * 0.6), my = MOUTH_Y + trunc(R.lookY), t = now - R.moodSince;
    switch (m) {
      case 'normal': drawCurve(mx, my, 6, 2, 0); break;
      case 'happy': drawCurve(mx, my - 1, 9, 4, 0); break;
      case 'laugh': case 'excited': {
        const r = m === 'laugh' ? 7 + trunc(sin(now / 70) * 1.5) : 7;
        o.circle(mx, my - 3, r); o.rect(mx - r - 1, my - 4 - r, 2 * r + 3, r + 1, 0); break;
      }
      case 'love': drawCurve(mx - 3, my, 3, 2, 0); drawCurve(mx + 3, my, 3, 2, 0); break;
      case 'wink': drawCurve(mx + 2, my, 7, 2, -2); break;
      case 'sad': drawCurve(mx, my + 2, 7, -3, 0); break;
      case 'cry': drawCurve(mx, my + 2, 8, -4 + sin(now / 100), 0); break;
      case 'angry': drawCurve(mx, my + 1, 4, -2, 0); break;
      case 'surprised': drawRing(mx, my, 5); break;
      case 'scared': drawWave(mx, my, 8, 1.5, now / 40); break;
      case 'confused': drawWave(mx + 3, my, 7, 1.2, 0); break;
      case 'suspicious': o.line(mx - 5, my + 1, mx + 6, my - 1); o.line(mx - 5, my + 2, mx + 6, my); break;
      case 'bored': o.hline(mx - 6, my, 13); o.hline(mx - 6, my + 1, 13); break;
      case 'sleepy': { const ph = now % 6000; ph < 1500 ? drawRing(mx, my, 2 + trunc(4 * sin(PI * ph / 1500))) : drawCurve(mx, my, 4, 0, 0); break; }
      case 'sleep': drawCurve(mx, my + trunc(sleepBreath() * 1.2), 3, 1, 0); break;
      case 'dizzy': drawWave(mx, my, 8, 2, now / 60); break;
      case 'music': drawRing(mx, my, S.notes && S.idx % 2 ? 5 : 3); break;
      case 'sneeze': t < 1300 ? drawRing(mx, my, 2 + trunc(t * 4 / 1300)) : t < 1800 ? drawRing(mx, my, 7) : drawCurve(mx, my, 5, 2, 0); break;
      case 'stretch': drawRing(mx, my, 3 + trunc(sin(PI * min(1, t / 2200)) * 3)); break;
      case 'hum': drawRing(mx, my, S.notes && S.idx % 2 ? 4 : 2); break;
      case 'whistle': drawRing(mx + 2, my + 1, 3); break;
      case 'plead': drawCurve(mx, my + 1, 4, -1.5 + sin(now / 110) * 0.8, 0); break;
      case 'annoyed': o.line(mx - 6, my + 1, mx + 6, my - 2); o.line(mx - 6, my + 2, mx + 6, my - 1); break;
    }
  }
  function drawFace() {
    const m = R.mood, t = now - R.moodSince;
    const jx = m === 'scared' ? rnd(-1, 2) : 0;
    const lx = LEFT_CX + round(R.eyeL.x) + jx, rx = RIGHT_CX + round(R.eyeR.x) + jx;
    const cyL = EYE_CY + round(R.eyeL.y), cyR = EYE_CY + round(R.eyeR.y), cy = (cyL + cyR) >> 1;
    const w = EYE_W * R.scale, h = EYE_H * R.scale * R.openness * R.blinkK;
    const n = clamp((R.eyeL.x + R.eyeR.x) / (2 * MAX_LX), -1, 1), sL = 1 - 0.14 * n, sR = 1 + 0.14 * n;
    drawMouth();
    if (m === 'dizzy') { const ph = now / 80; drawSpiral(lx, cyL, ph); drawSpiral(rx, cyR, ph + PI); }
    else if (m === 'sneeze' && t >= 1300 && t < 1800) {
      const j = rnd(-2, 3); drawChevron(lx + j, cyL, 1); drawChevron(rx + j, cyR, -1);
      for (let i = 0; i < 7; i++) o.px(W / 2 - 14 + rnd(29), MOUTH_Y + 5 + rnd(5));
    } else if (m === 'laugh') { drawChevron(lx, cyL, 1); drawChevron(rx, cyR, -1); }
    else if (m === 'sleep' && R.openness < 0.25) {
      const by = trunc(sleepBreath() * 1.5) + 3;
      drawSleepEye(lx, cyL + by, trunc(EYE_W * 0.5)); drawSleepEye(rx, cyR + by, trunc(EYE_W * 0.5)); drawSleepZ(rx + EYE_W / 2 + 4, cyR + 4);
    } else {
      const wl = w * sL, wr = w * sR; let hl = h * sL, hr = h * sR;
      if (m === 'confused') { hl *= 1.15; hr *= 0.70; }
      if (m === 'wink') hr = 3;
      if (m === 'sneeze' && t < 1300) { const k = 1 - 0.75 * t / 1300; hl *= k; hr *= k; }
      drawEye(lx, cyL, wl, hl, -1); drawEye(rx, cyR, wr, hr, 1);
      if (m === 'cry') drawTears(lx, rx, cy, w, h);
      if (m === 'love') drawFloatingHearts();
      if (m === 'whistle') {
        const mx = W / 2 + trunc(R.lookX * 0.6), my = MOUTH_Y + trunc(R.lookY);
        for (let i = 0; i < 2; i++) { const k = ((now + i * 600) % 1200) / 1200; drawNoteIcon(mx + 12 + trunc(k * 34), my + 4 - trunc(k * 4)); }
        const wig = trunc(abs(sin(now / 120)) * 3), byL = cyL - trunc(hl / 2) - 3 - wig, byR = cyR - trunc(EYE_H * R.scale * sR / 2) - 3;
        for (let k = 0; k < 2; k++) { o.line(lx - 9, byL + 2 + k, lx + 9, byL - 1 + k); o.line(rx - 9, byR - 1 + k, rx + 9, byR + 1 + k); }
      }
      if (m === 'music' || m === 'hum') drawFloatingNotes();
      if (m === 'angry') { drawAngerMark(rx + trunc(wr / 2) + 7, cyR - 12); drawSteam(cy); }
      if (m === 'scared') drawDrop(rx + trunc(wr / 2) + 6, cyR - 6 + fl(now / 80) % 6);
    }
    if (['happy', 'laugh', 'excited', 'wink', 'love', 'angry', 'music', 'plead', 'whistle'].includes(m)) {
      drawBlush(lx - trunc(EYE_W * sL / 2) + 6, cyL + trunc(EYE_H * R.scale * sL / 2) + 5);
      drawBlush(rx + trunc(EYE_W * sR / 2) - 6, cyR + trunc(EYE_H * R.scale * sR / 2) + 5);
    }
    drawBand();
  }

  // =====================================================================
  //  🟨 Holud band (drawBand)
  // =====================================================================
  function bandBitmap(id, since) {
    const b = BN[id]; if (!b) return;
    if (R.langEn && b.en) { bandText(b.en, since); return; }
    let x = (W - b.w) >> 1;
    if (b.w > W) { const over = b.w - W + 4; let t = max(0, now - since - 800); let dx = fl(t * 40 / 1000) % (over * 2 + 40); x = 2 - min(dx, over); }
    bmp(b, x, (BAND_H - b.h) >> 1);
  }
  function bandText(s, since) {
    const w = adv(s, D.fsb9);
    if (w <= W - 2) drawLabel(s);
    else if (sW(s) <= W) sTxtC(W / 2, 3, s);
    else { const over = w - W + 4, t = max(0, now - since - 800); o.text(s, 2 - min(fl(t * 40 / 1000) % (over * 2 + 40), over), 13, D.fsb9); }
  }
  function lyricX(w) { const over = w - W + 4, t = max(0, now - R.lyricSince - 600); return 2 - min(fl(t * 45 / 1000), over); }
  function drawLyric(L, idx) {
    if (idx !== R.lyricShown) { R.lyricShown = idx; R.lyricSince = now; }
    if (L[2]) { const b = BN[L[2]]; bmp(b, b.w <= W ? (W - b.w) >> 1 : lyricX(b.w), (BAND_H - b.h) >> 1); return; }
    const w = adv(L[1], D.fsb9);
    if (w <= W - 2) drawLabel(L[1]); else if (sW(L[1]) <= W) sTxtC(W / 2, 3, L[1]); else o.text(L[1], lyricX(w), 13, D.fsb9);
  }
  function drawSleepPage(page, xoff) {
    const d = new Date(), h24 = d.getHours();
    if (page === 'time') {
      let h = R.use24 ? h24 : h24 % 12; if (!R.use24 && h === 0) h = 12;
      const colon = d.getSeconds() % 2 === 0, mm = String(d.getMinutes()).padStart(2, '0');
      const buf = (R.use24 ? String(h).padStart(2, '0') : String(h)) + (colon ? ':' : ' ') + mm;
      const w = adv(buf, D.fsb9), x = trunc((W - (R.use24 ? w : w + 15)) / 2) + xoff;
      o.text(buf, x, 13, D.fsb9); if (!R.use24) sTxt(x + w + 3, 4, h24 < 12 ? 'AM' : 'PM');
    } else if (page === 'day') drawLabel(DAY_NAME[d.getDay()], xoff);
    else if (page === 'date') drawLabel(`${d.getDate()} ${MON_NAME[d.getMonth()]} ${String(d.getFullYear() % 100).padStart(2, '0')}`, xoff);
    else if (page === 'numdate') drawLabel(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`, xoff);
    else if (page === 'month') drawLabel(MON_FULL[d.getMonth()], xoff);
  }
  function drawPagesSliding(pages) {
    const n = pages.length, idx = fl(now / PAGE_MS) % n, ph = now % PAGE_MS;
    if (ph < SLIDE_MS && n > 1) {
      let k = ph / SLIDE_MS; k = 1 - (1 - k) * (1 - k);
      drawSleepPage(pages[(idx + n - 1) % n], -trunc(W * k)); drawSleepPage(pages[idx], trunc(W * (1 - k)));
    } else drawSleepPage(pages[idx], 0);
  }
  function drawBand() {
    o.rect(0, 0, W, BAND_H, 0);
    if (R.bandBn) { if (now < R.bandBnUntil) { bandBitmap(R.bandBn, R.bandBnUntil - 3000); return; } R.bandBn = null; }
    if (R.band) { if (now < R.bandUntil) { drawLabel(R.band); return; } R.band = null; }
    const m = R.mood;
    switch (m) {
      case 'sneeze': { const t = now - R.moodSince; drawLabel(t < 1300 ? 'a... a...' : t < 1800 ? 'ACHOO!' : 'hehe'); break; }
      case 'plead': bandBitmap('BN_I_PLAY', R.moodSince); break;
      case 'annoyed': bandBitmap('BN_I_UFF', R.moodSince); break;
      case 'bored': bandBitmap('BN_I_BORED', R.moodSince); break;
      case 'music': {
        const sg = D.songs[max(0, R.songIdx)];
        if (sg.lyr.length && S.notes === sg.notes) {
          const el = now - R.songStartAt; let cur = -1;
          for (let i = 0; i < sg.lyr.length; i++) { if (sg.byMs ? el >= sg.lyr[i][0] : S.idx > sg.lyr[i][0]) cur = i; else break; }
          if (cur >= 0 && !(R.langEn && sg.lyr[cur][2])) { drawLyric(sg.lyr[cur], cur); break; }
        }
        if (sg.bn && !R.langEn) {
          const b = BN[sg.bn], y = (BAND_H - b.h) >> 1;
          if (b.w <= 104) { bmp(b, (W - b.w) >> 1, y); drawNoteIcon(4, 12); drawNoteIcon(119, 12); }
          else if (sg.anthem) bmp(b, (W - b.w) >> 1, y);
          else bmp(b, W - fl((now - R.moodSince) / 30) % (W + b.w), y);
          break;
        }
        const w = adv(sg.name, D.fsb9);
        if (w <= 104) { drawLabel(sg.name); drawNoteIcon(4, 12); drawNoteIcon(119, 12); }
        else o.text(sg.name, W - fl((now - R.moodSince) / 30) % (W + w), 13, D.fsb9);
        break;
      }
      case 'love': { const beat = fl(now / 300) % 2; drawLabel('Love you'); drawHeart(14, 7, 5 + beat); drawHeart(114, 7, 5 + beat); break; }
      case 'sleep': drawPagesSliding(['time', 'day', 'date']); break;
      case 'confused': drawLabel(LABEL.confused, trunc(sin(now / 200) * 20)); break;
      case 'excited': { const s = fl(now / 150) % 2 ? 4 : 2; drawSparkle(12, 8, s); drawSparkle(116, 8, 6 - s); drawLabel(LABEL.excited); break; }
      case 'angry': drawLabel(R.idleAngry ? (R.langEn ? 'Not talking!' : 'hmph!') : LABEL.angry); break;
      default: drawLabel(LABEL[m] || '');
    }
  }
  function drawAnthemScreen() {
    const fx = 40, fy = 22, fw = 60, fh = 34;
    o.rect(fx - 3, fy - 3, 2, H - fy + 3); o.circle(fx - 2, fy - 4, 2);
    for (let x = 0; x < fw; x++) o.vline(fx + x, fy + round(sin(x * 0.15 - now / 220) * 2 * x / fw), fh);
    const cx = fx + trunc(fw * 9 / 20), coff = round(sin((cx - fx) * 0.15 - now / 220) * 2 * (cx - fx) / fw);
    o.circle(cx, fy + (fh >> 1) + coff, trunc(fw / 5), 0);
  }

  // =====================================================================
  //  ⏰ Ghori (5 tap) - HOME / DATE / DAY / TIMER
  // =====================================================================
  function drawClock() {
    let xoff = 0; const since = now - R.viewChangedAt;
    if (since < 250) { let k = since / 250; k = 1 - (1 - k) * (1 - k); xoff = trunc(W * (1 - k)); }
    if (R.timerAlarm) {
      drawLabel('TIMER'); const on = fl(now / 300) % 2;
      if (on) o.rect(0, BAND_H, W, H - BAND_H, 1);
      o.text('TIME UP!', trunc((W - adv('TIME UP!', D.fsb12)) / 2), 48, D.fsb12, on ? 0 : 1); return;
    }
    const d = new Date(), v = R.clockView;
    if (v !== 'home') drawLabel(CV_TITLE[v], xoff);
    if (v === 'home') {
      if (now < R.fmtShowUntil) drawLabel(R.use24 ? '24 HOUR' : '12 HOUR', xoff); else drawPagesSliding(['day', 'numdate', 'month']);
      let h = R.use24 ? d.getHours() : d.getHours() % 12; if (!R.use24 && h === 0) h = 12;
      const hh = R.use24 ? String(h).padStart(2, '0') : String(h), mm = String(d.getMinutes()).padStart(2, '0');
      const aH = adv(hh, D.fsb24), aC = adv(':', D.fsb24), aM = adv(mm, D.fsb24), x = trunc((W - (aH + aC + aM)) / 2) + xoff;
      o.text(hh, x, 57, D.fsb24); if (d.getSeconds() % 2 === 0) o.text(':', x + aH, 57, D.fsb24); o.text(mm, x + aH + aC, 57, D.fsb24);
    } else if (v === 'date') {
      const dd = String(d.getDate()), y = String(d.getFullYear()), mo = MON_NAME[d.getMonth()];
      const aD = adv(dd, D.fsb24), x = trunc((W - (aD + 8 + max(adv(mo, D.fsb12), adv(y, D.fsb12)))) / 2) + xoff;
      o.text(dd, x, 57, D.fsb24); o.text(mo, x + aD + 8, 36, D.fsb12); o.text(y, x + aD + 8, 58, D.fsb12);
    } else if (v === 'day') {
      const name = DAY_TITLE[d.getDay()]; o.text(name, trunc((W - adv(name, D.fsb12)) / 2) + xoff, 37, D.fsb12);
      const L = 'SMTWTFS', sx = ((W - 7 * 16) >> 1) + xoff;
      for (let i = 0; i < 7; i++) { const x = sx + i * 16, on = i === d.getDay(); if (on) o.rrect(x + 1, 46, 14, 12, 3, 1); sTxtC(x + 8, 48, L[i], on ? 0 : 1); }
    } else if (v === 'timer') {
      const left = timerRemaining();
      if (R.timerRunning) o.tri(114 + xoff, 3, 114 + xoff, 12, 122 + xoff, 7);
      else if (left > 0) { o.rect(115 + xoff, 3, 2, 10); o.rect(120 + xoff, 3, 2, 10); }
      if (!R.timerRunning && left === 0) {
        sTxt(4 + xoff, 19, '2 tap : +1 min'); sTxt(4 + xoff, 30, 'Hold : start/pause'); sTxt(4 + xoff, 41, '3 tap : reset'); sTxt(4 + xoff, 52, '1 tap : next screen'); return;
      }
      if (!R.timerRunning && fl(now / 500) % 2) return;
      const sec = fl((left + 999) / 1000), buf = String(fl(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
      o.text(buf, trunc((W - adv(buf, D.fsb24)) / 2) + xoff, 57, D.fsb24);
    }
  }
  const timerRemaining = () => R.timerRunning ? max(0, R.timerEndAt - now) : R.timerLeftMs;
  function timerAddMinute() { if (timerRemaining() + 60000 > 99 * 60000) return; if (R.timerRunning) R.timerEndAt += 60000; else R.timerLeftMs += 60000; PLAY('S_BEEP'); }
  function timerToggle() {
    if (R.timerRunning) { R.timerLeftMs = timerRemaining(); R.timerRunning = false; PLAY('S_PAUSE'); }
    else if (R.timerLeftMs > 0) { R.timerEndAt = now + R.timerLeftMs; R.timerRunning = true; PLAY('S_START'); }
  }
  function timerReset() { R.timerRunning = false; R.timerLeftMs = 0; PLAY('S_RESET'); }
  function updateTimer() {
    if (R.timerRunning && now >= R.timerEndAt) {
      R.timerRunning = false; R.timerLeftMs = 0; R.timerAlarm = true; R.alarmStart = now;
      if (!R.clockMode) setClockMode(true); R.clockView = 'timer'; R.viewChangedAt = now;
    }
    if (R.timerAlarm && now - R.alarmStart > 60000) R.timerAlarm = false;
    if (R.timerAlarm && !S.notes) PLAY('S_ALARM');
  }
  function setClockMode(on) {
    R.clockMode = on; R.lastActivity = now;
    if (on) { R.clockView = 'home'; R.viewChangedAt = now; PLAY('S_CLK_ON'); }
    else { quiet('happy', 1500); PLAY('S_CLK_OFF'); }
  }
  function nextClockView() { R.clockView = CLOCK_VIEWS[(CLOCK_VIEWS.indexOf(R.clockView) + 1) % CLOCK_VIEWS.length]; R.viewChangedAt = now; PLAY('S_TICK'); }

  // =====================================================================
  //  🐙 GitHub QR (7 tap)
  // =====================================================================
  function drawQR() {
    if (fl((now - R.qrShownAt) / 5000) % 2 === 0) {
      o.rect(0, 0, 64, 64, 1);
      const N = D.qr.length;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (D.qr[r] & (1 << (N - 1 - c))) o.rect(3 + c * 2, 3 + r * 2, 2, 2, 0);
      o.text('GitHub', 68, 13, D.fsb9); o.text('999mamun999', 66, 25, D.tiny); sTxt(68, 32, 'Scan me!');
      const dx = fl(now / 120) % 6; o.tri(74 - dx, 48, 82 - dx, 43, 82 - dx, 53); o.rect(82 - dx, 46, 14, 4);
      drawPageDots(0, 2, 110, 60);
    } else {
      o.sprite('bot_head', 2, 0); o.text('PetBot', 21, 13, D.fsb9); drawPageDots(1, 2, 113, 7);
      sTxtC(64, 22, 'Designed & Developed'); o.text('by Al-Mamun', trunc((W - adv('by Al-Mamun', D.fsb9)) / 2), 46, D.fsb9);
      sTxtC(64, 52, 'A Personal Project');
    }
  }
  function showQR() { R.game = false; R.clockMode = false; R.qrShownAt = now; R.qrUntil = now + 40000; R.lastActivity = now; PLAY('S_TADA_QR'); }

  // =====================================================================
  //  🎵 Gaan (3 tap) + 😂 funny (4 tap) + 🌐 bhasha (10 s)
  // =====================================================================
  function playNextSong() {
    R.songIdx = (R.songIdx + 1) % D.songs.length;
    const s = D.songs[R.songIdx], dur = s.notes.reduce((a, n) => a + n[1], 0);
    setMood('music', dur + 400); play(s.notes); R.songStartAt = now; R.lyricShown = -1;
  }
  function playFunnySound() {
    let k = rnd(D.funny.length); if (k === R.lastFunny) k = (k + 1) % D.funny.length; R.lastFunny = k;
    const f = D.funny[k]; quiet(f.mood, f.ms); PLAY(f.snd); showBand(f.label, f.ms);
  }
  function toggleLanguage() {
    R.langEn = !R.langEn; try { localStorage.setItem('vb-lang', R.langEn ? 'en' : 'bn'); } catch (e) {}
    quiet('excited', 2500); PLAY('FX_TADA'); showBandBn('BN_LANG', 2500); if (api.onLang) api.onLang(R.langEn);
  }

  // =====================================================================
  //  🎬 Animation (6 tap): tap = porer, chepe dhoro = ferot
  // =====================================================================
  function gameEnter() { R.game = true; R.clockMode = false; R.scIdx = 0; R.scSince = now; PLAY('S_CLK_ON'); }
  function gameExit() { R.game = false; quiet('happy', 1500); PLAY('S_CLK_OFF'); }

  // =====================================================================
  //  👆 Touch (handleTouch er port)
  // =====================================================================
  const T = { t: false, prev: false, downAt: 0, longFired: false, tapCount: 0, lastTapAt: 0, ignore: false, langToggled: false, gFired: 0 };
  function handleTouch() {
    const t = T.t;
    if (R.game) {                                     // 🎬 khelar touch: tap / hold
      if (t && !T.prev) { T.downAt = now; T.gFired = 0; }
      if (t && T.gFired === 0 && now - T.downAt > 900) { T.gFired = 1; gameExit(); T.ignore = true; }
      if (!t && T.prev && T.gFired === 0 && now - T.downAt < 900) { R.scIdx = (R.scIdx + 1) % SCENE_LIST.length; R.scSince = now; PLAY('S_TICK'); }
      T.prev = t; return;
    }
    if (T.ignore) { if (!t) T.ignore = false; T.prev = t; T.tapCount = 0; T.longFired = true; return; }
    if (t && !T.prev && R.qrUntil) { R.qrUntil = 0; T.ignore = true; T.prev = t; setMood('happy', 1500); return; }

    if (t && !T.prev) {
      T.downAt = now; R.welcomeStep = -1; T.langToggled = false; T.longFired = false;
      if (!(R.mood === 'music')) PLAY('S_CHIRP');
    }
    if (t && !R.clockMode) {
      R.lastActivity = now;
      const held = now - T.downAt;
      if (held > 10000) { if (!T.langToggled) { toggleLanguage(); T.langToggled = true; } T.longFired = true; }
      else if (held > 3000) { if (R.mood !== 'laugh') setMood('laugh', 0); T.longFired = true; }
      else if (held > 800 && !T.longFired) { setMood('happy', 0); T.longFired = true; }
    }
    if (t && R.clockMode && R.clockView === 'home' && !R.timerAlarm && !T.longFired && now - T.downAt > 3000) {
      R.use24 = !R.use24; R.fmtShowUntil = now + 2500; PLAY('S_CLK_ON'); T.longFired = true;
    }
    if (t && R.clockMode && R.clockView === 'timer' && !R.timerAlarm && !T.longFired && now - T.downAt > 800) { timerToggle(); T.longFired = true; }

    if (!t && T.prev) {
      if (T.longFired) { if (!R.clockMode && !T.langToggled) setMood('happy', 1200); T.tapCount = 0; }
      else if (now - T.downAt < 600) { T.tapCount++; T.lastTapAt = now; }
    }
    if (!t && T.tapCount > 0 && now - T.lastTapAt > 500) {
      const n = T.tapCount; T.tapCount = 0; R.lastActivity = now;
      R.nextRandomMood = max(R.nextRandomMood, now + 5000);   // tomar kaj er por sathe sathe nijer moto mood na
      if (R.mood === 'music' && n <= 2) {                 // gaan cholche: 1 tap = porer gaan, 2 tap = thamo
        if (n === 1) playNextSong(); else { noTone(); S.notes = null; setMood('normal', 0); }
      } else if (n >= 7) { R.timerAlarm = false; showQR(); }
      else if (n === 6) { R.timerAlarm = false; gameEnter(); }
      else if (n === 5) { R.timerAlarm = false; setClockMode(!R.clockMode); }
      else if (R.clockMode) {
        if (R.timerAlarm) R.timerAlarm = false;
        else if (R.clockView === 'timer' && n === 2) timerAddMinute();
        else if (R.clockView === 'timer' && n >= 3) timerReset();
        else nextClockView();
      }
      else if (n === 3) playNextSong();
      else if (n === 4) playFunnySound();
      else if (n === 2) setMood('love', 3000);          // robot e 2 tap = menu (porer dhape ashbe), menu te-o "Love" ache
      else if (R.mood === 'sleep') setMood('sleepy', 1500);
      else if (R.mood === 'excited' && R.band) { /* "yay!" cholche */ }
      else setMood('happy', 2000);
    }
    T.prev = t;
  }

  // =====================================================================
  //  🫨 Jhakuni / tok-tok / ghum theke utha (updateBehaviour er moto)
  // =====================================================================
  function shakeHit() {
    R.shakeScore += 1; R.lastActivity = now;
    if (R.mood === 'sleep') { setMood('happy', 2500); showBand('Hi!', 2500); }
    if (R.shakeScore > 3.5 && R.mood !== 'dizzy' && !R.game && !R.clockMode && !R.qrUntil) {
      R.cryAfterDizzy = R.lastDizzyAt !== 0 && now - R.lastDizzyAt < 10000; R.lastDizzyAt = now;
      setMood('dizzy', 3000); R.shakeScore = 0;
    }
  }
  function knock2() {                                   // ✊ table e 2 bar tok-tok: 5 s ghori
    if (R.game || R.qrUntil) return;
    if (R.mood === 'sleep') setMood('normal', 0);
    if (!R.clockMode) setClockMode(true);
    R.clockView = 'home'; R.viewChangedAt = now; R.peekClockUntil = now + 5000; R.lastActivity = now;
  }

  // =====================================================================
  //  ⏱️ Protiti tick (robot er loop)
  // =====================================================================
  function updateMoodTimeout() {
    if (R.moodUntil && now >= R.moodUntil) {
      if (R.mood === 'dizzy') R.cryAfterDizzy ? setMood('cry', 4000) : setMood('angry', 1500);
      else setMood('normal', 0);
    }
  }
  function randomMood() {
    if (R.mood !== 'normal' || now < R.nextRandomMood) return;
    const r = rnd(100);
    R.moodSound = false;
    if (r < 18) setMood('happy', 2000); else if (r < 28) setMood('wink', 900); else if (r < 35) setMood('laugh', 2000);
    else if (r < 41) setMood('love', 2500); else if (r < 51) setMood('suspicious', 2500); else if (r < 58) setMood('excited', 2000);
    else if (r < 62) setMood('confused', 2000);
    else {
      R.moodSound = true;
      if (r < 72) setMood('sneeze', 2700); else if (r < 82) setMood('stretch', 2800); else if (r < 91) setMood('hum', 3000); else if (r < 96) setMood('whistle', 2600);
    }
    R.moodSound = true; R.nextRandomMood = now + rnd(7000, 16000);
  }
  function idleStageMood(idle) {
    if (idle >= SLEEP_AFTER) return 'sleep'; if (idle >= SLEEPY_AFTER) return 'sleepy'; if (idle >= BORED_AFTER) return 'bored';
    if (idle >= ANGRY_AFTER) return 'angry'; if (idle >= ANNOY_AFTER) return 'annoyed'; if (idle >= PLEAD_AFTER) return 'plead'; return 'normal';
  }
  function updateIdleStory() {
    if (R.mood !== 'angry') R.idleAngry = false;
    const want = idleStageMood(now - R.lastActivity);
    if (want === 'normal') {
      if (waitingToPlay()) { R.idleAngry = false; setMood('excited', 2500); showBand('yay!', 2500); }
      else if (R.mood === 'sleepy') setMood('normal', 0);
      return;
    }
    if (R.mood === 'normal' || waitingToPlay() || R.mood === 'sleepy') {
      if (R.mood !== want || (want === 'angry' && !R.idleAngry)) { if (want === 'plead') R.pleadRepeated = false; setMood(want, 0); R.idleAngry = want === 'angry'; }
      if (R.mood === 'plead' && !R.pleadRepeated && now - R.moodSince > 10000) { PLAY('S_PLEAD'); R.pleadRepeated = true; }
    }
  }
  const W_ARR = ['BN_W_A1', 'BN_W_A2', 'BN_W_A3'], W_FEEL = ['BN_W_F1', 'BN_W_F2', 'BN_W_F3'], W_INV = ['BN_W_I1', 'BN_W_I2', 'BN_W_I3'];
  const W_FEEL_MOOD = ['love', 'plead', 'happy'], W_INV_MOOD = ['happy', 'laugh', 'wink'];
  let wA = 0, wF = 0, wI = 0;
  function updateWelcome() {
    if (R.welcomeStep < 0 || now < R.welcomeNext) return;
    let ms;
    switch (R.welcomeStep) {
      case 0: ms = 3200; setMood('excited', ms); showBandBn(W_ARR[wA], ms); break;
      case 1: ms = 3600; setMood(W_FEEL_MOOD[wF], ms); showBandBn(W_FEEL[wF], ms); break;
      case 2: ms = 3000; setMood(W_INV_MOOD[wI], ms); showBandBn(W_INV[wI], ms); break;
      default: R.welcomeStep = -1; return;
    }
    R.welcomeNext = now + ms; R.welcomeStep++; R.lastActivity = now;
  }
  function updateBlink() {
    if (!R.blinking && canBlink() && now >= R.nextBlink) { R.blinking = true; R.blinkStart = now; }
    if (R.blinking) {
      const t = (now - R.blinkStart) / BLINK_MS;
      if (t >= 1) { R.blinking = false; R.blinkK = 1; R.nextBlink = now + (rnd(100) < 20 ? 120 : rnd(2000, 6000)); }
      else R.blinkK = abs(1 - 2 * t);
    }
  }
  function updateLook() {
    const m = R.mood, oldX = R.tLookX, P = R.pointer && now - R.pointerAt < 2500 ? R.pointer : null;   // 🖱️ mouse = robot ke kaat kora
    R.tRoll = 0;
    if (['sleep', 'sad', 'cry'].includes(m)) { R.tLookX = 0; R.tLookY = MAX_LY; }
    else if (m === 'dizzy') { R.tLookX = sin(now / 120) * 6; R.tLookY = cos(now / 150) * 2; }
    else if (m === 'suspicious') { R.tLookX = (fl(now / 1200) % 2 ? 0.8 : -0.8) * MAX_LX; R.tLookY = 0; }
    else if (m === 'whistle') { R.tLookX = fl((now - R.moodSince) / 900) % 2 ? 0 : MAX_LX * 0.6; R.tLookY = 2; }
    else if (m === 'hum') { R.tLookX = sin(now / 450) * 7; R.tLookY = sin(now / 220) * 1.5; }
    else if (m === 'stretch') { R.tLookX = 0; R.tLookY = -MAX_LY; }
    else if (m === 'plead') { R.tLookX = 0; R.tLookY = 0; }
    else if (m === 'annoyed') { R.tLookX = sin(now / 600) * MAX_LX * 0.8; R.tLookY = -MAX_LY; }
    else if (m === 'music') { R.tLookX = sin(now / 500) * 8; R.tLookY = sin(now / 150) * 2; R.lookY = R.tLookY; }
    else if (m === 'laugh' || m === 'excited') { R.tLookX = 0; R.tLookY = sin(now / 90) * 2; R.lookY = R.tLookY; }
    else if (P) { R.tLookX = clamp(P.x * 30, -MAX_LX, MAX_LX); R.tLookY = clamp(P.y * 15, -MAX_LY, MAX_LY); R.tRoll = clamp(P.x * 10, -4, 4); R.nextSaccade = now + 1500; }
    else if (now >= R.nextSaccade) {
      if (rnd(100) < 35) { R.tLookX = 0; R.tLookY = 0; } else { R.tLookX = rnd(-MAX_LX, MAX_LX + 1); R.tLookY = rnd(-MAX_LY, MAX_LY + 1); }
      R.nextSaccade = now + rnd(1200, 4000);
    }
    if (abs(R.tLookX - oldX) > 10 && !R.blinking && rnd(100) < 35) R.nextBlink = now;
  }
  function spring(e, tx, ty, k, d) { e.vx = (e.vx + (tx - e.x) * k) * d; e.vy = (e.vy + (ty - e.y) * k) * d; e.x += e.vx; e.y += e.vy; }
  function animate() {
    let tOpen = 1, tScale = 1; const m = R.mood;
    if (m === 'sad') tOpen = 0.85; else if (m === 'cry') tOpen = 0.75; else if (m === 'angry') tOpen = 0.80; else if (m === 'surprised') tScale = 1.20;
    else if (m === 'scared') tScale = 0.70; else if (m === 'excited') tScale = 1.10; else if (m === 'plead') tScale = 1.12; else if (m === 'whistle') tScale = 0.80;
    else if (m === 'love') tScale = 1.08; else if (m === 'sleepy') tOpen = 0.35; else if (m === 'sleep') tOpen = 0.06;
    R.openness += (tOpen - R.openness) * (m === 'sleep' ? 0.04 : 0.25); R.scale += (tScale - R.scale) * 0.30;
    R.lookX += (R.tLookX - R.lookX) * 0.30; R.lookY += (R.tLookY - R.lookY) * 0.30;
    const txL = R.tLookX * (R.tLookX < 0 ? 1 : 0.75), txR = R.tLookX * (R.tLookX > 0 ? 1 : 0.75);
    spring(R.eyeL, txL, R.tLookY - R.tRoll, 0.22, 0.70); spring(R.eyeR, txR, R.tLookY + R.tRoll, 0.17, 0.72);
  }
  // 💪 Haat: armTargets er port (0 = niche, 90 = shamne, 180 = upore)
  function armTargets() {
    const m = R.mood, t = now - R.moodSince; let l = 0, r = 0;
    switch (m) {
      case 'happy': l = 20; r = 120 + 30 * sin(now / 150); break;
      case 'laugh': l = r = 35 + 15 * sin(now / 90); break;
      case 'love': l = 75 + 8 * sin(now / 400); r = 75 - 8 * sin(now / 400); break;
      case 'wink': r = 110; break;
      case 'cry': l = 110 + 10 * sin(now / 130); r = 110 - 10 * sin(now / 130); break;
      case 'angry': l = 60 + 25 * sin(now / 90); r = 60 - 25 * sin(now / 90); break;
      case 'surprised': l = r = 160; break;
      case 'scared': l = r = 140 + 4 * sin(now / 40); break;
      case 'confused': r = 150 + 8 * sin(now / 200); break;
      case 'suspicious': r = 70; break;
      case 'excited': l = 135 + 25 * sin(now / 110); r = 135 + 25 * sin(now / 110 + PI); break;
      case 'dizzy': l = 60 + 40 * sin(now / 300); r = 60 + 40 * sin(now / 300 + 2); break;
      case 'stretch': { let k = min(1, t / 1400); if (t > 2100) k = 0; l = r = ARM_MIN + (160 - ARM_MIN) * k; break; }
      case 'whistle': l = 40; r = 115; break;
      case 'hum': l = 35 + 12 * sin(now / 300); r = 35 - 12 * sin(now / 300); break;
      case 'sneeze': if (t > 1300 && t < 1800) l = r = 100; break;
      case 'plead': l = 85 + 10 * sin(now / 180); r = 85 + 10 * sin(now / 180 + PI); break;
      case 'annoyed': r = 35 + 18 * abs(sin(now / 140)); break;
      case 'music': if (D.songs[R.songIdx]?.anthem) { l = ARM_MIN; r = 150; } else { l = 90 + 40 * sin(now / 250); r = 90 - 40 * sin(now / 250); } break;
    }
    if (R.clockMode || R.game || R.qrUntil) { l = r = 0; if (R.timerAlarm) { l = 130 + 25 * sin(now / 120); r = 130 + 25 * sin(now / 120 + PI); } }
    else if ((waitingToPlay() || m === 'sleepy') && t > 3000) l = r = 0;
    return [l, r];
  }
  function updateArms() {
    const tg = armTargets();
    for (let i = 0; i < 2; i++) { const d = clamp(tg[i], ARM_MIN, ARM_MAX) - R.arm[i]; if (abs(d) > 1) R.arm[i] += clamp(d, -9, 9); }
  }
  function tick() {
    handleTouch(); updateWelcome(); updateTimer();
    if (R.peekClockUntil && (!R.clockMode || now >= R.peekClockUntil)) { R.peekClockUntil = 0; if (R.clockMode) setClockMode(false); }
    if (R.qrUntil && now >= R.qrUntil) { R.qrUntil = 0; setMood('happy', 1500); }
    R.shakeScore *= 0.92;
    if (!R.clockMode && !R.game && !R.qrUntil) { updateMoodTimeout(); if (R.welcomeStep < 0 && !T.t) { randomMood(); updateIdleStory(); } }
    updateBlink(); updateLook(); animate(); updateArms(); updateSound();
  }
  function render() {
    o.clear();
    if (R.qrUntil) drawQR();
    else if (R.game) SCENES[SCENE_LIST[R.scIdx]](o, now - R.scSince);
    else if (R.clockMode) drawClock();
    else if (R.mood === 'music' && D.songs[R.songIdx]?.anthem) { drawAnthemScreen(); drawBand(); }
    else drawFace();
    o.show();
  }

  // =====================================================================
  //  Chalu kora: window.VirtualPetBot({ root, canvas, pad, armL, armR, body, desk })
  // =====================================================================
  const api = {};
  window.VirtualPetBot = function (el) {
    o = new Oled(el.canvas);
    let visible = false, started = false, last = performance.now(), acc = 0, t0 = performance.now(), skew = 0;
    const clock = () => performance.now() - t0 + 1000 + skew;
    now = clock(); R.lastActivity = now;

    // touch pad: mouse / angul / keyboard (Space, Enter)
    const press = v => { if (v) audioInit(); T.t = v; el.pad.classList.toggle('on', v); };
    el.pad.addEventListener('pointerdown', e => { e.preventDefault(); try { el.pad.setPointerCapture(e.pointerId); } catch (x) {} press(true); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => el.pad.addEventListener(ev, () => press(false)));
    el.pad.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press(true); } });
    el.pad.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') press(false); });
    el.pad.addEventListener('contextmenu', e => e.preventDefault());

    // chokh mouse er dike (asol robot e kaat korle chokh shei dike jay)
    window.addEventListener('pointermove', e => {
      const r = el.canvas.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / (r.width * 1.5), dy = (e.clientY - cy) / (r.height * 2);
      if (abs(dx) < 1.2 && abs(dy) < 1.2) { R.pointer = { x: clamp(dx, -0.7, 0.7), y: clamp(dy, -0.5, 0.5) }; R.pointerAt = now; }
    }, { passive: true });

    // robot dhore jhakano (body te chepe tene)
    let drag = null;
    el.body.addEventListener('pointerdown', e => {
      if (e.target.closest('.vb-pad')) return;
      audioInit(); drag = { x: e.clientX, y: e.clientY, lx: e.clientX, vx: 0, dir: 0 }; try { el.body.setPointerCapture(e.pointerId); } catch (x) {} el.root.classList.add('drag');
    });
    el.body.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = clamp(e.clientX - drag.x, -40, 40), dy = clamp(e.clientY - drag.y, -30, 30);
      el.root.style.setProperty('--dx', dx + 'px'); el.root.style.setProperty('--dy', dy + 'px'); el.root.style.setProperty('--rot', (dx / 6) + 'deg');
      const vx = e.clientX - drag.lx, dir = Math.sign(vx);
      if (abs(vx) > 6 && dir && dir !== drag.dir) { drag.dir = dir; shakeHit(); }
      drag.lx = e.clientX;
    });
    const endDrag = () => { if (!drag) return; drag = null; el.root.classList.remove('drag'); ['--dx', '--dy', '--rot'].forEach(p => el.root.style.removeProperty(p)); };
    el.body.addEventListener('pointerup', endDrag); el.body.addEventListener('pointercancel', endDrag);
    // phone jhakale
    window.addEventListener('devicemotion', e => {
      const a = e.acceleration; if (!a || !visible) return;
      if (Math.hypot(a.x || 0, a.y || 0, a.z || 0) > 14) shakeHit();
    });
    // table e tok-tok
    let knockAt = 0;
    el.desk?.addEventListener('pointerdown', () => { audioInit(); if (now - knockAt < 700) { knockAt = 0; knock2(); } else knockAt = now; el.desk.classList.remove('knock'); void el.desk.offsetWidth; el.desk.classList.add('knock'); });

    new IntersectionObserver(es => es.forEach(e => {
      visible = e.isIntersecting;
      if (visible && !started) { started = true; R.welcomeStep = 0; R.welcomeNext = now + 300; wA = rnd(3); wF = rnd(3); wI = rnd(3); }
    }), { threshold: 0.35 }).observe(el.canvas);

    function frame(ts) {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) { last = ts; return; }
      acc += min(200, ts - last); last = ts;
      while (acc >= 25) { now = clock() - acc + 25; tick(); acc -= 25; }   // robot er loop er moto ~40 bar/second
      now = clock();
      paint();
    }
    function paint() {
      render();
      el.armL.style.transform = `rotate(${R.arm[0].toFixed(1)}deg)`;
      el.armR.style.transform = `rotate(${(-R.arm[1]).toFixed(1)}deg)`;
      if (api.onState) api.onState(R);
    }
    requestAnimationFrame(frame);

    // panel er button: tap gulo nijei kore dey (asol touch er motoi)
    api.tap = async n => { audioInit(); for (let i = 0; i < n; i++) { press(true); await wait(90); press(false); await wait(110); } };
    api.hold = async ms => { audioInit(); press(true); await wait(ms); press(false); };
    api.shake = () => { audioInit(); for (let i = 0; i < 5; i++) shakeHit(); el.root.classList.remove('shake'); void el.root.offsetWidth; el.root.classList.add('shake'); };
    api.knock = () => { audioInit(); knock2(); };
    api.sound = on => { if (on === undefined) return S.on; S.on = on; if (!on) noTone(); else audioInit(); try { localStorage.setItem('vb-sound', on ? '1' : '0'); } catch (e) {} return on; };
    api.lang = en => { if (en === undefined) return R.langEn; if (en !== R.langEn) toggleLanguage(); return R.langEn; };
    api.state = R;
    // test er jonno: shomoy ageye dey (lukano tab e animation chole na)
    api._sim = (ms, touch) => { if (touch !== undefined) press(touch); const end = clock() + ms; skew += ms; while (now < end) { now += 25; tick(); } paint(); };
    api._start = () => { started = true; R.welcomeStep = 0; R.welcomeNext = now + 300; };
    return api;
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
})();
