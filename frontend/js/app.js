// Starts the app: shows login if needed, otherwise loads your data and shows the tabs.
import * as auth from './auth.js';
import { $, esc, acts, applyTheme } from './ui.js';
import { S, load, onStatus, flush } from './store.js';
import { renderToday } from './today.js';
import { renderExercises } from './exercises.js';
import { renderProgress } from './progress.js';
import { showAuth } from './auth-screens.js';

let tab = 'today';
const STATUS = { loading: 'Loading…', saving: 'Saving…', saved: 'Saved ✓', error: 'Offline. Will retry.' };

function shell() {
  const app = $('#app');
  app.className = 'wide';
  app.innerHTML = `<div id="sync" class="sync"></div><div id="view"></div>
    <nav><button data-act="tab" data-t="today">Today</button><button data-act="tab" data-t="ex">Exercises</button><button data-act="tab" data-t="prog">Progress</button><button data-act="theme" aria-label="Switch theme" style="flex:none">◐</button></nav>`;
}
function show() {
  document.querySelectorAll('nav button[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
  if (tab === 'today') renderToday();
  else if (tab === 'ex') renderExercises();
  else renderProgress();
}
acts.tab = ({ t }) => { tab = t; show(); };
acts.out = () => { auth.signOut(); location.reload(); };

async function startApp() {
  shell();
  onStatus(() => { const e = $('#sync'); if (e) e.textContent = STATUS[S.status] || ''; });
  try { await load(); } catch (e) {
    $('#view').innerHTML = `<section class="sum"><p>Could not load your data: ${esc(e.message)}</p><button data-act="out">Sign out</button></section>`;
    return;
  }
  show();
}

document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
applyTheme();
if (auth.session()) startApp(); else showAuth(startApp);
