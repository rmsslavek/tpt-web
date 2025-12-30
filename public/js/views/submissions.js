import { db } from '../storage.js';

export function SubmissionsView(){
  const subs = db.submissions();
  return `
  <section class="panel">
    <h2>Predaje</h2>
    <div id="submissionDetail"></div>
    <table class="table">
      <thead><tr><th>ID</th><th>Vreme</th><th>Autor</th><th>Zadatak</th><th>Jezik</th><th>Rezultat</th><th>Dužina</th></tr></thead>
      <tbody>
        ${subs.map(s=>`<tr>
          <td><a href="javascript:void(0)" data-sub-id="${s.id}">${s.id}</a></td>
          <td>${new Date(s.time).toLocaleString()}</td>
          <td><a href="#/profile/${s.handle}">${s.handle}</a></td>
          <td><a href="#/problem/${s.problemId}">${s.problemId}</a></td>
          <td>${s.lang}</td>
          <td class="status ${cls(s.verdict)}">${s.verdictText}</td>
          <td>${s.length}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <script>
      (function(){
        const subs = ${JSON.stringify(subs || [])};
        const lastMap = JSON.parse(localStorage.getItem('ca_last_code') || '{}');
        const detail = document.getElementById('submissionDetail');
        const rows = document.querySelectorAll('[data-sub-id]');
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
            '<p class="status ' + (best?.verdict==='AC' ? 'ac' : (best?.verdict==='WA' ? 'wa' : 'pd')) + '">' + esc(best?.verdictText || sub.verdictText) + (best && best.id!==sub.id ? ' (poslednji sačuvani kod)' : '') + '</p>' +
            '<pre style="white-space:pre-wrap">' + code + '</pre>' +
            '</div>';
        }
        rows.forEach(a=>{
          a.addEventListener('click', ()=>{
            const id = a.getAttribute('data-sub-id');
            const found = subs.find(x=>x.id===id);
            render(found);
          });
        });
      })();
    </script>
  </section>`;
}

function cls(v){
  if(v==='AC') return 'ac';
  if(v==='WA'||v==='RE') return 'wa';
  return 'pd';
}


