import { db } from '../storage.js';
import { EMAIL_API_CONFIG } from '../config.js';
import { firestore, collection, addDoc, serverTimestamp } from '../firebaseClient.js';

const ATTEMPTS_KEY = 'ca_test_attempts';

function loadAttempts(){
  return JSON.parse(localStorage.getItem(ATTEMPTS_KEY)||'[]');
}
function saveAttempts(list){
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(list));
}

export function TestsListView(){
  const me = db.session();
  const users = db.users();
  const user = me ? users.find(u=>u.handle===me.handle) : null;
  const isAdmin = !!user?.isAdmin;
  const tests = db.tests();
  const isLogged = !!me;
  const visibleTests = tests.filter(t=>{
    if(isAdmin) return true;
    if(!t.assignedHandle) return true;
    const target = (t.assignedHandle||'').toLowerCase();
    return me && (me.handle||'').toLowerCase() === target;
  });
  return `
  <section class="panel">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
      <h2>Testovi znanja</h2>
      ${isAdmin ? `<a class="btn primary" href="#/tests/new">Kreiraj novi test</a>` : `<span class="muted">Kreiranje testa je dozvoljeno samo administratorima.</span>`}
    </div>
    ${visibleTests.length ? `
      <table class="table" style="margin-top:.6rem">
        <thead><tr><th>Naziv</th><th>Pitanja</th><th>Vreme</th><th>Autor</th><th>Akcije</th></tr></thead>
        <tbody>
          ${visibleTests.map(t=>`<tr>
            <td>${t.title}</td>
            <td>${t.questions.length}</td>
            <td>${Math.max(1, Math.ceil(t.durationSeconds/60))} min</td>
            <td class="muted">${t.authorHandle||'-'}</td>
            <td style="display:flex;gap:.4rem;flex-wrap:wrap">
            ${isLogged ? `<a class="btn" href="#/tests/run/${t.id}">Pokreni</a>` : `<a class="btn ghost" href="#/login">Prijavi se</a>`}
            ${isAdmin ? `<a class="btn warn" href="#/tests/edit/${t.id}">Izmeni</a>` : ''}
            ${isAdmin ? `<button class="btn warn" data-remove-test="${t.id}">Ukloni</button>` : ''}
          </td>
        </tr>`).join('')}
        </tbody>
      </table>
    `: `<p class="muted" style="margin-top:1rem">Jo?? uvek nema testova. Napravite prvi!</p>`}
    ${user?.isOwner ? `
      <div class="panel" style="margin-top:1rem">
        <h3>Dodela admin prava</h3>
        <p class="muted">Samo vlasnik sajta mo??e dodeliti administratorsku ulogu.</p>
        <form id="grantAdmin" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
          <input name="handle" placeholder="Korisni??ko ime" required style="max-width:220px" />
          <button class="btn primary" type="submit">Dodeli admin</button>
        </form>
      </div>
      <script>
        (function(){
          const f=document.getElementById('grantAdmin');
          if(!f) return;
          f.addEventListener('submit',(e)=>{
            e.preventDefault();
            const h=(f.handle.value||'').trim();
            const users = JSON.parse(localStorage.getItem('ca_users')||'[]');
            const u = users.find(x=>x.handle.toLowerCase()===h.toLowerCase());
            if(!u){ alert('Korisnik nije prona??en'); return; }
            u.isAdmin=true;
            localStorage.setItem('ca_users', JSON.stringify(users));
            alert('Dodeljena admin prava za '+u.handle);
          });
        })();
      </script>
    `:''}
    ${isAdmin ? `
      <script>
        (function(){
          const tools = window.__firestoreTools || {};
          document.querySelectorAll('[data-remove-test]')?.forEach(btn=>{
            btn.addEventListener('click', async ()=>{
              const id = btn.getAttribute('data-remove-test');
              if(!id) return;
              if(!window.confirm('Obri??i test '+id+'?')) return;
              // localStorage update
              const tests = JSON.parse(localStorage.getItem('ca_tests')||'[]').filter(t=>t.id!==id);
              localStorage.setItem('ca_tests', JSON.stringify(tests));
              // Firestore delete
              try{
                if(tools.firestore && tools.deleteDoc && tools.doc && tools.collection){
                  const ref = tools.doc(tools.firestore, 'tests', id);
                  await tools.deleteDoc(ref);
                }
              }catch(err){
                console.warn('Firestore brisanje testa neuspe??no', err);
              }
              location.reload();
            });
          });
        })();
      </script>
    `:''}
    ${isAdmin ? `
      <div class="panel" style="margin-top:1rem">
        <h3>Kreiraj korisnika</h3>
        <form id="createUser" style="display:grid;gap:.5rem;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));align-items:end">
          <label>Handle<input name="handle" required pattern="[A-Za-z0-9_]{3,20}" /></label>
          <label>Lozinka<input name="password" required minlength="4" /></label>
          <label>Email<input name="email" type="email" /></label>
          <label>Organizacija<input name="org" /></label>
          <label>Zemlja<input name="country" /></label>
          <label>Rating<input name="rating" type="number" min="0" value="1500" /></label>
          <button class="btn primary" type="submit">Sa??uvaj korisnika</button>
        </form>
      </div>
      <script>
        (function(){
          const f=document.getElementById('createUser');
          if(!f) return;
          f.addEventListener('submit',(e)=>{
            e.preventDefault();
            const data = Object.fromEntries(new FormData(f).entries());
            const users = JSON.parse(localStorage.getItem('ca_users')||'[]');
            if(users.some(u=>u.handle.toLowerCase()===(data.handle||'').toLowerCase())){
              alert('Handle je zauzet'); return;
            }
            users.push({
              handle:(data.handle||'').trim(),
              password:(data.password||'').trim(),
              email:(data.email||'').trim(),
              org:(data.org||'').trim(),
              country:(data.country||'').trim(),
              rating:Number(data.rating)||1500,
              isAdmin:false,
              isOwner:false
            });
            localStorage.setItem('ca_users', JSON.stringify(users));
            alert('Korisnik dodat');
            f.reset();
          });
        })();
      </script>
    `:''}
    ${isAdmin ? `
      <div class="panel" style="margin-top:1rem">
        <h3>Upravljanje nalozima</h3>
        <p class="muted" style="margin-bottom:.5rem">Prvi/prip poslednji pristup i IP se beleze pri prijavi. Mozete privremeno onemoguciti naloge.</p>
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
      </div>
      <script>
        (function(){
          document.querySelectorAll('[data-toggle-user]')?.forEach(btn=>{
            btn.addEventListener('click', ()=>{
              const h = btn.getAttribute('data-toggle-user')||'';
              const list = JSON.parse(localStorage.getItem('ca_users')||'[]');
              const idx = list.findIndex(u=> (u.handle||'').toLowerCase()===h.toLowerCase());
              if(idx===-1){ alert('Nalog nije pronadjen'); return; }
              const nowDisabled = !list[idx].disabled;
              list[idx].disabled = nowDisabled;
              localStorage.setItem('ca_users', JSON.stringify(list));
              btn.textContent = nowDisabled ? 'Omoguci' : 'Onemoguci';
              btn.classList.toggle('warn', nowDisabled);
            });
          });
        })();
      </script>
    `:''}
    ${isAdmin ? `
      <div class="panel" style="margin-top:1rem">
        <h3>Pregled ura??enih testova</h3>
        <form id="attemptViewer" style="display:grid;gap:.6rem;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));align-items:end;margin-bottom:.6rem">
          <label>Korisnik
            <select name="user" required>
              <option value="">-- izaberi korisnika --</option>
              ${db.users().map(u=>`<option value="${u.handle}">${u.handle}</option>`).join('')}
            </select>
          </label>
          <label>Test
            <select name="test" required disabled>
              <option value="">-- izaberi test --</option>
            </select>
          </label>
          <button class="btn primary" type="submit">Prika??i rezultat</button>
        </form>
        <div id="attemptDetails" class="panel" style="background:#11162a;border:1px dashed #273056;font-size:13px"></div>
      </div>
      <script>
        (function(){
          const form = document.getElementById('attemptViewer');
          const userSel = form?.user;
          const testSel = form?.test;
          const details = document.getElementById('attemptDetails');
          const tools = window.__firestoreTools || {};
          const readAttempts = async ()=>{
            if(tools.firestore && tools.collection && tools.getDocs){
              try{
                const snap = await tools.getDocs(tools.collection(tools.firestore, 'test_attempts'));
                return snap.docs.map(d=>({ id:d.id, ...d.data() }));
              }catch(err){
                console.warn('Ne mogu da ??itam test_attempts iz Firestore-a', err);
              }
            }
            try{return JSON.parse(localStorage.getItem('ca_test_attempts')||'[]');}catch(_){return [];}
          };
          const fmt = (ts)=> new Date(ts||Date.now()).toLocaleString();
          function populateTests(){
            if(!userSel || !testSel) return;
            const handle = (userSel.value||'').toLowerCase();
            // U??itaj poku??aje iz Firestore-a ako su dostupni
            readAttempts().then(attempts=>{
              const filtered = attempts.filter(a=>a.handle === handle);
              testSel.innerHTML = '<option value="">-- izaberi test --</option>' + filtered.map(a=>'<option value="'+a.testId+'">'+(a.testTitle||a.testId)+'</option>').join('');
              testSel.disabled = filtered.length===0;
              details.innerHTML = filtered.length ? 'Izaberite test za pregled.' : 'Nema poku??aja za ovog korisnika.';
            });
          }
          function renderAttempt(){
            readAttempts().then(attempts=>{
              const at = attempts.find(a=>a.handle===(userSel?.value||'').toLowerCase() && a.testId===(testSel?.value||''));
              if(!at){ details.innerHTML = 'Nema podataka za izabrani test.'; return; }
              const ans = Array.isArray(at.answers) ? at.answers : [];
              const rows = ans.map((a,i)=>{
                const qLabel = a.isCode
                  ? '<pre style="white-space:pre-wrap;margin:.2rem 0">'+(a.text||'').replace(/</g,'&lt;')+'</pre>'
                  : '<div>'+ (a.text||'') +'</div>';
                return '<div style="margin-bottom:.5rem">'
                  + '<div style="font-weight:600">'+(i+1)+'. '+(a.isCode ? 'CODE:' : 'Pitanje:')+'</div>'
                  + qLabel
                  + '<div><span class="muted">Odgovor:</span> '+(a.pickedText||'nije odgovoreno')+'</div>'
                  + '<div><span class="muted">Ta??no:</span> '+(a.correctText||'')+'</div>'
                  + '</div>';
              }).join('');
              details.innerHTML =
                '<div style="margin-bottom:.4rem"><b>Korisnik:</b> '+at.handle+'</div>'
                + '<div style="margin-bottom:.4rem"><b>Test:</b> '+(at.testTitle || at.testId)+'</div>'
                + '<div style="margin-bottom:.4rem"><b>Rezultat:</b> '+at.correct+' / '+at.total+' &nbsp; <span class="muted">'+fmt(at.ts)+'</span></div>'
                + '<div>'+(rows || '<span class="muted">Nema snimljenih odgovora.</span>')+'</div>';
            });
          }
          if(userSel){
            userSel.addEventListener('change', populateTests);
          }
          form?.addEventListener('submit',(e)=>{
            e.preventDefault();
            if(!userSel?.value || !testSel?.value){ details.innerHTML = 'Izaberite korisnika i test.'; return; }
            renderAttempt();
          });
          populateTests();
        })();
      </script>
    `:''}
  </section>`;
}

