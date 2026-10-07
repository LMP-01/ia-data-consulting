// Réservation Rive Drive : fenêtre en 4 étapes, prix en direct, véhicules « déjà loués » inventés.
import { AGENCIES, CATEGORIES, DAYS_AHEAD, HOURS, MAX_DAYS, OPTIONS, type Theme } from './data';

const WEB3FORMS_ACCESS_KEY = '0f86820b-6cbf-42b8-b5f6-a3283a7c3f40';
const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const FALLBACK_EMAIL = 'theo.mansopro@gmail.com';
const STORE_KEY = 'rive-drive-rentals';
const DAY = 86400000;

type Step = 'when' | 'car' | 'options' | 'contact' | 'done';
const STEPS: Step[] = ['when', 'car', 'options', 'contact'];

interface Rental {
  agency: string;
  category: string;
  from: string;
  to: string;
}

export interface Query {
  agency?: string;
  from?: string;
  fromHour?: number;
  to?: string;
  toHour?: number;
  category?: string;
}

const state = {
  agency: AGENCIES[0].id,
  from: '',
  fromHour: 10,
  to: '',
  toHour: 10,
  category: '',
  options: new Set<string>(),
  step: 'when' as Step
};

let theme: Theme = 'premium';
const tu = (): boolean => theme === 'street';
/** Tutoiement pour la version street, vouvoiement pour la version premium. */
const say = (tuText: string, vousText: string): string => (tu() ? tuText : vousText);

// --- Dates ---

const pad = (n: number): string => String(n).padStart(2, '0');
export const dateKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string): Date => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (k: string, n: number): string => {
  const d = fromKey(k);
  return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
const shortDate = (k: string): string =>
  fromKey(k).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const stamp = (k: string, h: number): number => fromKey(k).getTime() + h * 3600000;

/** Jours facturés : chaque tranche de 24 h entamée compte (minimum 1). */
export function rentalDays(from: string, fromHour: number, to: string, toHour: number): number {
  return Math.max(1, Math.ceil((stamp(to, toHour) - stamp(from, fromHour) - 59 * 60000) / DAY));
}

function datesValid(): string {
  if (!state.from || !state.to) return say('Choisis tes dates de départ et de retour.', 'Choisissez vos dates de départ et de retour.');
  const now = Date.now();
  if (stamp(state.from, state.fromHour) < now + 3600000) return 'Le départ doit être au moins dans une heure.';
  if (stamp(state.to, state.toHour) <= stamp(state.from, state.fromHour)) return 'Le retour doit être après le départ.';
  if (rentalDays(state.from, state.fromHour, state.to, state.toHour) > MAX_DAYS) return say(`${MAX_DAYS} jours maximum en ligne : appelle l’agence au-delà.`, `${MAX_DAYS} jours maximum en ligne : appelez l’agence au-delà.`);
  const ag = AGENCIES.find((a) => a.id === state.agency)!;
  if (state.fromHour < ag.open || state.fromHour > ag.close || state.toHour < ag.open || state.toHour > ag.close)
    return `L’agence ${ag.name} est ouverte de ${ag.open}h à ${ag.close}h.`;
  return '';
}

// --- Locations inventées (identiques à chaque visite) ---

/** Hash FNV-1a → [0, 1) (même logique que les démos Hamed et Nonna Rosa). */
function unit(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

function myRentals(): Rental[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as Rental[];
  } catch {
    return [];
  }
}

function saveRental(r: Rental): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...myRentals(), r]));
  } catch {
    // Stockage indisponible : la démo continue sans mémoriser.
  }
}

/** Véhicules déjà loués un jour donné : plus le week-end, un peu au hasard. */
function rentedOn(agency: string, category: string, day: string): number {
  const stock = CATEGORIES.find((c) => c.id === category)!.stock;
  const wd = fromKey(day).getDay();
  const weekend = wd === 5 || wd === 6 || wd === 0;
  const base = (weekend ? 0.62 : 0.38) + (unit(`${agency}|${category}|${day}`) - 0.5) * 0.7;
  const mine = myRentals().filter((r) => r.agency === agency && r.category === category && r.from <= day && day <= r.to).length;
  return Math.min(stock, Math.round(Math.max(0, base) * stock)) + mine;
}

