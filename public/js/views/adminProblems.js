import { db } from '../storage.js';

export function AdminProblemsView(){
  const me = db.session();
  const users = db.users();
  const user = me ? users.find(u=>u.handle===me.handle) : null;
  if(!user?.isAdmin){
    return `<div class="panel">Ova stranica je dostupna samo administratorima.</div>`;
  }
  const problems = db.problems();
  return `
  <section class="panel">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
      <h2>Zadaci (admin)</h2>
      <button class="btn primary" id="newProblem">Novi zadatak</button>
    </div>
    <div style="overflow:auto;margin-top:.5rem">
      <table class="table" id="problemsTable">
        <thead><tr><th>Sifra</th><th>Naziv</th><th>Tezina</th><th>Tagovi</th><th>Akcije</th></tr></thead>
        <tbody>
          ${problems.map(p=>`<tr>
            <td>${p.id}</td>
            <td>${p.title}</td>
            <td>${p.difficulty||''}</td>
            <td class="muted">${(p.tags||[]).join(', ')}</td>
            <td style="display:flex;gap:.4rem;flex-wrap:wrap">
              <button class="btn" data-edit-problem="${p.id}">Izmeni</button>
              <button class="btn warn" data-delete-problem="${p.id}">Obrisi</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>
  <section class="panel" id="problemFormWrap" style="margin-top:1rem;display:none">
    <h3 id="formTitle">Novi zadatak</h3>
    <form id="problemForm" style="display:grid;gap:.8rem">
      <div class="row"><label>Sifra</label><input name="id" required pattern="[A-Za-z0-9_\\-]{2,20}" /></div>
      <div class="row"><label>Naziv</label><input name="title" required /></div>
      <div class="row"><label>Tezina</label><input name="difficulty" type="number" min="200" step="100" value="800" required /></div>
      <div class="row"><label>Tagovi (zarez)</label><input name="tags" placeholder="npr. dp, graf" /></div>
      <div class="row"><label>Vreme (ms)</label><input name="timeLimit" type="number" min="100" step="100" value="1000" /></div>
      <div class="row"><label>Memorija (MB)</label><input name="memoryLimit" type="number" min="16" step="16" value="256" /></div>
      <div class="row"><label>Tekst zadatka</label><textarea name="statement" rows="8" required placeholder="Opis zadatka..."></textarea></div>
      <div class="row"><label>Sample primeri</label>
        <div id="samplesWrap"></div>
        <button class="btn" type="button" id="addSample">Dodaj sample</button>
      </div>
      <div class="row"><label>Test primeri</label>
        <div id="testsWrap"></div>
        <button class="btn" type="button" id="addTest">Dodaj test</button>
      </div>
      <div class="row" style="display:flex;gap:.6rem">
        <button class="btn primary" type="submit">Sacuvaj</button>
        <button class="btn" type="button" id="cancelEdit">Otkazi</button>
      </div>
    </form>
  </section>
  <script>
    (function(){
      const state = { editingId:null };
      const formWrap = document.getElementById('problemFormWrap');
      const form = document.getElementById('problemForm');
      const titleEl = document.getElementById('formTitle');
      const addSampleBtn = document.getElementById('addSample');
      const samplesWrap = document.getElementById('samplesWrap');
      const addTestBtn = document.getElementById('addTest');
      const testsWrap = document.getElementById('testsWrap');
      const cancelBtn = document.getElementById('cancelEdit');
      const table = document.getElementById('problemsTable');
      function showForm(p){
        formWrap.style.display = 'block';
        titleEl.textContent = p ? 'Izmeni zadatak' : 'Novi zadatak';
        form.reset();
        samplesWrap.innerHTML = '';
        testsWrap.innerHTML = '';
        state.editingId = p ? p.id : null;
        if(p){
          form.id.value = p.id;
          form.id.disabled = true;
          form.title.value = p.title||'';
          form.difficulty.value = p.difficulty||800;
          form.tags.value = (p.tags||[]).join(', ');
          form.timeLimit.value = p.timeLimit||1000;
          form.memoryLimit.value = p.memoryLimit||256;
          form.statement.value = p.statement||'';
          (p.samples||[]).forEach(s=> addSample(s));
          (p.tests||[]).forEach(t=> addTest(t));
        }else{
          form.id.disabled = false;
          addSample();
          addTest();
        }
      }
      function addSample(prefill){
        const div = document.createElement('div');
        div.className = 'panel';
        div.style.margin = '.4rem 0';
        div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem"><strong>Sample</strong><button type="button" class="btn warn" data-remove>Obrisi</button></div>'
          + '<label>Ulaz<textarea name="sampleIn" rows="3" required></textarea></label>'
          + '<label>Izlaz<textarea name="sampleOut" rows="3" required></textarea></label>';
        div.querySelector('[data-remove]').addEventListener('click', ()=> div.remove());
        samplesWrap.appendChild(div);
        if(prefill){
          div.querySelector('[name=\"sampleIn\"]').value = prefill.input||'';
          div.querySelector('[name=\"sampleOut\"]').value = prefill.output||'';
        }
      }
      function addTest(prefill){
        const div = document.createElement('div');
        div.className = 'panel';
        div.style.margin = '.4rem 0';
        div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem"><strong>Test</strong><button type="button" class="btn warn" data-remove>Obrisi</button></div>'
          + '<label>ID testa<input name="testId" placeholder="npr. T1" required /></label>'
          + '<label>Ulaz<textarea name="testIn" rows="3" required></textarea></label>'
          + '<label>Izlaz<textarea name="testOut" rows="3" required></textarea></label>';
        div.querySelector('[data-remove]').addEventListener('click', ()=> div.remove());
        testsWrap.appendChild(div);
        if(prefill){
          div.querySelector('[name=\"testId\"]').value = prefill.id||'';
          div.querySelector('[name=\"testIn\"]').value = prefill.in||'';
          div.querySelector('[name=\"testOut\"]').value = prefill.out||'';
        }
      }
      addSampleBtn?.addEventListener('click', ()=> addSample());
      addTestBtn?.addEventListener('click', ()=> addTest());
      document.getElementById('newProblem')?.addEventListener('click', ()=> showForm(null));
      cancelBtn?.addEventListener('click', ()=>{
        formWrap.style.display = 'none';
        state.editingId = null;
      });
      table?.querySelectorAll('[data-edit-problem]')?.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const id = btn.getAttribute('data-edit-problem');
          const list = JSON.parse(localStorage.getItem('ca_problems')||'[]');
          const found = list.find(x=>x.id===id);
          if(!found){ alert('Zadatak nije pronadjen'); return; }
          showForm(found);
        });
      });
      table?.querySelectorAll('[data-delete-problem]')?.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const id = btn.getAttribute('data-delete-problem');
          if(!id) return;
          if(!window.confirm('Obrisi zadatak '+id+'?')) return;
          const list = JSON.parse(localStorage.getItem('ca_problems')||'[]').filter(p=>p.id!==id);
          localStorage.setItem('ca_problems', JSON.stringify(list));
          alert('Zadatak obrisan.');
          location.hash = '#/problemset';
        });
      });
      form?.addEventListener('submit',(e)=>{
        e.preventDefault();
        const data = new FormData(form);
        const id = (data.get('id')||'').trim();
        const title = (data.get('title')||'').trim();
        const diff = Number(data.get('difficulty'))||800;
        const tags = (data.get('tags')||'').split(',').map(t=>t.trim()).filter(Boolean);
        const timeLimit = Number(data.get('timeLimit'))||1000;
        const memoryLimit = Number(data.get('memoryLimit'))||256;
        const statement = (data.get('statement')||'').trim();
        const samples = [];
        samplesWrap.querySelectorAll('.panel').forEach(div=>{
          const input = (div.querySelector('[name=\"sampleIn\"]')?.value||'').trim();
          const output = (div.querySelector('[name=\"sampleOut\"]')?.value||'').trim();
          if(input && output) samples.push({ input, output });
        });
        const tests = [];
        testsWrap.querySelectorAll('.panel').forEach(div=>{
          const tid = (div.querySelector('[name=\"testId\"]')?.value||'').trim();
          const tin = (div.querySelector('[name=\"testIn\"]')?.value||'').trim();
          const tout = (div.querySelector('[name=\"testOut\"]')?.value||'').trim();
          if(tid && tin && tout) tests.push({ id: tid, in: tin, out: tout });
        });
        if(!id || !title || !statement){ alert('Popunite sifru, naziv i tekst zadatka.'); return; }
        if(!samples.length){ alert('Dodajte barem jedan sample.'); return; }
        if(!tests.length){ alert('Dodajte barem jedan test.'); return; }
        const list = JSON.parse(localStorage.getItem('ca_problems')||'[]');
        if(state.editingId){
          const idx = list.findIndex(p=>p.id===state.editingId);
          if(idx===-1){ alert('Zadatak vise ne postoji.'); return; }
          list[idx] = { ...list[idx], id: state.editingId, title, difficulty: diff, tags, timeLimit, memoryLimit, statement, samples, tests };
        }else{
          if(list.some(p=>p.id.toLowerCase()===id.toLowerCase())){ alert('Sifra je vec u upotrebi.'); return; }
          list.push({ id, title, difficulty: diff, tags, timeLimit, memoryLimit, statement, samples, tests });
        }
        localStorage.setItem('ca_problems', JSON.stringify(list));
        alert('Sacuvano.');
        location.hash = '#/problem/'+id;
      });
    })();
  </script>`;
}
