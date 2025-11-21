import { initRouter, navigate } from './router.js';
import { Navbar } from './components/navbar.js';
import { ensureSeed } from './storage.js';
import { ensureAdminAccountPrompt } from './adminSetup.js';
import './googleAuth.js';

async function bootstrap(){
  try{
    await ensureSeed();
  }catch(err){
    console.error('Greska pri inicijalizaciji podataka', err);
  }
  ensureAdminAccountPrompt();

  const navbarEl = document.getElementById('navbar');
  const view = document.getElementById('view');
  if(!navbarEl || !view){
    console.error("Elementi #navbar ili #view nisu pronadjeni u DOM-u.");
    return;
  }
  Navbar(navbarEl);
  initRouter();
  window.nav = navigate;
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', bootstrap, { once:true });
}else{
  bootstrap();
}
