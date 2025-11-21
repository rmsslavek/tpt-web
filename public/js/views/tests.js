import { db } from '../storage.js';

export function TestsListView(){
  const me = db.session();
  const users = db.users();
  const user = me ? users.find(u=>u.handle===me.handle) : null;
  const isAdmin = !!user?.isAdmin;
  const tests = db.tests();
  const isLogged = !!me;
  return `
  <section class="panel">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
      <h2>Testovi znanja</h2>
      ${isAdmin ? `<a class="btn primary" href="#/tests/new">Kreiraj novi test</a>` : `<span class="muted">Kreiranje testa je dozvoljeno samo administratorima.</span>`}
    </div>
    ${tests.length ? `
      <table class="table" style="margin-top:.6rem">
        <thead><tr><th>Naziv</th><th>Pitanja</th><th>Vreme</th><th>Autor</th><th>Akcije</th></tr></thead>
        <tbody>
          ${tests.map(t=>`<tr>
            <td>${t.title}</td>
            <td>${t.questions.length}</td>
            <td>${Math.max(1, Math.ceil(t.durationSeconds/60))} min</td>
            <td class="muted">${t.authorHandle||'—'}</td>
            <td style="display:flex;gap:.4rem;flex-wrap:wrap">
              ${isLogged ? `<a class="btn" href="#/tests/run/${t.id}">Pokreni</a>` : `<a class="btn ghost" href="#/login">Prijavi se</a>`}
              ${isAdmin ? `<a class="btn warn" href="#/tests/edit/${t.id}">Izmeni</a>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    `: `<p class="muted" style="margin-top:1rem">Još uvek nema testova. Napravite prvi!</p>`}
    ${user?.isOwner ? `
      <div class="panel" style="margin-top:1rem">
        <h3>Dodela admin prava</h3>
        <p class="muted">Samo vlasnik sajta može dodeliti administratorsku ulogu.</p>
        <form id="grantAdmin" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
          <input name="handle" placeholder="Korisničko ime" required style="max-width:220px" />
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
            if(!u){ alert('Korisnik nije pronađen'); return; }
            u.isAdmin=true;
            localStorage.setItem('ca_users', JSON.stringify(users));
            alert('Dodeljena admin prava za '+u.handle);
          });
        })();
      </script>
    `:''}
  </section>`;
}

