import { db } from '../storage.js';

export function SubmissionsView(){
  const subs = db.submissions();
  return `
  <section class="panel">
    <h2>Predaje</h2>
    <div id="submissionDetail"></div>
    <div class="panel" style="margin:.6rem 0">
      <div class="grid cols-3">
        <div>
          <label>Filter po zadatku</label>
          <input id="subFilterProblem" placeholder="npr. A100" />
        </div>
        <div>
          <label>Filter po korisniku</label>
          <input id="subFilterUser" placeholder="npr. slavek" />
        </div>
        <div style="display:flex;align-items:flex-end;gap:.5rem">
          <button class="btn" type="button" id="subFilterApply">Primeni</button>
          <button class="btn ghost" type="button" id="subFilterClear">Reset</button>
        </div>
      </div>
      <div class="muted" id="subFilterSummary" style="margin-top:.4rem"></div>
    </div>
    <table class="table">
      <thead><tr><th>ID</th><th>Vreme</th><th>Autor</th><th>Zadatak</th><th>Jezik</th><th>Rezultat</th><th>Du‘–ina</th></tr></thead>
      <tbody id="submissionRows"></tbody>
    </table>
    <script>
      (function(){
        const subs = ${JSON.stringify(subs || [])};
        const lastMap = JSON.parse(localStorage.getItem('ca_last_code') || '{}');
        const detail = document.getElementById('submissionDetail');
        const tbody = document.getElementById('submissionRows');
        const filterProblem = document.getElementById('subFilterProblem');
        const filterUser = document.getElementById('subFilterUser');
        const filterApply = document.getElementById('subFilterApply');
        const filterClear = document.getElementById('subFilterClear');
        const filterSummary = document.getElementById('subFilterSummary');
        function esc(str){ return String(str||'').replace(/[&<>]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
        function pickBest(sub){
          if(!sub) return null;
          const best = lastMap[sub.problemId];
          if(!best) return sub;
          const bestIsAc = best.verdict === 'AC';
          const currentIsAc = sub.verdict === 'AC';
          if(bestIsAc) return best; // prikazi poslednji AC
          if(!currentIsAc) return best; // nema AC, prikazi poslednji zapamceni (moze biti WA)
          return sub;
        }
        function render(sub){
          if(!detail) return;
          if(!sub){
            detail.innerHTML = '<p class="muted">Nema detalja.</p>';
            return;
          }
          const best = pickBest(sub);
          const code = esc(best?.source||'');
          detail.innerHTML =
            '<div class="panel" style="margin:0 0 .8rem">' +
            '<h3>Predaja ' + esc(sub.id) + '</h3>' +
            '<p class="muted">Problem: ' + esc(sub.problemId) + ' | Autor: ' + esc(sub.handle) + ' | Jezik: ' + esc(sub.lang) + ' | ' + new Date(sub.time).toLocaleString() + '</p>' +
            '<p class="status ' + (best?.verdict==='AC' ? 'ac' : (best?.verdict==='WA' ? 'wa' : 'pd')) + '">' + esc(best?.verdictText || sub.verdictText) + (best && best.id!==sub.id ? ' (poslednji saŽ›uvani kod)' : '') + '</p>' +
            '<pre style="white-space:pre-wrap">' + code + '</pre>' +
            '</div>';
        }
        function renderRows(list){
          if(!tbody) return;
          if(!list.length){
            tbody.innerHTML = '<tr><td colspan="7" class="muted">Nema predaja za zadati filter.</td></tr>';
            return;
          }
          tbody.innerHTML = list.map(s=>(
            '<tr>' +
              '<td><a href="javascript:void(0)" data-sub-id="'+esc(s.id)+'">'+esc(s.id)+'</a></td>' +
              '<td>'+esc(new Date(s.time).toLocaleString())+'</td>' +
              '<td><a href="#/profile/'+esc(s.handle)+'">'+esc(s.handle)+'</a></td>' +
              '<td><a href="#/problem/'+esc(s.problemId)+'">'+esc(s.problemId)+'</a></td>' +
              '<td>'+esc(s.lang)+'</td>' +
              '<td class="status '+(s.verdict==='AC'?'ac':(s.verdict==='WA'||s.verdict==='RE'?'wa':'pd'))+'">'+esc(s.verdictText)+'</td>' +
              '<td>'+esc(s.length)+'</td>' +
            '</tr>'
          )).join('');
        }
        function applyFilter(){
          const p = (filterProblem?.value || '').trim().toLowerCase();
          const u = (filterUser?.value || '').trim().toLowerCase();
          const filtered = subs.filter(s=>{
            const sp = String(s.problemId||'').toLowerCase();
            const su = String(s.handle||'').toLowerCase();
            const okP = !p || sp.includes(p);
            const okU = !u || su.includes(u);
            return okP && okU;
          });
          if(filterSummary){
            const label = [];
            if(p) label.push('zadatak: '+p);
            if(u) label.push('korisnik: '+u);
            filterSummary.textContent = 'Prikazano: '+filtered.length+' / '+subs.length + (label.length ? ' (filter: '+label.join(', ')+')' : '');
          }
          renderRows(filtered);
        }
        if(filterApply) filterApply.addEventListener('click', applyFilter);
        if(filterClear) filterClear.addEventListener('click', ()=>{
          if(filterProblem) filterProblem.value = '';
          if(filterUser) filterUser.value = '';
          applyFilter();
        });
        if(tbody){
          tbody.addEventListener('click', (e)=>{
            const link = e.target.closest('[data-sub-id]');
            if(!link) return;
            const id = link.getAttribute('data-sub-id');
            const found = subs.find(x=>x.id===id);
            render(found);
          });
        }
        applyFilter();
      })();
    </script>
  </section>`;
}

function cls(v){
  if(v==='AC') return 'ac';
  if(v==='WA'||v==='RE') return 'wa';
  return 'pd';
}
