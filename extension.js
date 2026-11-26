const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECTS = path.join(os.homedir(), '.claude', 'projects');

// Claude Code stores C:\WorkSpace\Personal as "C--WorkSpace-Personal" (drive letter case varies).
const encode = (dir) => dir.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

// Parse one session log: token totals (each message.id once; it repeats per content block) + its name.
function parseSession(text) {
  const t = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const seen = new Set();
  let customTitle, aiTitle, lastPrompt, cwd;
  for (const line of text.split('\n')) {
    if (!line) continue;
    let j;
    try { j = JSON.parse(line); } catch { continue; } // format is internal; skip what we can't read
    if (j.customTitle) customTitle = j.customTitle;
    if (j.aiTitle) aiTitle = j.aiTitle;
    if (j.lastPrompt) lastPrompt = j.lastPrompt;
    if (!cwd && j.cwd) cwd = j.cwd;
    const msg = j.message;
    const u = msg && msg.usage;
    if (!u || seen.has(msg.id)) continue;
    seen.add(msg.id);
    t.input += u.input_tokens || 0;
    t.output += u.output_tokens || 0;
    t.cacheRead += u.cache_read_input_tokens || 0;
    t.cacheWrite += u.cache_creation_input_tokens || 0;
  }
  t.total = t.input + t.output + t.cacheRead + t.cacheWrite;
  return { totals: t, title: customTitle || aiTitle || lastPrompt || '', cwd };
}

const cache = new Map(); // file -> { mtime, info }: only re-read logs that changed

function listSessions() {
  const out = [];
  let projects;
  try { projects = fs.readdirSync(PROJECTS); } catch { return out; }
  for (const p of projects) {
    let names;
    try { names = fs.readdirSync(path.join(PROJECTS, p)); } catch { continue; }
    for (const n of names) {
      if (!n.endsWith('.jsonl')) continue;
      const file = path.join(PROJECTS, p, n);
      let mtime;
      try { mtime = fs.statSync(file).mtimeMs; } catch { continue; }
      out.push({ file, project: p, id: n.slice(0, -6), mtime });
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

function load(s) {
  const c = cache.get(s.file);
  if (c && c.mtime === s.mtime) return Object.assign(s, c.info);
  const info = parseSession(fs.readFileSync(s.file, 'utf8'));
  cache.set(s.file, { mtime: s.mtime, info });
  return Object.assign(s, info);
}

const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n);
const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const name = (s) => s.title || s.id.slice(0, 8);
const folder = (s) => (s.cwd ? path.basename(s.cwd) : s.project);

function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

function activate(context) {
  const vscode = require('vscode');
  const PIN = 'claudeTokenMeter.pinned';
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = 'claudeTokenMeter.pick';
  item.show();

  const mine = () => new Set((vscode.workspace.workspaceFolders || []).map((f) => encode(f.uri.fsPath)));

  const refresh = () => {
    const all = listSessions();
    const pinned = context.workspaceState.get(PIN);
    const here = mine();
    // Pinned session if set; else newest session for this window's folder; else newest anywhere.
    const s = all.find((x) => x.id === pinned)
      || all.find((x) => here.has(x.project.toLowerCase()))
      || all[0];
    if (!s) { item.text = '$(pulse) no session'; return; }
    load(s);
    const t = s.totals;
    item.text = `$(pulse) ${fmt(t.total)} · ${short(name(s), 24)}`;
    item.tooltip = [
      `${name(s)}`,
      `Project: ${folder(s)} · ${s.id.slice(0, 8)} · active ${ago(s.mtime)}${pinned ? ' · pinned' : ''}`,
      '',
      `Total: ${t.total.toLocaleString()}`,
      `Input: ${t.input.toLocaleString()}`,
      `Output: ${t.output.toLocaleString()}`,
      `Cache read: ${t.cacheRead.toLocaleString()}`,
      `Cache write: ${t.cacheWrite.toLocaleString()}`,
      '',
      'Click to see every session',
    ].join('\n');
  };

  const pick = async () => {
    const all = listSessions();
    const here = mine();
    const toItem = (s) => {
      load(s);
      const t = s.totals;
      return {
        label: name(s),
        description: `${fmt(t.total)} tokens`,
        detail: `${folder(s)} · ${ago(s.mtime)} · in ${fmt(t.input)} · out ${fmt(t.output)} · cache read ${fmt(t.cacheRead)} · cache write ${fmt(t.cacheWrite)}`,
        id: s.id,
      };
    };
    const local = all.filter((s) => here.has(s.project.toLowerCase()));
    const other = all.filter((s) => !here.has(s.project.toLowerCase()));
    const items = [
      { label: '$(sync) Follow latest session in this window', id: null },
      { label: 'This workspace', kind: vscode.QuickPickItemKind.Separator },
      ...local.map(toItem),
      { label: 'Other projects', kind: vscode.QuickPickItemKind.Separator },
      ...other.map(toItem),
    ];
    const chosen = await vscode.window.showQuickPick(items, {
      title: 'Claude Code sessions — pick one to show in the status bar',
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (!chosen) return;
    await context.workspaceState.update(PIN, chosen.id || undefined);
    refresh();
  };

  // ponytail: polls every 3s and re-reads a log only when its mtime changes; switch to fs.watch if this gets slow.
  const timer = setInterval(() => { try { refresh(); } catch {} }, 3000);
  context.subscriptions.push(
    item,
    { dispose: () => clearInterval(timer) },
    vscode.commands.registerCommand('claudeTokenMeter.pick', pick),
  );
  refresh();
}

module.exports = { activate, deactivate() {}, parseSession, encode };
