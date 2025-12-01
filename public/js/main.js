import { initRouter, navigate } from './router.js';
import { Navbar } from './components/navbar.js';
import { ensureSeed } from './storage.js';
import { ensureAdminAccountPrompt } from './adminSetup.js';
import './googleAuth.js';

const diagLog = [];
function diag(msg){
  const line = `[diag] ${msg}`;
  diagLog.push(line);
  console.log(line);
  try{ localStorage.setItem('ca_diag_log', diagLog.join('\n')); }catch(_){}
  window.__diagLog = diagLog;
}

diag('main.js loaded');

async function bootstrap(){
  diag('bootstrap start');
  const seedPromise = ensureSeed()
    .then(()=>diag('ensureSeed ok'))
    .catch(err=>{
      console.error('Greska pri inicijalizaciji podataka', err);
      diag('ensureSeed error: '+(err?.message||err));
    });
  // Nemoj blokirati ceo render ako se Firestore uspori
  await Promise.race([
    seedPromise,
    delay(4000).then(()=>diag('ensureSeed timeout (nastavljamo render bez cekanja)')),
  ]);

  // Pusti UI da krene, ali prompt za admina tek kad seed završi ili propadne
  seedPromise.then(()=>ensureAdminAccountPrompt()).catch(()=>ensureAdminAccountPrompt());

  const navbarEl = document.getElementById('navbar');
  const view = document.getElementById('view');
  if(!navbarEl || !view){
    console.error("Elementi #navbar ili #view nisu pronadjeni u DOM-u.");
    diag('#navbar ili #view nije nadjen');
    return;
  }
  Navbar(navbarEl);
  diag('Navbar renderovan');
  initRouter();
  diag('Router init');
  window.nav = navigate;

  setTimeout(()=>{
    if(!view.innerHTML || view.innerHTML.trim()===''){
      diag('view je prazan 1500ms nakon initRouter');
    }else{
      diag('view popunjen');
    }
  },1500);
}

function delay(ms){ return new Promise(res=>setTimeout(res, ms)); }

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', bootstrap, { once:true });
}else{
  bootstrap();
}
