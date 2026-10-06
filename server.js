// Backlog Viewer — local server (Node >= 18, no dependencies)
// Run: node server.js   →  http://localhost:4321
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4321;
const ROOT = path.resolve(__dirname, '..');           // parent folder — scanned for BACKLOG*.md
const DATA = path.join(__dirname, 'projects.json');
const PUBLIC = path.join(__dirname, 'public');
const SKIP = new Set(['node_modules', '.git', '.godot', 'build', 'dist', '.import', 'backlog-viewer']);

// ---------- messages (vi / en, picked by the page's X-Lang header) ----------
const MSG = {
  vi: {
    noTicket: id => 'Không tìm thấy ticket ' + id, noStatusCol: 'Ticket không có cột trạng thái',
    noBuildCmd: 'Dự án chưa có lệnh build (Sửa → Lệnh build release)', alreadyBuilding: 'Đang build rồi',
    noPresets: 'Không thấy export_presets.cfg để tăng version',
    reverted: (n, c) => `build lỗi — đã trả version về ${n} (${c})`, finished: (c, s) => `kết thúc, mã thoát ${c} sau ${s} s`,
    stopped: 'đã bấm dừng', cantRead: 'Không đọc được file', noProject: 'Không có dự án',
    noBacklogInDir: 'Thư mục không có file BACKLOG*.md', noFile: 'File không tồn tại',
  },
  en: {
    noTicket: id => 'Ticket not found: ' + id, noStatusCol: 'This ticket has no status column',
    noBuildCmd: 'The project has no build command (Edit → Release build command)', alreadyBuilding: 'A build is already running',
    noPresets: 'export_presets.cfg not found, cannot bump the version',
    reverted: (n, c) => `build failed — version restored to ${n} (${c})`, finished: (c, s) => `finished, exit code ${c} after ${s} s`,
    stopped: 'stop requested', cantRead: 'Cannot read the file', noProject: 'No such project',
    noBacklogInDir: 'No BACKLOG*.md file in that folder', noFile: 'File not found',
  },
};
const msg = (lang, k, ...a) => { const v = (MSG[lang] || MSG.vi)[k]; return typeof v === 'function' ? v(...a) : v; };

// ---------- project store ----------
function loadProjects() {
  try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch { return null; }
}
function saveProjects(list) {
  fs.writeFileSync(DATA, JSON.stringify(list, null, 2), 'utf8');
}
function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
}
function uniqueId(base, list) {
  let id = base, n = 2;
  while (list.some(p => p.id === id)) id = `${base}-${n++}`;
  return id;
}

// Find BACKLOG*.md files up to a few levels deep
function scan(dir = ROOT, depth = 0, out = []) {
  if (depth > 3) return out;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith('.')) scan(full, depth + 1, out); }
    else if (/^backlog.*\.md$/i.test(e.name)) out.push(full);
  }
  return out;
}

function projectFromFile(file, list) {
  const text = safeRead(file) || '';
  const h1 = text.match(/^#\s+(.+)$/m);
  const name = h1 ? h1[1].replace(/\s*[—-]\s*backlog\s*$/i, '').trim() : path.basename(path.dirname(file));
  return { id: uniqueId(slug(path.basename(path.dirname(file))), list), name, file, color: null };
}

function ensureProjects() {
  let list = loadProjects();
  if (!list) {
    list = [];
    for (const f of scan()) list.push(projectFromFile(f, list));
    saveProjects(list);
  }
  return list;
}

function safeRead(f) { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } }

// ---------- markdown backlog parser ----------
const COLS = {
  id: /^id$/i,
  title: /^(việc|task|title|tên|mô tả|description)$/i,
  priority: /^(ưu tiên|priority|prio)$/i,
  estimate: /^(ước lượng|estimate|est|effort)$/i,
  needs: /^(cần bạn|owner|người làm|assignee|cần)$/i,
  status: /^(trạng thái|status|state)$/i,
};
const splitRow = line => {
  const s = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = []; let cur = '', code = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '`') code = !code;
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '|' && !code) { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
};
function parseStatus(cell) {
  if (cell == null) return 'none';
  const m = cell.match(/\[( |x|X|~|-|\/)\]/);
  if (!m) return /done|xong/i.test(cell) ? 'done' : 'none';
  return { ' ': 'todo', x: 'done', X: 'done', '~': 'doing', '/': 'doing', '-': 'cancel' }[m[1]];
}