/** Véhicules libres sur toute la période (le jour le plus chargé fait foi). */
export function available(agency: string, category: string, from: string, to: string): number {
  const stock = CATEGORIES.find((c) => c.id === category)!.stock;
  let free = stock;
  for (let d = from; d <= to; d = addDays(d, 1)) free = Math.min(free, stock - rentedOn(agency, category, d));
  return Math.max(0, free);
}

// --- Prix ---

function quote(): { days: number; car: number; opts: number; total: number } | null {
  const cat = CATEGORIES.find((c) => c.id === state.category);
  if (!cat || datesValid()) return null;
  const days = rentalDays(state.from, state.fromHour, state.to, state.toHour);
  const opts = OPTIONS.filter((o) => state.options.has(o.id)).reduce((s, o) => s + o.price, 0) * days;
  return { days, car: cat.price * days, opts, total: cat.price * days + opts };
}

const euros = (n: number): string => `${n.toLocaleString('fr-FR')} €`;

// --- Fenêtre ---

let modal: HTMLElement;
let lastFocus: HTMLElement | null = null;
const $ = <T extends HTMLElement>(sel: string): T => modal.querySelector<T>(sel)!;

const hourOptions = (sel: number): string =>
  HOURS.map((h) => `<option value="${h}"${h === sel ? ' selected' : ''}>${pad(h)}:00</option>`).join('');

