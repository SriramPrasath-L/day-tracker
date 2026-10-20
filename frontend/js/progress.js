// Progress tab: overview, per-task history, gym charts, and weekly body weight with monthly summaries.
import { S, TODAY, addD, wk } from './store.js';
import { api } from './api.js';
import { $, esc, toast, acts } from './ui.js';

let pt = 'ov', rng = 7, pe = '';
const lastN = (n) => Array.from({ length: n }, (_, k) => addD(TODAY, k - n + 1));
const pc = (d) => { const x = S.days[d]; return x && x.items.length ? x.items.filter((i) => i.done).length / x.items.length : null; };

function sess(name) {
  return Object.keys(S.days).sort().map((k) => {
    const e = S.days[k].gym.find((x) => x.name === name), ss = e ? e.sets.filter((s) => s.done) : [];
    if (!ss.length) return null;
    return { d: k, top: Math.max(...ss.map((s) => +s.w)), txt: ss.map((s) => s.r + '×' + s.w).join(', ') };
  }).filter(Boolean);
}

function chart(ss) {
  if (ss.length < 2) return '<p class="mut">Log at least two entries to see the line.</p>';
  const W = 320, H = 130, p = 24, ws = ss.map((s) => s.top), mn = Math.min(...ws), r = (Math.max(...ws) - mn) || 1;
  const X = (i) => p + i * (W - 2 * p) / (ss.length - 1), Y = (v) => H - p - (v - mn) / r * (H - 2 * p);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Progress over time"><polyline fill="none" stroke="var(--acc)" stroke-width="2.5" points="${ss.map((s, i) => X(i) + ',' + Y(s.top)).join(' ')}"/>${ss.map((s, i) => `<circle cx="${X(i)}" cy="${Y(s.top)}" r="4" fill="var(--acc)"/><text x="${X(i)}" y="${Y(s.top) - 9}" text-anchor="middle" font-size="10" fill="var(--mut)">${s.top}</text>`).join('')}</svg>`;
}

function pOv() {
  const ds = lastN(rng), v = ds.map(pc), ok = v.filter((x) => x !== null), W = 320, H = 110, bw = W / ds.length;
  const avg = ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length * 100) : 0;
  const gy = ds.filter((d) => S.days[d] && S.days[d].items.some((i) => i.gym && i.done)).length;
  return `<section class="sum"><div class="stat"><div><b>${avg}%</b><span class="mut">avg completion</span></div><div><b>${ok.filter((x) => x === 1).length}</b><span class="mut">perfect days</span></div><div><b>${gy}</b><span class="mut">gym sessions</span></div></div><svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Daily completion">${v.map((x, i) => { const h = Math.max(3, (x || 0) * H); return `<rect x="${i * bw + 1}" y="${H - h}" width="${bw - 2}" height="${h}" rx="3" fill="${x === null ? 'var(--line)' : x === 1 ? 'var(--ok)' : 'var(--acc)'}"/>`; }).join('')}</svg><div class="mut small">Daily % of tasks done, last ${rng} days</div></section>`;
}

function pTasks() {
  const ds = lastN(rng), m = {}, bw = 320 / ds.length;
  ds.forEach((d, i) => { const x = S.days[d]; if (x) x.items.forEach((t) => { const o = m[t.name] || (m[t.name] = { c: Array(ds.length).fill(0) }); o.c[i] = t.done ? 2 : 1; }); });
  return Object.entries(m).map(([n, o]) => {
    const pl = o.c.filter(Boolean).length, dn = o.c.filter((c) => c === 2).length;
    let st = 0;
    for (let i = o.c.length - 1; i >= 0; i--) { if (o.c[i] === 2) st++; else if (o.c[i] === 1 && i < o.c.length - 1) break; }
    return `<section class="sum"><div class="eh"><b>${esc(n)}</b><span class="chip">${pl ? Math.round(dn / pl * 100) : 0}%</span><span class="mut small" style="margin-left:auto">streak ${st}</span></div><svg viewBox="0 0 320 28" class="chart" role="img" aria-label="${esc(n)} history">${o.c.map((c, i) => `<rect x="${i * bw + 1}" y="2" width="${bw - 2}" height="24" rx="4" fill="${c === 2 ? 'var(--ok)' : c === 1 ? 'var(--bad)' : 'var(--line)'}"/>`).join('')}</svg></section>`;
  }).join('') || '<section class="sum mut">No data yet.</section>';
}

