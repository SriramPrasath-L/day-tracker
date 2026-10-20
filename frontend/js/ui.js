// Small shared helpers: DOM shortcuts, the pop-up sheet, toasts, theme, and click handling.
export const $ = (s) => document.querySelector(s);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Every button/link carries data-act="name"; one listener runs the matching function in `acts`.
export const acts = {};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || !acts[b.dataset.act]) return;
  if (b.tagName === 'A') e.preventDefault();
  acts[b.dataset.act](b.dataset, e);
});
document.addEventListener('change', (e) => {
  const n = e.target.dataset && e.target.dataset.change;
  if (n && acts[n]) acts[n](e.target.value, e.target);
});

export function modal(html) {
  let ov = $('#ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'ov';
    ov.innerHTML = '<div id="sh"></div>';
    ov.onclick = (e) => { if (e.target === ov) closeM(); };
    document.body.appendChild(ov);
  }
  $('#sh').innerHTML = html;
  ov.style.display = 'flex';
}
export function closeM() { const o = $('#ov'); if (o) o.style.display = 'none'; }
acts.closeM = closeM;

export function toast(text) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = text; t.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.style.display = 'none'; }, 2500);
}

let TH = 'auto';
try { TH = localStorage.getItem('dt-theme') || 'auto'; } catch { /* ignore */ }
export function applyTheme() {
  const r = document.documentElement;
  if (TH === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', TH);
}
acts.theme = () => {
  TH = { auto: 'light', light: 'dark', dark: 'auto' }[TH];
  try { localStorage.setItem('dt-theme', TH); } catch { /* ignore */ }
  applyTheme(); toast('Theme: ' + TH);
};
