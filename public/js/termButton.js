// Initializes terminal-style animated buttons inside a root element.
// Usage: initTermButtons(root)

export function initTermButtons(root = document) {
  const elements = Array.from(root.querySelectorAll('.term-btn'));
  elements.forEach(setupTermButton);
}

function setupTermButton(btn) {
  if (btn.__termInited) return; // idempotent
  btn.__termInited = true;

  const out = btn.querySelector('.output');
  const after = btn.querySelector('.subline');
  const cvs = btn.querySelector('canvas.bits') || createBitsCanvas(btn);
  const ctx = cvs.getContext('2d');

  const targetText = btn.dataset.text || (out?.textContent?.trim() || 'run');
  const afterText = btn.dataset.after || '';

  let typing = false, cancelToken = 0;

  function resetTyping() {
    btn.classList.remove('done','typing');
    if (out) out.textContent = '';
    if (after) after.textContent = '';
  }

  async function typeSequence() {
    if (typing) return;
    typing = true; btn.classList.add('typing');
    const myToken = ++cancelToken;

    resetTyping();
    await sleep(120); if (myToken !== cancelToken) return;

    for (let i=0; i<targetText.length; i++){
      if (out) out.textContent = targetText.slice(0, i+1);
      await sleep(rand(45, 85));
      if (myToken !== cancelToken) return;
      if (Math.random() < 0.08) await sleep(120);
    }

    await sleep(160);
    if (afterText && after){ after.textContent = afterText; btn.classList.add('done'); }
    await sleep(700);
    btn.classList.remove('typing');
    typing = false;
  }

  btn.addEventListener('mouseenter', typeSequence);

  // Bits (0/1) animation per button
  let W=0, H=0, DPR=1;
  const bits = [];
  const MAX_BITS = 160;
  const BITS_PER_CLICK = 30;

  function resize(){
    W = btn.clientWidth; H = btn.clientHeight;
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    cvs.width  = Math.floor(W * DPR);
    cvs.height = Math.floor(H * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }
  resize();
  window.addEventListener('resize', resize);

  function spawnBits(cx, cy){
    for(let i=0; i<BITS_PER_CLICK; i++){
      if(bits.length > MAX_BITS) bits.shift();
      const ang = Math.random()*Math.PI*2;
      const spd = 40 + Math.random()*110; // px/s
      bits.push({
        ch: (Math.random()<0.5 ? '0' : '1'),
        x: cx + Math.cos(ang)*6,
        y: cy + Math.sin(ang)*6,
        vx: Math.cos(ang)*spd,
        vy: Math.sin(ang)*spd,
        life: 900 + Math.random()*900,
        age: 0,
        size: 12 + Math.random()*8,
        wobA: 6 + Math.random()*7,
        wobF: 3 + Math.random()*4,
        phase: Math.random()*Math.PI*2
      });
    }
  }

  let last = 0;
  function loop(t){
    const dt = last ? Math.min(0.05, (t-last)/1000) : 0;
    last = t;

    ctx.clearRect(0,0,W,H);

    for(let i=bits.length-1; i>=0; i--){
      const b = bits[i];
      b.age += dt*1000;
      if(b.age >= b.life){ bits.splice(i,1); continue; }

      const tt = b.age/1000;
      const wob = Math.sin(tt*b.wobF + b.phase) * b.wobA;

      b.x += (b.vx*dt) + (-b.vy/100)*wob*dt;
      b.y += (b.vy*dt) + ( b.vx/100)*wob*dt;

      if(b.x<10){ b.x=10; b.vx*=-0.6; }
      if(b.x>W-10){ b.x=W-10; b.vx*=-0.6; }
      if(b.y<10){ b.y=10; b.vy*=-0.6; }
      if(b.y>H-10){ b.y=H-10; b.vy*=-0.6; }

      const alpha = 1 - (b.age/b.life);

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.font = `700 ${b.size.toFixed(0)}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.shadowColor = 'rgba(168,255,96,0.35)';
      ctx.shadowBlur  = 6;
      ctx.fillStyle = 'rgba(168,255,96,0.95)';
      ctx.fillText(b.ch, b.x, b.y);
      ctx.restore();
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  let navTimer = null;
  btn.addEventListener('click', (e)=>{
    const r = btn.getBoundingClientRect();
    const x = (e.clientX - r.left);
    const y = (e.clientY - r.top );
    spawnBits(x,y);

    cancelToken++; typing=false; typeSequence();

    const isAnchor = btn.tagName === 'A';
    const href = isAnchor ? btn.getAttribute('href') : (btn.getAttribute('data-nav') || null);
    const isHashNav = href && href.startsWith('#');
    if (isHashNav){
      e.preventDefault();
      e.stopPropagation();
      if (navTimer) { clearTimeout(navTimer); navTimer = null; }
      navTimer = setTimeout(()=>{
        if (location.hash !== href) location.hash = href;
      }, 1000); // 1s delay to let animation play
    }
  }, true); // capture to beat other listeners (e.g., router data-nav)
}

function createBitsCanvas(btn){
  const c = document.createElement('canvas');
  c.className = 'bits';
  btn.insertBefore(c, btn.firstChild);
  return c;
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function rand(a,b){ return Math.random()*(b-a)+a; }

