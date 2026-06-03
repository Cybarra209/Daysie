const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const loading = document.getElementById('loading');
const select = document.getElementById('select');
const gameOver = document.getElementById('gameOver');
const endTitle = document.getElementById('endTitle');
const endText = document.getElementById('endText');
const prayBtn = document.getElementById('prayBtn');

const holyImg = new Image(); holyImg.src = 'assets/holy-man.png';
const mouthImg = new Image(); mouthImg.src = 'assets/mouth-open.png';

let W = 390, H = 844, dpr = 1;
let state = 'loading';
let hero = 'male';
let coins = 0;
let startTime = 0;
let last = 0;
let spawnTimer = 0;
let wave = 1;
let enemies = [];
let bullets = [];
let turrets = [];
let effects = [];
let spots = [];
let base, boss;
let path = [];
let prayFlash = 0;

function resize() {
  const wrap = document.getElementById('game-wrap');
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = wrap.clientWidth; H = wrap.clientHeight;
  canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  setupMap(false);
}
window.addEventListener('resize', resize);

function setupMap(reset=true) {
  path = [
    {x: W*0.75, y: H*0.13}, {x: W*0.75, y: H*0.25}, {x: W*0.25, y: H*0.25},
    {x: W*0.25, y: H*0.43}, {x: W*0.82, y: H*0.43}, {x: W*0.82, y: H*0.62},
    {x: W*0.32, y: H*0.62}, {x: W*0.32, y: H*0.78}
  ];
  boss = {x: W*0.75, y: H*0.07, r: Math.min(W,H)*0.105, hp: 850, maxHp: 850};
  base = base || {hp: 220, maxHp: 220};
  base.x = W*0.32; base.y = H*0.86; base.r = Math.min(W,H)*0.09;
  spots = [
    {x: W*0.50, y: H*0.20, cost: 5, built:false},
    {x: W*0.13, y: H*0.34, cost: 8, built:false},
    {x: W*0.53, y: H*0.36, cost: 12, built:false},
    {x: W*0.67, y: H*0.55, cost: 15, built:false},
    {x: W*0.15, y: H*0.70, cost: 20, built:false},
  ];
  if (!reset) {
    for (const t of turrets) {
      const s = spots[t.spotIndex]; if (s) { s.built = true; t.x = s.x; t.y = s.y; }
    }
  }
}

function newGame() {
  coins = 0; wave = 1; spawnTimer = 0; enemies = []; bullets = []; turrets = []; effects = [];
  base = {hp: 220, maxHp: 220};
  setupMap(true);
  startTime = performance.now(); last = startTime; state = 'playing';
  gameOver.classList.remove('show'); prayBtn.style.display = 'block';
  requestAnimationFrame(loop);
}

setTimeout(() => { loading.classList.remove('show'); select.classList.add('show'); state = 'select'; }, 1800);
document.getElementById('maleBtn').onclick = () => { hero = 'male'; select.classList.remove('show'); newGame(); };
document.getElementById('femaleBtn').onclick = () => { hero = 'female'; select.classList.remove('show'); newGame(); };
document.getElementById('restartBtn').onclick = () => { gameOver.classList.remove('show'); select.classList.add('show'); state = 'select'; };
prayBtn.onclick = () => pray();

