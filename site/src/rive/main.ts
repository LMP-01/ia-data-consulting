// Démo Rive Drive : code commun aux deux versions (premium et street).
import { initBooking, open, dateKey } from './booking';
import { AGENCIES, CATEGORIES, OPTIONS, type Theme } from './data';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function renderFleet(base: string, cta: string): void {
  const list = document.querySelector<HTMLElement>('.rd-fleet')!;
  list.innerHTML = CATEGORIES.map(
    (c) => `<li class="rd-card">
      <img src="${base}car-${c.id}.webp" alt="${c.name} Rive Drive" width="800" height="600" loading="lazy" />
      <div class="rd-card-body">
        <p class="rd-card-price"><small>dès</small> <strong>${c.price} €</strong><small>/jour</small></p>
        <h3>${c.name}</h3>
        <p class="rd-card-example">${c.example}</p>
        <ul class="rd-specs">
          <li>${c.seats} places</li><li>${c.bags ? `${c.bags} valises` : '6 m³'}</li><li>${c.gearbox}</li><li>${c.fuel}</li>
        </ul>
        <button class="rd-btn rd-btn-card" type="button" data-category="${c.id}">${cta}</button>
      </div>
    </li>`
  ).join('');
  list.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((b) =>
    b.addEventListener('click', () => open({ category: b.dataset.category }))
  );

  // Flèches du carrousel : une carte à la fois.
  const step = (): number => (list.querySelector('li')?.getBoundingClientRect().width ?? 320) + 20;
  const prev = document.querySelector<HTMLButtonElement>('.rd-fleet-prev')!;
  const next = document.querySelector<HTMLButtonElement>('.rd-fleet-next')!;
  const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
  prev.addEventListener('click', () => list.scrollBy({ left: -step(), behavior }));
  next.addEventListener('click', () => list.scrollBy({ left: step(), behavior }));
  const sync = (): void => {
    prev.disabled = list.scrollLeft < 8;
    next.disabled = list.scrollLeft + list.clientWidth > list.scrollWidth - 8;
  };
  list.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  sync();
}

function renderOptions(): void {
  const wrap = document.querySelector<HTMLElement>('.rd-options')!;
  wrap.innerHTML = OPTIONS.map(
    (o, i) => `<li class="rd-option"><span class="rd-option-num" aria-hidden="true">0${i + 1}</span>
      <h3>${o.name}</h3><p>${o.desc}</p><p class="rd-option-price">+${o.price} € / jour</p></li>`
  ).join('');
}

function renderAgencies(): void {
  document.querySelectorAll<HTMLElement>('.rd-agencies').forEach((el) => {
    el.innerHTML = AGENCIES.map((a) => `<li><strong>${a.name}</strong><span>${a.address}</span><small>${a.hours}</small></li>`).join('');
  });
  document.querySelectorAll<HTMLSelectElement>('select[name="q-agency"]').forEach((sel) => {
    sel.innerHTML = AGENCIES.map((a) => `<option value="${a.id}">${a.name}</option>`).join('');
  });
  document.querySelectorAll<HTMLSelectElement>('select[name="q-category"]').forEach((sel) => {
    sel.innerHTML = '<option value="">Toutes catégories</option>' + CATEGORIES.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  });
}

/** Barre de réservation rapide du hero : ouvre la fenêtre de réservation pré-remplie. */
function initQuick(): void {
  const form = document.querySelector<HTMLFormElement>('.rd-quick')!;
  const now = new Date();
  const from = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const to = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4));
  const fromInput = form.querySelector<HTMLInputElement>('[name="q-from"]')!;
  const toInput = form.querySelector<HTMLInputElement>('[name="q-to"]')!;
  fromInput.value = from;
  toInput.value = to;
  fromInput.min = toInput.min = dateKey(now);
  fromInput.addEventListener('change', () => {
    if (toInput.value <= fromInput.value) {
      const d = new Date(fromInput.value);
      toInput.value = dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3));
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const get = (n: string): string => (form.elements.namedItem(n) as HTMLInputElement).value;
    open({ agency: get('q-agency'), from: get('q-from'), to: get('q-to'), fromHour: 10, toHour: 10, category: get('q-category') });
  });
}

/** Voiture 3D du hero : la vidéo remplace l'image fixe quand elle est prête (jamais en mouvement réduit). */
function initHeroVideo(base: string): void {
  const stage = document.querySelector<HTMLElement>('.rd-stage');
  if (!stage || reduced) return;
  let video: HTMLVideoElement | null = null;
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !video) {
      video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('aria-hidden', 'true');
      video.preload = 'auto';
      video.src = `${base}hero.mp4`;
      video.addEventListener('playing', () => stage.classList.add('is-playing'), { once: true });
      stage.appendChild(video);
    }
    if (!video) return;
    if (e.isIntersecting) video.play().catch(() => undefined);
    else video.pause();
  }, { threshold: 0.15 }).observe(stage);
}

function initChrome(): void {
  const top = document.querySelector<HTMLElement>('.rd-top')!;
  const onScroll = (): void => {
    top.classList.toggle('is-solid', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  document.querySelectorAll<HTMLElement>('.js-book').forEach((b) => b.addEventListener('click', () => open()));

  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      }
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll('.rd-reveal').forEach((el) => io.observe(el));
  document.querySelectorAll('.rd-year').forEach((el) => (el.textContent = String(new Date().getFullYear())));
}

export function initRive(theme: Theme, opts: { cta: string }): void {
  const base = `${import.meta.env.BASE_URL}exemples/${theme === 'premium' ? 'rive-drive' : 'rive-drive-street'}/`;
  initBooking(theme, base);
  renderAgencies();
  renderFleet(base, opts.cta);
  renderOptions();
  initQuick();
  initHeroVideo(base);
  initChrome();
}
