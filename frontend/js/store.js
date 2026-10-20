// The app's data in memory, plus saving it to your backend. Screens read S and call touch() after changing a day.
import { api } from './api.js';

export const DEFAULT_LIB = {
  Chest: ['Flat bench press', 'Incline DB press', 'Cable fly'],
  Back: ['Lat pulldown', 'Seated row', 'Deadlift'],
  Legs: ['Squat', 'Leg press', 'Leg curl'],
  Shoulders: ['Overhead press', 'Lateral raise'],
  Arms: ['Barbell curl', 'Triceps pushdown'],
  Core: ['Plank', 'Cable crunch'],
};

const z = (n) => String(n).padStart(2, '0');
export const fmt = (d) => d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
export const addD = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return fmt(d); };
export const wk = (s) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return fmt(d); };
export const uid = () => 'i' + Math.random().toString(36).slice(2, 10);
export const TODAY = fmt(new Date());

export const S = { days: {}, cfg: { lib: structuredClone(DEFAULT_LIB), tpl: {} }, bw: [], status: 'loading' };
export const day = (d) => S.days[d] || (S.days[d] = { items: [], gym: [] });

const dirty = new Set();
let cfgDirty = false, timer = null;
const listeners = [];
export const onStatus = (fn) => listeners.push(fn);
const setStatus = (s) => { S.status = s; listeners.forEach((f) => f()); };

export async function load() {
  setStatus('loading');
  const [data, defaults] = await Promise.all([api('/data'), api('/defaults').catch(() => null)]);
  S.days = data.days || {};
  S.bw = data.bw || [];
  S.cfg = data.cfg || { lib: structuredClone((defaults && defaults.lib) || DEFAULT_LIB), tpl: {} };
  S.cfg.tpl = S.cfg.tpl || {};
  setStatus('saved');
}

export function touch(d) { dirty.add(d); schedule(); }
export function touchCfg() { cfgDirty = true; schedule(); }
function schedule() { setStatus('saving'); clearTimeout(timer); timer = setTimeout(flush, 500); }

// Sends every changed day (and settings) to the backend. If it fails, it keeps them and retries.
export async function flush() {
  clearTimeout(timer);
  const days = [...dirty], cfg = cfgDirty;
  if (!days.length && !cfg) return;
  dirty.clear(); cfgDirty = false;
  try {
    await Promise.all([
      ...days.map((d) => api('/day/' + d, { method: 'PUT', body: day(d) })),
      ...(cfg ? [api('/config', { method: 'PUT', body: S.cfg })] : []),
    ]);
    setStatus(dirty.size || cfgDirty ? 'saving' : 'saved');
  } catch {
    days.forEach((d) => dirty.add(d)); cfgDirty = cfgDirty || cfg;
    setStatus('error');
    timer = setTimeout(flush, 5000);
  }
}