canvas.addEventListener('pointerdown', e => {
  if (state !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  spots.forEach((s, i) => {
    if (!s.built && Math.hypot(x-s.x, y-s.y) < 38 && coins >= s.cost) {
      coins -= s.cost; s.built = true;
      turrets.push({x:s.x, y:s.y, spotIndex:i, range:115, cooldown:0, rate: i<2 ? .65 : .45, damage: i<2 ? 18 : 26});
      effects.push({x:s.x,y:s.y,t:.35,type:'build'});
    }
  });
});

function pray() {
  if (state !== 'playing' || coins < 10) return;
  coins -= 10;
  enemies.forEach(en => { coins += 1; boss.hp = Math.max(0, boss.hp - 3); });
  enemies = [];
  base.hp = base.maxHp;
  prayFlash = 1.8;
}

function spawnGroup() {
  for (let i=0;i<3;i++) {
    enemies.push({x:path[0].x+i*8-8, y:path[0].y-18*i, hp:38+wave*7, maxHp:38+wave*7, speed:34+wave*2, wp:1, r:12});
  }
  wave++;
}

function update(dt) {
  spawnTimer -= dt;
  if (spawnTimer <= 0) { spawnGroup(); spawnTimer = Math.max(2.2, 4.5 - wave*.08); }
  for (const en of enemies) {
    const target = path[en.wp];
    const dx = target.x-en.x, dy = target.y-en.y, dist = Math.hypot(dx,dy) || 1;
    en.x += dx/dist * en.speed * dt; en.y += dy/dist * en.speed * dt;
    if (dist < 8) en.wp++;
    if (en.wp >= path.length) { en.dead = true; base.hp -= 13; }
  }
  for (const t of turrets) {
    t.cooldown -= dt;
    if (t.cooldown <= 0) {
      const target = enemies.find(en => Math.hypot(en.x-t.x,en.y-t.y) < t.range);
      if (target) { bullets.push({x:t.x,y:t.y,target,damage:t.damage,speed:390}); t.cooldown = t.rate; }
    }
  }
  for (const b of bullets) {
    if (!b.target || b.target.dead) { b.dead = true; continue; }
    const dx=b.target.x-b.x, dy=b.target.y-b.y, dist=Math.hypot(dx,dy)||1;
    b.x += dx/dist*b.speed*dt; b.y += dy/dist*b.speed*dt;
    if (dist < 14) { b.target.hp -= b.damage; b.dead = true; effects.push({x:b.x,y:b.y,t:.2,type:'hit'}); }
  }
  for (const en of enemies) {
    if (en.hp <= 0 && !en.dead) { en.dead = true; coins += 1; boss.hp = Math.max(0, boss.hp - 5); effects.push({x:en.x,y:en.y,t:.3,type:'coin'}); }
  }
  enemies = enemies.filter(e => !e.dead);
  bullets = bullets.filter(b => !b.dead);
  effects.forEach(e=>e.t-=dt); effects = effects.filter(e=>e.t>0);
  if (prayFlash > 0) prayFlash -= dt;
  if (base.hp <= 0) end(false);
  if (boss.hp <= 0) end(true);
}

function end(win) {
  state = 'over'; prayBtn.style.display = 'none';
  const seconds = Math.floor((performance.now()-startTime)/1000);
  endTitle.textContent = win ? 'You defeated Daysie!' : 'Your base was destroyed!';
  endText.textContent = `Time: ${formatTime(seconds)} • Coins: ${coins}`;
  gameOver.classList.add('show');
}

function formatTime(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }

function drawPath() {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#b8884f'; ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y); path.forEach(p=>ctx.lineTo(p.x,p.y)); ctx.stroke();
  ctx.strokeStyle = '#e1bd78'; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y); path.forEach(p=>ctx.lineTo(p.x,p.y)); ctx.stroke();
}

function drawStick(x,y,scale,kind) {
  ctx.strokeStyle = kind==='female' ? '#ff6fb1' : '#4da3ff'; ctx.lineWidth = 3; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(x,y-18*scale,8*scale,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x,y-10*scale); ctx.lineTo(x,y+16*scale); ctx.moveTo(x,y); ctx.lineTo(x-15*scale,y+8*scale); ctx.moveTo(x,y); ctx.lineTo(x+15*scale,y+8*scale); ctx.moveTo(x,y+16*scale); ctx.lineTo(x-12*scale,y+34*scale); ctx.moveTo(x,y+16*scale); ctx.lineTo(x+12*scale,y+34*scale); ctx.stroke();
  if (kind==='female') { ctx.beginPath(); ctx.moveTo(x-9*scale,y-6*scale); ctx.lineTo(x+9*scale,y-6*scale); ctx.lineTo(x,y+12*scale); ctx.closePath(); ctx.stroke(); }
}

function drawHealth(x,y,w,h,hp,max) {
  ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(x-w/2,y,w,h);
  ctx.fillStyle= hp/max > .5 ? '#36e35d' : hp/max > .25 ? '#ffd33d' : '#ff3a3a'; ctx.fillRect(x-w/2,y,w*Math.max(0,hp/max),h);
  ctx.strokeStyle='white'; ctx.lineWidth=1; ctx.strokeRect(x-w/2,y,w,h);
}

