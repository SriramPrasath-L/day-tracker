// The Today screen: timeline of tasks, ticking, notes, copy yesterday, saved schedules, weekly strip, summary.
import { S, day, touch, touchCfg, TODAY, addD, wk, uid } from './store.js';
import { session } from './auth.js';
import { $, esc, modal, closeM, toast, acts } from './ui.js';

let cur = TODAY;
const label = (d) => new Date(d + 'T12:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }) + (d === TODAY ? ' (today)' : '');
const pc = (d) => { const x = S.days[d]; return x && x.items.length ? x.items.filter((i) => i.done).length / x.items.length : null; };
const cloneItems = (a) => a.map((i) => ({ ...i, id: uid(), done: false }));
const find = (id) => day(cur).items.find((x) => x.id === id);

export function renderToday() {
  const d = day(cur), it = [...d.items].sort((a, b) => a.start.localeCompare(b.start));
  const n = it.length, dn = it.filter((i) => i.done).length, left = it.filter((i) => !i.done), past = cur < TODAY;
  const mon = wk(cur), week = Array.from({ length: 7 }, (_, k) => addD(mon, k));

  let h = `<div class="dn"><button data-act="nav" data-d="-1" aria-label="Previous day">‹</button><div data-act="go" data-d="${TODAY}">${label(cur)}</div><button data-act="nav" data-d="1" aria-label="Next day">›</button></div>`;
  h += '<div class="wkstrip">' + week.map((x, k) => {
    const p = pc(x);
    return `<button class="wd${x === cur ? ' cur' : ''}${p === null ? '' : p === 1 ? ' f' : p > 0 ? ' p' : ''}" data-act="go" data-d="${x}"><small>${'MTWTFSS'[k]}</small><b>${+x.slice(8)}</b></button>`;
  }).join('') + '</div>';

  h += `<section class="sum"><div class="big">${dn}<span> of ${n} done</span></div><div class="bar"><i style="width:${n ? dn / n * 100 : 0}%"></i></div>`;
  if (!n) h += '<div class="left mut">Nothing planned yet. Copy yesterday or load a saved schedule.</div>';
  else if (left.length) h += `<div class="left"><b>${past ? 'Missed' : 'Still left'}:</b><br>${left.map((i) => `<span class="chip">${esc(i.name)}</span>`).join('')}</div>${past ? '<button class="ghost" data-act="moveLeft">Move missed to next day</button>' : ''}`;
  else h += '<div class="left">All done. Nice.</div>';
  h += '</section>';

  h += `<div class="acts"><button data-act="copyY">Copy yesterday</button><button data-act="saveT">Save as schedule</button><select data-change="loadT" aria-label="Load a saved schedule"><option value="">Load a saved schedule…</option>${Object.keys(S.cfg.tpl).map((k) => `<option>${esc(k)}</option>`).join('')}</select></div>`;

  h += '<ul class="tl">' + it.map((i) => `<li class="${i.done ? 'dn2' : ''}"><button class="ck" data-act="tog" data-id="${i.id}" aria-label="Mark done">${i.done ? '✓' : ''}</button><div class="m" data-act="edit" data-id="${i.id}"><div class="t">${i.start}${i.end ? '–' + i.end : ''}</div><div class="nm">${esc(i.name)}</div></div><button class="pill${i.note ? '' : ' faint'}" data-act="note" data-id="${i.id}">${i.note ? '1 note' : '+ note'}</button></li>`).join('') + '</ul>';
  h += '<button class="add" data-act="add">+ Add task</button>';
  const s = session();
  h += `<p class="mut small" style="margin-top:18px">Signed in as ${esc(s ? s.email : '')} · <a href="#" data-act="out">Sign out</a></p>`;
  $('#view').innerHTML = h;
}

function itemForm(id) {
  const t = id ? find(id) : null, x = t || { name: '', start: '09:00', end: '', note: '' };
  modal(`<h3>${t ? 'Edit task' : 'New task'}</h3>
    <label>Name<input id="f_n" value="${esc(x.name)}"></label>
    <div class="two"><label>Start<input id="f_s" type="time" value="${x.start}"></label><label>End<input id="f_e" type="time" value="${x.end}"></label></div>
    ${t ? '' : `<label>Date<input id="f_d" type="date" value="${cur}"></label><label>Repeat<select id="f_r"><option value="0">Once</option><option value="1">Every day for 14 days</option><option value="2">Weekdays for 14 days</option></select></label>`}
    <label>Note (what to do in this task)<textarea id="f_t" rows="3">${esc(x.note)}</textarea></label>
    <div class="row">${t ? `<button class="danger" data-act="delI" data-id="${id}">Delete</button>` : ''}<button class="pri" data-act="saveI" data-id="${id || ''}">Save</button></div>`);
}

Object.assign(acts, {
  nav: ({ d }) => { cur = addD(cur, +d); renderToday(); },
  go: ({ d }) => { cur = d; renderToday(); },
  tog: ({ id }) => { const t = find(id); t.done = !t.done; touch(cur); renderToday(); },
  add: () => itemForm(),
  edit: ({ id }) => itemForm(id),
  delI: ({ id }) => { const d = day(cur); d.items = d.items.filter((x) => x.id !== id); touch(cur); closeM(); renderToday(); },
  saveI: ({ id }) => {
    const g = (k) => $('#f_' + k).value, name = g('n').trim();
    if (!name) return;
    if (id) Object.assign(find(id), { name, start: g('s'), end: g('e'), note: g('t') });
    else {
      const mode = +g('r'), first = g('d') || cur;
      for (let k = 0; k < (mode ? 14 : 1); k++) {
        const ds = addD(first, k), wd = new Date(ds + 'T12:00').getDay();
        if (mode === 2 && (wd === 0 || wd === 6)) continue;
        day(ds).items.push({ id: uid(), name, start: g('s'), end: g('e'), note: g('t'), done: false, gym: /gym/i.test(name) });
        touch(ds);
      }
    }
    touch(cur); closeM(); renderToday();
  },
  note: ({ id }) => {
    const t = find(id);
    modal(`<h3>${esc(t.name)}</h3><label>Note<textarea id="f_t" rows="5" placeholder="What should you do in this task?">${esc(t.note)}</textarea></label><div class="row"><button data-act="closeM">Close</button><button class="pri" data-act="saveN" data-id="${id}">Save note</button></div>`);
  },
  saveN: ({ id }) => { find(id).note = $('#f_t').value.trim(); touch(cur); closeM(); renderToday(); },
  copyY: () => {
    const y = S.days[addD(cur, -1)];
    if (!y || !y.items.length) return toast('Nothing on the previous day to copy.');
    day(cur).items = cloneItems(y.items); touch(cur); renderToday(); toast('Copied yesterday. Edit what changed.');
  },
  loadT: (name) => {
    if (!name || !S.cfg.tpl[name]) return;
    day(cur).items = cloneItems(S.cfg.tpl[name].items); touch(cur); renderToday(); toast('Loaded "' + name + '"');
  },
  saveT: () => modal('<h3>Save today as a schedule</h3><label>Name<input id="f_n" placeholder="e.g. Weekday"></label><div class="row"><button class="pri" data-act="doSaveT">Save</button></div>'),
  doSaveT: () => {
    const name = $('#f_n').value.trim();
    if (!name) return;
    S.cfg.tpl[name] = { items: cloneItems(day(cur).items), gym: [] };
    touchCfg(); closeM(); renderToday(); toast('Saved "' + name + '"');
  },
  moveLeft: () => {
    const d = day(cur), nx = day(addD(cur, 1)), left = d.items.filter((i) => !i.done);
    d.items = d.items.filter((i) => i.done);
    left.forEach((i) => nx.items.push({ ...i, id: uid() }));
    touch(cur); touch(addD(cur, 1)); renderToday(); toast('Moved ' + left.length + ' task(s) to the next day');
  },
});
