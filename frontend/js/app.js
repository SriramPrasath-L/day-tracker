import * as auth from './auth.js';
import { api } from './api.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const root = $('#app');

function screen(title, sub, body) {
  root.innerHTML = `<div class="card"><h1>${title}</h1><p class="sub">${sub}</p>${body}<p id="msg" class="msg" role="alert"></p></div>`;
}
function msg(text, ok) { const m = $('#msg'); if (m) { m.textContent = text; m.className = 'msg' + (ok ? ' ok' : ''); } }
async function run(btn, fn) {
  btn.disabled = true; msg('');
  try { await fn(); } catch (e) { msg(e.message); } finally { btn.disabled = false; }
}
const link = (id, fn) => { $(id).onclick = (e) => { e.preventDefault(); fn(); }; };

function login(prefill = '') {
  screen('Day Tracker', 'Sign in to your planner', `
    <form id="f">
      <label>Email<input id="e" type="email" autocomplete="username" value="${esc(prefill)}" required></label>
      <label>Password<input id="p" type="password" autocomplete="current-password" required></label>
      <button id="go" class="pri">Sign in</button>
    </form>
    <div class="links"><a href="#" id="su">Create account</a><a href="#" id="fp">Forgot password?</a></div>`);
  link('#su', () => signup());
  link('#fp', () => forgot($('#e').value));
  $('#f').onsubmit = (ev) => {
    ev.preventDefault();
    run($('#go'), async () => {
      const email = $('#e').value.trim().toLowerCase();
      try { await auth.signIn(email, $('#p').value); } catch (e) {
        if (/confirm your email/.test(e.message)) { await auth.resend(email); return confirmView(email); }
        throw e;
      }
      home();
    });
  };
}

function signup() {
  screen('Create account', 'Use an email you can open. We send a code to it.', `
    <form id="f">
      <label>Email<input id="e" type="email" autocomplete="username" required></label>
      <label>Password<input id="p" type="password" autocomplete="new-password" required></label>
      <label>Repeat password<input id="p2" type="password" autocomplete="new-password" required></label>
      <p class="sub" style="font-size:13px">At least 10 characters with upper and lower case, a number and a symbol.</p>
      <button id="go" class="pri">Create account</button>
    </form>
    <div class="links"><a href="#" id="back">Back to sign in</a></div>`);
  link('#back', () => login());
  $('#f').onsubmit = (ev) => {
    ev.preventDefault();
    run($('#go'), async () => {
      if ($('#p').value !== $('#p2').value) throw new Error('The two passwords do not match.');
      const email = $('#e').value.trim().toLowerCase();
      await auth.signUp(email, $('#p').value);
      confirmView(email);
    });
  };
}

function confirmView(email) {
  screen('Check your email', `We sent a 6-digit code to ${esc(email)}. It can take a minute, and may land in spam.`, `
    <form id="f">
      <label>Code<input id="c" inputmode="numeric" autocomplete="one-time-code" required></label>
      <button id="go" class="pri">Confirm</button>
    </form>
    <div class="links"><a href="#" id="again">Send a new code</a><a href="#" id="back">Back</a></div>`);
  link('#back', () => login(email));
  link('#again', async () => { try { await auth.resend(email); msg('New code sent.', true); } catch (e) { msg(e.message); } });
  $('#f').onsubmit = (ev) => {
    ev.preventDefault();
    run($('#go'), async () => { await auth.confirm(email, $('#c').value.trim()); login(email); msg('Email confirmed. You can sign in now.', true); });
  };
}

function forgot(prefill = '') {
  screen('Reset password', 'We email you a code to set a new password.', `
    <form id="f">
      <label>Email<input id="e" type="email" value="${esc(prefill)}" required></label>
      <button id="go" class="pri">Send code</button>
    </form>
    <div class="links"><a href="#" id="back">Back to sign in</a></div>`);
  link('#back', () => login());
  $('#f').onsubmit = (ev) => {
    ev.preventDefault();
    run($('#go'), async () => { const email = $('#e').value.trim().toLowerCase(); await auth.forgot(email); resetView(email); });
  };
}

function resetView(email) {
  screen('New password', `Enter the code sent to ${esc(email)}.`, `
    <form id="f">
      <label>Code<input id="c" inputmode="numeric" autocomplete="one-time-code" required></label>
      <label>New password<input id="p" type="password" autocomplete="new-password" required></label>
      <button id="go" class="pri">Set password</button>
    </form>`);
  $('#f').onsubmit = (ev) => {
    ev.preventDefault();
    run($('#go'), async () => { await auth.resetPassword(email, $('#c').value.trim(), $('#p').value); login(email); msg('Password changed. Sign in.', true); });
  };
}

async function home() {
  screen('Day Tracker', 'Checking your session…', '');
  try {
    const me = await api('/me');
    screen('Day Tracker', `Signed in as <b>${esc(me.email)}</b>`, `
      <p><span class="chip">${esc(me.role)}</span></p>
      <p class="sub">Part 1 works: login and the connection to your backend. The real screens arrive in Part 2.</p>
      <button id="out">Sign out</button>`);
    $('#out').onclick = () => { auth.signOut(); login(); };
  } catch (e) {
    screen('Day Tracker', 'Could not reach your backend.', '<button id="out">Back to sign in</button>');
    msg(e.message);
    $('#out').onclick = () => { auth.signOut(); login(); };
  }
}

auth.session() ? home() : login();
