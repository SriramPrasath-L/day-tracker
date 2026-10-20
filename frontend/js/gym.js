// Gym log: muscle groups, exercises, sets, tick-all, "last time" hints and notes.
import { S, day, touch, touchCfg, uid } from './store.js';
import { $, esc, toast, acts } from './ui.js';

let ctx = { cur: () => '', render: () => {} };
let open = false;
export const initGym = (c) => { ctx = c; };
export const gymOpen = () => open;

export const mk = (group, name, n = 3, r = 10, w = 0) => ({ id: uid(), group, name, note: '', sets: Array.from({ length: n }, () => ({ r, w, done: false })) });
export const cloneGym = (a) => (a || []).map((e) => ({ ...e, id: uid(), sets: e.sets.map((s) => ({ ...s, done: false })) }));
export const gStat = (d) => {
  const a = d.gym.flatMap((e) => e.sets), n = a.filter((s) => s.done).length;
  return a.length ? `${n}/${a.length} sets` : 'pick muscle groups';
};

// The most recent earlier day where you did this exercise.
function last(name, cur) {
  for (const k of Object.keys(S.days).filter((x) => x < cur).sort().reverse()) {
    const e = S.days[k].gym.find((x) => x.name === name);
    if (e) return e;
  }
  return null;
}
function addOne(d, group, name, cur) {
  const l = last(name, cur);
  d.gym.push(l ? { id: uid(), group, name, note: '', sets: l.sets.map((s) => ({ r: s.r, w: s.w, done: false })) } : mk(group, name));
}
export function addDef(d, group, cur) {
  (S.cfg.lib[group] || []).forEach((n) => { if (!d.gym.some((e) => e.name === n)) addOne(d, group, n, cur); });
}
// Keeps the "Gym" task's tick in step with its sets: all sets done means the task is done.
export function syncGym(d) {
  const a = d.gym.flatMap((e) => e.sets);
  if (a.length) d.items.filter((i) => i.gym).forEach((i) => { i.done = a.every((s) => s.done); });
}

const opts = (g) => (S.cfg.lib[g] || []).map((n) => `<option>${esc(n)}</option>`).join('');

export function gymPanel(d) {
  const cur = ctx.cur(), groups = Object.keys(S.cfg.lib);
  let h = `<div class="gcs">${groups.map((g, gi) => `<button class="gc${d.gym.some((e) => e.group === g) ? ' on' : ''}" data-act="togG" data-g="${gi}">${esc(g)}</button>`).join('')}</div>`;
  if (!d.gym.length) h += '<p class="mut small">Tap the muscle groups you train today. Their default exercises are added for you.</p>';
  h += d.gym.map((e) => {
    const all = e.sets.length && e.sets.every((s) => s.done), l = last(e.name, cur);
    const ls = l ? (l.sets.some((s) => s.done) ? l.sets.filter((s) => s.done) : l.sets) : null;
    return `<div class="ex"><div class="eh"><button class="ck sm${all ? ' on' : ''}" data-act="texAll" data-id="${e.id}" aria-label="Tick all sets">${all ? '✓' : ''}</button><b>${esc(e.name)}</b><span class="chip">${esc(e.group)}</span><button class="x" data-act="rmEx" data-id="${e.id}">Remove</button>${ls ? `<span class="gx mut small">Last time: ${ls.map((x) => x.r + '×' + x.w).join(', ')}</span>` : ''}</div>`
      + e.sets.map((s, k) => `<div class="set"><span>Set ${k + 1}</span><input type="number" inputmode="numeric" value="${s.r}" aria-label="Reps" data-change="upd" data-id="${e.id}" data-k="${k}" data-f="r"><span>reps ×</span><input type="number" inputmode="decimal" step="0.5" value="${s.w}" aria-label="Weight" data-change="upd" data-id="${e.id}" data-k="${k}" data-f="w"><span>kg</span><button class="ck sm${s.done ? ' on' : ''}" data-act="tset" data-id="${e.id}" data-k="${k}" aria-label="Set done">${s.done ? '✓' : ''}</button></div>`).join('')
      + `<button class="ghost" data-act="addSet" data-id="${e.id}">+ set</button><input class="en" placeholder="Note (seat position, how it felt…)" value="${esc(e.note || '')}" aria-label="Exercise note" data-change="enote" data-id="${e.id}"></div>`;
  }).join('');
  return h + `<div class="adx"><select id="g_g" data-change="fillEx" aria-label="Muscle group">${groups.map((g) => `<option>${esc(g)}</option>`).join('')}</select><select id="g_e" aria-label="Exercise">${opts(groups[0])}</select><button class="pri" data-act="addEx">Add</button></div><div class="adx v"><input id="g_v" placeholder="New variation (saved to defaults)" aria-label="New variation"><button data-act="newVar">Add variation</button></div>`;
}

const D = () => day(ctx.cur());
const ex = (id) => D().gym.find((e) => e.id === id);
const commit = () => { syncGym(D()); touch(ctx.cur()); ctx.render(); };

Object.assign(acts, {
  gymToggle: () => { open = !open; ctx.render(); },
  togG: ({ g }) => {
    const name = Object.keys(S.cfg.lib)[+g], d = D();
    if (d.gym.some((e) => e.group === name)) d.gym = d.gym.filter((e) => e.group !== name);
    else addDef(d, name, ctx.cur());
    commit();
  },
  texAll: ({ id }) => { const e = ex(id), all = e.sets.every((s) => s.done); e.sets.forEach((s) => { s.done = !all; }); commit(); },
  tset: ({ id, k }) => { const s = ex(id).sets[+k]; s.done = !s.done; commit(); },
  addSet: ({ id }) => { const e = ex(id), l = e.sets[e.sets.length - 1] || { r: 10, w: 0 }; e.sets.push({ r: l.r, w: l.w, done: false }); commit(); },
  rmEx: ({ id }) => { const d = D(); d.gym = d.gym.filter((e) => e.id !== id); commit(); },
  upd: (v, el) => { const { id, k, f } = el.dataset; ex(id).sets[+k][f] = +v; touch(ctx.cur()); },
  enote: (v, el) => { ex(el.dataset.id).note = v; touch(ctx.cur()); },
  fillEx: (g) => { $('#g_e').innerHTML = opts(g); },
  addEx: () => {
    const g = $('#g_g').value, n = $('#g_e').value, d = D();
    if (!n) return toast('Add exercises in the Exercises tab first.');
    if (d.gym.some((e) => e.name === n)) return toast('Already added.');
    addOne(d, g, n, ctx.cur()); commit();
  },
  newVar: () => {
    const g = $('#g_g').value, n = $('#g_v').value.trim(), d = D();
    if (!n) return;
    if (!S.cfg.lib[g].includes(n)) { S.cfg.lib[g].push(n); touchCfg(); }
    if (!d.gym.some((e) => e.name === n)) addOne(d, g, n, ctx.cur());
    commit();
  },
});
