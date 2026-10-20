// Exercises tab: the default exercises for each muscle group, and your saved schedules.
import { S, touchCfg } from './store.js';
import { $, esc, acts } from './ui.js';

export function renderExercises() {
  const groups = Object.keys(S.cfg.lib), tpl = Object.keys(S.cfg.tpl);
  let h = '<h2>Default exercises by muscle group</h2><p class="mut small">These are added automatically when you pick a muscle group for a gym day. Add or remove variations here.</p>';
  h += `<section class="sum"><h3>Add exercise</h3><select id="a_g" aria-label="Muscle group">${groups.map((g) => `<option>${esc(g)}</option>`).join('')}</select><input id="a_ng" placeholder="…or type a new muscle group" style="margin:8px 0"><input id="a_n" placeholder="Exercise name, e.g. Incline bench press"><button class="pri" style="margin-top:8px" data-act="addLib">Add exercise</button></section>`;
  h += groups.map((g, gi) => `<section class="sum"><h3>${esc(g)}</h3>${S.cfg.lib[g].length ? S.cfg.lib[g].map((n, ni) => `<div class="ln"><span>${esc(n)}</span><button class="x" data-act="rmLib" data-g="${gi}" data-n="${ni}">Remove</button></div>`).join('') : '<p class="mut small" style="margin:0">No exercises yet.</p>'}</section>`).join('');
  h += `<h2>Saved schedules</h2><section class="sum">${tpl.map((k, i) => `<div class="ln"><span>${esc(k)}</span><button class="x" data-act="rmT" data-i="${i}">Remove</button></div>`).join('') || '<p class="mut small" style="margin:0">None yet. Use "Save as schedule" on the Today tab.</p>'}</section>`;
  $('#view').innerHTML = h;
}

Object.assign(acts, {
  addLib: () => {
    const n = $('#a_n').value.trim(), g = $('#a_ng').value.trim() || $('#a_g').value;
    if (!n) return;
    (S.cfg.lib[g] = S.cfg.lib[g] || []).push(n);
    touchCfg(); renderExercises();
  },
  rmLib: ({ g, n }) => { S.cfg.lib[Object.keys(S.cfg.lib)[+g]].splice(+n, 1); touchCfg(); renderExercises(); },
  rmT: ({ i }) => { delete S.cfg.tpl[Object.keys(S.cfg.tpl)[+i]]; touchCfg(); renderExercises(); },
});
