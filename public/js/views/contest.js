import { db, currentUser } from '../storage.js';

export function ContestView({ params }){
  const [id] = params;
  const c = db.contests().find(x=>x.id===id);
  if(!c) return `<div class="panel">Takmičenje nije pronađeno.</div>`;
  const now = Date.now();
  const start = new Date(c.startTime).getTime();
  const end = start + c.durationMinutes*60000;
  const state = now < start ? 'upcoming' : now > end ? 'finished' : 'running';
  const problems = db.problems().filter(p=>c.problems.includes(p.id));
  const me = currentUser();
  const rank = computeRanklist(c);

  return `
  <section class="panel">
    <h2>${c.title}</h2>
    <p class="muted">Start: ${new Date(c.startTime).toLocaleString()} • Trajanje: ${c.durationMinutes} min • Status: <b>${state}</b></p>
    <h3>Zadaci</h3>
    <table class="table"><thead><tr><th>#</th><th>Naziv</th><th>Težina</th></tr></thead>
    <tbody>
      ${problems.map((p,i)=>`<tr><td>${String.fromCharCode(65+i)}</td><td><a href="#/problem/${p.id}">${p.title}</a></td><td>${p.difficulty}</td></tr>`).join('')}
    </tbody></table>
    ${state==='running' && me ? `<p><a class="btn primary" href="#/problem/${problems[0]?.id||''}">Počni rešavanje</a></p>`:''}
  </section>

  <section class="panel" style="margin-top:1rem">
    <h3>Rang lista (demo)</h3>
    <table class="table">
      <thead><tr><th>Poz</th><th>Takmičar</th><th>Prihvaćeno</th><th>Kazna</th></tr></thead>
      <tbody>
        ${rank.map((r,i)=>`<tr><td>${i+1}</td><td><a href="#/profile/${r.handle}">${r.handle}</a></td><td>${r.solved}</td><td>${r.penalty}</td></tr>`).join('')}
      </tbody>
    </table>
    <p class="muted">Napomena: Ovo je jednostavna simulacija rang liste zasnovana na lokalnim predajama tokom perioda takmičenja.</p>
  </section>`;
}

function computeRanklist(contest){
  const start = new Date(contest.startTime).getTime();
  const end = start + contest.durationMinutes*60000;
  const subs = (JSON.parse(localStorage.getItem('ca_submissions')||'[]'))
    .filter(s=> contest.problems.includes(s.problemId) && s.time>=start && s.time<=end);
  const byUser = new Map();
  for(const s of subs){
    if(!byUser.has(s.handle)) byUser.set(s.handle, { handle:s.handle, solved:0, penalty:0, ok:new Set(), wrong:{} });
    const u = byUser.get(s.handle);
    if(u.ok.has(s.problemId)) continue;
    if(s.verdict==='AC'){
      u.ok.add(s.problemId);
      u.solved = u.ok.size;
      const wrongTries = u.wrong[s.problemId]||0;
      const timePenalty = Math.floor((s.time-start)/60000);
      u.penalty += timePenalty + wrongTries*10;
    }else if(s.verdict==='WA'){
      u.wrong[s.problemId] = (u.wrong[s.problemId]||0)+1;
    }
  }
  return Array.from(byUser.values()).sort((a,b)=> b.solved-a.solved || a.penalty-b.penalty);
}


