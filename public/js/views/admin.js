import { db, setUserDisabled } from '../storage.js';

export function AdminAccountsView(){
  const me = db.session();
  const users = db.users();
  const user = me ? users.find(u=>u.handle===me.handle) : null;
  if(!user?.isAdmin){
    return `<div class="panel">Ova stranica je dostupna samo administratorima.</div>`;
  }
  return `
  <section class="panel">
    <h2>Upravljanje nalozima</h2>
    <p class="muted" style="margin-bottom:.6rem">Prvi/poslednji pristup i IP beleze se pri prijavi. Onemoguceni nalozi ne mogu da se prijave.</p>
    <div style="margin-bottom:.8rem;display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
      <label style="font-weight:600">Pretraga</label>
      <input id="accountSearch" placeholder="handle ili email" style="min-width:260px;padding:8px 10px;border:1px solid #334; border-radius:6px; background:#0f1425; color:#e8ecff;">
    </div>
    <div style="overflow:auto">
      <table class="table">
        <thead>
          <tr><th>Handle</th><th>Email</th><th>Uloga</th><th>Prvi pristup</th><th>Poslednji pristup</th><th>IP</th><th>Stanje</th></tr>
        </thead>
        <tbody>
          ${users.map(u=>`<tr>
            <td>${u.handle}</td>
            <td class="muted">${u.email||'-'}</td>
            <td class="muted">${u.isAdmin ? 'admin' : 'korisnik'}</td>
            <td class="muted">${u.firstSeen ? new Date(u.firstSeen).toLocaleString() : '-'}</td>
            <td class="muted">${u.lastSeen ? new Date(u.lastSeen).toLocaleString() : '-'}</td>
            <td class="muted">${u.lastIp || '-'}</td>
            <td><button class="btn ${u.disabled ? 'warn' : ''}" data-toggle-user="${u.handle}">${u.disabled ? 'Omoguci' : 'Onemoguci'}</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>
  <script>
    (function(){
      const search = document.getElementById('accountSearch');
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const filterRows = ()=>{
        const q = (search?.value||'').toLowerCase().trim();
        rows.forEach(r=>{
          if(!q){ r.style.display=''; return; }
          const txt = (r.textContent||'').toLowerCase();
          r.style.display = txt.includes(q) ? '' : 'none';
        });
      };
      search?.addEventListener('input', filterRows);
      document.querySelectorAll('[data-toggle-user]')?.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const h = btn.getAttribute('data-toggle-user')||'';
          const ok = setUserDisabled(h, !(btn.classList.contains('warn')));
          if(!ok){ alert('Nalog nije pronadjen.'); return; }
          const nowDisabled = btn.classList.contains('warn') ? false : true;
          btn.textContent = nowDisabled ? 'Omoguci' : 'Onemoguci';
          btn.classList.toggle('warn', nowDisabled);
        });
      });
      filterRows();
    })();
  </script>`;
}