function build(): void {
  modal = document.createElement('div');
  modal.className = 'rd-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="rd-modal-backdrop" data-close></div>
    <div class="rd-dialog" role="dialog" aria-modal="true" aria-labelledby="rd-title">
      <header class="rd-dialog-head">
        <p class="rd-dialog-kicker">Réservation</p>
        <h2 id="rd-title" tabindex="-1">${say('Ta voiture en 4 étapes', 'Votre voiture en 4 étapes')}</h2>
        <button class="rd-close" type="button" data-close aria-label="Fermer">×</button>
        <ol class="rd-steps" aria-label="Étapes">
          <li data-for="when">Où & quand</li><li data-for="car">Véhicule</li><li data-for="options">Options</li><li data-for="contact">Coordonnées</li>
        </ol>
      </header>
      <div class="rd-body">
        <section class="rd-step" data-step="when">
          <label class="rd-field"><span>Agence</span>
            <select name="agency">${AGENCIES.map((a) => `<option value="${a.id}">${a.name}</option>`).join('')}</select>
          </label>
          <p class="rd-hint rd-agency-hours"></p>
          <div class="rd-row">
            <label class="rd-field"><span>Départ</span><input type="date" name="from" required /></label>
            <label class="rd-field rd-field-hour"><span>Heure</span><select name="fromHour">${hourOptions(10)}</select></label>
          </div>
          <div class="rd-row">
            <label class="rd-field"><span>Retour</span><input type="date" name="to" required /></label>
            <label class="rd-field rd-field-hour"><span>Heure</span><select name="toHour">${hourOptions(10)}</select></label>
          </div>
          <p class="rd-error" role="alert"></p>
        </section>
        <section class="rd-step" data-step="car" hidden>
          <p class="rd-hint rd-car-note"></p>
          <div class="rd-cars" role="radiogroup" aria-label="Catégorie de véhicule"></div>
        </section>
        <section class="rd-step" data-step="options" hidden>
          <p class="rd-hint">Prix par jour de location. Assurance responsabilité civile et assistance 24/7 incluses.</p>
          <div class="rd-opts"></div>
        </section>
        <section class="rd-step" data-step="contact" hidden>
          <form class="rd-form" novalidate>
            <div class="rd-row">
              <label class="rd-field"><span>Prénom et nom</span><input name="name" autocomplete="name" required /></label>
              <label class="rd-field"><span>Téléphone</span><input name="phone" type="tel" autocomplete="tel" required /></label>
            </div>
            <label class="rd-field"><span>E-mail</span><input name="email" type="email" autocomplete="email" required /></label>
            <label class="rd-check"><input type="checkbox" name="licence" required /> <span>J’ai 21 ans ou plus et mon permis depuis 2 ans au moins.</span></label>
            <p class="rd-error" role="alert"></p>
          </form>
        </section>
        <section class="rd-step rd-done" data-step="done" hidden>
          <p class="rd-done-icon" aria-hidden="true">✓</p>
          <h3 class="rd-done-title" tabindex="-1"></h3>
          <p class="rd-done-text"></p>
          <p class="rd-hint rd-demo-note">Démo : aucune voiture n’est réellement réservée et rien n’est débité.</p>
        </section>
      </div>
      <footer class="rd-dialog-foot">
        <div class="rd-price" aria-live="polite"></div>
        <div class="rd-nav">
          <button class="rd-btn rd-btn-ghost rd-prev" type="button">Retour</button>
          <button class="rd-btn rd-next" type="button">Continuer</button>
        </div>
      </footer>
    </div>`;
  document.body.appendChild(modal);

  const today = dateKey(new Date());
  const max = addDays(today, DAYS_AHEAD);
  for (const n of ['from', 'to']) {
    const input = $<HTMLInputElement>(`[name="${n}"]`);
    input.min = today;
    input.max = max;
  }

  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') trapFocus(e);
  });
  $('[name="agency"]').addEventListener('change', (e) => {
    state.agency = (e.target as HTMLSelectElement).value;
    refresh();
  });
  for (const n of ['from', 'to'] as const)
    $(`[name="${n}"]`).addEventListener('change', (e) => {
      state[n] = (e.target as HTMLInputElement).value;
      if (n === 'from' && state.from && (!state.to || state.to < state.from)) {
        state.to = addDays(state.from, 2);
        $<HTMLInputElement>('[name="to"]').value = state.to;
      }
      refresh();
    });
  for (const n of ['fromHour', 'toHour'] as const)
    $(`[name="${n}"]`).addEventListener('change', (e) => {
      state[n] = Number((e.target as HTMLSelectElement).value);
      refresh();
    });
  $('.rd-prev').addEventListener('click', () => go(STEPS[Math.max(0, STEPS.indexOf(state.step) - 1)]));
  $('.rd-next').addEventListener('click', next);
  $('.rd-form').addEventListener('submit', (e) => {
    e.preventDefault();
    next();
  });
}

function trapFocus(e: KeyboardEvent): void {
  const items = [...modal.querySelectorAll<HTMLElement>('button, input, select, [tabindex="0"]')].filter(
    (el) => !el.closest('[hidden]') && !(el as HTMLButtonElement).disabled
  );
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function syncInputs(): void {
  $<HTMLSelectElement>('[name="agency"]').value = state.agency;
  $<HTMLInputElement>('[name="from"]').value = state.from;
  $<HTMLInputElement>('[name="to"]').value = state.to;
  $<HTMLSelectElement>('[name="fromHour"]').value = String(state.fromHour);
  $<HTMLSelectElement>('[name="toHour"]').value = String(state.toHour);
}

function renderCars(): void {
  const wrap = $('.rd-cars');
  const ok = !datesValid();
  const days = ok ? rentalDays(state.from, state.fromHour, state.to, state.toHour) : 0;
  $('.rd-car-note').textContent = ok
    ? `${days} jour${days > 1 ? 's' : ''} · ${shortDate(state.from)} ${state.fromHour}h → ${shortDate(state.to)} ${state.toHour}h · ${AGENCIES.find((a) => a.id === state.agency)!.name}`
    : '';
  wrap.innerHTML = '';
  const frees = CATEGORIES.map((c) => (ok ? available(state.agency, c.id, state.from, state.to) : 0));
  // Un seul badge « Dernier véhicule » par liste, sinon il ne veut plus rien dire.
  const lastOne = frees.indexOf(1);
  for (const [i, c] of CATEGORIES.entries()) {
    const free = frees[i];
    if (!free && state.category === c.id) state.category = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rd-car';
    btn.dataset.category = c.id;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(state.category === c.id));
    btn.disabled = !free;
    btn.innerHTML = `
      <img src="${img(`car-${c.id}.webp`)}" alt="" width="400" height="300" loading="lazy" />
      <span class="rd-car-text"><strong>${c.name}</strong><small>${c.example} · ${c.seats} places · ${c.gearbox}</small></span>
      <span class="rd-car-price">${free ? `<strong>${euros(c.price * days)}</strong><small>${c.price} €/jour</small>` : '<strong class="rd-full">Complet</strong><small>à ces dates</small>'}</span>
      ${i === lastOne ? '<span class="rd-badge">Dernier véhicule</span>' : ''}`;
    btn.setAttribute('aria-label', `${c.name}, ${free ? `${euros(c.price * days)} au total` : 'complet à ces dates'}`);
    btn.addEventListener('click', () => {
      state.category = c.id;
      renderCars();
      wrap.querySelector<HTMLElement>(`[data-category="${c.id}"]`)?.focus();
      renderPrice();
    });
    wrap.appendChild(btn);
  }
}

function renderOptions(): void {
  const wrap = $('.rd-opts');
  wrap.innerHTML = OPTIONS.map(
    (o) => `<label class="rd-opt"><input type="checkbox" value="${o.id}"${state.options.has(o.id) ? ' checked' : ''} />
      <span class="rd-opt-text"><strong>${o.name}</strong><small>${o.desc}</small></span>
      <span class="rd-opt-price">+${o.price} €/j</span></label>`
  ).join('');
  wrap.querySelectorAll<HTMLInputElement>('input').forEach((input) =>
    input.addEventListener('change', () => {
      if (input.checked) state.options.add(input.value);
      else state.options.delete(input.value);
      renderPrice();
    })
  );
}

function renderPrice(): void {
  const q = quote();
  const el = $('.rd-price');
  if (!q) {
    el.innerHTML = '<span class="rd-price-label">Total</span><strong>—</strong>';
    return;
  }
  el.innerHTML = `<span class="rd-price-label">Total · ${q.days} jour${q.days > 1 ? 's' : ''}</span><strong class="rd-total">${euros(q.total)}</strong>
    <small>Véhicule ${euros(q.car)}${q.opts ? ` + options ${euros(q.opts)}` : ''}</small>`;
}

function refresh(): void {
  const ag = AGENCIES.find((a) => a.id === state.agency)!;
  $('.rd-agency-hours').textContent = `${ag.address} · ${ag.hours}`;
  if (state.step === 'when') $('[data-step="when"] .rd-error').textContent = '';
  renderPrice();
}

function go(step: Step): void {
  state.step = step;
  modal.querySelectorAll<HTMLElement>('.rd-step').forEach((s) => (s.hidden = s.dataset.step !== step));
  const idx = STEPS.indexOf(step);
  modal.querySelectorAll<HTMLElement>('.rd-steps li').forEach((li, k) => {
    li.classList.toggle('is-done', k < idx || step === 'done');
    if (k === idx) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  });
  if (step === 'car') renderCars();
  if (step === 'options') renderOptions();
  $('.rd-prev').hidden = idx <= 0;
  $('.rd-next').hidden = false;
  $('.rd-next').textContent = step === 'contact' ? (say('Je réserve', 'Confirmer la réservation')) : step === 'done' ? 'Fermer' : 'Continuer';
  $('.rd-dialog-foot').classList.toggle('is-done', step === 'done');
  renderPrice();
  const target = modal.querySelector<HTMLElement>(`[data-step="${step}"] select, [data-step="${step}"] [aria-checked="true"], [data-step="${step}"] .rd-car:not(:disabled), [data-step="${step}"] input, [data-step="${step}"] .rd-done-title`);
  target?.focus({ preventScroll: true });
}

async function next(): Promise<void> {
  if (state.step === 'when') {
    const err = datesValid();
    $('[data-step="when"] .rd-error').textContent = err;
    if (!err) go('car');
    return;
  }
  if (state.step === 'car') {
    if (!state.category) {
      $('.rd-car-note').textContent = say('Choisis une catégorie disponible.', 'Choisissez une catégorie disponible.');
      return;
    }
    go('options');
    return;
  }
  if (state.step === 'options') return go('contact');
  if (state.step === 'done') return close();
  await submit();
}

async function submit(): Promise<void> {
  const form = $<HTMLFormElement>('.rd-form');
  const err = form.querySelector<HTMLElement>('.rd-error')!;
  if (!form.checkValidity()) {
    err.textContent = 'Merci de remplir tous les champs et de cocher la case.';
    form.querySelector<HTMLElement>(':invalid')?.focus();
    return;
  }
  const q = quote();
  if (!q || !available(state.agency, state.category, state.from, state.to)) return go('car');
  err.textContent = '';
  const data = new FormData(form);
  const get = (k: string): string => String(data.get(k) ?? '').trim();
  const ag = AGENCIES.find((a) => a.id === state.agency)!;
  const cat = CATEGORIES.find((c) => c.id === state.category)!;
  const opts = OPTIONS.filter((o) => state.options.has(o.id)).map((o) => o.name);
  const payload: Record<string, string> = {
    access_key: WEB3FORMS_ACCESS_KEY,
    subject: `[Démo Rive Drive ${theme}] ${cat.name} · ${ag.name} · ${euros(q.total)}`,
    from_name: 'Démo Rive Drive',
    name: get('name'),
    email: get('email'),
    phone: get('phone'),
    agence: ag.name,
    depart: `${state.from} ${state.fromHour}h`,
    retour: `${state.to} ${state.toHour}h`,
    vehicule: cat.name,
    options: opts.join(', ') || 'aucune',
    jours: String(q.days),
    total: euros(q.total)
  };
  const btn = $<HTMLButtonElement>('.rd-next');
  btn.disabled = true;
  try {
    const res = await fetch(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    const body = Object.entries(payload)
      .filter(([k]) => k !== 'access_key')
      .map(([k, v]) => `${k} : ${v}`)
      .join('\n');
    window.location.href = `mailto:${FALLBACK_EMAIL}?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(body)}`;
  } finally {
    btn.disabled = false;
  }
  saveRental({ agency: state.agency, category: state.category, from: state.from, to: state.to });
  const first = get('name').split(' ')[0];
  $('.rd-done-title').textContent = say(`C’est réservé, ${first} !`, `C’est réservé, ${first}.`);
  $('.rd-done-text').textContent = `${cat.name} à ${ag.name}, du ${shortDate(state.from)} ${state.fromHour}h au ${shortDate(state.to)} ${state.toHour}h. Total ${euros(q.total)}${opts.length ? ` avec ${opts.join(', ').toLowerCase()}` : ''}. ${say('Tu reçois', 'Vous recevez')} la confirmation par e-mail.`;
  go('done');
}

function setBackgroundInert(on: boolean): void {
  document.querySelectorAll<HTMLElement>('body > header, body > main, body > footer, body > .rd-sticky').forEach((el) => (el.inert = on));
}

export function open(q: Query = {}): void {
  if (q.agency) state.agency = q.agency;
  if (q.from) state.from = q.from;
  if (q.to) state.to = q.to;
  if (q.fromHour !== undefined) state.fromHour = q.fromHour;
  if (q.toHour !== undefined) state.toHour = q.toHour;
  if (q.category !== undefined) state.category = q.category;
  if (!state.from) {
    state.from = addDays(dateKey(new Date()), 1);
    state.to = addDays(state.from, 3);
  }
  lastFocus = document.activeElement as HTMLElement | null;
  syncInputs();
  refresh();
  modal.hidden = false;
  document.documentElement.classList.add('rd-locked');
  setBackgroundInert(true);
  // Dates déjà valides (barre du hero) : on passe directement au choix du véhicule.
  go(q.from && q.to && !datesValid() ? 'car' : 'when');
}

function close(): void {
  modal.hidden = true;
  document.documentElement.classList.remove('rd-locked');
  setBackgroundInert(false);
  if (state.step === 'done') {
    state.category = '';
    state.options.clear();
    $<HTMLFormElement>('.rd-form').reset();
  }
  lastFocus?.focus();
}

let imgBase = '';
const img = (file: string): string => `${imgBase}${file}`;

export function initBooking(t: Theme, base: string): void {
  theme = t;
  imgBase = base;
  build();
}
