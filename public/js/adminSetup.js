import { db } from './storage.js';

const OVERLAY_ID = 'adminSetupOverlay';

export function ensureAdminAccountPrompt(){
  if (document.getElementById(OVERLAY_ID)) return;
  const users = db.users();
  if (users.some(u => u.isAdmin)) return;
  renderOverlay();
}

function renderOverlay(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = `
    <div class="modal">
      <h3>Postavite prvog administratora</h3>
      <p class="muted">Nema nijednog naloga sa administratorskim pravima. Kreirajte glavnog administratora koji će moći da dodeljuje prava drugima.</p>
      <form id="adminSetupForm" style="display:flex;flex-direction:column;gap:.6rem">
        <label>Korisničko ime
          <input name="handle" placeholder="npr. admin" required pattern="[A-Za-z0-9_]{3,20}" title="3-20 znakova, slova/cifre/_">
        </label>
        <label>Lozinka
          <input name="password" type="password" minlength="4" required placeholder="Lozinka">
        </label>
        <label>Email
          <input name="email" type="email" required placeholder="email@domen.com">
        </label>
        <label>Organizacija (opciono)
          <input name="org" placeholder="npr. CodeArena">
        </label>
        <label>Zemlja (opciono)
          <input name="country" placeholder="npr. RS">
        </label>
        <p class="muted" data-error style="color:#e34d4d;display:none"></p>
        <div class="actions" style="display:flex;justify-content:flex-end;gap:.6rem;margin-top:.5rem">
          <button class="btn primary" type="submit">Sačuvaj administratora</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  const form = overlay.querySelector('#adminSetupForm');
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const handle = (data.handle||'').trim();
    const email = (data.email||'').trim();
    const password = (data.password||'').trim();
    const errorEl = form.querySelector('[data-error]');
    errorEl.style.display = 'none';
    if (!handle || !password || !email){
      return showError(errorEl, 'Sva obavezna polja moraju biti popunjena.');
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(handle)){
      return showError(errorEl, 'Korisničko ime mora imati 3-20 znakova (slova, cifre, _).');
    }
    const users = db.users();
    if (users.some(u => u.handle.toLowerCase() === handle.toLowerCase())){
      return showError(errorEl, 'Korisničko ime je zauzeto.');
    }
    const adminUser = {
      handle,
      password,
      email,
      org: (data.org||'').trim(),
      country: (data.country||'').trim(),
      rating: 2000,
      isAdmin: true,
      isOwner: true,
    };
    users.push(adminUser);
    db.saveUsers(users);
    localStorage.setItem('ca_session', JSON.stringify({ handle }));
    window.dispatchEvent(new Event('ca:session'));
    overlay.remove();
  });
}

function showError(target, text){
  target.textContent = text;
  target.style.display = 'block';
}
