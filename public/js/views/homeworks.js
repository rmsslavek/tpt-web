import { db, currentUser } from '../storage.js';

export function HomeworksView(){
  const me = currentUser();
  const isEditor = !!me?.isAdmin || !!me?.isProfessor || !!me?.isOwner;
  let homeworks = db.homeworks();
  if(!homeworks?.length){
    const fromLocal = JSON.parse(localStorage.getItem('ca_homeworks')||'[]');
    if(fromLocal?.length) homeworks = fromLocal;
  }
  const problems = db.problems();
  const tests = db.tests();
  const users = db.users();
  const statusKey = 'ca_homework_status';
  const statuses = JSON.parse(localStorage.getItem(statusKey) || '[]');
  const allProblems = db.problems();
  const allTests = db.tests();
  const submissions = JSON.parse(localStorage.getItem('ca_submissions')||'[]');
  const now = Date.now();

  const myHandle = (me?.handle||'').toLowerCase();
  const visible = isEditor
    ? homeworks
    : homeworks.filter(hw=>{
        const targets = (hw.assignedHandles && hw.assignedHandles.length) ? hw.assignedHandles.map(x=>x.toLowerCase()) : (hw.assignedHandle ? [hw.assignedHandle.toLowerCase()] : []);
        const allowed = !targets.length || targets.includes(myHandle);
        return (!hw.dueAt || hw.dueAt >= now) && allowed;
      });

  return `
  <section class="panel">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
      <div>
        <h2>Domaci zadaci</h2>
        <p class="muted" style="margin:0">Vidljivo aktivnim korisnicima do isteka roka. Kreiranje: samo admin/profesor.</p>
      </div>
      ${isEditor ? `<button class="btn primary" id="showHwForm">Novi domaci</button>` : ''}
    </div>
  </section>

  <section class="panel" id="hwFormWrap" style="display:${isEditor?'block':'none'};margin-top:.8rem">
    ${isEditor ? `
    <h3>Novi domaci</h3>
    <form id="hwForm" style="display:grid;gap:.6rem">
      <div class="row"><label>Naziv</label><input name="title" required /></div>
      <div class="row"><label>Pretraga korisnika</label><input id="hwUserSearch" placeholder="upiši handle ili email" /></div>
      <div class="row"><label>Kome je namenjen</label>
        <div id="hwUserList" class="grid cols-3" style="gap:.4rem;max-height:140px;overflow:auto">
          ${users.map(u=>`<label data-user="${(u.handle+' '+(u.email||'')).toLowerCase()}" style="display:flex;gap:.35rem;align-items:center"><input type="checkbox" name="assigned" value="${u.handle}" /> ${u.handle} ${u.email ? '('+u.email+')' : ''}</label>`).join('')}
        </div>
      </div>
      <div class="row" style="align-items:center;gap:.6rem"><label>Rok (do kada je vidljiv)</label><button class="btn" type="button" id="openCalendar">Izaberi datum</button><span id="dueAtLabel" class="muted">nije izabran</span></div>
      <div id="calendarModal" class="panel" style="position:fixed;left:0;top:0;right:0;bottom:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);z-index:9999">
        <div class="panel" style="max-width:320px;width:90%;background:#0f1425;padding:1rem">
          <h4>Izaberi datum roka</h4>
          <input type="date" id="dueAtInput" style="width:100%" />
          <div style="margin-top:.6rem;display:flex;gap:.5rem;justify-content:flex-end">
            <button class="btn" type="button" id="calCancel">Otkaži</button>
            <button class="btn primary" type="button" id="calSave">Sačuvaj</button>
          </div>
        </div>
      </div>
      <div class="row"><label>Pretraga zadataka</label><input id="hwProblemSearch" placeholder="upiši šifru ili naziv" /></div>
      <div class="row"><label>Zadaci (cekiraj)</label>
        <div id="hwProblemList" class="grid cols-3" style="gap:.4rem;max-height:180px;overflow:auto">
          ${problems.map(p=>`<label data-problem="${(p.id+' '+p.title).toLowerCase()}" style="display:flex;gap:.35rem;align-items:center"><input type="checkbox" name="problem" value="${p.id}" /> ${p.id} - ${p.title}</label>`).join('')}
        </div>
      </div>
      <div class="row"><label>Pretraga testova</label><input id="hwTestSearch" placeholder="upiši šifru ili naziv" /></div>
      <div class="row"><label>Testovi (cekiraj)</label>
        <div id="hwTestList" class="grid cols-3" style="gap:.4rem;max-height:160px;overflow:auto">
          ${tests.map(t=>`<label data-test="${(t.id+' '+(t.title||'')).toLowerCase()}" style="display:flex;gap:.35rem;align-items:center"><input type="checkbox" name="test" value="${t.id}" /> ${t.id} - ${t.title||''}</label>`).join('')}
        </div>
      </div>
      <div class="row" style="display:flex;gap:.6rem">
        <button class="btn primary" type="submit">Sacuvaj</button>
        <button class="btn" type="button" id="cancelHw">Otkazi</button>
      </div>
    </form>` : '<p class="muted">Samo admin/profesor mogu da kreiraju domaci.</p>'}
  </section>

  <section class="panel" style="margin-top:.8rem">
    <h3>Lista</h3>
    ${visible.length ? `
      <table class="table" id="hwListTable">
        <thead><tr><th>ID</th><th>Naziv</th><th>Kreator</th><th>Cilj</th><th>Rok</th><th>Status</th><th>Zadaci</th><th>Testovi</th><th>Akcija</th>${isEditor?'<th>Predaje</th>':''}</tr></thead>
        <tbody>
          ${visible.map(hw=>{
            const expired = hw.dueAt && hw.dueAt < now;
            const targetList = (hw.assignedHandles&&hw.assignedHandles.length) ? hw.assignedHandles : (hw.assignedHandle ? [hw.assignedHandle] : []);
            const myAllowed = !targetList.length || targetList.map(x=>x.toLowerCase()).includes((me?.handle||'').toLowerCase());
            const myStatus = statuses.find(s=> s.hwId===hw.id && s.handle===(me?.handle||'')) || null;
            let actionBtn = '';
            if(!isEditor && myAllowed && !expired){
              if(myStatus?.status === 'done'){
                actionBtn = `<button class="btn" disabled>Domaci završen</button> <button class="btn ghost" data-hw-report="${hw.id}">Pregled</button>`;
              }else{
                actionBtn = `<button class="btn" data-hw-do="${hw.id}">${myStatus?.status==='in_progress' ? 'Nastavi domaci' : 'Uradi domaci'}</button>
                             <button class="btn warn" data-hw-finish="${hw.id}">Završi</button>`;
              }
            }else if(isEditor){
              actionBtn = `<button class="btn ghost" data-hw-report="${hw.id}">Pregled</button>`;
            }
            const statusList = isEditor ? statuses.filter(s=>s.hwId===hw.id).map(s=> `${s.handle}: ${s.status}`).join(', ') : '';
            return `<tr>
              <td>${hw.id}</td>
              <td>${hw.title}</td>
              <td>${hw.creator||'-'}</td>
              <td>${targetList.length ? targetList.join(', ') : 'svi'}</td>
              <td>${hw.dueAt ? new Date(hw.dueAt).toLocaleString() : '-'}</td>
              <td class="${expired?'wa':'ac'}">${expired ? 'istekao' : 'aktivan'}</td>
              <td>${(hw.problems||[]).join(', ')||'-'}</td>
              <td>${(hw.tests||[]).join(', ')||'-'}</td>
              <td>${actionBtn}</td>
              ${isEditor?`<td>${statusList||'-'}</td>`:''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    ` : '<p class="muted">Nema domacih zadataka za prikaz.</p>'}
  </section>

  <div id="hwDoModal" style="position:fixed;left:0;top:0;right:0;bottom:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);z-index:9999">
    <div class="panel" style="max-width:600px;width:92%;background:#0f1425;padding:1rem;max-height:80vh;overflow:auto">
      <h3 id="hwDoTitle">Domaci</h3>
      <div id="hwDoContent"></div>
      <div style="text-align:right;margin-top:.8rem">
        <button class="btn" type="button" id="hwDoClose">Zatvori</button>
      </div>
    </div>
  </div>

  <script>
    (function(){
      const isEditor = ${JSON.stringify(isEditor)};
      const homeworksAll = ${JSON.stringify(homeworks||[])};
      // deo za kreiranje samo ako je editor
      if(isEditor){
        const form = document.getElementById('hwForm');
        const wrap = document.getElementById('hwFormWrap');
        document.getElementById('showHwForm')?.addEventListener('click', ()=> wrap.style.display='block');
        document.getElementById('cancelHw')?.addEventListener('click', ()=> wrap.style.display='none');
        const userSearch = document.getElementById('hwUserSearch');
        const userList = document.getElementById('hwUserList');
        const probSearch = document.getElementById('hwProblemSearch');
        const probList = document.getElementById('hwProblemList');
        const testSearch = document.getElementById('hwTestSearch');
        const testList = document.getElementById('hwTestList');
        const dueLabel = document.getElementById('dueAtLabel');
        const cal = document.getElementById('calendarModal');
        const calInput = document.getElementById('dueAtInput');
        document.getElementById('openCalendar')?.addEventListener('click', ()=>{
          if(cal) cal.style.display='flex';
        });
        document.getElementById('calCancel')?.addEventListener('click', ()=>{
          if(cal) cal.style.display='none';
        });
        document.getElementById('calSave')?.addEventListener('click', ()=>{
          const val = calInput?.value;
          if(val){
            dueLabel.textContent = new Date(val).toLocaleDateString();
            dueLabel.dataset.value = val;
          }
          if(cal) cal.style.display='none';
        });
        const filterList = (input, list, attr)=>{
          if(!input || !list) return;
          const q = (input.value||'').toLowerCase().trim();
          list.querySelectorAll('label').forEach(l=>{
            const hay = (l.getAttribute(attr)||'');
            l.style.display = !q || hay.includes(q) ? '' : 'none';
          });
        };
        userSearch?.addEventListener('input', ()=> filterList(userSearch, userList, 'data-user'));
        probSearch?.addEventListener('input', ()=> filterList(probSearch, probList, 'data-problem'));
        testSearch?.addEventListener('input', ()=> filterList(testSearch, testList, 'data-test'));
        form?.addEventListener('submit',(e)=>{
          e.preventDefault();
          const fd = new FormData(form);
          const title = (fd.get('title')||'').trim();
          const assigned = fd.getAll('assigned').map(v=> (v||'').toString()).filter(Boolean);
          const dueAtStr = dueLabel?.dataset?.value || fd.get('dueAt') || '';
          const dueAt = dueAtStr ? new Date(dueAtStr).setHours(23,59,59,999) : null;
          const problems = fd.getAll('problem');
          const tests = fd.getAll('test');
          if(!title || !dueAt){ alert('Unesite naziv i rok.'); return; }
          const list = homeworksAll.slice();
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
          let id = slug || 'hw-' + Date.now();
          let suf = 2;
          while(list.some(x=>x.id===id)){ id = (slug||'hw') + '-' + (suf++); }
          list.push({
            id,
            title,
            creator: ${JSON.stringify(me?.handle||'')},
            assignedHandle: assigned[0] || '',
            assignedHandles: assigned,
            problems,
            tests,
            dueAt,
            createdAt: Date.now()
          });
          localStorage.setItem('ca_homeworks', JSON.stringify(list));
          const tbody = document.querySelector('#hwListTable tbody');
          if(tbody){
            const now = Date.now();
            const expired = dueAt && dueAt < now;
            const targetList = assigned.length ? assigned : [];
            const row = document.createElement('tr');
            row.innerHTML =
              '<td>'+id+'</td>'+
              '<td>'+title+'</td>'+
              '<td>'+${JSON.stringify(me?.handle||'')}+'</td>'+
              '<td>'+(targetList.length ? targetList.join(', ') : 'svi')+'</td>'+
              '<td>'+(dueAt ? new Date(dueAt).toLocaleString() : '-')+'</td>'+
              '<td class=\"'+(expired?'wa':'ac')+'\">'+(expired?'istekao':'aktivan')+'</td>'+
              '<td>'+(problems.join(', ')||'-')+'</td>'+
              '<td>'+(tests.join(', ')||'-')+'</td>'+
              '<td></td>'+
              '<td>${isEditor? ' - ' : ''}</td>';
            tbody.prepend(row);
          }
          alert('Domaci sacuvan.');
        });
      }
      // akcije za ucesnike (uvek)
      document.querySelectorAll('[data-hw-do]')?.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const hwId = btn.getAttribute('data-hw-do');
          const handle = ${JSON.stringify(me?.handle||'')};
          if(!handle) return;
          const statusKey = ${JSON.stringify(statusKey)};
          const statuses = JSON.parse(localStorage.getItem(statusKey) || '[]');
          const idx = statuses.findIndex(s=>s.hwId===hwId && s.handle===handle);
          const current = idx>=0 ? statuses[idx] : null;
          if(current?.status === 'done'){
            alert('Domaci je već označen kao završen.');
            return;
          }
          const entry = { hwId, handle, status:'in_progress', time:Date.now(), report: current?.report||{} };
          if(idx>=0) statuses[idx] = entry; else statuses.push(entry);
          localStorage.setItem(statusKey, JSON.stringify(statuses));
          // prikazi modal sa linkovima
          const hw = (${JSON.stringify(homeworks||[])}).find(x=>x.id===hwId);
          const probMap = ${JSON.stringify(allProblems||[])}.reduce((acc,p)=>{ acc[p.id]=p; return acc; },{});
          const testMap = ${JSON.stringify(allTests||[])}.reduce((acc,t)=>{ acc[t.id]=t; return acc; },{});
          const content = document.getElementById('hwDoContent');
          const title = document.getElementById('hwDoTitle');
          const modal = document.getElementById('hwDoModal');
          if(title && hw) title.textContent = 'Domaci: ' + hw.title;
          if(content && hw){
            const probs = (hw.problems||[]).map(id=> '<li><a class="btn ghost" href="#/problem/'+id+'?hw='+encodeURIComponent(hw.id)+'">Zadatak '+id+'</a></li>').join('');
            const tests = (hw.tests||[]).map(id=> '<li><a class="btn ghost" href="#/tests/run/'+id+'?hw='+encodeURIComponent(hw.id)+'">Test '+id+'</a></li>').join('');
            content.innerHTML = '<h4>Zadaci</h4><ul style="padding-left:18px">'+ (probs||'<li class="muted">Nema zadataka</li>') +'</ul>'
              + '<h4>Testovi</h4><ul style="padding-left:18px">'+ (tests||'<li class="muted">Nema testova</li>') +'</ul>';
          }
          if(modal) modal.style.display='flex';
        });
      });
      document.querySelectorAll('[data-hw-finish]')?.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const hwId = btn.getAttribute('data-hw-finish');
          const handle = ${JSON.stringify(me?.handle||'')};
          const statusKey = ${JSON.stringify(statusKey)};
          const statuses = JSON.parse(localStorage.getItem(statusKey) || '[]');
          const idx = statuses.findIndex(s=>s.hwId===hwId && s.handle===handle);
          const report = {};
          const hw = (${JSON.stringify(homeworks||[])}).find(x=>x.id===hwId);
          const subs = ${JSON.stringify(submissions||[])}.filter(s=> s.handle===handle);
          if(hw){
            report.problems = (hw.problems||[]).map(pid=>{
              const last = subs.find(s=> s.problemId===pid);
              return { id: pid, verdict: last?.verdict || 'N/A', text: last?.verdictText || 'nema predaje' };
            });
            report.tests = (hw.tests||[]).map(tid=> ({ id: tid, verdict:'N/A', text:'Rezultat testa nije sačuvan' }));
          }
          const entry = { hwId, handle, status:'done', time:Date.now(), report };
          if(idx>=0) statuses[idx] = entry; else statuses.push(entry);
          localStorage.setItem(statusKey, JSON.stringify(statuses));
          alert('Domaci oznacen kao zavrsen.');
          location.hash = '#/homeworks';
        });
      });
      document.querySelectorAll('[data-hw-report]')?.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const hwId = btn.getAttribute('data-hw-report');
          const handle = ${JSON.stringify(me?.handle||'')};
          const statusKey = ${JSON.stringify(statusKey)};
          const statuses = JSON.parse(localStorage.getItem(statusKey) || '[]');
          const entry = statuses.find(s=>s.hwId===hwId && (isEditor || s.handle===handle));
          const content = document.getElementById('hwDoContent');
          const title = document.getElementById('hwDoTitle');
          const modal = document.getElementById('hwDoModal');
          if(title) title.textContent = 'Izveštaj za domaci ' + hwId;
          if(content){
            if(entry?.report){
              const probs = (entry.report.problems||[]).map(r=>{
                const subs = ${JSON.stringify(submissions||[])}.filter(s=> s.problemId===r.id && s.handle===entry.handle);
                const links = subs.map(s=> '<button class="btn ghost" data-sub-code="'+s.id+'">Kod '+s.id+'</button>').join(' ');
                return '<li>'+r.id+': '+r.verdict+' ('+r.text+') '+(links||'')+'</li>';
              }).join('');
              const tests = (entry.report.tests||[]).map(r=> '<li><a class="btn ghost" href="#/tests/run/'+r.id+'?hw='+encodeURIComponent(hwId)+'">Test '+r.id+'</a></li>').join('');
              content.innerHTML = '<h4>Zadaci</h4><ul style="padding-left:18px">'+(probs||'<li class="muted">Nema podataka</li>')+'</ul>'
                + '<h4>Testovi</h4><ul style="padding-left:18px">'+(tests||'<li class="muted">Nema podataka</li>')+'</ul>';
            }else{
              content.innerHTML = '<p class="muted">Nema sačuvanog izveštaja.</p>';
            }
          }
          if(modal) modal.style.display='flex';
        });
      });
      document.getElementById('hwDoClose')?.addEventListener('click', ()=>{
        const modal = document.getElementById('hwDoModal');
        if(modal) modal.style.display='none';
      });
      document.getElementById('hwDoModal')?.addEventListener('click', (e)=>{
        if(e.target && e.target.id==='hwDoModal'){
          e.currentTarget.style.display='none';
        }
      });
      document.querySelectorAll('[data-sub-code]')?.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const id = btn.getAttribute('data-sub-code');
          const subs = ${JSON.stringify(submissions||[])};
          const found = subs.find(s=>s.id===id);
          const content = document.getElementById('hwDoContent');
          const title = document.getElementById('hwDoTitle');
          const modal = document.getElementById('hwDoModal');
          if(title) title.textContent = 'Predaja ' + id;
          if(content && found){
            content.innerHTML = '<p class="muted">Problem: '+found.problemId+' | Autor: '+found.handle+' | Jezik: '+found.lang+' | ' + new Date(found.time).toLocaleString() + '</p>'
              + '<p class="status '+(found.verdict==='AC'?'ac':(found.verdict==='WA'?'wa':'pd'))+'">'+found.verdictText+'</p>'
              + '<pre style="white-space:pre-wrap">'+String(found.source||'').replace(/[&<>]/g,c=>({\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\"}[c]))+'</pre>';
          }else if(content){
            content.innerHTML = '<p class="muted">Predaja nije pronađena.</p>';
          }
          if(modal) modal.style.display='flex';
        });
      });
    })();
  </script>
  `;
}