export function TestCreateView(){
  const me = db.session();
  const user = me ? db.users().find(u=>u.handle===me.handle) : null;
  if(!me){
    return `<div class="panel">Samo administrator mo??e da kreira test. <a href="#/login">Prijavite se</a>.</div>`;
  }
  if(!user?.isAdmin){
    return `<div class="panel">Nemate administratorska prava. Vlasnik sajta mora da ih dodeli kako biste kreirali test.</div>`;
  }
  return renderTestForm({ user, test:null, mode:'create' });
}

export function TestRunView({ params }){
  const [id] = params;
  const me = db.session();
  const user = me ? db.users().find(u=>u.handle===me.handle) : null;
  if(!me){
    return `<div class="panel">Morate biti prijavljeni da biste resavali test. <a href="#/login">Prijavite se</a>.</div>`;
  }
  const test = db.tests().find(t=>t.id===id);
  if(!test){
    return `<div class="panel">Test nije pronadjen. <a href="#/tests">Nazad</a></div>`;
  }
  const isAdmin = !!user?.isAdmin;
  if(test.assignedHandle && !isAdmin){
    const target = (test.assignedHandle||'').toLowerCase();
    if((me.handle||'').toLowerCase() !== target){
      return `<div class="panel">Ovaj test je dostupan samo nalogu ${test.assignedHandle}. <a href="#/tests">Nazad</a></div>`;
    }
  }
  return `
  <section id="takeWrap" class="panel" style="max-width:900px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center">
        <h2>${test.title}</h2>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.25rem">
          <div class="badge" id="timer">${fmt(test.durationSeconds)}</div>
          <div id="emailStatus" class="muted" style="font-size:12px;"></div>
        </div>
      </div>
    <form id="takeForm" style="margin-top:1rem">
      ${test.questions.map((q,qi)=>`
        <div class="panel" style="margin-bottom:.6rem">
          <div style="font-weight:600">${qi+1}. ${q.isCode ? 'Sta je rezultat rada ovog koda?' : q.text}</div>
          ${q.isCode ? `<pre class="code-block" style="margin:.5rem 0 0;white-space:pre-wrap">${escapeHtml(q.code || q.text)}</pre>` : ''}
          <div class="options-grid" style="margin-top:.6rem">
            ${q.options.map((opt,oi)=>`
              <label class="option-tile">
                <input type="radio" name="q${qi}" value="${oi}" required />
                <span class="bullet" aria-hidden="true"></span>
                <span>${opt}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <div id="actionRow" style="display:flex;justify-content:flex-end;gap:.6rem;align-items:center">
        <span class="muted">Vreme ograniceno na ${Math.max(1, Math.ceil(test.durationSeconds/60))} min</span>
        <button class="btn primary" type="submit">Zavrsi test</button>
        <a class="btn" href="#/tests">Nazad</a>
      </div>
    </form>
    <div id="result" class="panel" style="display:none;margin-top:1rem"></div>
  </section>
  <script id="testRunData" type="application/json">${JSON.stringify({ test, user, emailConfig: EMAIL_API_CONFIG || {} }).replace(/</g,'\\u003c')}</script>
  `;
}
function fmt(sec){
  const s = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(s/60)).padStart(2,'0');
  const r = String(s%60).padStart(2,'0');
  return `${m}:${r}`;
}

function escapeHtml(str=''){
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

export function TestEditView({ params }){
  const [id] = params;
  const me = db.session();
  const user = me ? db.users().find(u=>u.handle===me.handle) : null;
  if(!me){
    return `<div class="panel">Morate biti prijavljeni da biste menjali testove. <a href="#/login">Prijavite se</a>.</div>`;
  }
  if(!user?.isAdmin){
    return `<div class="panel">Nemate administratorska prava da menjate testove.</div>`;
  }
  const test = db.tests().find(t=>t.id===id);
  if(!test){
    return `<div class="panel">Test nije prona??en. <a href="#/tests">Nazad</a></div>`;
  }
  return renderTestForm({ user, test, mode:'edit' });
}

export function initTestRunPage({ root }){
  if (location.search) {
    history.replaceState(null, '', location.origin + location.pathname + location.hash);
  }
  const dataEl = root?.querySelector('#testRunData');
  let payload = {};
  try { payload = JSON.parse(dataEl?.textContent || '{}'); } catch(_){ }
  const test = payload.test || {};
  const sessionUser = payload.user || null;
  const emailConfig = payload.emailConfig || {};
  const loadAttempts = ()=>JSON.parse(localStorage.getItem('ca_test_attempts')||'[]');
  const saveAttempts = (list)=>localStorage.setItem('ca_test_attempts', JSON.stringify(list));
  const timerEl = root?.querySelector('#timer');
  const wrap = root?.querySelector('#takeWrap');
  const form = root?.querySelector('#takeForm');
  const result = root?.querySelector('#result');
  const emailStatus = root?.querySelector('#emailStatus');
  const fmtLocal = (sec)=>{
    const s = Math.max(0, Math.floor(sec));
    const m = String(Math.floor(s/60)).padStart(2,'0');
    const r = String(s%60).padStart(2,'0');
    return m+':'+r;
  };
  let left = Number(test.durationSeconds)||0;
  let finished = false;
  let tick = null;

  const tools = window.__firestoreTools || {};
  const handleVal = (sessionUser?.handle || '').toLowerCase();
  const setTimer = () => { if(timerEl) timerEl.textContent = fmtLocal(left); };

  async function fetchAttemptsFs(){
    if(!tools.firestore || !tools.collection || !tools.getDocs || !tools.query || !tools.where) return [];
    try{
      const qref = tools.query(
        tools.collection(tools.firestore, 'test_attempts'),
        tools.where('handle','==', handleVal),
        tools.where('testId','==', test.id)
      );
      const snap = await tools.getDocs(qref);
      return snap.docs.map(d=>({ id:d.id, ...d.data() }));
    }catch(err){
      console.warn('Ne mogu da procitam test_attempts', err);
      return [];
    }
  }

  async function initRun(){
    if(handleVal && !sessionUser?.isAdmin){
      const existing = await fetchAttemptsFs();
      if(existing.length){
        if(wrap){
          wrap.innerHTML = '<div class="panel" style="max-width:700px;margin:0 auto">Vec ste radili ovaj test. Rezultat: '
            + (existing[0].correct||0) + ' / ' + (existing[0].total||test.questions?.length||0)
            + '. <p class="muted">Samo administratori mogu ponovo pokretati testove.</p></div>';
        }
        return;
      }
    }
    setTimer();
    tick = setInterval(()=>{
      left -= 1;
      setTimer();
      if(left<=0){
        clearInterval(tick);
        grade();
      }
    },1000);
    if(form){
      form.addEventListener('submit', async (e)=>{ e.preventDefault(); await grade(); });
    }
  }

  initRun();

  async function grade(){
    if(finished) return;
    finished = true;
    clearInterval(tick);
    if(!form) return;
    const data = new FormData(form);
    let correct = 0;
    (test.questions||[]).forEach((q,qi)=>{
      const picked = data.get('q'+qi);
      if(picked!==null && Number(picked)===q.answer) correct++;
    });
    const total = (test.questions||[]).length;
    form.querySelectorAll('input,button,select').forEach(el=> el.disabled=true);

    const answers = (test.questions||[]).map((q,qi)=>{
      const picked = data.get('q'+qi);
      return {
        isCode: !!q.isCode,
        text: q.isCode ? (q.code || q.text || '') : (q.text || ''),
        picked: picked!==null ? Number(picked) : null,
        pickedText: picked!==null ? q.options[Number(picked)] : 'nije odgovoreno',
        correct: q.answer,
        correctText: q.options[q.answer],
      };
    });
    const attempts = loadAttempts();
    const handleValLocal = (sessionUser?.handle || 'guest').toLowerCase();
    attempts.push({
      testId: test.id,
      testTitle: test.title,
      handle: handleValLocal,
      correct,
      total,
      ts: Date.now(),
      answers,
    });
    saveAttempts(attempts);
    try{
      const tools = window.__firestoreTools || {};
      if(!tools.firestore || !tools.addDoc || !tools.collection || !tools.serverTimestamp){
        throw new Error('Firestore helperi nisu dostupni u prozoru.');
      }
      await tools.addDoc(tools.collection(tools.firestore, 'test_attempts'), {
        testId: test.id,
        testTitle: test.title,
        handle: handleValLocal,
        correct,
        total,
        answers,
        createdAt: tools.serverTimestamp(),
        clientTs: Date.now(),
      });
      if(emailStatus) emailStatus.textContent = 'Pokusaj sacuvan (Firestore).';
    }catch(err){
      console.warn('Firestore upis za test_attempts nije uspeo', err);
      if(emailStatus) emailStatus.textContent = 'Upis u bazu nije uspeo: '+(err?.message||err);
    }

    if(result){
      result.style.display='block';
      result.innerHTML = '<h3>Rezultat</h3><p>Tacnih: <b>'+correct+'</b> od '+total+'</p>';
    }

    const targetEmail = test.authorEmail || emailConfig.to || '';
    if(!targetEmail){
      if(emailStatus) emailStatus.textContent = 'Nema definisanog primaoca rezultata.';
      return;
    }
    if(emailStatus) emailStatus.textContent = 'Saljem rezultat...';
    try{
      const lines = [];
      lines.push('Rezultat testa: '+test.title);
      lines.push('Kandidat: '+(sessionUser?.handle||handleValLocal||'anonimno'));
      lines.push('Tacnih: '+correct+' od '+total);
      lines.push('');
      answers.forEach((a,i)=>{
        const qLabel = a.isCode ? 'CODE:\n'+(a.text||'') : (a.text||'');
        lines.push((i+1)+'. '+qLabel);
        lines.push('  odgovor: '+(a.pickedText||'nije odgovoreno'));
        lines.push('  tacno: '+(a.correctText||''));
        lines.push('');
      });
      const message = lines.join('\n');
      const hasEndpoint = emailConfig?.endpoint && !String(emailConfig.endpoint).includes('REPLACE');
      const hasAccessKey = emailConfig?.accessKey && !String(emailConfig.accessKey).includes('REPLACE');
      if(hasEndpoint && hasAccessKey){
        const payload = {
          access_key: emailConfig.accessKey,
          from_email: sessionUser?.email || emailConfig.fromEmail || 'no-reply@codearena.local',
          from_name: emailConfig.fromName || 'CodeArena',
          subject: 'Rezultat testa: '+test.title,
          message,
          to: targetEmail,
        };
        const res = await fetch(emailConfig.endpoint, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify(payload),
        });
        const dataRes = await res.json().catch(()=> ({}));
        if(!res.ok){
          throw new Error(dataRes?.error || dataRes?.message || ('Email API error '+res.status));
        }
        if(emailStatus) emailStatus.textContent = 'Email poslat (Web3Forms).';
      }else{
        const body = encodeURIComponent(message);
        const subj = encodeURIComponent('Rezultat testa: '+test.title);
        window.location.href = 'mailto:'+encodeURIComponent(targetEmail)+'?subject='+subj+'&body='+body;
        if(emailStatus) emailStatus.textContent = 'Otvoren email klijent (mailto).';
      }
    }catch(err){
      console.warn('Email slanje nije uspelo', err);
      const reason = err?.message || 'Nepoznata greska';
      if(emailStatus) emailStatus.textContent = 'Slanje emaila nije uspelo: '+reason;
    }
  }
}

function renderTestForm({ user, test, mode }){
  const heading = mode==='edit' ? `Izmena testa: ${test.title}` : 'Novi test';
  const notifyValue = test?.authorEmail || user.email || '';
  const btnLabel = mode==='edit' ? 'Sa??uvaj izmene' : 'Sa??uvaj test';
  const formId = mode==='edit' ? 'editTestForm' : 'newTestForm';
  const durationMinutes = test ? Math.max(1, Math.ceil(test.durationSeconds/60)) : 2;
  const allTests = db.tests();
  return `
  <section class="panel" style="max-width:900px;margin:0 auto">
    <h2>${heading}</h2>
    <form id="${formId}">
      <div class="row"><label>Naziv testa</label><input name="title" required placeholder="npr. Osnove JS" value="${test?.title||''}" /></div>
      <div class="row"><label>Trajanje (minute)</label><input name="durationMinutes" type="number" min="1" step="1" value="${durationMinutes}" required /></div>
      <div class="row"><label>Email za rezultate</label><input name="notifyEmail" type="email" value="${notifyValue}" required /></div>
      <div class="row"><label>Test dodeljen nalogu</label><input name="assignedHandle" placeholder="ostavi prazno za sve" value="${test?.assignedHandle||''}" /></div>
      <div class="row"><label>Import pitanja (JSON)</label>
        <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
          <input id="importQuestions" type="file" accept=".json,.txt" />
          <span class="muted" style="font-size:12px">Format: JSON array objekata { type:'text'|'code', text:'', code:'', options:[], answer:0 }</span>
        </div>
      </div>
      <div class="row"><label>Dodaj u postoje??i test</label>
        <select id="importTarget">
          <option value="">-- novi test / trenutni --</option>
          ${allTests.map(t=>`<option value="${t.id}">${t.title} (${t.id})</option>`).join('')}
        </select>
      </div>
      <div class="row"><label>Pitanja</label>
        <div id="questions"></div>
      </div>
      <div class="row"><label></label><button type="button" class="btn" id="addQ">Dodaj pitanje</button></div>
      <div class="row"><label></label><button class="btn primary" type="submit">${btnLabel}</button></div>
    </form>
  </section>
  <script>
    (function(){
      const existing = ${JSON.stringify(test||null)};
      const allTests = ${JSON.stringify(allTests||[])};
      const mode = ${JSON.stringify(mode)};
      const authorHandle = existing?.authorHandle || ${JSON.stringify(user.handle)};
      const qWrap = document.getElementById('questions');
      const addBtn = document.getElementById('addQ');
      const importInput = document.getElementById('importQuestions');
      const importTarget = document.getElementById('importTarget');
      const form = document.getElementById('${formId}');
      let counter = 0;
      function renumberQuestions(){
        qWrap.querySelectorAll('[data-question]').forEach((blk, i)=>{
          const label = blk.querySelector('[data-q-label]');
          if(label) label.textContent = 'Pitanje #'+(i+1);
        });
      }
      function addQuestion(prefill){
        const idx = counter++;
        const block = document.createElement('div');
        block.className = 'panel';
        block.style.margin = '0 0 .8rem';
        block.setAttribute('data-question', idx);
        const optsHtml = [0,1,2,3].map(i=>
          '<div>'
            + '<label style="margin:0 0 .25rem">Odgovor ' + (i+1) + '</label>'
            + '<input name="opt-' + idx + '-' + i + '" required />'
          + '</div>'
        ).join('');
        block.innerHTML =
          '<div style="display:flex;justify-content:space-between;gap:1rem;align-items:center">'
            + '<label data-q-label style="margin:0">Pitanje</label>'
            + '<button type="button" class="btn warn" data-remove>Ukloni</button>'
          + '</div>'
          + '<label style="display:block;margin-top:.5rem;font-weight:600;font-size:.9rem">Tip pitanja</label>'
          + '<select name="type-' + idx + '" data-type-select style="max-width:220px">'
            + '<option value="text">Tekstualno</option>'
            + '<option value="code">Code snippet</option>'
          + '</select>'
          + '<input name="qtext-' + idx + '" placeholder="Tekst pitanja" required style="margin-top:.4rem" />'
          + '<div data-code-hint class="muted" style="margin-top:.4rem;display:none">Sta radi sledeci kod?</div>'
          + '<textarea name="code-' + idx + '" rows="6" style="display:none;margin-top:.25rem;font-family:monospace" placeholder="Ovde nalepi kod"></textarea>'
          + '<div class="grid cols-2" style="margin-top:.6rem">' + optsHtml + '</div>'
          + '<div class="row" style="margin-top:.6rem">'
            + '<label>Tacan odgovor</label>'
            + '<select name="correct-' + idx + '" required>'
              + '<option value="0">1</option>'
              + '<option value="1">2</option>'
              + '<option value="2">3</option>'
              + '<option value="3">4</option>'
            + '</select>'
          + '</div>';
        block.querySelector('[data-remove]').addEventListener('click', ()=>{
          block.remove();
          if(!qWrap.querySelector('[data-question]')) addQuestion();
          renumberQuestions();
        });
        const typeSelect = block.querySelector('[data-type-select]');
        const textInput = block.querySelector('[name="qtext-' + idx + '"]');
        const codeArea = block.querySelector('[name="code-' + idx + '"]');
        const codeHint = block.querySelector('[data-code-hint]');
        const syncType = ()=>{
          const isCode = typeSelect.value === 'code';
          textInput.style.display = isCode ? 'none' : '';
          codeArea.style.display = isCode ? '' : 'none';
          codeHint.style.display = isCode ? 'block' : 'none';
          textInput.required = !isCode;
          codeArea.required = isCode;
        };
        typeSelect.addEventListener('change', syncType);
        qWrap.appendChild(block);
        if(prefill){
          textInput.value = prefill.text || '';
          if(prefill.isCode){
            typeSelect.value = 'code';
            codeArea.value = prefill.code || prefill.text || '';
          }
          if(Array.isArray(prefill.options)){
            prefill.options.forEach((opt, i)=>{
              const input = block.querySelector('[name="opt-' + idx + '-' + i + '"]');
              if(input) input.value = opt;
            });
          }
          if(typeof prefill.answer !== 'undefined'){
            block.querySelector('[name="correct-' + idx + '"]').value = String(prefill.answer);
          }
        }
        syncType();
        renumberQuestions();
      }
      addBtn.addEventListener('click', ()=> addQuestion());
      function resetQuestions(){
        counter = 0;
        qWrap.innerHTML = '';
      }
      function loadTestById(id){
        const found = allTests.find(t=>t.id===id);
        if(!found) return;
        resetQuestions();
        (found.questions||[]).forEach(q=> addQuestion(q));
        form.title.value = found.title || '';
        form.durationMinutes.value = Math.max(1, Math.ceil((found.durationSeconds||120)/60));
        form.notifyEmail.value = found.authorEmail || form.notifyEmail.value;
        if(form.assignedHandle) form.assignedHandle.value = found.assignedHandle || '';
      }
      if(importTarget){
        importTarget.addEventListener('change', ()=>{
          const val = importTarget.value;
          if(val){
            loadTestById(val);
          }else if(existing?.questions?.length){
            resetQuestions();
            existing.questions.forEach(q=> addQuestion(q));
          }
        });
      }
      if(existing?.questions?.length){
        existing.questions.forEach(q=> addQuestion(q));
      }else{
        addQuestion();
      }

      async function importFromFile(file){
        try{
          const text = await file.text();
          const parsed = JSON.parse(text);
          if(!Array.isArray(parsed)){ alert('JSON mora biti niz pitanja'); return; }
          const targetId = importTarget?.value || '';
          if(targetId){
            loadTestById(targetId);
          }
          parsed.forEach(q=>{
            if(!q.options || q.options.length!==4) return;
            const prefill = {
              isCode: q.type === 'code' || q.isCode,
              text: q.text || '',
              code: q.code || '',
              options: q.options,
              answer: Number(q.answer)||0
            };
            addQuestion(prefill);
          });
          alert('Import zavr??en. Proverite pitanja pre ??uvanja.');
        }catch(err){
          alert('Import nije uspeo: '+(err?.message||err));
        }
      }
      importInput?.addEventListener('change',(e)=>{
        const f = e.target.files?.[0];
        if(f) importFromFile(f);
      });

      form.addEventListener('submit', (e)=>{
        e.preventDefault();
        const data = new FormData(form);
        const title = (data.get('title')||'').trim();
        const durationMinutes = Math.max(1, Number(data.get('durationMinutes'))||0);
        const durationSeconds = durationMinutes * 60;
        const notifyEmail = (data.get('notifyEmail')||'').trim();
        const assignedHandle = (data.get('assignedHandle')||'').trim();
        const questions = [];
        qWrap.querySelectorAll('[data-question]').forEach((blk)=>{
          const qKey = blk.getAttribute('data-question');
          const typeSelect = blk.querySelector('[name="type-' + qKey + '"]');
          const type = typeSelect ? typeSelect.value : 'text';
          const isCode = type === 'code';
          const text = (data.get('qtext-'+qKey)||'').trim();
          const code = (data.get('code-'+qKey)||'').trim();
          const opts = [0,1,2,3].map(i=> (data.get('opt-'+qKey+'-'+i)||'').trim()).filter(Boolean);
          const ans = Number(data.get('correct-'+qKey));
          if(isCode){
            if(code && opts.length===4){
              questions.push({ isCode:true, text:'Sta radi sledeci kod?', code, options:opts, answer:ans });
            }
          }else if(text && opts.length===4){
            questions.push({ text, options:opts, answer:ans });
          }
        });
        if(!questions.length){ alert('Dodajte bar jedno pitanje sa 4 odgovora.'); return; }
        const tests = JSON.parse(localStorage.getItem('ca_tests')||'[]');
        if(mode==='edit' && existing){
          const idx = tests.findIndex(t=>t.id===existing.id);
          if(idx===-1){ alert('Test vi??e ne postoji.'); return; }
          tests[idx] = {
            ...tests[idx],
            title,
            durationSeconds,
            questions,
            authorEmail: notifyEmail,
            assignedHandle: assignedHandle || ''
          };
        }else{
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
          let id = slug || 'test-'+Date.now();
          if(slug){
            let suffix = 2;
            while(tests.some(t=>t.id===id)){
              id = slug + '-' + (suffix++);
            }
          }else{
            while(tests.some(t=>t.id===id)){
              id = 'test-'+(Date.now()+Math.floor(Math.random()*1000));
            }
          }
          tests.push({ id, title, durationSeconds, questions, authorHandle: authorHandle, authorEmail:notifyEmail, assignedHandle: assignedHandle || '' });
        }
        localStorage.setItem('ca_tests', JSON.stringify(tests));
        location.hash = '#/tests';
      });
    })();
  </script>`;
}