function pGym() {
  const names = [...new Set(Object.values(S.days).flatMap((d) => d.gym.map((e) => e.name)))];
  if (!pe || !names.includes(pe)) pe = names[0] || '';
  if (!names.length) return '<section class="sum mut">Tick some sets in the Gym log on the Today tab and they show up here.</section>';
  const ss = sess(pe), pb = ss.length ? Math.max(...ss.map((s) => s.top)) : 0, l = ss[ss.length - 1], p = ss[ss.length - 2];
  return `<section class="sum"><select data-change="pEx" aria-label="Exercise">${names.map((n) => `<option${n === pe ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select><div class="stat"><div><b>${pb} kg</b><span class="mut">best weight</span></div><div><b>${l && p ? (l.top - p.top > 0 ? '+' : '') + (l.top - p.top) + ' kg' : '–'}</b><span class="mut">vs previous</span></div></div>${chart(ss)}<table><tr><th>Date</th><th>Sets (reps×kg)</th></tr>${[...ss].reverse().map((s) => `<tr><td>${s.d.slice(5)}</td><td>${s.txt}</td></tr>`).join('')}</table></section>`;
}

function pBody() {
  const b = [...S.bw].sort((a, c) => a.d.localeCompare(c.d)), have = b.some((e) => e.d === wk(TODAY)), mo = {};
  b.forEach((e) => (mo[e.d.slice(0, 7)] = mo[e.d.slice(0, 7)] || []).push(e));
  return `<section class="sum"><h3>Weekly weigh-in</h3><div class="adx v"><input id="bw" type="number" inputmode="decimal" step="0.1" placeholder="${have ? 'Update this week (kg)' : 'This week\'s weight (kg)'}" aria-label="Weight in kg"><button class="pri" data-act="addBw">Save</button></div><p class="mut small" style="margin:6px 0 0">One entry per week. Saving again this week replaces it.</p></section><section class="sum">${chart(b.map((e) => ({ top: e.w })))}</section>`
    + Object.keys(mo).sort().reverse().map((m) => {
      const a = mo[m], ch = a[a.length - 1].w - a[0].w;
      return `<section class="sum"><div class="eh"><b>${new Date(m + '-15').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b><span class="chip">${a.length > 1 ? (ch > 0 ? '+' : '') + ch.toFixed(1) + ' kg this month' : '1 weigh-in'}</span></div><table>${a.map((e, i) => `<tr><td>Week of ${e.d.slice(5)}</td><td>${e.w} kg</td><td class="mut">${i ? ((e.w - a[i - 1].w > 0 ? '+' : '') + (e.w - a[i - 1].w).toFixed(1)) : 'start'}</td></tr>`).join('')}</table></section>`;
    }).join('');
}

export function renderProgress() {
  const T = [['ov', 'Overview'], ['tk', 'Tasks'], ['gm', 'Gym'], ['bd', 'Body']];
  let h = '<h2>Progress</h2><div class="gcs" style="margin-bottom:10px">' + T.map(([k, l]) => `<button class="gc${pt === k ? ' on' : ''}" data-act="pTab" data-k="${k}">${l}</button>`).join('') + '</div>';
  if (pt === 'ov' || pt === 'tk') h += '<div class="gcs" style="margin-bottom:10px">' + [7, 30].map((n) => `<button class="gc${rng === n ? ' on' : ''}" data-act="pRng" data-n="${n}">Last ${n} days</button>`).join('') + '</div>';
  $('#view').innerHTML = h + { ov: pOv, tk: pTasks, gm: pGym, bd: pBody }[pt]();
}

Object.assign(acts, {
  pTab: ({ k }) => { pt = k; renderProgress(); },
  pRng: ({ n }) => { rng = +n; renderProgress(); },
  pEx: (v) => { pe = v; renderProgress(); },
  weighIn: () => { pt = 'bd'; acts.tab({ t: 'prog' }); },
  addBw: async () => {
    const v = parseFloat($('#bw').value);
    if (!(v > 0 && v < 500)) return toast('Enter your weight in kg.');
    const d = wk(TODAY);   // one entry per week, saved under that week's Monday
    try {
      await api('/bw/' + d, { method: 'PUT', body: { w: v } });
      S.bw = S.bw.filter((e) => e.d !== d); S.bw.push({ d, w: v });
      renderProgress(); toast('Saved');
    } catch (e) { toast(e.message); }
  },
});
