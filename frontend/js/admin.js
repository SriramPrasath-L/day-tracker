// Admin screens: users, audit log and shared defaults. The backend refuses all of this to anyone who is not an admin.
import { api } from './api.js';
import { S, ME, TODAY, addD } from './store.js';
import { $, esc, modal, closeM, toast, acts } from './ui.js';

let sec = 'users', users = [], audit = [];
const when = (t) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export async function renderAdmin() {
  $('#view').innerHTML = '<section class="sum mut">Loading…</section>';
  try {
    if (sec === 'users') users = await api('/admin/users');
    if (sec === 'audit') audit = await api('/admin/audit');
  } catch (e) { $('#view').innerHTML = `<section class="sum">${esc(e.message)}</section>`; return; }
  draw();
}

function draw() {
  let h = '<h2>Admin</h2><div class="gcs" style="margin-bottom:10px">' + [['users', 'Users'], ['audit', 'Audit log'], ['defaults', 'Shared defaults']].map(([k, l]) => `<button class="gc${sec === k ? ' on' : ''}" data-act="aSec" data-k="${k}">${l}</button>`).join('') + '</div>';
  h += sec === 'users' ? usersHtml() : sec === 'audit' ? auditHtml() : defaultsHtml();
  $('#view').innerHTML = h;
}

const usersHtml = () => '<p class="mut small">Every view and change you make here is written to the audit log.</p>' + (users.map((u) => `<section class="sum"><div class="eh"><b>${esc(u.email || u.sub)}</b>${u.sub === ME.sub ? '<span class="chip">you</span>' : ''}<span class="chip">${u.enabled ? 'active' : 'disabled'}</span></div><div class="mut small">Joined ${new Date(u.created).toLocaleDateString('en-IN')}</div><div class="btns"><button data-act="aView" data-sub="${u.sub}">View data</button>${u.sub !== ME.sub ? `<button data-act="aToggle" data-sub="${u.sub}" data-on="${u.enabled ? 1 : 0}">${u.enabled ? 'Disable' : 'Enable'}</button><button class="danger" data-act="aDel" data-sub="${u.sub}">Delete</button>` : ''}</div></section>`).join('') || '<section class="sum mut">No users.</section>');

const auditHtml = () => `<section class="sum">${audit.length ? `<table><tr><th>When</th><th>Admin</th><th>Action</th></tr>${audit.map((a) => `<tr><td>${when(a.at)}</td><td>${esc(a.by)}</td><td>${esc(a.action)}<br><span class="mut small">${esc(String(a.target).slice(0, 13))}</span></td></tr>`).join('')}</table>` : '<span class="mut">Nothing recorded yet.</span>'}</section>`;

const defaultsHtml = () => `<section class="sum"><p class="small">New users start with these exercises. Publishing replaces the shared list with the one from your Exercises tab.</p>${Object.entries(S.cfg.lib).map(([g, a]) => `<p class="small"><b>${esc(g)}:</b> ${a.map(esc).join(', ') || '–'}</p>`).join('')}<button class="pri" data-act="aPub">Publish my exercises as shared defaults</button></section>`;

function userHtml(u, d) {
  const days = Object.keys(d.days || {}).sort(), from = addD(TODAY, -29), recent = days.slice(-14).reverse();
  const p = days.filter((k) => k >= from && d.days[k].items.length).map((k) => d.days[k].items.filter((i) => i.done).length / d.days[k].items.length);
  const avg = p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length * 100) : 0;
  const gym = days.filter((k) => d.days[k].items.some((i) => i.gym && i.done)).length;
  const w = [...(d.bw || [])].sort((a, b) => a.d.localeCompare(b.d)), lw = w[w.length - 1];
  return `<h3>${esc(u ? u.email : 'User')}</h3><div class="stat"><div><b>${days.length}</b><span class="mut">days logged</span></div><div><b>${avg}%</b><span class="mut">avg, 30 days</span></div><div><b>${gym}</b><span class="mut">gym sessions</span></div></div>${lw ? `<p class="small">Latest weight: ${lw.w} kg (week of ${lw.d.slice(5)})</p>` : ''}<table><tr><th>Date</th><th>Tasks</th><th>Gym</th></tr>${recent.map((k) => { const x = d.days[k]; return `<tr><td>${k.slice(5)}</td><td>${x.items.filter((i) => i.done).length}/${x.items.length}</td><td>${x.gym.length ? x.gym.length + ' exercises' : '–'}</td></tr>`; }).join('') || '<tr><td colspan="3" class="mut">No data yet.</td></tr>'}</table><div class="row" style="margin-top:12px"><button data-act="closeM">Close</button></div>`;
}

Object.assign(acts, {
  aSec: ({ k }) => { sec = k; renderAdmin(); },
  aView: async ({ sub }) => {
    try { modal(userHtml(users.find((x) => x.sub === sub), await api(`/admin/users/${sub}/data`))); } catch (e) { toast(e.message); }
  },
  aToggle: async ({ sub, on }) => {
    try { await api(`/admin/users/${sub}/${+on ? 'disable' : 'enable'}`, { method: 'POST' }); toast(+on ? 'User disabled' : 'User enabled'); renderAdmin(); } catch (e) { toast(e.message); }
  },
  aDel: ({ sub }) => {
    const u = users.find((x) => x.sub === sub);
    modal(`<h3>Delete ${esc(u ? u.email : 'user')}?</h3><p class="small">This permanently deletes the account and all of its data. Type DELETE to confirm.</p><label>Confirm<input id="f_c" autocomplete="off"></label><div class="row"><button data-act="closeM">Cancel</button><button class="danger" data-act="aDelGo" data-sub="${sub}">Delete</button></div>`);
  },
  aDelGo: async ({ sub }) => {
    if ($('#f_c').value.trim() !== 'DELETE') return toast('Type DELETE to confirm.');
    try { await api(`/admin/users/${sub}`, { method: 'DELETE' }); closeM(); toast('User deleted'); renderAdmin(); } catch (e) { toast(e.message); }
  },
  aPub: async () => {
    try { await api('/admin/defaults', { method: 'PUT', body: { lib: S.cfg.lib } }); toast('Shared defaults updated'); } catch (e) { toast(e.message); }
  },
});
