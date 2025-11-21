import { db, currentUser } from '../storage.js';

export function ProblemView({ params }){
  const [id] = params;
  const p = db.problems().find(x=>x.id===id);
  if (!p) return `<div class="panel">Zadatak nije pronađen.</div>`;
  const me = currentUser();
  return `
  <section class="grid cols-2">
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h2>${p.id}. ${p.title}</h2>
        <div class="muted">Težina: ${p.difficulty}</div>
      </div>
      <div class="muted">Vremensko ograničenje: ${p.timeLimit} ms • Memorija: ${p.memoryLimit} MB</div>
      <div style="margin-top:.8rem">${p.statement}</div>
      <h3>Primeri</h3>
      ${p.samples.map(s=>`
        <div class="grid cols-2">
          <div><label>Ulaz</label><pre>${escapeHtml(s.input)}</pre></div>
          <div><label>Izlaz</label><pre>${escapeHtml(s.output)}</pre></div>
        </div>
      `).join('')}
    </div>

    <div class="panel">
      <h3>Predaja rešenja</h3>
      ${me ? `
      <p class="muted">Podržan je JavaScript sandbox. Definiši funkciju <code>solve(input)</code> koja vraća string izlaz.</p>
      <form id="submitForm">
        <div class="row">
          <label>Jezik</label>
          <select name="lang" required>
            <option value="js">JavaScript</option>
            <option disabled>Više jezika uskoro…</option>
          </select>
        </div>
        <div class="row">
          <label>Kod</label>
          <textarea name="source" rows="10" placeholder="function solve(input){\n  // ...\n  return outputString;\n}"></textarea>
        </div>
        <div class="row">
          <label></label>
          <button class="btn primary" type="submit">Pošalji</button>
        </div>
      </form>
      <div id="verdict"></div>
      `: `<p>Morate biti prijavljeni da biste predali rešenje. <a href="#/login">Prijava</a></p>`}
    </div>
  </section>

  <script>
    (function(){
      const form = document.getElementById('submitForm');
      if(!form) return;
      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        const verdictEl = document.getElementById('verdict');
        verdictEl.innerHTML = '<p class="status pd">Pending…</p>';
        await new Promise(r=>setTimeout(r,400));
        try{
          const runner = new Function('input', data.source + '\nreturn solve(input);');
          const samples = ${JSON.stringify(p.samples)};
          let allOk = true, wrongAt = -1, err = null;
          for(let i=0;i<samples.length;i++){
            const s = samples[i];
            let out;
            try{
              out = String(runner(String(s.input)));
            }catch(ex){ err = ex; allOk=false; break; }
            if(normalize(out)!==normalize(String(s.output))){ allOk=false; wrongAt=i; break; }
          }
          if(allOk){ saveSubmission('AC', 'Accepted'); verdictEl.innerHTML = '<p class="status ac">Accepted</p>'; }
          else if(err){ saveSubmission('RE','Runtime Error'); verdictEl.innerHTML = '<p class="status wa">Runtime Error</p><pre>'+String(err)+'</pre>'; }
          else{ saveSubmission('WA','Wrong Answer'); verdictEl.innerHTML = '<p class="status wa">Wrong Answer na primeru #'+(wrongAt+1)+'</p>'; }
        }catch(ex){ verdictEl.innerHTML = '<p class="status wa">Greška u sandbox-u</p>'; }

        function normalize(s){ return s.trim().replace(/\r\n/g,'\n'); }
        function saveSubmission(code, text){
          const store = JSON.parse(localStorage.getItem('ca_submissions')||'[]');
          store.unshift({ id: 'S'+Date.now(), problemId: '${p.id}', time: Date.now(), lang: data.lang, verdict: code, verdictText: text, length: (data.source||'').length, handle: ${JSON.stringify(me?.handle||'guest')} });
          localStorage.setItem('ca_submissions', JSON.stringify(store));
        }
      });
    })();
  </script>`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));
}