function parseBacklog(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  const tickets = [];
  let title = '', intro = [], section = null, table = null;
  const legend = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      table = null;
      if (h[1] === '#' && !title) { title = h[2].trim(); continue; }
      if (h[1] === '##') {
        section = { name: h[2].trim(), note: [], line: i };
        sections.push(section);
      } else if (section) section.note.push(line);
      continue;
    }
    if (/^\s*\|/.test(line)) {
      const cells = splitRow(line);
      if (!table) {
        // header row: need ID column + separator next
        const sep = lines[i + 1] && /^\s*\|[\s:|-]+\|?\s*$/.test(lines[i + 1]);
        const map = {};
        cells.forEach((c, idx) => { for (const k in COLS) if (COLS[k].test(c.replace(/\*/g, ''))) map[k] = idx; });
        table = { map, isTicket: sep && map.id != null };
        if (sep) i++;
        continue;
      }
      if (!table.isTicket) continue;
      const g = k => (table.map[k] != null ? cells[table.map[k]] : null);
      const id = (g('id') || '').replace(/[*~`]/g, '').trim();
      if (!id) continue;
      tickets.push({
        id,
        title: g('title') ?? cells.filter((_, k) => k !== table.map.id).join(' · '),
        priority: (g('priority') || '').replace(/[*`]/g, '').trim(),
        estimate: (g('estimate') || '').trim(),
        needs: (g('needs') || '').trim(),
        status: parseStatus(g('status')),
        hasStatus: table.map.status != null,
        section: section ? section.name : '(Chung)',
        line: i,
        struck: /^~~/.test((g('id') || '').trim()),
      });
      continue;
    }
    table = null;
    if (section) section.note.push(line);
    else if (title) { if (/^\*\*.+?:\*\*/.test(line)) legend.push(line); else intro.push(line); }
  }
  return {
    title,
    // first plain paragraph after the title
    intro: (intro.join('\n').split(/\n\s*\n/).map(s => s.trim())
      .find(s => s && !/^(\*\*|#|\||---)/.test(s)) || ''),
    legend,
    sections: sections.map(s => ({ name: s.name, note: s.note.join('\n').trim() })),
    tickets,
  };
}

// Rewrite the status cell of one ticket row in the file
function setStatus(file, ticketId, line, status, lang) {
  const text = fs.readFileSync(file, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const mark = { todo: '[ ]', doing: '[~]', done: '[x]' }[status];
  if (!mark) throw new Error('Bad status');
  // locate row: prefer given line, fall back to search by ID
  const isRow = l => /^\s*\|/.test(l) && splitRow(l)[0].replace(/[*~`]/g, '').trim() === ticketId;
  let idx = isRow(lines[line] || '') ? line : lines.findIndex(isRow);
  if (idx < 0) throw new Error(msg(lang, 'noTicket', ticketId));
  const row = lines[idx];
  const re = /\[( |x|X|~|-|\/)\]/g;
  let last = null, m;
  while ((m = re.exec(row))) last = m;
  if (!last) throw new Error(msg(lang, 'noStatusCol'));
  lines[idx] = row.slice(0, last.index) + mark + row.slice(last.index + 3);
  fs.writeFileSync(file, lines.join(eol), 'utf8');
}

// ---------- release build ----------
// Each project may set `build` (shell command run in the project folder). Without it,
// tools/export_release.ps1 is used when present. Godot projects get their version
// bumped in export_presets.cfg first; a failed build puts the old version back.
const { spawn, execFile } = require('child_process');
const builds = new Map();                 // project id -> build state

const projDir = p => path.dirname(p.file);
function buildCmd(p) {
  if (p.build) return { cmd: p.build, auto: false };
  const ps = path.join(projDir(p), 'tools', 'export_release.ps1');
  if (fs.existsSync(ps)) return { cmd: 'powershell -NoProfile -ExecutionPolicy Bypass -File tools\\export_release.ps1', auto: true };
  return { cmd: '', auto: false };
}
const presetsFile = p => path.join(projDir(p), 'export_presets.cfg');
function readVersion(p) {
  const t = safeRead(presetsFile(p));
  if (!t) return null;
  const code = t.match(/^version\/code=(\d+)/m), name = t.match(/^version\/name="([^"]*)"/m);
  return code || name ? { code: code ? +code[1] : null, name: name ? name[1] : null } : null;
}
function writeVersion(p, v) {
  const f = presetsFile(p);
  let t = fs.readFileSync(f, 'utf8');
  if (v.code != null) t = t.replace(/^version\/code=\d+/gm, `version/code=${v.code}`);
  if (v.name != null) t = t.replace(/^version\/name="[^"]*"/gm, `version/name="${v.name}"`);
  fs.writeFileSync(f, t, 'utf8');
}
function buildInfo(p) {
  const b = builds.get(p.id);
  return {
    ...buildCmd(p), version: readVersion(p),
    running: !!(b && b.running), startedAt: b?.startedAt, endedAt: b?.endedAt, exitCode: b?.exitCode ?? null,
    bumped: b?.bumped || null, reverted: !!b?.reverted, log: b ? b.log.join('') .split('\n').slice(-400).join('\n') : '',
  };
}
function startBuild(p, bump, lang) {
  const { cmd } = buildCmd(p);
  if (!cmd) throw new Error(msg(lang, 'noBuildCmd'));
  if (builds.get(p.id)?.running) throw new Error(msg(lang, 'alreadyBuilding'));
  const b = { running: true, startedAt: Date.now(), log: [], bumped: null, reverted: false, lang };
  const out = s => { b.log.push(s); if (b.log.length > 4000) b.log.splice(0, 1000); };
  let old = null;
  if (bump) {
    old = readVersion(p);
    if (!old) throw new Error(msg(lang, 'noPresets'));
    writeVersion(p, bump);
    b.bumped = { from: old, to: bump };
    out(`> version ${old.name} (${old.code}) → ${bump.name} (${bump.code})\n`);
  }
  out(`> ${cmd}\n`);
  const child = spawn(cmd, { cwd: projDir(p), shell: true, windowsHide: true });
  b.child = child;
  child.stdout.on('data', d => out(d.toString()));
  child.stderr.on('data', d => out(d.toString()));
  const done = code => {
    if (!b.running) return;
    b.running = false; b.endedAt = Date.now(); b.exitCode = code;
    if (code !== 0 && old) { try { writeVersion(p, old); b.reverted = true; out(`\n> ${msg(lang, 'reverted', old.name, old.code)}\n`); } catch {} }
    out(`\n> ${msg(lang, 'finished', code, Math.round((b.endedAt - b.startedAt) / 1000))}\n`);
  };
  child.on('error', e => { out(String(e) + '\n'); done(-1); });
  child.on('close', code => done(code ?? -1));
  builds.set(p.id, b);
}
function stopBuild(p) {
  const b = builds.get(p.id);
  if (!b?.running) return;
  b.log.push(`\n> ${msg(b.lang, 'stopped')}\n`);
  if (process.platform === 'win32') execFile('taskkill', ['/pid', String(b.child.pid), '/T', '/F'], () => {});
  else b.child.kill('SIGTERM');
}
const anyBuildRunning = () => [...builds.values()].some(b => b.running);

// ---------- auto exit (node server.js --auto-exit) ----------
// Exit a few seconds after the last browser tab closes. Hidden tabs may only
// ping once a minute (browser throttling), so stale entries expire after 3 min.
const AUTO_EXIT = process.argv.includes('--auto-exit');
const clients = new Map();               // client id -> last ping time
let idleTimer = null;
function scheduleIdleCheck(delay = 4000) {
  if (!AUTO_EXIT) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const now = Date.now();
    for (const [id, t] of clients) if (now - t > 180000) clients.delete(id);
    if (!clients.size && !anyBuildRunning()) { console.log('No open tabs left, stopping.'); process.exit(0); }
    scheduleIdleCheck(30000);
  }, delay);
}
scheduleIdleCheck(60000);                 // no tab opened within 1 min → exit

// ---------- http ----------
function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((ok, fail) => {
    let d = ''; req.on('data', c => (d += c));
    req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { fail(e); } });
  });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

function projectPayload(p, lang) {
  const text = safeRead(p.file);
  const extra = { building: !!builds.get(p.id)?.running, canBuild: !!buildCmd(p).cmd };
  if (text == null) return { ...p, ...extra, error: msg(lang, 'cantRead'), tickets: [], sections: [] };
  let mtime = 0; try { mtime = fs.statSync(p.file).mtimeMs; } catch {}
  return { ...p, ...extra, mtime, ...parseBacklog(text) };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean);
  const lang = req.headers['x-lang'] === 'en' ? 'en' : 'vi';
  try {
    // Changes need the X-BV header (sent by our page; bye comes from sendBeacon; other sites can't add it without CORS)
    if (parts[0] === 'api' && req.method !== 'GET' && parts[1] !== 'bye' && req.headers['x-bv'] !== '1')
      return send(res, 403, { error: 'Forbidden' });
    // --- lifecycle: heartbeat from open tabs, shutdown button ---
    if (parts[0] === 'api' && parts[1] === 'ping') { clients.set(url.searchParams.get('c'), Date.now()); return send(res, 200, { ok: true }); }
    if (parts[0] === 'api' && parts[1] === 'bye') { clients.delete(url.searchParams.get('c')); scheduleIdleCheck(); return send(res, 200, { ok: true }); }
    if (parts[0] === 'api' && parts[1] === 'shutdown' && req.method === 'POST') {
      send(res, 200, { ok: true });
      console.log('Stopped from the UI.');
      return setTimeout(() => process.exit(0), 200);
    }
    if (parts[0] === 'api') {
      const list = ensureProjects();
      // GET/POST/DELETE /api/projects/:id/build
      if (parts[1] === 'projects' && parts[3] === 'build') {
        const p = list.find(p => p.id === parts[2]);
        if (!p) return send(res, 404, { error: msg(lang, 'noProject') });
        if (req.method === 'POST') { const b = await readBody(req); startBuild(p, b.bump || null, lang); }
        if (req.method === 'DELETE') stopBuild(p);
        return send(res, 200, buildInfo(p));
      }
      // GET /api/projects
      if (parts[1] === 'projects' && !parts[2] && req.method === 'GET')
        return send(res, 200, list.map(p => projectPayload(p, lang)));
      // POST /api/projects {name, file, color}
      if (parts[1] === 'projects' && !parts[2] && req.method === 'POST') {
        const b = await readBody(req);
        let file = path.resolve(String(b.file || '').trim());
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
          const f = fs.readdirSync(file).find(n => /^backlog.*\.md$/i.test(n));
          if (!f) return send(res, 400, { error: msg(lang, 'noBacklogInDir') });
          file = path.join(file, f);
        }
        if (!fs.existsSync(file)) return send(res, 400, { error: msg(lang, 'noFile') });
        const p = projectFromFile(file, list);
        if (b.name) p.name = String(b.name).trim();
        if (b.color) p.color = b.color;
        if (b.build) p.build = String(b.build).trim();
        list.push(p); saveProjects(list);
        return send(res, 201, projectPayload(p, lang));
      }
      // PUT/DELETE /api/projects/:id
      if (parts[1] === 'projects' && parts[2] && !parts[3]) {
        const i = list.findIndex(p => p.id === parts[2]);
        if (i < 0) return send(res, 404, { error: msg(lang, 'noProject') });
        if (req.method === 'DELETE') { list.splice(i, 1); saveProjects(list); return send(res, 200, { ok: true }); }
        if (req.method === 'PUT') {
          const b = await readBody(req);
          if (b.name != null) list[i].name = String(b.name).trim() || list[i].name;
          if (b.color !== undefined) list[i].color = b.color || null;
          if (b.build !== undefined) list[i].build = String(b.build || '').trim() || null;
          if (b.file) {
            const f = path.resolve(String(b.file).trim());
            if (!fs.existsSync(f)) return send(res, 400, { error: msg(lang, 'noFile') });
            list[i].file = f;
          }
          saveProjects(list);
          return send(res, 200, projectPayload(list[i], lang));
        }
      }
      // PATCH /api/projects/:id/tickets/:ticketId {status, line}
      if (parts[1] === 'projects' && parts[3] === 'tickets' && req.method === 'PATCH') {
        const p = list.find(p => p.id === parts[2]);
        if (!p) return send(res, 404, { error: msg(lang, 'noProject') });
        const b = await readBody(req);
        setStatus(p.file, decodeURIComponent(parts[4]), Number(b.line), b.status, lang);
        return send(res, 200, projectPayload(p, lang));
      }
      // GET /api/scan → backlog files not yet added
      if (parts[1] === 'scan') {
        const known = new Set(list.map(p => path.resolve(p.file).toLowerCase()));
        return send(res, 200, scan().filter(f => !known.has(f.toLowerCase())));
      }
      return send(res, 404, { error: 'Not found' });
    }
    // static
    const fp = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
    if (!fp.startsWith(PUBLIC) || !fs.existsSync(fp)) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, fs.readFileSync(fp), MIME[path.extname(fp)] || 'application/octet-stream');
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Backlog Viewer → http://localhost:${PORT}  (root: ${ROOT})`));
