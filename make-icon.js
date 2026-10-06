// Generates icon.ico (16/32/48/256) matching the web favicon. Run: node make-icon.js
const fs = require('fs'), zlib = require('zlib');

function draw(size) {
  const SS = 4, N = size * SS, px = new Float32Array(size * size * 4);
  const u = v => v / 32 * N;                       // favicon viewBox is 32
  const inRR = (x, y) => {                         // rounded rect 0..32, r=8
    const r = u(8), cx = Math.min(Math.max(x, r), N - r), cy = Math.min(Math.max(y, r), N - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  const segs = [[9, 11, 23], [9, 16, 19], [9, 21, 15]], w = u(2.5) / 2;
  const onLine = (x, y) => segs.some(([x0, yy, x1]) => {
    const cx = Math.min(Math.max(x, u(x0)), u(x1));
    return (x - cx) ** 2 + (y - u(yy)) ** 2 <= w * w;
  });
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const X = x + .5, Y = y + .5;
    if (!inRR(X, Y)) continue;
    const c = onLine(X, Y) ? [255, 255, 255] : [99, 102, 241];
    const i = ((y / SS | 0) * size + (x / SS | 0)) * 4;
    px[i] += c[0]; px[i + 1] += c[1]; px[i + 2] += c[2]; px[i + 3] += 1;
  }
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, a = px[i + 3], o = y * (size * 4 + 1) + 1 + x * 4;
    if (a) { raw[o] = px[i] / a; raw[o + 1] = px[i + 1] / a; raw[o + 2] = px[i + 2] / a; raw[o + 3] = a / (SS * SS) * 255; }
  }
  return png(size, raw);
}

function png(size, raw) {
  const crcT = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const sizes = [16, 32, 48, 256], imgs = sizes.map(draw);
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let off = head.length;
sizes.forEach((s, k) => {
  const e = 6 + 16 * k;
  head[e] = s % 256; head[e + 1] = s % 256; head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(imgs[k].length, e + 8); head.writeUInt32LE(off, e + 12); off += imgs[k].length;
});
fs.writeFileSync(__dirname + '/icon.ico', Buffer.concat([head, ...imgs]));
fs.writeFileSync(__dirname + '/icon-preview.png', imgs[3]);
console.log('icon.ico written');