function render() {
  ctx.clearRect(0,0,W,H);
  const grd = ctx.createLinearGradient(0,0,0,H); grd.addColorStop(0,'#6ab05b'); grd.addColorStop(1,'#2f6a35'); ctx.fillStyle = grd; ctx.fillRect(0,0,W,H);
  drawPath();
  // boss building
  ctx.save(); ctx.beginPath(); ctx.arc(boss.x,boss.y,boss.r,0,Math.PI*2); ctx.clip(); ctx.drawImage(mouthImg,boss.x-boss.r,boss.y-boss.r,boss.r*2,boss.r*2); ctx.restore();
  drawHealth(boss.x,boss.y-boss.r-16,120,10,boss.hp,boss.maxHp);
  ctx.fillStyle='white'; ctx.font='bold 12px Arial'; ctx.textAlign='center'; ctx.fillText('Daysie Base', boss.x, boss.y+boss.r+16);
  // base
  ctx.fillStyle='#76512e'; ctx.beginPath(); ctx.roundRect(base.x-base.r,base.y-base.r,base.r*2,base.r*1.6,12); ctx.fill();
  ctx.fillStyle='#422'; ctx.fillRect(base.x-base.r*.35,base.y,base.r*.7,base.r*.6);
  drawStick(base.x,base.y-8,0.85,hero); drawHealth(base.x,base.y-base.r-15,110,10,base.hp,base.maxHp);
  // spots
  spots.forEach((s,i)=>{
    ctx.fillStyle = s.built ? '#333' : coins>=s.cost ? '#ffd84a' : '#a14d35';
    ctx.beginPath(); ctx.arc(s.x,s.y,30,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='white'; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle='black'; ctx.font='bold 13px Arial'; ctx.textAlign='center'; ctx.fillText(s.built?'BUILT':`$${s.cost}`,s.x,s.y+4);
  });
  // turrets
  turrets.forEach(t=>{ ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(t.x,t.y,18,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#111'; ctx.fillRect(t.x-4,t.y-25,8,25); ctx.fillStyle='#00d4ff'; ctx.beginPath(); ctx.arc(t.x,t.y,7,0,Math.PI*2); ctx.fill(); });
  // enemies
  enemies.forEach(en=>{ ctx.fillStyle='#8326ff'; ctx.beginPath(); ctx.arc(en.x,en.y,en.r,0,Math.PI*2); ctx.fill(); ctx.fillStyle='white'; ctx.beginPath(); ctx.arc(en.x-4,en.y-3,2,0,Math.PI*2); ctx.arc(en.x+4,en.y-3,2,0,Math.PI*2); ctx.fill(); drawHealth(en.x,en.y-22,28,4,en.hp,en.maxHp); });
  bullets.forEach(b=>{ ctx.fillStyle='#ffee55'; ctx.beginPath(); ctx.arc(b.x,b.y,5,0,Math.PI*2); ctx.fill(); });
  effects.forEach(e=>{ ctx.globalAlpha=Math.max(0,e.t*3); ctx.fillStyle=e.type==='coin'?'gold':e.type==='build'?'cyan':'orange'; ctx.beginPath(); ctx.arc(e.x,e.y,22*(1-e.t),0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; });
  // holy prayer effect
  if (prayFlash > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, prayFlash);
    ctx.fillStyle='rgba(255,238,80,.25)'; ctx.fillRect(0,0,W,H);
    const imgW = W*.62, imgH = imgW*1.33;
    ctx.drawImage(holyImg, W/2-imgW/2, H/2-imgH/2, imgW, imgH);
    ctx.fillStyle='white'; ctx.font='bold 28px Arial'; ctx.textAlign='center'; ctx.fillText('PRAYER POWER!', W/2, H*.18);
    ctx.restore();
  }
  // UI
  ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,0,W,48);
  ctx.fillStyle='gold'; ctx.font='bold 21px Arial'; ctx.textAlign='left'; ctx.fillText(`Coins: ${coins}`, 10, 31);
  const seconds = Math.floor((performance.now()-startTime)/1000);
  ctx.fillStyle='white'; ctx.textAlign='center'; ctx.fillText(formatTime(seconds), W/2, 31);
  ctx.textAlign='right'; ctx.fillText(`Wave ${wave}`, W-10, 31);
  ctx.textAlign='left';
}

function loop(now) {
  if (state !== 'playing') return;
  const dt = Math.min(.05, (now-last)/1000); last = now;
  update(dt); render(); requestAnimationFrame(loop);
}

resize();