export function TestCreateView(){
  const me = db.session();
  const user = me ? db.users().find(u=>u.handle===me.handle) : null;
  if(!me){
    return `<div class="panel">Samo administrator može da kreira test. <a href="#/login">Prijavite se</a>.</div>`;
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
    return `<div class="panel">Morate biti prijavljeni da biste rešavali test. <a href="#/login">Prijavite se</a>.</div>`;
  }
  const test = db.tests().find(t=>t.id===id);
  if(!test){
    return `<div class="panel">Test nije pronađen. <a href="#/tests">Nazad</a></div>`;
  }
  return `
  <section class="panel" style="max-width:900px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center">
      <h2>${test.title}</h2>
      <div class="badge" id="timer">${fmt(test.durationSeconds)}</div>
    </div>
    <form id="takeForm" style="margin-top:1rem">
      ${test.questions.map((q,qi)=>`
        <div class="panel" style="margin-bottom:.6rem">
          <div style="font-weight:600">${qi+1}. ${q.isCode ? 'Sta je rezultat rada ovog koda?' : q.text}</div>
          ${q.isCode ? `<pre class="code-block" style="margin:.5rem 0 0">${escapeHtml(q.code || q.text)}</pre>` : ''}
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
      <div style="display:flex;justify-content:flex-end;gap:.6rem;align-items:center">
        <span class="muted">Vreme ograničeno na ${Math.max(1, Math.ceil(test.durationSeconds/60))} min</span>
        <button class="btn primary" type="submit">Završi test</button>
      </div>
    </form>
    <div id="result" class="panel" style="display:none;margin-top:1rem"></div>
  </section>
  <script type="module">
    import { sendEmailViaApi, isEmailApiConfigured } from './js/emailService.js';
    import { EMAIL_API_CONFIG } from './js/config.js';
    (function(){
      const test = ${JSON.stringify(test)};
      const sessionUser = ${JSON.stringify(user||null)};
      const timerEl = document.getElementById('timer');
      const form = document.getElementById('takeForm');
      const result = document.getElementById('result');
      const fmtLocal = (sec)=>{
        const s = Math.max(0, Math.floor(sec));
        const m = String(Math.floor(s/60)).padStart(2,'0');
        const r = String(s%60).padStart(2,'0');
        return m+':'+r;
      };
      let left = test.durationSeconds;
      let finished = false;
      const tick = setInterval(()=>{
        left -= 1;
        timerEl.textContent = fmtLocal(left);
        if(left<=0){
          clearInterval(tick);
          grade();
        }
      },1000);

      form.addEventListener('submit', async (e)=>{ e.preventDefault(); await grade(); });

      async function grade(){
        if(finished) return;
        finished = true;
        clearInterval(tick);
        const data = new FormData(form);
        let correct = 0;
        test.questions.forEach((q,qi)=>{
          const picked = data.get('q'+qi);
          if(picked!==null && Number(picked)===q.answer) correct++;
        });
        const total = test.questions.length;
        form.querySelectorAll('input,button,select').forEach(el=> el.disabled=true);

        let emailMsg = '';
        const targetEmail = test.authorEmail || EMAIL_API_CONFIG.to || '';
        if(targetEmail){
          const candidate = sessionUser?.handle || 'anonimno';
          const lines = [];
          lines.push('Rezultat testa: '+test.title);
          lines.push('Kandidat: '+candidate);
          lines.push('Tacnih: '+correct+' od '+total);
          lines.push('');
          test.questions.forEach((q,qi)=>{
            const picked = data.get('q'+qi);
            const pickedText = picked!==null ? q.options[Number(picked)] : 'nije odgovoreno';
            const correctText = q.options[q.answer];
            const qLabel = q.isCode ? 'Sta je rezultat rada ovog koda?\n'+(q.code||'') : q.text;
            lines.push((qi+1)+'. '+qLabel);
            lines.push('  odgovor: '+pickedText);
            lines.push('  tacno: '+correctText);
            lines.push('');
          });
          const message = lines.join('\\n');
          const subject = 'Rezultat testa: '+test.title;
          if(isEmailApiConfigured()){
            try{
              await sendEmailViaApi({
                to: targetEmail,
                subject,
                message,
                replyTo: sessionUser?.email || undefined,
                fromName: 'CodeArena testovi'
              });
              emailMsg = 'Rezultat je poslat autoru preko email API-ja.';
            }catch(err){
              console.error('Email API greska', err);
              emailMsg = 'Slanje emaila nije uspelo: '+(err?.message||'nepoznata greska');
            }
          }else{
            const body = encodeURIComponent(message);
            const subj = encodeURIComponent(subject);
            window.location.href = 'mailto:'+encodeURIComponent(targetEmail)+'?subject='+subj+'&body='+body;
            emailMsg = 'Otvoren je email klijent (API nije podeshen).';
          }
        }

        result.style.display='block';
        result.innerHTML = '<h3>Rezultat</h3><p>Tacnih: <b>'+correct+'</b> od '+total+'</p>'+ (emailMsg ? '<p class=\"muted\">'+emailMsg+'</p>' : '');
      }

    })();
  </script>`;
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
    return `<div class="panel">Test nije pronađen. <a href="#/tests">Nazad</a></div>`;
  }
  return renderTestForm({ user, test, mode:'edit' });
}

function renderTestForm({ user, test, mode }){
  const heading = mode==='edit' ? `Izmena testa: ${test.title}` : 'Novi test';
  const notifyValue = test?.authorEmail || user.email || '';
  const btnLabel = mode==='edit' ? 'Sačuvaj izmene' : 'Sačuvaj test';
  const formId = mode==='edit' ? 'editTestForm' : 'newTestForm';
  const durationMinutes = test ? Math.max(1, Math.ceil(test.durationSeconds/60)) : 2;
  return `
  <section class="panel" style="max-width:900px;margin:0 auto">
    <h2>${heading}</h2>
    <form id="${formId}">
      <div class="row"><label>Naziv testa</label><input name="title" required placeholder="npr. Osnove JS" value="${test?.title||''}" /></div>
      <div class="row"><label>Trajanje (minute)</label><input name="durationMinutes" type="number" min="1" step="1" value="${durationMinutes}" required /></div>
      <div class="row"><label>Email za rezultate</label><input name="notifyEmail" type="email" value="${notifyValue}" required /></div>
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
      const mode = ${JSON.stringify(mode)};
      const authorHandle = existing?.authorHandle || ${JSON.stringify(user.handle)};
      const qWrap = document.getElementById('questions');
      const addBtn = document.getElementById('addQ');
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
          + '<label style="display:flex;align-items:center;gap:.5rem;margin-top:.5rem;font-size:.9rem">'
            + '<input type="checkbox" name="isCode-' + idx + '" data-code-toggle />'
            + '<span>Ovo je pitanje sa kodom</span>'
          + '</label>'
          + '<input name="qtext-' + idx + '" placeholder="Tekst pitanja" required style="margin-top:.4rem" />'
          + '<div data-code-hint class="muted" style="margin-top:.4rem;display:none">Sta je rezultat rada ovog koda?</div>'
          + '<textarea name="code-' + idx + '" rows="5" style="display:none;margin-top:.25rem" placeholder="Ovde nalepi kod"></textarea>'
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
        const toggle = block.querySelector('[data-code-toggle]');
        const textInput = block.querySelector('[name="qtext-' + idx + '"]');
        const codeArea = block.querySelector('[name="code-' + idx + '"]');
        const codeHint = block.querySelector('[data-code-hint]');
        const syncType = ()=>{
          const isCode = toggle.checked;
          textInput.style.display = isCode ? 'none' : '';
          codeArea.style.display = isCode ? '' : 'none';
          codeHint.style.display = isCode ? 'block' : 'none';
          textInput.required = !isCode;
          codeArea.required = isCode;
        };
        toggle.addEventListener('change', syncType);
        qWrap.appendChild(block);
        if(prefill){
          textInput.value = prefill.text || '';
          if(prefill.isCode){
            toggle.checked = true;
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
      if(existing?.questions?.length){
        existing.questions.forEach(q=> addQuestion(q));
      }else{
        addQuestion();
      }

      form.addEventListener('submit', (e)=>{
        e.preventDefault();
        const data = new FormData(form);
        const title = (data.get('title')||'').trim();
        const durationMinutes = Math.max(1, Number(data.get('durationMinutes'))||0);
        const durationSeconds = durationMinutes * 60;
        const notifyEmail = (data.get('notifyEmail')||'').trim();
        const questions = [];
        qWrap.querySelectorAll('[data-question]').forEach((blk)=>{
          const qKey = blk.getAttribute('data-question');
          const typeToggle = blk.querySelector('[name="isCode-' + qKey + '"]');
          const isCode = typeToggle ? typeToggle.checked : false;
          const text = (data.get('qtext-'+qKey)||'').trim();
          const code = (data.get('code-'+qKey)||'').trim();
          const opts = [0,1,2,3].map(i=> (data.get('opt-'+qKey+'-'+i)||'').trim()).filter(Boolean);
          const ans = Number(data.get('correct-'+qKey));
          if(isCode){
            if(code && opts.length===4){
              questions.push({ isCode:true, text:'Sta je rezultat rada ovog koda?', code, options:opts, answer:ans });
            }
          }else if(text && opts.length===4){
            questions.push({ text, options:opts, answer:ans });
          }
        });
        if(!questions.length){ alert('Dodajte bar jedno pitanje sa 4 odgovora.'); return; }
        const tests = JSON.parse(localStorage.getItem('ca_tests')||'[]');
        if(mode==='edit' && existing){
          const idx = tests.findIndex(t=>t.id===existing.id);
          if(idx===-1){ alert('Test više ne postoji.'); return; }
          tests[idx] = {
            ...tests[idx],
            title,
            durationSeconds,
            questions,
            authorEmail: notifyEmail
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
          tests.push({ id, title, durationSeconds, questions, authorHandle: authorHandle, authorEmail:notifyEmail });
        }
        localStorage.setItem('ca_tests', JSON.stringify(tests));
        location.hash = '#/tests';
      });
    })();
  </script>`;
}
