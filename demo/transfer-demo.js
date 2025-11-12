// Simple standalone transfer animation demo
(function(){
  const demoCards = [
    {id:'node-0001abcd', name:'Node A', color:'#3b82f6'},
    {id:'node-0001abcd-ABCDEFGHIJKL', name:'Node B (long id)', color:'#10b981'},
    {id:'abcd1234', name:'Node C (short8)', color:'#f59e0b'},
    {id:'node-verylong-id-1234567890abcdef', name:'Node D (very long)', color:'#ef4444'}
  ];

  const cardsEl = document.getElementById('cards');
  const srcSel = document.getElementById('demo_src');
  const tgtSel = document.getElementById('demo_tgt');
  const startBtn = document.getElementById('demo_start');
  const statusEl = document.getElementById('demo_status');
  const logEl = document.getElementById('demo_log');

  function makeCard(c){
    const el = document.createElement('div');
    el.className = 'card';
    // attach full id as data attribute
    el.setAttribute('data-full-id', c.id);
    // use an id attribute that simulates node-card-<prefix>
    const idPrefix = c.id.substr(0, Math.min(12, c.id.length)).replace(/[^a-zA-Z0-9_-]/g,'');
    el.id = 'node-card-' + idPrefix;
    el.innerHTML = `<h5>${c.name}</h5><div class="id">${c.id}</div>`;

    const badge = document.createElement('div'); badge.className='owner-badge'; badge.textContent='未分配'; badge.style.background=c.color; el.appendChild(badge);

    const tbtn = document.createElement('button'); tbtn.className='transfer-btn'; tbtn.textContent='传输到...';
    tbtn.onclick = (ev)=>{
      ev.stopPropagation();
      // set selections
      srcSel.value = c.id; // select source
      // open prompt for target
      const tgt = prompt('输入目标节点 id (或选择下拉后点击 开始传输):', demoCards.map(d=>d.id).join('\n'));
      if (tgt) {
        tgtSel.value = tgt;
        startTransfer(c.id, tgt);
      }
    };
    el.appendChild(tbtn);
    return el;
  }

  // populate DOM and selects
  demoCards.forEach(c=>{
    const el = makeCard(c);
    cardsEl.appendChild(el);
    const o1 = document.createElement('option'); o1.value=c.id; o1.text=c.name + ' • ' + c.id; srcSel.appendChild(o1);
    const o2 = document.createElement('option'); o2.value=c.id; o2.text=c.name + ' • ' + c.id; tgtSel.appendChild(o2);
  });

  startBtn.onclick = ()=>{
    const s = srcSel.value; const t = tgtSel.value;
    if (!s || !t) { alert('请选择源和目标节点'); return; }
    if (s === t) { alert('源与目标相同'); return; }
    startTransfer(s,t);
  };

  function findNodeCardElement(nodeId){
    if (!nodeId) return null;
    // try data-full-id exact
    const byData = document.querySelector(`[data-full-id="${nodeId}"]`);
    if (byData) return byData;
    // try id prefix matches
    const s = String(nodeId);
    const candidates = [];
    candidates.push('node-card-' + s);
    if (s.length >= 12) candidates.push('node-card-' + s.substring(0,12));
    if (s.length >= 8) candidates.push('node-card-' + s.substring(0,8));
    for (const cid of candidates) { const el = document.getElementById(cid); if (el) return el; }
    // fallback: first element whose innerText contains a short8
    const short8 = s.substring(0, Math.min(8,s.length));
    const all = document.querySelectorAll('[id^="node-card-"]');
    for (const el of all) { try{ if (el.innerText && el.innerText.indexOf(short8)!==-1) return el }catch(e){} }
    return null;
  }

  async function startTransfer(srcNode, tgtNode){
    log(`开始传输: ${srcNode} -> ${tgtNode}`);
    statusEl.textContent = `正在传输...`;

    let srcEl = findNodeCardElement(srcNode);
    let tgtEl = findNodeCardElement(tgtNode);

    if (!srcEl) { alert('找不到源节点卡片: '+srcNode); return; }
    if (!tgtEl) { alert('找不到目标节点卡片: '+tgtNode); return; }

    // create fly dot
    const fly = document.createElement('div'); fly.className='transfer-dot'; document.body.appendChild(fly);

    const sRect = srcEl.getBoundingClientRect();
    const tRect = tgtEl.getBoundingClientRect();
    fly.style.left = (sRect.left + sRect.width/2) + 'px';
    fly.style.top = (sRect.top + sRect.height/2) + 'px';

    const steps = 60; const delay = 12;
    // progress UI
    const progressFill = document.getElementById('demo_progress_fill');
    const progressText = document.getElementById('demo_progress_text');
    function setProgress(p){
      const pct = Math.max(0, Math.min(100, Math.round(p)));
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressText) progressText.textContent = pct + '%';
    }
    setProgress(0);

    for (let i=1;i<=steps;i++){
      await new Promise(r=>setTimeout(r, delay));
      const t = i/steps;
      const nx = sRect.left + (tRect.left - sRect.left) * t + sRect.width/2;
      const ny = sRect.top + (tRect.top - sRect.top) * t + sRect.height/2;
      fly.style.left = nx + 'px'; fly.style.top = ny + 'px';
      setProgress(t * 100);
    }

    fly.remove();
    statusEl.textContent = `传输完成`;
    // flash target
    const color = tgtEl.querySelector('.owner-badge') ? tgtEl.querySelector('.owner-badge').style.background : '#3b82f6';
    tgtEl.style.transition = 'box-shadow 0.36s ease'; tgtEl.style.boxShadow = `0 0 14px ${color}`;
    setTimeout(()=>{ tgtEl.style.boxShadow=''; }, 700);

    log(`完成: ${srcNode} -> ${tgtNode}`);
    // scroll log
    logEl.scrollTop = logEl.scrollHeight;
  }

  function log(msg){ const d = new Date(); const li = document.createElement('div'); li.textContent = `${d.toLocaleTimeString()} ${msg}`; logEl.appendChild(li); }

})();
