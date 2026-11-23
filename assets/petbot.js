// PetBot live demo: robot er OLED (128x64, upore 16 shari holud, baki neel) browser e.
// Drawing code robot er firmware (C++) theke port kora, sprite ar font robot er-i.
(function () {
  const D = window.PB_DATA;
  const W = 128, H = 64, S = 4;                           // 4x boro, protita pixel OLED er bindur moto
  const YEL = [255, 214, 64], BLU = [96, 196, 255], OFF = [6, 8, 14];

  function hash(x) {                                       // robot er scHash() er moto (eki "random")
    x >>>= 0; x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0; x ^= x >>> 16; return x >>> 0;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const ease = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
  const fl = Math.floor;

  class Oled {
    constructor(canvas) {
      this.cv = canvas; canvas.width = W * S; canvas.height = H * S;
      this.ctx = canvas.getContext('2d'); this.img = this.ctx.createImageData(W * S, H * S);
      this.buf = new Uint8Array(W * H);
    }
    clear() { this.buf.fill(0); }
    px(x, y, v = 1) { x = fl(x); y = fl(y); if (x < 0 || y < 0 || x >= W || y >= H) return; this.buf[y * W + x] = v ? 1 : 0; }
    hline(x, y, w, v = 1) { for (let i = 0; i < w; i++) this.px(x + i, y, v); }
    vline(x, y, h, v = 1) { for (let i = 0; i < h; i++) this.px(x, y + i, v); }
    rect(x, y, w, h, v = 1) { for (let j = 0; j < h; j++) this.hline(x, y + j, w, v); }
    box(x, y, w, h, v = 1) { this.hline(x, y, w, v); this.hline(x, y + h - 1, w, v); this.vline(x, y, h, v); this.vline(x + w - 1, y, h, v); }
    line(x0, y0, x1, y1, v = 1) {
      x0 = fl(x0); y0 = fl(y0); x1 = fl(x1); y1 = fl(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (let n = 0; n < 400; n++) { this.px(x0, y0, v); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    }
    circle(cx, cy, r, v = 1) { cx = fl(cx); cy = fl(cy); for (let y = -r; y <= r; y++) { const d = fl(Math.sqrt(r * r - y * y)); this.hline(cx - d, cy + y, d * 2 + 1, v); } }
    ring(cx, cy, r, v = 1) { for (let a = 0; a < 360; a += 4) this.px(cx + Math.round(Math.cos(a * 0.01745) * r), cy + Math.round(Math.sin(a * 0.01745) * r), v); }
    tri(x0, y0, x1, y1, x2, y2, v = 1) {
      const p = [[x0, y0], [x1, y1], [x2, y2]].sort((a, b) => a[1] - b[1]);
      const [a, b, c] = p;
      const edge = (p1, p2, y) => p2[1] === p1[1] ? p1[0] : p1[0] + (p2[0] - p1[0]) * (y - p1[1]) / (p2[1] - p1[1]);
      for (let y = Math.ceil(a[1]); y <= fl(c[1]); y++) {
        let xa = edge(a, c, y), xb = y < b[1] ? edge(a, b, y) : edge(b, c, y);
        if (xa > xb) [xa, xb] = [xb, xa];
        this.hline(Math.round(xa), y, Math.round(xb) - Math.round(xa) + 1, v);
      }
    }
    rrect(x, y, w, h, r, v = 1) {
      this.rect(x + r, y, w - 2 * r, h, v); this.rect(x, y + r, w, h - 2 * r, v);
      this.circle(x + r, y + r, r, v); this.circle(x + w - r - 1, y + r, r, v); this.circle(x + r, y + h - r - 1, r, v); this.circle(x + w - r - 1, y + h - r - 1, r, v);
    }
    dith(x, y, lv) { return BAYER[(y & 3) * 4 + (x & 3)] < lv; }
    dRect(x0, y0, w, h, lv) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (this.dith(x, y, lv)) this.px(x, y); }
    dCircle(cx, cy, r, lv) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r && this.dith(cx + x, cy + y, lv)) this.px(cx + x, cy + y); }
    sprite(name, x, y, flip = false, rows = -1) {
      const s = D.sprites[name], h = rows < 0 ? s.length : Math.min(s.length, rows);
      for (let j = 0; j < h; j++) { const r = s[j]; for (let i = 0; i < r.length; i++) {
        const c = r[i], px = flip ? x + r.length - 1 - i : x + i;
        if (c === '#') this.px(px, y + j, 1); else if (c === 'o') this.px(px, y + j, 0);
      } }
    }
    textW(str, f = D.font) { let w = 0; for (const ch of str) { const g = f.g[ch.charCodeAt(0) - 32]; if (g) w += g[3]; } return w; }
    text(str, x, baseY, f = D.font, v = 1) {               // robot er GFX font er moto (baseline theke)
      for (const ch of str) {
        const g = f.g[ch.charCodeAt(0) - 32]; if (!g) continue;
        const [off, w, h, adv, xo, yo] = g; let bit = 0;
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++, bit++)
          if (f.b[off + (bit >> 3)] & (0x80 >> (bit & 7))) this.px(x + xo + xx, baseY + yo + yy, v);
        x += adv;
      }
    }
    textC(str, cx, baseY, f = D.font, v = 1) { this.text(str, cx - fl(this.textW(str, f) / 2), baseY, f, v); }
    show() {                                               // OLED er bindu: 3x3 jole, 1 px faka
      const d = this.img.data, RW = W * S;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const on = this.buf[y * W + x], col = on ? (y < 16 ? YEL : BLU) : OFF;
        for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
          const gap = (i === S - 1 || j === S - 1);
          const c = on && gap ? OFF : col, k = ((y * S + j) * RW + x * S + i) * 4;
          d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
        }
      }
      this.ctx.putImageData(this.img, 0, 0);
    }
  }

  // ---------------- 😊 Mukh (robot er chokh) ----------------
  function face(o, mood, t, st) {
    const lx = 29 + st.look, rx = 73 + st.look, y = 21;
    const blink = st.blinkAt && t - st.blinkAt < 140;
    const band = { happy: 'yay!', love: 'Love you', dizzy: '@_@', angry: 'hmph!', surprised: '!!', sleep: '' }[mood];
    if (band) o.textC(band, 64, 13);
    if (mood === 'normal' || mood === 'surprised') {
      if (mood === 'surprised') { o.circle(lx + 13, 36, 14); o.circle(rx + 13, 36, 12); o.ring(64, 58, 3); return; }
      if (blink) { o.rect(lx, 34, 26, 4); o.rect(rx, 34, 26, 4); }
      else { o.rrect(lx, y, 26, 28, 7); o.rrect(rx, y, 26, 28, 7); }
      o.line(59, 57, 61, 59); o.hline(61, 59, 6); o.line(67, 59, 69, 57);
    } else if (mood === 'happy') {
      const b = fl(Math.abs(Math.sin(t / 160)) * 3);
      o.rrect(lx, y + 4 - b, 26, 22, 10); o.rrect(rx, y + 4 - b, 26, 22, 10);
      o.rect(lx - 1, y + 16 - b, 28, 14, 0); o.rect(rx - 1, y + 16 - b, 28, 14, 0);
      for (const cx of [27, 97]) for (let k = 0; k < 3; k++) o.line(cx + k * 3, 53, cx + k * 3 + 2, 50);
      o.circle(64, 55, 4); o.rect(59, 50, 11, 5, 0);
    } else if (mood === 'love') {
      const p = 1 + (fl(t / 300) % 2);
      for (const cx of [42, 86]) { o.circle(cx - 6, 33, 6 + p); o.circle(cx + 6, 33, 6 + p); o.tri(cx - 13 - p, 35, cx + 13 + p, 35, cx, 50 + p); }
      for (let k = 0; k < 3; k++) { const a = (t + k * 900) % 2700, hx = 10 + k * 50, hy = 60 - fl(a / 70); if (hy > 17) { o.circle(hx - 2, hy, 2); o.circle(hx + 2, hy, 2); o.tri(hx - 4, hy + 1, hx + 4, hy + 1, hx, hy + 5); } }
    } else if (mood === 'sleep') {
      o.rect(lx + 2, 38, 22, 3); o.rect(rx + 2, 38, 22, 3);
      o.line(60, 56, 64, 58); o.line(64, 58, 68, 56);
      for (let k = 0; k < 3; k++) { const a = (t + k * 800) % 2400, zx = 100 + k * 6 + fl(a / 200), zy = 14 - fl(a / 300) + k * 2; o.text('z', zx, zy + 2, D.small); }
    } else if (mood === 'dizzy') {
      for (const cx of [42, 86]) { let r = 1; for (let a = 0; a < 16; a += 0.25) { r = 1 + a * 0.75; o.px(cx + Math.cos(a + t / 150) * r, 36 + Math.sin(a + t / 150) * r); } }
      for (let x = 54; x < 74; x++) o.px(x, 56 + Math.round(Math.sin(x / 1.5 + t / 100) * 1.5));
    } else if (mood === 'angry') {
      o.rrect(lx, y + 4, 26, 24, 6); o.rrect(rx, y + 4, 26, 24, 6);
      o.tri(lx - 1, y + 3, lx + 27, y + 3, lx + 27, y + 14, 0); o.tri(rx - 1, y + 3, rx + 27, y + 3, rx - 1, y + 14, 0);
      o.line(58, 58, 64, 55); o.line(64, 55, 70, 58);
      const sx = fl(t / 80) % 2; o.ring(110 + sx, 22, 3); o.ring(116 + sx, 27, 2);
    }
  }

  // ---------------- 🎬 Drishyo (robot er scene, C++ theke) ----------------
  function sun(o, cx, cy, r, t, rays) {
    o.circle(cx, cy, r + 1, 0); o.circle(cx, cy, r);
    if (rays) for (let k = 0; k < 10; k++) { const a = k * 0.628 + t / 2200, r1 = r + 3, r2 = r + 4 + ((k + fl(t / 300)) % 2); o.line(cx + fl(Math.cos(a) * r1), cy + fl(Math.sin(a) * r1), cx + fl(Math.cos(a) * r2), cy + fl(Math.sin(a) * r2)); }
  }
  function farBirds(o, t, n, y0, sp) {
    for (let b = 0; b < n; b++) { const bx = (fl(t / sp) + b * 11 + (b % 2) * 5) % 170 - 20, by = y0 + (b % 3) * 2 + fl(Math.sin(t / 700 + b) * 1.5), w = (fl(t / 160) + b) % 2 ? 2 : 0; o.line(bx - 2, by - w, bx, by); o.line(bx, by, bx + 2, by - w); }
  }
  function palm(o, bx, tx, ty, t) {
    for (let i = 0; i <= 20; i++) { const k = i / 20, x = bx + fl((tx - bx) * k + Math.sin(k * 3.1) * 3), y = 63 - fl((63 - ty) * k); o.rect(x - 1, y, k < 0.7 ? 3 : 2, 2); if (i % 3 === 0) o.px(x, y, 0); }
    const sw = Math.sin(t / 800) * 1.5, FX = [-16, -12, -6, 1, 7, 13, 16], FY = [6, 2, -3, -5, -3, 2, 7];
    for (let f = 0; f < 7; f++) { let px = tx, py = ty; for (let s = 1; s <= 8; s++) { const k = s / 8, x = tx + FX[f] * k + sw * k, y = ty + FY[f] * k + (Math.abs(FX[f]) > 10 ? 5 * k * k : 0); o.line(px, py, x, y); if (s > 1 && s < 8) { const dl = 2 + (s < 5 ? 1 : 0); o.px(x, y + dl); o.px(x - (FX[f] > 0 ? 1 : -1), y + dl - 1); } px = x; py = y; } }
    o.circle(tx - 1, ty + 2, 1); o.circle(tx + 2, ty + 2, 1);
  }
  function village(o, t) {
    sun(o, 112, 7, 4, t, true); o.sprite('cloud', fl(t / 140) % 180 - 30, 1); farBirds(o, t, 4, 6, 70);
    for (let x = 0; x < 128; x++) { const top = 23 + fl(Math.sin(x / 5) * 2 + Math.sin(x / 2.3)); for (let y = top; y < 30; y++) if (y === top || o.dith(x, y, 7)) o.px(x, y); }
    o.rect(6, 27, 48, 28, 0);
    for (let y = 0; y < 12; y++) { const half = 6 + y * 2; for (let x = -half; x <= half; x++) { const px = 30 + x, py = 28 + y; if ((px + py * 2) % 5 !== 0 || y === 11) o.px(px, py); } }
    o.hline(7, 40, 47, 0); o.box(12, 40, 36, 14);
    for (let y = 41; y < 53; y++) for (let x = 13; x < 47; x++) if (o.dith(x, y, 3)) o.px(x, y);
    o.rect(25, 43, 10, 11, 0); o.box(25, 43, 10, 11); o.px(33, 48);
    o.rect(15, 44, 7, 5, 0); o.box(15, 44, 7, 5); o.vline(17, 44, 5); o.vline(19, 44, 5);
    for (let p = 0; p < 5; p++) { const age = (t + p * 560) % 2800, x = 46 + fl(age / 200) + fl(Math.sin(age / 260) * 3), y = 32 - fl(age / 150); if (y > 15) { const r = 1 + fl(age / 900); if (age < 1800) o.circle(x, y, r); else o.dCircle(x, y, r, 6); } }
    palm(o, 62, 58, 27, t + 900);
    for (let row = 0; row < 3; row++) for (let x = 72 + row; x < 128; x += 4 + row) { const y = 43 + row * 4, sw = fl(Math.sin(t / 500 + x / 9) * (1 + row * 0.5)), h = 3 + row; o.line(x, y, x - 1 + sw, y - h); o.line(x, y, x + 1 + sw, y - h); if (row === 2) o.px(x + sw, y - h - 1); }
    o.hline(0, 54, 128);
    for (let r = 0; r < 3; r++) for (let x0 = 0; x0 < 150; x0 += 12) { const x = (x0 + r * 7 + fl(t / (60 + r * 25))) % 150 - 10; o.hline(x, 57 + r * 3, 3 + r); }
    const bx = fl(t / 75) % 200 - 40, bob = Math.round(Math.sin(t / 380) * 1.2);
    o.rect(bx, 44 + bob, 31, 12, 0); o.sprite('nouka', bx, 45 + bob);
    const mx = bx + 26, my = 45 + bob, pa = Math.sin(t / 600) * 0.3; o.circle(mx, my - 6, 1); o.line(mx, my - 5, mx, my); o.line(mx - 3 + fl(pa * 6), my - 8, mx + 4 - fl(pa * 6), my + 8);
  }
  function beach(o, t) {
    const c = t % 26000, k = ease(c / 20000);
    o.dRect(0, 14, 128, 1, 3); o.dRect(0, 15, 128, 1, 6);
    const sy = 4 + fl(k * 20), sx = 70; o.circle(sx, sy, 9, 0);
    for (let y = sy - 8; y <= sy + 8; y++) { if (y < 0 || y >= 16) continue; const dx = fl(Math.sqrt(64 - (y - sy) * (y - sy))); o.hline(sx - dx, y, dx * 2 + 1); }
    o.hline(0, 16, 128, 0); o.sprite('cloud', fl(t / 160) % 180 - 30, 2); farBirds(o, t, 3, 5, 55);
    for (let r = 0; r < 6; r++) { const y = 19 + r * 4 + fl(r * r / 3), sp = 40 + r * 20, len = 3 + r; for (let x0 = 0; x0 < 170; x0 += 14 + r * 3) o.hline((x0 + r * 9 + fl(t / sp)) % 170 - 20, y, len); }
    if (sy < 24) { const st = 24 - sy; for (let r = 0; r < 8; r++) { const w = fl(st * (10 - r) / 18) + 1, jx = fl(Math.sin(t / 180 + r * 1.7) * 2); if ((r + fl(t / 250)) % 3) o.hline(sx - w + jx, 18 + r * 3, w * 2); } }
    for (let x = 0; x < 128; x++) { const edge = 47 + fl(Math.sin(x / 11 + t / 600) * 1.5 + Math.sin(t / 1300) * 1.2); o.px(x, edge); if ((x + fl(t / 120)) % 9 < 3) o.px(x, edge - 1); for (let y = edge + 2; y < 64; y++) if (o.dith(x, y, 3 + fl((y - edge) / 4))) o.px(x, y); }
    palm(o, 10, 21, 26, t);
    const cx = 70 + fl(Math.sin(t / 2600) * 28), right = Math.cos(t / 2600) > 0; o.rect(cx - 1, 53, 17, 11, 0); o.sprite(fl(t / 160) % 2 ? 'crab_a' : 'crab_b', cx, 54, !right);
    const ux = 108; o.line(ux, 40, ux + 2, 62);
    for (let y = 0; y <= 9; y++) { const half = fl(Math.sqrt(Math.max(0, 100 - (9 - y) * (9 - y) * 1.2))); for (let x = -half; x <= half; x++) if (y === 9 || fl((x + 12) / 4) % 2 || o.dith(ux + x, 31 + y, 8)) o.px(ux + x, 31 + y); }
  }
  function fireworks(o, t) {
    for (let i = 0; i < 12; i++) { const h = hash(i + 31); if ((fl(t / 500) + h) % 6) o.px(h % 128, (h >>> 8) % 12); }
    for (let y = 38; y < 50; y++) o.dRect(0, y, 128, 1, fl((y - 38) / 3));
    const BX = [0, 10, 21, 33, 44, 56, 69, 81, 93, 104, 116], BW = [10, 11, 12, 11, 12, 13, 12, 12, 11, 12, 12], BH = [16, 24, 13, 30, 18, 22, 14, 27, 17, 21, 15];
    for (let i = 0; i < 11; i++) {
      const x = BX[i], w = BW[i], h = BH[i], top = 64 - h; o.rect(x, top, w, h, 0); o.vline(x, top, h); o.hline(x, top, w);
      if (i === 3) { o.vline(x + fl(w / 2), top - 7, 7); if (fl(t / 600) % 2) o.px(x + fl(w / 2), top - 8); }
      if (i === 7) { o.line(x, top, x + fl(w / 2), top - 4); o.line(x + fl(w / 2), top - 4, x + w - 1, top); }
      for (let wy = top + 3; wy < 62; wy += 3) for (let wx = x + 2; wx < x + w - 1; wx += 3) if (hash(i * 977 + wy * 31 + wx * 7 + fl(t / 5000)) % 3 === 0) o.rect(wx, wy, 2, 1);
    }
    for (let s = 0; s < 3; s++) {
      const P = 3000, tt = t + s * 1000, h = hash(fl(tt / P) * 7 + s * 131), ph = tt % P, x = 16 + h % 96, by = 6 + (h >>> 8) % 20;
      if (ph < 650) { const y = 60 - fl((60 - by) * ease(ph / 650)); o.px(x, y); o.px(x, y + 1); for (let k2 = 3; k2 < 9; k2 += 2) o.px(x + (fl(k2 / 2) % 2), y + k2); }
      else {
        const a = ph - 650, r = 15 * (1 - Math.exp(-a / 260)), fall = a * a / 140000, n = 14, fade = fl(a / 160), ring2 = (h >>> 20) & 1;
        for (let k = 0; k < n; k++) {
          if ((fade > 6 && (k + fade) % 3) || fade > 9) continue;
          const an = k * 6.2832 / n + ((h >>> 4) & 7) * 0.2, cx = Math.cos(an), cy = Math.sin(an), x1 = x + fl(cx * r), y1 = by + fl(cy * r + fall);
          if (a < 500) o.line(x + fl(cx * r * 0.6), by + fl(cy * r * 0.6 + fall), x1, y1); else o.px(x1, y1);
          if (ring2 && fade < 5) o.px(x + fl(cx * r * 0.5), by + fl(cy * r * 0.5 + fall));
        }
        if (a < 120) o.circle(x, by, 3 - fl(a / 50));
      }
    }
  }
  function miniBot(o, x, y, pose, t) {                     // choto PetBot (khela-r jonno)
    const a = Math.sin(t / 65), lx1 = x - 2, lx2 = x + 2, ly = y - 7;
    o.rect(x - 6, y - 25, 13, 26, 0);
    if (pose === 1) { const s = fl(a * 4); o.line(lx1, ly, lx1 + s, y); o.line(lx2, ly, lx2 - s, y); }
    else if (pose === 2) { o.line(lx1, ly, lx1 - 1, y); o.line(lx2, ly, lx2 + 6, y - 4); }
    else { o.line(lx1, ly, lx1, y); o.line(lx2, ly, lx2, y); }
    o.rrect(x - 4, y - 14, 9, 8, 2); o.px(x, y - 11, 0);
    const ay = y - 12;
    if (pose === 4) { o.line(x - 4, ay, x - 7, ay - 6); o.line(x + 4, ay, x + 7, ay - 6); }
    else if (pose === 1) { const s = fl(a * 3); o.line(x - 4, ay, x - 6 - s, ay + 4); o.line(x + 4, ay, x + 6 + s, ay + 4); }
    else { o.line(x - 4, ay, x - 6, ay + 5); o.line(x + 4, ay, x + 6, ay + 5); }
    o.sprite('bot_head', x - 6, y - 25);
  }
  function football(o, t) {
    const e = t % 8000;
    o.textC('Football time!', 64, 13);
    for (let x = 1; x < 128; x += 4) { const h = hash(x * 7), jy = e > 4500 && (fl(t / 150) + h) % 2 ? -1 : 0; o.circle(x, 20 + (h % 2) + jy, 1); }
    o.dRect(0, 22, 128, 3, 6); o.hline(0, 59, 128);
    for (let x = 0; x < 128; x++) if (o.dith(x, 61, 5)) o.px(x, 61);
    const bulge = e > 4400 && e < 5000 ? 2 : 0; o.vline(108, 36, 23); o.hline(108, 36, 20);
    for (let y = 37; y < 59; y++) for (let x = 109; x < 128; x++) if ((x + y + bulge) % 3 === 0 || ((x - y) % 3 === 0 && y > 40)) o.px(x + (y > 44 ? fl(bulge / 2) : 0), y);
    let rx, pose, bx, by;
    if (e < 3500) { rx = 8 + fl(e * 58 / 3500); pose = 1; bx = rx + 7 + fl(Math.sin(e / 140) * 2); by = 52; }
    else if (e < 3700) { rx = 66; pose = 2; bx = 74; by = 52; }
    else if (e < 4400) { rx = 66; pose = 0; const k = (e - 3700) / 700; bx = 74 + k * 44; by = 52 - Math.sin(k * 3.1416) * 16 - k * 6; }
    else { const k = Math.min(1, (e - 4400) / 500), r = ease(Math.min(1, (e - 4400) / 900)); bx = 116; by = 46 + k * 6; rx = 66 - fl(r * 40); pose = r < 1 ? 1 : 4; }
    const goal = e > 4400, jy = goal ? fl(Math.abs(Math.sin(e / 160)) * 5) : 0;
    miniBot(o, rx, 59 - jy, pose, t);
    o.circle(fl(bx) + 3, fl(by) + 3, 4, 0); o.sprite('football', fl(bx), fl(by), fl(e / 120) % 2 === 1);
    if (goal) {
      for (let i = 0; i < 14; i++) { const h = hash(i + 900); o.px(h % 128 + Math.sin(e / 200 + i) * 2, 16 + (fl(e / 18) + (h >>> 8)) % 46); }
      const w = o.textW('GOAL!'); o.rect(84 - fl(w / 2) - 2, 27, w + 4, 15, 0); o.textC('GOAL!', 84, 40);
    }
  }
  function birdSong(o, t) {
    sun(o, 112, 7, 4, t, true); o.sprite('cloud', fl(t / 160 + 90) % 180 - 30, 2);
    o.rect(26, 38, 9, 23); for (let y = 40; y < 60; y += 3) o.px(29 + fl(y / 3) % 3, y, 0);
    o.line(24, 61, 26, 56); o.line(37, 61, 35, 56); o.rect(34, 44, 54, 3); o.line(60, 44, 66, 40); o.line(84, 44, 90, 40);
    const CR = [[17, 30, 8], [29, 27, 9], [42, 28, 8], [22, 37, 6], [38, 36, 7], [51, 33, 6], [9, 35, 5]];
    for (const c of CR) o.circle(c[0], c[1], c[2] + 1, 0);
    for (const c of CR) for (let y = -c[2]; y <= c[2]; y++) for (let x = -c[2]; x <= c[2]; x++) {
      const d = x * x + y * y, r2 = c[2] * c[2]; if (d > r2) continue; const px = c[0] + x, py = c[1] + y, edge = d > r2 - 2 * c[2];
      if (edge ? (px + py) % 3 !== 0 : o.dith(px, py, 6 + (y > 0 ? 4 : 0))) o.px(px, py);
    }
    o.hline(0, 61, 128); for (let x = 2; x < 128; x += 4) { o.line(x, 61, x - 1, 58); o.line(x, 61, x + 1, 59); }
    const c = t % 14000, s1 = (c % 3000) < 1300 && fl(c / 150) % 2;
    o.sprite(s1 ? 'doyel_sing' : 'doyel', 58, 33);
    for (let k = 0; k < 4; k++) { const age = (c + k * 700) % 2800; if (age > 2100) continue; const x = 76 + fl(age / 40) + fl(Math.sin(age / 180 + k) * 3), y = 33 - fl(age / 75);
      if (y > 21 && x < 126) { o.circle(x, y, 1); o.vline(x + 1, y - 5, 5); o.line(x + 1, y - 5, x + 3, y - 3); } }
    o.sprite((c % 3000) >= 1500 && (c % 3000) < 2700 && fl(c / 150) % 2 ? 'doyel_sing' : 'doyel', 80, 33, true);
  }

  const SCENES = { village, beach, fireworks, football, birds: birdSong };
  const AUTO = [['face', 'normal', 5000], ['face', 'happy', 2500], ['scene', 'village', 11000], ['face', 'love', 3000], ['scene', 'football', 8000],
                ['face', 'dizzy', 2500], ['scene', 'beach', 10000], ['face', 'surprised', 1800], ['scene', 'birds', 10000], ['face', 'angry', 2500],
                ['scene', 'fireworks', 9000], ['face', 'sleep', 4000]];

  // ---------------- Chalano ----------------
  window.PetBotDemo = function (canvas, onChange) {
    const o = new Oled(canvas);
    const st = { kind: 'face', name: 'normal', since: performance.now(), auto: true, step: 0, look: 0, nextLook: 0, blinkAt: 0, nextBlink: 1500, visible: true, until: 0 };
    const set = (kind, name, auto = false) => { st.kind = kind; st.name = name; st.since = performance.now(); st.auto = auto; if (onChange) onChange(kind, name, auto); };
    const api = {
      mood(m) { set('face', m); st.until = performance.now() + 6000; },
      scene(s) { set('scene', s); st.until = 0; },
      auto() { st.step = 0; set(AUTO[0][0], AUTO[0][1], true); },
    };
    canvas.addEventListener('click', () => { if (st.kind === 'face') api.mood(['happy', 'love', 'surprised', 'dizzy'][fl(Math.random() * 4)]); });
    new IntersectionObserver(es => es.forEach(e => st.visible = e.isIntersecting)).observe(canvas);
    function frame(now) {
      requestAnimationFrame(frame);
      if (!st.visible) return;
      const t = now - st.since;
      if (st.auto && t > AUTO[st.step][2]) { st.step = (st.step + 1) % AUTO.length; const a = AUTO[st.step]; st.kind = a[0]; st.name = a[1]; st.since = now; if (onChange) onChange(a[0], a[1], true); }
      if (!st.auto && st.until && now > st.until) { st.until = 0; set('face', 'normal'); }
      if (now > st.nextLook) { st.look = [-5, 0, 0, 5][fl(Math.random() * 4)]; st.nextLook = now + 1500 + Math.random() * 2500; }
      if (now > st.nextBlink) { st.blinkAt = now; st.nextBlink = now + 2200 + Math.random() * 3000; }
      o.clear();
      if (st.kind === 'face') face(o, st.name, now, { look: st.look, blinkAt: st.blinkAt ? now - (now - st.blinkAt) : 0 });
      else SCENES[st.name](o, t);
      o.show();
    }
    requestAnimationFrame(frame);
    return api;
  };
  window.PBOled = Oled;                                    // virtual PetBot (vbot.js) eki screen bebohar kore
  window.PBScenes = SCENES;
  // Ekta nirdishto muhurter chobi (animation chara): kind 'face' | 'scene', t = ms
  window.PetBotFrame = function (canvas, kind, name, t) {
    const o = new Oled(canvas);
    if (kind === 'face') face(o, name, t, { look: 0, blinkAt: 0 }); else SCENES[name](o, t);
    o.show();
  };
})();
