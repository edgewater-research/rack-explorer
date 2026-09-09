/* Rack Explorer — SVG drawing engine. Each view returns an SVG string drawn on an engineering
   sheet: double frame, grid-free white paper, leader-line callouts, media colour code, title block. */
(function(){
const D = window.RE_DATA;
const fmt = (v,d) => window.RE_COMPUTE.fmt(v,d);
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const M = id => D.MEDIA[id] || D.MEDIA.backplane;
const dash = id => M(id).family === 'optical' ? 'stroke-dasharray="7 4"' : '';

/* ---------- primitives ---------- */
function rect(x,y,w,h,o={}){ return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx??0}" class="${o.cls||''}" ${o.style?`style="${o.style}"`:''} ${o.extra||''}/>`; }
function text(x,y,s,o={}){ return `<text x="${x}" y="${y}" class="${o.cls||'t-label'}" text-anchor="${o.anchor||'start'}" ${o.style?`style="${o.style}"`:''} ${o.extra||''}>${esc(s)}</text>`; }
function line(x1,y1,x2,y2,o={}){ return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${o.cls||''}" ${o.style?`style="${o.style}"`:''} ${o.extra||''}/>`; }
function path(d,o={}){ return `<path d="${d}" class="${o.cls||''}" ${o.style?`style="${o.style}"`:''} ${o.extra||''}/>`; }
function g(inner,o={}){ return `<g class="${o.cls||''}" ${o.sel?`data-sel="${o.sel}"`:''} ${o.extra||''}>${inner}</g>`; }
function hit(key, sel, inner, extraCls=''){ return g(inner, {cls:`hit ${extraCls} ${sel===key?'selected':''}`, sel:key}); }

/* A silicon package: rounded rect, pin-1 notch, name + two sub lines. */
function chip(x,y,w,h,name,sub1,sub2,fill,key,sel){
  const narrow = w < 70;
  if (narrow){ sub1=''; sub2=''; name = String(name).replace(/Trainium/,'Trn').replace(/Blackwell/,'B').replace(/\s.*$/,'').slice(0,7); }
  const inner = rect(x,y,w,h,{rx:narrow?4:6,cls:`${fill} ink sel-target`,style:'stroke-width:1.4'}) +
    rect(x+(narrow?5:8),y+(narrow?5:8),w-(narrow?10:16),h-(narrow?10:16),{rx:3,cls:'f-none rule2',style:'stroke-width:1'}) +
    path(`M${x+4} ${y+12} L${x+12} ${y+4}`,{cls:'ink2',style:'stroke-width:1.2'}) +
    text(x+w/2,y+h/2-(sub1?4:-5),name,{cls:'t-chip',anchor:'middle',style:narrow?'font-size:10px':''}) +
    (sub1?text(x+w/2,y+h/2+11,sub1,{cls:'t-chip-s',anchor:'middle'}):'') +
    (sub2?text(x+w/2,y+h/2+23,sub2,{cls:'t-chip-s',anchor:'middle'}):'');
  return key ? hit(key, sel, inner) : g(inner);
}
/* Small module / connector block coloured by category or media. */
function block(x,y,w,h,color,label,o={}){
  return rect(x,y,w,h,{rx:2,cls:'sel-target',style:`fill:${color};fill-opacity:${o.op??.9};stroke:${color};stroke-width:1`}) +
    (label?text(x+w/2,y+h/2+3.5,label,{cls:'t-tb',anchor:'middle',style:`fill:#fff;font-size:${o.fs||9}px;font-weight:600`}):'');
}
/* Leader-line callout: dot at (x1,y1), elbow to (x2,y2), label past the elbow. */
function callout(x1,y1,x2,y2,lines,color,anchor='start'){
  const dir = anchor==='end' ? -1 : 1;
  const tx = x2 + dir*6;
  let s = `<circle cx="${x1}" cy="${y1}" r="2.6" style="fill:${color}"/>` +
    path(`M${x1} ${y1} L${x2 - dir*14} ${y2} L${x2} ${y2}`,{cls:'leader',style:`stroke:${color}`});
  let arr = Array.isArray(lines)?lines.slice():[lines];
  const lim = anchor==='end' ? 34 : 40; if (arr[0] && arr[0].length > lim){ const cut = arr[0].lastIndexOf(' ', lim); if (cut > 12){ arr = [arr[0].slice(0,cut), arr[0].slice(cut+1), ...arr.slice(1)]; } }
  arr.forEach((l,i)=>{ s += text(tx, y2 + 4 + i*13 - (arr.length-1)*6.5, l, {cls:i?'t-small':'t-label', anchor, style:i?'':`fill:${color};font-weight:600`}); });
  return s;
}
/* Dimension bracket with a centred label (engineering-drawing style). */
function dimH(x1,x2,y,label){
  return line(x1,y,x2,y,{cls:'dim'}) + line(x1,y-5,x1,y+5,{cls:'dim'}) + line(x2,y-5,x2,y+5,{cls:'dim'}) +
    rect((x1+x2)/2-label.length*3.1-4,y-8,label.length*6.2+8,16,{cls:'f-sheet'}) + text((x1+x2)/2,y+4,label,{cls:'t-mono',anchor:'middle'});
}
function mediaLegend(x,y,ids,title='Interconnect media'){
  let s = text(x,y,title,{cls:'t-eyebrow'});
  [...new Set(ids)].forEach((id,i)=>{ const m=M(id); const yy=y+16+i*16;
    s += line(x,yy,x+26,yy,{style:`stroke:${m.color};stroke-width:3`, extra:dash(id)}) + text(x+34,yy+4,m.name,{cls:'t-small'}); });
  return s;
}
function titleBlock(W,H,ctx){
  const w=540,h=58,x=W-16-w,y=H-16-h;
  const c1=x, c2=x+150, c3=x+400;
  return g(
    rect(x,y,w,h,{cls:'f-sheet ink',style:'stroke-width:1.2'}) +
    line(c2,y,c2,y+h,{cls:'ink'}) + line(c3,y,c3,y+h,{cls:'ink'}) + line(c3,y+h/2,x+w,y+h/2,{cls:'ink'}) + line(c2,y+h/2,c3,y+h/2,{cls:'rule'}) +
    text(c1+8,y+16,'EDGEWATER RESEARCH',{cls:'t-eyebrow',style:'fill:var(--brand)'}) +
    text(c1+8,y+34,'Rack Explorer',{cls:'t-tb-b'}) + text(c1+8,y+49,'Interconnect drawing set',{cls:'t-tb'}) +
    text(c2+8,y+13,'DRAWING',{cls:'t-eyebrow'}) + text(c2+8,y+26,ctx.short||ctx.title,{cls:'t-tb-b'}) +
    text(c2+8,y+41,'ARCHITECTURE',{cls:'t-eyebrow'}) + text(c2+8,y+53,ctx.arch,{cls:'t-tb'}) +
    text(c3+8,y+13,'SHEET',{cls:'t-eyebrow'}) + text(x+w-8,y+24,ctx.sheet,{cls:'t-tb-b',anchor:'end'}) +
    text(c3+8,y+41,'REV · CONF',{cls:'t-eyebrow'}) + text(x+w-8,y+53,`${ctx.rev} · ${ctx.conf}`,{cls:'t-tb',anchor:'end'})
  );
}
function sheet(W,H,ctx,inner){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(ctx.title)}">
  <defs>
    <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" style="stroke:var(--ink-3);stroke-width:.8;opacity:.6"/></pattern>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:var(--ink-2)"/></marker>
  </defs>
  ${rect(.5,.5,W-1,H-1,{cls:'f-sheet ink',style:'stroke-width:1.2'})}
  ${rect(16,16,W-32,H-32,{cls:'f-none rule',style:'stroke-width:1'})}
  ${text(28,44,ctx.title,{cls:'t-title'})}
  ${text(28,62,ctx.sub,{cls:'t-sub'})}
  ${inner}
  ${titleBlock(W,H,ctx)}
</svg>`;
}
function ctxFor(build, view, i, n){
  const titles = {board:'Compute board — component & connector map', tray:'Compute and switch trays — plan view', rack:'Rack elevation — scale-up spine and scale-out exits', scaleup:'Scale-up fabric — topology and link budget', scaleout:'Scale-out network — NICs, optics and leaf layer'};
  const shorts = {board:'Board component map', tray:'Tray plan view', rack:'Rack elevation', scaleup:'Scale-up fabric', scaleout:'Scale-out network'};
  return { title: titles[view], short: shorts[view], sub:'', arch: build.name, sheet:`${i} / ${n}`, rev: new Date().toISOString().slice(0,10), conf: build.conf || 'M' };
}
function xpuShort(b){ return b.blocks.xpu.name.replace(/\s*\(.*\)$/,''); }

/* =====================================================================
   1. BOARD
   ===================================================================== */
function renderBoard(b, o, sel){
  const bd = b.board, X = b.blocks.xpu, C = b.blocks.cpu, su = b.scaleup;
  const nx = Math.max(1, bd.xpus|0), nc = bd.cpus|0, nm = nc ? (bd.mem_per_cpu|0) : 0;
  const chipW = nx > 4 ? 96 : 130, chipH = chipW, gap = nx > 4 ? 18 : 30;
  const rowW = nx*chipW + (nx-1)*gap;
  const cpuW = 150, memW = 64, memGap = 10;
  const cpuRowW = nc ? nc*cpuW + nm*(memW+memGap) + (nc-1)*40 : 0;
  const bw = Math.max(560, Math.max(rowW, cpuRowW) + 140), bh = 470;
  const W = Math.max(1300, bw + 780), H = 780;
  const bx = Math.round((W - bw)/2), by = 120;
  const ctx = ctxFor(b,'board',1,5); ctx.title = `${bd.name} — component & connector map`;
  ctx.sub = `${nx} × ${X.name}${nc?` · ${nc} × ${C.name}`:''}${nm?` · ${nm*nc} × ${bd.mem_type}`:''} · ${b.rack.boards_per_tray} board(s) per compute tray · ${o.n.boards} per rack`;
  let s = '';
  // board
  s += hit('board', sel, rect(bx,by,bw,bh,{rx:14,cls:'f-tray ink sel-target',style:'stroke-width:1.6'}) + rect(bx+10,by+10,bw-20,bh-20,{rx:9,cls:'f-none rule'}));
  [[bx+18,by+18],[bx+bw-18,by+18],[bx+18,by+bh-18],[bx+bw-18,by+bh-18]].forEach(([x,y])=>{ s += `<circle cx="${x}" cy="${y}" r="4" class="f-sheet ink2" style="stroke-width:1"/>`; });
  // XPU row + scale-up connectors on top edge
  const rx0 = bx + (bw-rowW)/2, ry = by + 62;
  const suColor = M(su.media_xpu_sw).color;
  for (let i=0;i<nx;i++){
    const x = rx0 + i*(chipW+gap);
    s += chip(x, ry, chipW, chipH, xpuShort(b), `${X.hbm_gb} GB HBM · ${X.hbm_tbs} TB/s`, `${fmt(o.link.xpu_tbs_bidir,2)} TB/s ${su.name}`, 'f-xpu', 'xpu', sel);
    // connector on top edge
    const cw = Math.min(110, chipW-10);
    s += hit('seg:'+(o.segments[0]?.id||'xpu_sw'), sel, block(x+(chipW-cw)/2, by-9, cw, 18, suColor, `${su.name}`) );
    // trace bundle from chip to connector
    for (let k=0;k<3;k++) s += line(x+chipW/2-8+k*8, ry, x+chipW/2-8+k*8, by+9, {style:`stroke:${suColor};stroke-width:1;opacity:.7`});
  }
  // callout for scale-up connector
  const seg0 = o.segments[0];
  s += callout(rx0+rowW-8, by-9, rx0+rowW+40, by-48, [`${su.name} connector × ${nx}`, `${su.links_per_xpu} links × ${su.lanes_per_link} lanes × ${su.lane_gbps}G per ${xpuShort(b)}`, `${M(su.media_xpu_sw).name}`], suColor);
  s += dimH(rx0, rx0+rowW, ry+chipH+14, `${nx} × ${xpuShort(b)}  ·  ${fmt(o.link.xpu_lanes*nx)} SerDes lanes / direction`);
  // CPU row
  const cy = ry + chipH + 42;
  if (nc){
    let cx = bx + (bw-cpuRowW)/2;
    for (let c=0;c<nc;c++){
      const left = Math.floor(nm/2), right = nm-left;
      for (let m=0;m<left;m++){ s += hit('mem',sel, rect(cx,cy,memW,118,{rx:5,cls:'f-mem ink sel-target'}) + rect(cx+6,cy+6,memW-12,106,{cls:'hatch rule2'}) + text(cx+memW/2,cy+64,bd.mem_type,{cls:'t-chip-s',anchor:'middle',extra:`transform="rotate(-90 ${cx+memW/2} ${cy+64})"`})); cx += memW+memGap; }
      s += chip(cx, cy, cpuW, 118, C.name, C.cores?`${C.cores} cores`:'', C.mem, 'f-cpu', 'cpu', sel); cx += cpuW + memGap;
      for (let m=0;m<right;m++){ s += hit('mem',sel, rect(cx,cy,memW,118,{rx:5,cls:'f-mem ink sel-target'}) + rect(cx+6,cy+6,memW-12,106,{cls:'hatch rule2'}) + text(cx+memW/2,cy+64,bd.mem_type,{cls:'t-chip-s',anchor:'middle',extra:`transform="rotate(-90 ${cx+memW/2} ${cy+64})"`})); cx += memW+memGap; }
      cx += 30;
    }
    // C2C traces CPU↔GPU
    s += text(bx+bw/2, cy+140, `${X.c2c !== '—' ? X.c2c : 'PCIe host link'} · ${C.c2c}`, {cls:'t-small',anchor:'middle'});
  } else if (b.rack.switch_chips_per_compute_tray){
    const k = b.rack.switch_chips_per_compute_tray, sw = b.blocks.sw, swW=150;
    let cx = bx + (bw - (k*swW + (k-1)*30))/2;
    for (let i=0;i<k;i++){ s += chip(cx, cy, swW, 100, sw.name.split(' (')[0], `${sw.ports} ports · ${fmt(o.link.link_gbps_dir)}G`, `${fmt(sw.tbs_bidir,1)} TB/s`, 'f-sw', 'sw', sel); cx += swW+30; }
    s += text(bx+bw/2, cy+124, `${su.name} on baseboard PCB · ${fmt(o.topo.links_per_xpu_per_switch,0)} links per ${xpuShort(b)} per switch`, {cls:'t-small',anchor:'middle'});
  } else {
    s += text(bx+bw/2, cy+60, `No host CPU on this board — ${su.name} ${D.TOPOLOGIES[su.topology].name.toLowerCase()}`, {cls:'t-small',anchor:'middle'});
  }
  // side/bottom connectors from list
  const conns = (bd.connectors||[]).map((c,i)=>({...c,i})).filter(c=>c.cat!=='scaleup');
  const L = conns.filter(c=>c.side==='left'), R = conns.filter(c=>c.side==='right'), Bt = conns.filter(c=>c.side==='bottom'), T = conns.filter(c=>c.side==='top');
  const place = (arr, side) => {
    const n = arr.length; if(!n) return;
    const span = bh - 80, step = Math.min(64, span/Math.max(1,n));
    arr.forEach((c,j)=>{
      const col = D.CONNECTOR_CATS[c.cat]?.color || '#888';
      const y = by + 50 + j*step + step/2 - 14;
      const x = side==='left' ? bx-8 : bx+bw-8;
      s += hit('conn:'+c.i, sel, block(x, y, 16, 28, col, ''));
      const lx = side==='left' ? bx-110 : bx+bw+110;
      s += callout(side==='left'?x:x+16, y+14, lx, y+14, c.n, col, side==='left'?'end':'start');
    });
  };
  place(L,'left'); place(R,'right');
  Bt.forEach((c,j)=>{ const col = D.CONNECTOR_CATS[c.cat]?.color||'#888'; const n=Bt.length; const x = bx + bw*(j+1)/(n+1) - 20;
    s += hit('conn:'+c.i, sel, block(x, by+bh-8, 40, 16, col, ''));
    s += callout(x+20, by+bh+8, x+20 + (j%2?40:-40), by+bh+46+(j%2?18:0), c.n, col, j%2?'start':'end'); });
  T.forEach((c,j)=>{ const col = D.CONNECTOR_CATS[c.cat]?.color||'#888'; const x = bx + 30 + j*90;
    s += hit('conn:'+c.i, sel, block(x, by-8, 40, 16, col, '')); s += callout(x, by-8, x-30, by-46, c.n, col, 'end'); });
  // legend
  let ly = H-16-58-16*Object.keys(D.CONNECTOR_CATS).length - 30;
  s += text(28, ly, 'Connector categories', {cls:'t-eyebrow'});
  Object.entries(D.CONNECTOR_CATS).forEach(([k,c],i)=>{ s += rect(28, ly+10+i*16, 14, 9, {style:`fill:${c.color}`}) + text(50, ly+18+i*16, c.name, {cls:'t-small'}); });
  s += text(28, H-30, 'Click any chip, connector or link to inspect and edit. Layout is schematic, not to scale.', {cls:'t-small'});
  return sheet(W,H,ctx,s);
}

/* =====================================================================
   2. TRAY — plan view with the data paths: rear scale-up connectors, boards, PCIe to front NICs
   ===================================================================== */
function renderTray(b, o, sel){
  const r=b.rack, su=b.scaleup, so=b.scaleout, bd=b.board, X=b.blocks.xpu, C=b.blocks.cpu, N=b.blocks.nic, P=b.blocks.dpu, SW=b.blocks.sw;
  const hasSw = r.switch_trays>0, W=1240, H = hasSw ? 960 : 760;
  const ctx = ctxFor(b,'tray',2,5);
  const nb=Math.max(1,r.boards_per_tray|0), xpb=Math.ceil(r.xpus_per_tray/nb), hostBoard = (bd.cpus|0)===0 && r.cpus_per_tray>0, cpb = hostBoard?0:Math.ceil(r.cpus_per_tray/nb);
  const nn=Math.round(r.xpus_per_tray*r.nics_per_xpu), cages = so.module_gbps?Math.ceil(nn*N.gbps/so.module_gbps):0, portsPerCage = cages?Math.max(1,Math.round(so.module_gbps/Math.max(1,N.gbps))):0;
  const dpuN=r.dpus_per_tray|0, drives=r.drives_per_tray??0, mgmt=r.mgmt_ports_per_tray??1, inSw=r.switch_chips_per_compute_tray|0;
  const suCol=M(su.media_xpu_sw).color, nicCol=M(so.nic_media).color, dpuCol=M(so.dpu_media).color, pcieCol=D.CONNECTOR_CATS.pcie.color, pwrCol=D.CONNECTOR_CATS.power.color, liqCol='#2F8F83', c2cCol=D.CONNECTOR_CATS.c2c.color;
  const liquid = /liquid/i.test(r.cooling);
  ctx.sub = `${r.compute_trays} compute trays × (${r.xpus_per_tray} ${xpuShort(b)} · ${r.cpus_per_tray} ${C.name} · ${nn} ${N.name})` + (hasSw?` · ${r.switch_trays} switch trays × ${r.switch_chips_per_tray} ${SW.name.split(' (')[0]}`:'') + ` · ${r.cooling}`;
  let s='';
  const tx=300, ty=110, tw=640, th=410;
  const L = (y, lines, color, from) => callout(from[0], from[1], tx-34, y, lines, color, 'end');       // left callout
  const Rt = (y, lines, color, from) => callout(from[0], from[1], tx+tw+34, y, lines, color, 'start'); // right callout

  /* ---------------- compute tray ---------------- */
  s += text(tx, ty-16, `COMPUTE TRAY · PLAN VIEW · ×${r.compute_trays} PER RACK · ${liquid?'DIRECT LIQUID COOLING':'AIR COOLED'}`, {cls:'t-eyebrow'});
  s += hit('tray:compute', sel, rect(tx,ty,tw,th,{rx:5,cls:'f-tray ink sel-target',style:'stroke-width:1.6'}));
  s += text(tx+tw+8, ty+14, 'REAR', {cls:'t-eyebrow'}) + text(tx+tw+8, ty+th-4, 'FRONT', {cls:'t-eyebrow'});
  // rear: power clip + liquid QDs
  s += rect(tx+tw-22, ty+8, 12, 64, {rx:2,style:`fill:${pwrCol};fill-opacity:.9`}) + text(tx+tw-16, ty+40, '48 V', {cls:'t-tb',anchor:'middle',style:'fill:#fff;font-weight:600;font-size:8px',extra:`transform="rotate(-90 ${tx+tw-16} ${ty+40})"`});
  if (liquid){ [0,1].forEach(i=>{ s += `<circle cx="${tx+14}" cy="${ty+18+i*18}" r="6" style="fill:${liqCol};fill-opacity:.9"/><circle cx="${tx+14}" cy="${ty+18+i*18}" r="2.5" class="f-sheet"/>`; });
    s += line(tx+14, ty+42, tx+14, ty+th-60, {style:`stroke:${liqCol};stroke-width:2;opacity:.5`}); }
  // geometry: boards, XPU grid (2 rows when more than 4 per board), rear connectors per column
  const areaX = tx+30, areaW = tw-60-(hostBoard?150:0)-10, boardGap=18, boardW=(areaW-(nb-1)*boardGap)/nb, bY=ty+56, bH=th-56-140;
  const rows = xpb>4 ? 2 : 1, cols = Math.ceil(xpb/rows), slot = boardW/cols;
  const cw = Math.min(96, slot-18); let ch = Math.round(cw*0.78); if (rows>1 && (cpb||inSw)) ch = Math.min(ch, 44);
  const xy = bY+26, rowY = xy + rows*(ch+12) + 6, rowH = Math.max(50, bY+bH-rowY-14);
  const conns=[], xpuPos=[];
  for (let i=0;i<nb;i++){ const bx=areaX+i*(boardW+boardGap);
    for (let c=0;c<cols;c++){ const cwid=Math.min(104, slot-14), cx=bx+(c+.5)*slot; conns.push({x:cx-cwid/2,w:cwid,cx}); }
    for (let k=0;k<xpb;k++){ const row=Math.floor(k/cols), col=k%cols, cx=bx+(col+.5)*slot, y=xy+row*(ch+12); xpuPos.push({x:cx, top:y, bot:y+ch, row, board:i, col}); } }
  const connFor = pp => conns[pp.board*cols+pp.col];
  const cageY=ty+th-24, fy=ty+th-96, cardH=34, zoneL=tx+24+(drives?Math.min(drives,8)*14+40:0)+(mgmt?34:0), zoneR=tx+tw-24-(dpuN?dpuN*62+16:0);
  const cardPos=[]; if (nn){ for (let j=0;j<nn;j++) cardPos.push(zoneL+(j+.5)*((zoneR-zoneL)/nn)); }
  const cardW = nn ? Math.min(72, (zoneR-zoneL)/nn-8) : 0;
  // CPU geometry per board
  const memN=Math.min(4, bd.mem_per_cpu|0), cpuW=104, memW=13, unit = cpuW + memN*(memW+4) + 26, cpuTotal = cpb*unit - 26;
  const cpuCx = (i,c) => areaX+i*(boardW+boardGap) + (boardW-cpuTotal)/2 + c*unit + Math.floor(memN/2)*(memW+4) + cpuW/2;
  // 1. rear connectors
  conns.forEach((cn,i)=>{ const perConn = su.links_per_xpu*rows; const lab = `${su.name.replace(/\s*\(.*\)/,'')} × ${perConn}`; s += hit('seg:'+(o.segments[0]?.id||'xpu_sw'), sel, rect(cn.x, ty+8, cn.w, 20, {rx:2,cls:'sel-target',style:`fill:${suCol};stroke:${suCol}`}) + (lab.length*6.2 < cn.w-8?text(cn.cx, ty+22, lab, {cls:'t-tb',anchor:'middle',style:'fill:#fff;font-weight:600'}):'')); });
  // 2. board outlines
  for (let i=0;i<nb;i++){ const bx=areaX+i*(boardW+boardGap); s += hit('board', sel, rect(bx,bY,boardW,bH,{rx:6,cls:'f-sheet ink2 sel-target',style:'stroke-width:1.1'}) + text(bx+10,bY+15,`${bd.name}${nb>1?' '+(i+1):''}`,{cls:'t-small'})); }
  if (hostBoard){ const hx=areaX+areaW+18, hw=tw-48-areaW-18; s += hit('board',sel,rect(hx,bY,hw,bH,{rx:6,cls:'f-sheet ink2 sel-target',style:'stroke-width:1.1'})+text(hx+10,bY+15,'Host board',{cls:'t-small'})); }
  // 3. wires (under the silicon): NVLink traces, C2C, PCIe
  xpuPos.forEach(pp=>{ const cn=connFor(pp); const n=4, span = pp.row===0 ? 18 : cw+8; for (let t=0;t<n;t++){ const fx = pp.x - span/2 + t*(span/(n-1)); s += line(fx, pp.top, fx, ty+28, {style:`stroke:${suCol};stroke-width:1.1;opacity:.75`}); } void cn; });
  if (cpb){ for (let i=0;i<nb;i++) for (let c=0;c<cpb;c++){ const cx=cpuCx(i,c); xpuPos.filter(pp=>pp.board===i).forEach(pp=>{ s += path(`M${cx} ${rowY} C ${cx} ${rowY-14}, ${pp.x} ${pp.bot+14}, ${pp.x} ${pp.bot}`, {cls:'f-none',style:`stroke:${c2cCol};stroke-width:1.2;opacity:.7`}); }); } }
  if (inSw){ for (let i=0;i<nb;i++){ const bx=areaX+i*(boardW+boardGap), per=Math.ceil(inSw/nb), swW=Math.min(150,(boardW-40)/per-20); let sx=bx+(boardW-(per*swW+(per-1)*20))/2; for (let j=0;j<per;j++){ xpuPos.filter(pp=>pp.board===i).forEach(pp=>{ s += path(`M${pp.x} ${pp.bot} C ${pp.x} ${pp.bot+14}, ${sx+swW/2} ${rowY-14}, ${sx+swW/2} ${rowY}`,{cls:'f-none',style:`stroke:${suCol};stroke-width:1;opacity:.5`}); }); sx+=swW+20; } } }
  if (nn){ xpuPos.forEach((pp,i)=>{ const j=Math.min(nn-1, Math.floor(i*nn/Math.max(1,xpuPos.length))); const cx=cardPos[j]; s += path(`M${pp.x} ${pp.bot} C ${pp.x} ${pp.bot+80}, ${cx} ${fy-60}, ${cx} ${fy}`, {cls:'f-none',style:`stroke:${pcieCol};stroke-width:1.4;opacity:.8`}); });
    if (r.nics_per_xpu>1){ for (let i=0;i<xpuPos.length;i++) for (let m=1;m<r.nics_per_xpu;m++){ const j=Math.min(nn-1, i*Math.round(r.nics_per_xpu)+m); s += path(`M${xpuPos[i].x} ${xpuPos[i].bot} C ${xpuPos[i].x} ${xpuPos[i].bot+80}, ${cardPos[j]} ${fy-60}, ${cardPos[j]} ${fy}`, {cls:'f-none',style:`stroke:${pcieCol};stroke-width:1.2;opacity:.5`}); } } }
  if (dpuN){ for (let i=0;i<dpuN;i++){ const dx=tx+tw-24-(dpuN-i)*62+8; const srcX = cpb ? cpuCx(nb-1, cpb-1) : (hostBoard ? areaX+areaW+18+(tw-48-areaW-18)/2 : xpuPos[xpuPos.length-1].x); const srcY = bY+bH; s += path(`M${srcX} ${srcY} C ${srcX} ${srcY+40}, ${dx+27} ${fy-40}, ${dx+27} ${fy}`, {cls:'f-none',style:`stroke:${pcieCol};stroke-width:1;opacity:.5;stroke-dasharray:4 3`}); } }
  // 4. silicon
  xpuPos.forEach(pp=>{ s += chip(pp.x-cw/2, pp.top, cw, ch, xpuShort(b), cw>=92?`${X.hbm_gb} GB · ${X.hbm_tbs} TB/s`:(cw>=76?`${X.hbm_gb} GB HBM`:''), '', 'f-xpu', 'xpu', sel); });
  for (let i=0;i<nb;i++){ const bx=areaX+i*(boardW+boardGap);
    if (cpb){ let cx0 = bx + (boardW-cpuTotal)/2;
      for (let c=0;c<cpb;c++){ const half=Math.floor(memN/2); let mx=cx0;
        for (let m=0;m<half;m++){ s += hit('mem',sel,rect(mx,rowY,memW,rowH,{rx:2,cls:'f-mem ink2 sel-target',style:'stroke-width:.7'})+rect(mx+2,rowY+4,memW-4,rowH-8,{cls:'hatch'})); mx+=memW+4; }
        s += chip(mx, rowY, cpuW, rowH, C.name.split(' ')[0], C.cores?`${C.cores} cores`:'', '', 'f-cpu', 'cpu', sel); mx += cpuW+4;
        for (let m=half;m<memN;m++){ s += hit('mem',sel,rect(mx,rowY,memW,rowH,{rx:2,cls:'f-mem ink2 sel-target',style:'stroke-width:.7'})+rect(mx+2,rowY+4,memW-4,rowH-8,{cls:'hatch'})); mx+=memW+4; }
        cx0 += unit; } }
    else if (inSw){ const per=Math.ceil(inSw/nb), swW=Math.min(150,(boardW-40)/per-20); let sx=bx+(boardW-(per*swW+(per-1)*20))/2; for (let j=0;j<per;j++){ s += chip(sx,rowY,swW,rowH,SW.name.split(' ')[0].replace('NVLink','NVSwitch'),`${SW.ports} ports`,'','f-sw','sw',sel); sx+=swW+20; } } }
  if (hostBoard){ const hx=areaX+areaW+18, hw=tw-48-areaW-18, n=r.cpus_per_tray, hh=Math.min(70,(bH-40)/n-10); for (let c=0;c<n;c++){ s += chip(hx+16, bY+26+c*(hh+10), hw-32, hh, C.name.split(' ')[0], C.cores?`${C.cores} cores`:'', '', 'f-cpu','cpu',sel); } }
  // 5. front zone: drives, BMC, NIC cards, cages, DPUs
  if (drives){ for (let i=0;i<Math.min(drives,8);i++){ s += hit('drives',sel,rect(tx+24+i*14, ty+th-46, 10, 34, {rx:1,cls:'f-mem ink2 sel-target',style:'stroke-width:.6'})); } s += text(tx+24, ty+th-52, `${drives} × E1.S`, {cls:'t-tb'}); }
  if (mgmt){ const mxp = tx+24+(drives?Math.min(drives,8)*14+14:0); s += hit('mgmt',sel,rect(mxp, ty+th-36, 22, 16, {rx:2,cls:'f-conn ink sel-target',style:'stroke-width:.8'})); s += text(mxp, ty+th-42, 'BMC', {cls:'t-tb'}); }
  if (nn){ cardPos.forEach(cx=>{ s += hit('nic',sel,rect(cx-cardW/2, fy, cardW, cardH, {rx:3,cls:'f-nic ink sel-target',style:'stroke-width:.9'}) + text(cx, fy+14, N.name.replace('ConnectX-','CX-').split(' ')[0], {cls:'t-tb-b',anchor:'middle',style:'font-size:11px'}) + text(cx, fy+27, `${N.gbps}G`, {cls:'t-tb',anchor:'middle'})); });
    for (let c=0;c<cages;c++){ const first=c*portsPerCage, last=Math.min(nn-1,first+portsPerCage-1); const cx=(cardPos[first]+cardPos[last])/2, cwid=Math.max(34, Math.min(70, cardPos[last]-cardPos[first]+40));
      s += hit('soseg:so_nic',sel, block(cx-cwid/2, cageY, cwid, 18, nicCol, `${so.module_gbps>=1000?so.module_gbps/1000+'T':so.module_gbps+'G'}${cwid>=64?' '+M(so.nic_media).short:''}`, {fs:8}));
      for (let j=first;j<=last;j++) s += line(cardPos[j], fy+cardH, cardPos[j], cageY, {style:`stroke:${nicCol};stroke-width:1.2`}); } }
  if (dpuN){ for (let i=0;i<dpuN;i++){ const dx=tx+tw-24-(dpuN-i)*62+8; s += hit('dpu',sel,rect(dx, fy, 54, cardH, {rx:3,cls:'f-dpu ink sel-target',style:'stroke-width:.9'}) + text(dx+27, fy+14, P.name.split(' ')[0].replace('BlueField-','BF-'), {cls:'t-tb-b',anchor:'middle',style:'font-size:11px'}) + text(dx+27, fy+27, `${P.gbps}G`, {cls:'t-tb',anchor:'middle'}));
      s += hit('soseg:so_dpu',sel, block(dx+7, cageY, 40, 18, dpuCol, `${P.gbps}G`, {fs:8, op:.8})) + line(dx+27, fy+cardH, dx+27, cageY, {style:`stroke:${dpuCol};stroke-width:1.2`}); } }

  // ---- callouts, left
  const c0=conns[0];
  s += L(ty+6, [`${r.xpus_per_tray*su.links_per_xpu} × ${su.name} links leave the rear`, `${su.links_per_xpu} per ${xpuShort(b)} · ${M(su.media_xpu_sw).name}`, `blind-mate, no cables in the tray`], suCol, [c0.x, ty+18]);
  if (liquid) s += L(ty+62, ['Liquid quick-disconnects', 'cold plates on every GPU and CPU'], liqCol, [tx+14, ty+36]);
  s += L(bY+40, [`${xpb} × ${X.name} per board`, `${nb} board${nb>1?'s':''} per tray · ${X.tdp_w} W each`], 'var(--brand)', [xpuPos[0].x-cw/2, xpuPos[0].top+20]);
  if (cpb) s += L(rowY+rowH/2, [`${r.cpus_per_tray} × ${C.name} per tray`, `${C.mem} · ${C.c2c}`], '#7A4FB5', [areaX+(boardW-cpuTotal)/2-2, rowY+rowH/2]);
  else if (hostBoard) s += Rt(ty+th-150, [`${r.cpus_per_tray} × ${C.name} on a host board`, `${C.mem} · accelerators attach over PCIe`], '#7A4FB5', [tx+tw-24-8, bY+bH-12]);
  if (nn) s += L(fy-26, [`PCIe ${N.pcie.split(' ')[0]} ${N.pcie.split(' ')[1]||''} GPU → NIC`, `one lane group per GPU: GPU-direct RDMA`], pcieCol, [cardPos[0]-cardW/2, fy+6]);
  if (drives) s += L(ty+th-14, [`${drives} × E1.S NVMe · BMC 1 GbE`, 'local storage and out-of-band management'], 'var(--ink-3)', [tx+24, ty+th-30]);
  // ---- callouts, right
  s += Rt(ty+48, ['48 V DC busbar clip', `≈ ${fmt((r.xpus_per_tray*X.tdp_w + r.cpus_per_tray*C.tdp_w + nn*N.tdp_w + dpuN*P.tdp_w)/1000,1)} kW silicon per tray`], pwrCol, [tx+tw-10, ty+40]);
  if (cages) s += Rt(cageY-8, [`${nn} × ${N.name} in ${cages} × ${so.module_gbps}G ${M(so.nic_media).short} cage${cages>1?'s':''}`, `${M(so.nic_media).name} · ${fmt(nn*N.gbps/1000,1)} Tb/s per tray`], nicCol, [tx+tw-24-(dpuN?dpuN*62+16:0)+2, cageY+9]);
  if (dpuN) s += Rt(fy-4, [`${dpuN} × ${P.name} ${P.gbps}G`, 'front-end / storage · PCIe from the host'], dpuCol, [tx+tw-24-8, fy+10]);
  // per-tray figures (right margin, between the callouts)
  const sx=tx+tw+40; let sy=ty+90;
  [['SCALE-UP OUT OF TRAY', `${fmt(r.xpus_per_tray*o.link.xpu_tbs_bidir,1)} TB/s · ${fmt(r.xpus_per_tray*o.link.xpu_lanes)} lanes/dir`],['SCALE-OUT OUT OF TRAY', `${fmt(nn*N.gbps/1000,1)} Tb/s · ${cages} cages`],['TRAY POWER (SILICON)', `${fmt((r.xpus_per_tray*X.tdp_w + r.cpus_per_tray*C.tdp_w + nn*N.tdp_w + dpuN*P.tdp_w)/1000,1)} kW`],['HBM PER TRAY', `${fmt(r.xpus_per_tray*X.hbm_gb/1000,2)} TB · ${fmt(r.xpus_per_tray*X.hbm_tbs)} TB/s`]].forEach(([k,v])=>{ s += text(sx,sy,k,{cls:'t-eyebrow'})+text(sx,sy+15,v,{cls:'t-label'}); sy+=38; });

  /* ---------------- switch tray ---------------- */
  if (hasSw){
    const sy0=ty+th+100, sh=240, k=r.switch_chips_per_tray, ports=SW.ports;
    s += text(tx, sy0-16, `SWITCH TRAY · PLAN VIEW · ×${r.switch_trays} PER RACK · ${k} × ${SW.name.toUpperCase()}`, {cls:'t-eyebrow'});
    s += hit('tray:switch', sel, rect(tx,sy0,tw,sh,{rx:5,cls:'f-tray ink sel-target',style:'stroke-width:1.6'}));
    s += text(tx+tw+8, sy0+14, 'REAR', {cls:'t-eyebrow'}) + text(tx+tw+8, sy0+sh-4, 'FRONT', {cls:'t-eyebrow'});
    s += rect(tx+tw-22, sy0+8, 12, 64, {rx:2,style:`fill:${pwrCol};fill-opacity:.9`}) + text(tx+tw-16, sy0+40, '48 V', {cls:'t-tb',anchor:'middle',style:'fill:#fff;font-weight:600;font-size:8px',extra:`transform="rotate(-90 ${tx+tw-16} ${sy0+40})"`});
    if (liquid){ [0,1].forEach(i=>{ s += `<circle cx="${tx+14}" cy="${sy0+18+i*18}" r="6" style="fill:${liqCol};fill-opacity:.9"/><circle cx="${tx+14}" cy="${sy0+18+i*18}" r="2.5" class="f-sheet"/>`; }); }
    const chipW=Math.min(220,(tw-200-(k-1)*50)/k), chipH=86, chipY=sy0+110; let cx=tx+(tw-(k*chipW+(k-1)*50))/2-10;
    for (let j=0;j<k;j++){
      const segW=Math.min(chipW+60, (tw-60)/k-30), segX=cx+chipW/2-segW/2;
      s += hit('seg:'+(o.segments[0]?.id||'xpu_sw'), sel, rect(segX, sy0+8, segW, 20, {rx:2,cls:'sel-target',style:`fill:${suCol};stroke:${suCol}`}) + text(segX+segW/2, sy0+22, `${ports} × ${su.name} ports · blind-mate`, {cls:'t-tb',anchor:'middle',style:'fill:#fff;font-weight:600'}));
      // fan-in bundle from chip to connector
      s += `<polygon points="${cx+14},${chipY} ${cx+chipW-14},${chipY} ${segX+segW-8},${sy0+28} ${segX+8},${sy0+28}" style="fill:${suCol};fill-opacity:.16;stroke:${suCol};stroke-width:.8"/>`;
      for (let t=0;t<9;t++){ const f=(t+.5)/9; s += line(cx+14+f*(chipW-28), chipY, segX+8+f*(segW-16), sy0+28, {style:`stroke:${suCol};stroke-width:.8;opacity:.5`}); }
      s += text(cx+chipW/2, sy0+72, `${ports} ports × ${su.lanes_per_link} lanes × ${su.lane_gbps}G = ${fmt(SW.tbs_bidir,1)} TB/s`, {cls:'t-mono',anchor:'middle'});
      s += chip(cx, chipY, chipW, chipH, SW.name.split(' (')[0], `${ports} × ${fmt(o.link.link_gbps_dir)}G ports`, `${SW.tdp_w} W`, 'f-sw', 'sw', sel);
      cx += chipW+50;
    }
    if (mgmt){ s += hit('mgmt',sel,rect(tx+24, sy0+sh-36, 22, 16, {rx:2,cls:'f-conn ink sel-target',style:'stroke-width:.8'})); s += text(tx+24, sy0+sh-42, 'BMC', {cls:'t-tb'}); }
    s += text(tx+tw/2, sy0+sh-14, M(su.media_xpu_sw).family==='optical' ? `Optical scale-up: ${fmt(k*ports)} ports of ${M(su.media_xpu_sw).name} per tray.` : `No front-panel data ports: every ${su.name} port enters through the rear ${M(su.media_xpu_sw).name.toLowerCase()}.`, {cls:'t-small',anchor:'middle'});
    s += callout(tx+(tw-(k*chipW+(k-1)*50))/2+chipW/2-Math.min(chipW+60, tw/k-30)/2+10, sy0+18, tx-34, sy0+6, [`${fmt(k*ports)} ports per switch tray`, `${fmt(o.topo.ports_avail)} in rack for ${fmt(o.topo.links)} XPU links → ${fmt(o.topo.util*100,0)}% used`, `each ${xpuShort(b)} reaches every switch ASIC (${fmt(o.topo.links_per_xpu_per_switch,2)} link${o.topo.links_per_xpu_per_switch===1?'':'s'})`], suCol, 'end');
    s += callout(tx+(tw-(k*chipW+(k-1)*50))/2-10+8, chipY+10, tx-34, chipY-22, [`${SW.name}`, `${SW.serdes?SW.serdes+' × '+SW.serdes_gbps+'G SerDes · ':''}${fmt(SW.tbs_bidir,1)} TB/s bidir · ${SW.tdp_w} W`], '#B26A2B', 'end');
    const ssx=tx+tw+40; let ssy=sy0+60;
    [['PER SWITCH TRAY', `${fmt(k*SW.tbs_bidir,1)} TB/s · ${fmt(k*SW.tdp_w/1000,2)} kW`],['RACK SWITCHING', `${o.n.sw_chips} ASICs · ${fmt(o.n.sw_chips*SW.tbs_bidir,0)} TB/s`],['SPINE MEDIA', `${M(su.media_xpu_sw).name}`]].forEach(([kk,v])=>{ s += text(ssx,ssy,kk,{cls:'t-eyebrow'})+text(ssx,ssy+15,v,{cls:'t-label'}); ssy+=38; });
  } else {
    s += text(tx, ty+th+70, `No switch tray: ${D.TOPOLOGIES[su.topology].name}.`, {cls:'t-label'});
    s += text(tx, ty+th+88, D.TOPOLOGIES[su.topology].desc, {cls:'t-small'});
  }
  s += mediaLegend(28, H-16-58-16*4-40, [su.media_xpu_sw, so.nic_media, so.dpu_media].filter(Boolean));
  const lgY = H-16-58-16*4-40+16*4+20; s += text(28, lgY, 'Trace colours', {cls:'t-eyebrow'}) + line(28,lgY+14,54,lgY+14,{style:`stroke:${pcieCol};stroke-width:2`}) + text(62,lgY+18,'PCIe host / NIC path',{cls:'t-small'}) + line(28,lgY+30,54,lgY+30,{style:`stroke:${c2cCol};stroke-width:2`}) + text(62,lgY+34,'CPU ↔ GPU C2C',{cls:'t-small'});
  return sheet(W,H,ctx,s);
}

/* =====================================================================
   3. RACK
   ===================================================================== */
function trayU(b){ const r=b.rack; if (r.tray_u) return r.tray_u; const spare = r.rack_u - r.switch_trays - 6; return Math.max(1, Math.min(10, Math.floor(spare/Math.max(1,r.compute_trays)))); }
function renderRack(b, o, sel){
  const r=b.rack, su=b.scaleup, so=b.scaleout, N=b.blocks.nic, SW=b.blocks.sw, P=b.blocks.dpu;
  const W=1240, H=900, ctx=ctxFor(b,'rack',3,5);
  ctx.sub = `${o.n.xpus} × ${xpuShort(b)} · ${fmt(o.link.rack_tbs_bidir,0)} TB/s scale-up (${su.name}) · ${fmt(o.so.rack_tbs_dir,1)} Tb/s scale-out · ~${r.power_kw} kW · ${r.form}`;
  let s='';
  const U = Math.min(15, Math.floor(700/Math.max(24,r.rack_u)));
  const rx=470, ry=90, rw=300, rh=r.rack_u*U;
  s += hit('rack', sel, rect(rx,ry,rw,rh,{rx:3,cls:'f-rack ink sel-target',style:'stroke-width:1.8'}));
  // U scale
  for (let u=0;u<=r.rack_u;u+=(r.rack_u>40?6:4)){ const y=ry+rh-u*U; s += line(rx-6,y,rx,y,{cls:'ink2'}) + text(rx-10,y+3,`${u}U`,{cls:'t-mono',anchor:'end'}); }
  // layout: power shelves top & bottom, compute upper, switch middle, compute lower
  const tu = trayU(b), nPow = Math.max(2, Math.min(8, Math.ceil(r.power_kw/33)));
  const powTop = Math.ceil(nPow/2), powBot = nPow-powTop;
  const items=[]; let u=0;
  for (let i=0;i<powTop;i++) items.push({t:'pow',u:1});
  const upper = Math.ceil(r.compute_trays/2), lower = r.compute_trays-upper;
  for (let i=0;i<upper;i++) items.push({t:'c',u:tu,i});
  for (let i=0;i<r.switch_trays;i++) items.push({t:'s',u:1,i});
  for (let i=0;i<lower;i++) items.push({t:'c',u:tu,i:upper+i});
  for (let i=0;i<powBot;i++) items.push({t:'pow',u:1});
  const totalU = items.reduce((a,x)=>a+x.u,0);
  const scale = totalU > r.rack_u ? r.rack_u/totalU : 1;   // squeeze if the layout exceeds the rack
  let y = ry + 6;
  const suCol = M(su.media_xpu_sw).color, ttCol = M(su.media_tray_tray).color, extCol = M(su.media_ext||su.media_tray_tray).color, nicCol = M(so.nic_media).color;
  const compY=[], swY=[];
  items.forEach(it=>{
    const h = it.u*U*scale - 2;
    if (it.t==='pow'){ s += rect(rx+8,y,rw-16,h,{rx:1,cls:'f-pwr ink2',style:'stroke-width:.8'}); s += text(rx+rw/2,y+h/2+3,'PSU / power shelf',{cls:'t-tb',anchor:'middle'}); }
    else if (it.t==='c'){ compY.push(y+h/2);
      s += hit('tray:compute', sel, rect(rx+8,y,rw-16,h,{rx:1,cls:'f-tray ink sel-target',style:'stroke-width:.9'}) +
        // XPU ticks
        Array.from({length:Math.min(16,r.xpus_per_tray)},(_,k)=>rect(rx+16+k*((rw-40)/Math.min(16,r.xpus_per_tray)), y+2, (rw-40)/Math.min(16,r.xpus_per_tray)-3, Math.max(3,h-4), {rx:1,cls:'f-xpu ink2',style:'stroke-width:.5'})).join('') );
      // scale-out exits on the front (left)
      const modsPerTray = so.module_gbps ? Math.ceil(r.xpus_per_tray*r.nics_per_xpu*N.gbps/so.module_gbps) : 0;
      if (modsPerTray) s += line(rx+8, y+h/2, rx-70, y+h/2, {style:`stroke:${nicCol};stroke-width:${Math.min(4,1+modsPerTray/3)};opacity:.85`, extra:dash(so.nic_media)});
      // spine stubs on the rear (right)
      if (su.topology==='switched') s += line(rx+rw-8, y+h/2, rx+rw+40, y+h/2, {style:`stroke:${suCol};stroke-width:${Math.min(5,1+r.xpus_per_tray*su.links_per_xpu/40)}`, extra:dash(su.media_xpu_sw)});
    } else { swY.push(y+h/2);
      s += hit('tray:switch', sel, rect(rx+8,y,rw-16,h,{rx:1,cls:'f-sw ink sel-target',style:'stroke-width:.9'}) + text(rx+rw/2,y+h/2+3,`${r.switch_chips_per_tray} × ${SW.name.split(' (')[0]}`,{cls:'t-tb',anchor:'middle'}) );
      s += line(rx+rw-8, y+h/2, rx+rw+40, y+h/2, {style:`stroke:${suCol};stroke-width:${Math.min(6,1+r.switch_chips_per_tray*SW.ports/60)}`, extra:dash(su.media_xpu_sw)});
    }
    y += it.u*U*scale;
  });
  // ---- scale-up: spine (switched) or inter-tray links (torus / mesh)
  const seg0 = o.segments.find(x=>x.id==='xpu_sw');
  if (su.topology==='switched' && compY.length){
    const top = Math.min(...compY, ...swY), bot = Math.max(...compY, ...swY);
    s += hit('seg:xpu_sw', sel, rect(rx+rw+40, top-6, 14, bot-top+12, {rx:3,cls:'sel-target',style:`fill:${suCol};stroke:${suCol};fill-opacity:.85`}));
    s += callout(rx+rw+54, top+(bot-top)*0.66, rx+rw+140, top+(bot-top)*0.66-30, [`${su.name} spine — ${M(su.media_xpu_sw).short}`, `${M(su.media_xpu_sw).name}`, `${fmt(seg0.links)} links · ${fmt(seg0.lanes_total)} lanes/dir · ${fmt(seg0.pairs)} twinax pairs`, `${fmt(o.link.rack_tbs_bidir,0)} TB/s bidirectional · longest run ≈ ${seg0.need_m} m (reach ${seg0.reach_m} m)`, `${fmt(o.topo.ports_avail)} switch ports for ${fmt(o.topo.links)} XPU links → ${fmt(o.topo.util*100,0)}% used`], suCol);
  } else if (su.topology==='intray' || su.topology==='mesh'){
    compY.forEach(cy=>{ s += line(rx+rw-8, cy, rx+rw+30, cy, {style:`stroke:${suCol};stroke-width:3`}); s += path(`M${rx+rw+30} ${cy-8} L${rx+rw+30} ${cy+8}`,{style:`stroke:${suCol};stroke-width:3`}); });
    const segId = o.segments[0]?.id;
    s += callout(rx+rw+30, compY[Math.floor(compY.length/2)], rx+rw+120, compY[Math.floor(compY.length/2)]+40, [`${su.name} stays inside each tray (${M(su.media_xpu_sw).short})`, `${fmt(o.topo.links)} links total · scale-up domain = ${o.topo.domain} XPUs`, `nothing between trays except the scale-out network`], suCol);
    void segId;
  } else { // torus
    const segI = o.segments.find(x=>x.id==='inter'), segW = o.segments.find(x=>x.id==='wrap'), segA = o.segments.find(x=>x.id==='intra');
    for (let i=0;i<compY.length-1;i++){ s += path(`M${rx+rw-8} ${compY[i]} C ${rx+rw+40} ${compY[i]}, ${rx+rw+40} ${compY[i+1]}, ${rx+rw-8} ${compY[i+1]}`, {cls:'f-none', style:`stroke:${ttCol};stroke-width:2.2`, extra:dash(su.media_tray_tray)}); }
    if (segI) s += hit('seg:inter', sel, rect(rx+rw+2, compY[0]-4, 30, compY[compY.length-1]-compY[0]+8, {cls:'f-none sel-target',style:'stroke:transparent'}));
    if (segI) s += callout(rx+rw+28, (compY[0]+compY[compY.length-1])/2+40, rx+rw+120, (compY[0]+compY[compY.length-1])/2+20, [`Tray ↔ tray torus edges — ${M(su.media_tray_tray).short}`, `${M(su.media_tray_tray).name} · ${fmt(segI.links)} links · ${fmt(segI.lanes_total)} lanes/dir`, segA?`+ ${fmt(segA.links)} in-tray edges on ${M(segA.media).name.toLowerCase()}`:''], ttCol);
    if (segW){
      // wrap links exit to an OCS / next-rack box
      const ox = rx+rw+330, oy = ry+rh/2-50;
      s += hit('seg:wrap', sel, rect(ox, oy, 150, 100, {rx:4,cls:'f-sheet ink sel-target',style:'stroke-width:1.2'}) + text(ox+75, oy+42, SW.ports? SW.name.split(' (')[0] : 'Next rack', {cls:'t-chip',anchor:'middle'}) + text(ox+75, oy+60, `${fmt(segW.links)} wrap links`, {cls:'t-chip-s',anchor:'middle'}) + text(ox+75, oy+74, M(segW.media).name, {cls:'t-chip-s',anchor:'middle'}));
      [compY[0], compY[Math.floor(compY.length/2)], compY[compY.length-1]].forEach(cy=>{ s += path(`M${rx+rw-8} ${cy} C ${rx+rw+200} ${cy}, ${ox-60} ${oy+50}, ${ox} ${oy+50}`, {cls:'f-none',style:`stroke:${extCol};stroke-width:2`, extra:dash(segW.media)}); });
      s += callout(ox+75, oy, ox+75, oy-40, [`Wrap-around edges leave the rack`, `${fmt(segW.modules)} optical modules · ${fmt(segW.fibers)} fibers`], extCol, 'middle');
    }
  }
  // ---- scale-out: leaf switch stack on the left
  const S=o.so, lx=90, lw=200;
  const leafN = Math.max(1, S.leaf_switches||1), leafH = Math.min(40, 220/leafN), ly0 = ry+rh/2 - leafN*leafH/2 - 40;
  s += line(rx-70, compY[0]||ry+40, rx-70, compY[compY.length-1]||ry+rh-40, {style:`stroke:${nicCol};stroke-width:6;opacity:.75`, extra:dash(so.nic_media)});
  s += path(`M${rx-70} ${ry+rh/2} L${lx+lw} ${ry+rh/2}`, {style:`stroke:${nicCol};stroke-width:6;opacity:.75`, extra:dash(so.nic_media)+' marker-end="url(#arr)"'});
  s += hit('soseg:so_nic', sel, rect(rx-78, (compY[0]||ry)-10, 16, (compY[compY.length-1]||ry+rh)-(compY[0]||ry)+20, {cls:'f-none sel-target',style:'stroke:transparent'}));
  for (let i=0;i<leafN;i++){ s += hit('leaf', sel, rect(lx, ly0+i*leafH, lw, leafH-4, {rx:2,cls:'f-sw ink sel-target',style:'stroke-width:.9'}) + text(lx+lw/2, ly0+i*leafH+leafH/2+2, b.blocks.so_sw.name.split(' (')[0], {cls:'t-tb',anchor:'middle'})); }
  s += text(lx, ly0-10, `SCALE-OUT LEAF  ·  ${leafN} × ${b.blocks.so_sw.name.split(' (')[0]} (share)`, {cls:'t-eyebrow'});
  s += callout(rx-70, ry+rh/2+60, rx-110, ry+rh/2+110, [`${S.nics} × ${N.name} → ${fmt(S.modules_nic_side)} × ${so.module_gbps}G ${M(so.nic_media).short}`, `${fmt(S.rack_tbs_dir,1)} Tb/s per direction · ${fmt(S.per_xpu_gbps)} Gb/s per XPU`, `${M(so.nic_media).name}${M(so.nic_media).family==='optical'?` · ${fmt(o.so_segments[0]?.fibers||0)} fibers`:''}`], nicCol, 'end');
  if (o.n.dpus){ const dCol=M(so.dpu_media).color; s += path(`M${rx+8} ${ry+rh-30} L${lx+lw} ${ry+rh-30}`, {style:`stroke:${dCol};stroke-width:2;opacity:.8`, extra:dash(so.dpu_media)+' marker-end="url(#arr)"'});
    s += hit('soseg:so_dpu', sel, rect(lx, ry+rh-44, lw, 28, {rx:2,cls:'f-dpu ink sel-target',style:'stroke-width:.9'}) + text(lx+lw/2, ry+rh-26, `Front-end · ${o.n.dpus} × ${P.name}`, {cls:'t-tb',anchor:'middle'})); }
  // headline figures right
  const hx = W-16-24, hy = ry+10; const hv=(k,v,i)=>text(hx, hy+i*40, k, {cls:'t-eyebrow',anchor:'end'}) + text(hx, hy+i*40+18, v, {cls:'t-tb-b',anchor:'end',style:'font-size:16px'});
  s += hv('RACK', `${o.n.xpus} × ${xpuShort(b)} · ${o.n.cpus} CPU · ${r.rack_u}U`, 0) + hv('SCALE-UP', `${fmt(o.link.xpu_tbs_bidir,2)} TB/s per XPU · ${fmt(o.link.rack_tbs_bidir,0)} TB/s rack`, 1) + hv('SCALE-OUT', `${fmt(S.per_xpu_gbps)} Gb/s per XPU · ${fmt(S.rack_tbs_dir,1)} Tb/s rack`, 2) + hv('POWER', `${r.power_kw} kW stated · ${fmt(o.power.computed_rack_kw,0)} kW computed`, 3) + hv('INTERCONNECT POWER', `${fmt(o.power.interconnect_kw,1)} kW (${fmt(o.power.interconnect_share*100,0)}% of rack)`, 4);
  s += mediaLegend(28, ry+rh-16*5-10, [su.media_xpu_sw, su.media_tray_tray, su.media_ext, so.nic_media, so.dpu_media].filter(Boolean));
  return sheet(W,H,ctx,s);
}

/* =====================================================================
   4. SCALE-UP FABRIC
   ===================================================================== */
function renderScaleUp(b, o, sel, selXpu){
  const r=b.rack, su=b.scaleup, SW=b.blocks.sw, T=o.topo, W=1240, H=840, ctx=ctxFor(b,'scaleup',4,5);
  ctx.sub = `${T.name} · ${o.link.formula}`;
  let s='';
  const suCol = M(su.media_xpu_sw).color;
  const selIdx = Math.max(0, Math.min(o.n.xpus-1, selXpu|0));
  if (su.topology==='switched'){
    const trays=r.compute_trays, per=r.xpus_per_tray, blockRows=Math.min(trays,24), nBlocks=Math.ceil(trays/blockRows);
    const cell = Math.min(20, 560/blockRows), cw = cell-3;
    const gx0 = 60, gy0 = 120, blockW = per*cell + 40;
    const swN = o.n.sw_chips, swH = Math.min(26, 560/Math.max(1,swN)), swX = W-540, swY0 = gy0 + (560 - swN*swH)/2;
    const pos = [];
    for (let t=0;t<trays;t++){ const bI=Math.floor(t/blockRows), row=t%blockRows; for (let k=0;k<per;k++){ const idx=t*per+k; pos[idx]={x:gx0+bI*blockW+k*cell, y:gy0+row*cell}; } }
    // tray bundles (faint)
    for (let t=0;t<trays;t++){ const p=pos[t*per+per-1]; const bI=Math.floor(t/blockRows); if (bI!==nBlocks-1) continue; s += path(`M${p.x+cw+4} ${p.y+cw/2} C ${(p.x+swX)/2} ${p.y+cw/2}, ${(p.x+swX)/2} ${swY0+swN*swH/2}, ${swX} ${swY0+swN*swH/2}`, {cls:'f-none',style:`stroke:${suCol};stroke-width:1;opacity:.18`}); }
    // selected XPU links to each switch
    const p = pos[selIdx];
    const lpps = T.links_per_xpu_per_switch;
    for (let j=0;j<swN;j++){ const sy = swY0+j*swH+swH/2-2; s += path(`M${p.x+cw} ${p.y+cw/2} C ${p.x+cw+200} ${p.y+cw/2}, ${swX-200} ${sy}, ${swX} ${sy}`, {cls:'f-none',style:`stroke:${suCol};stroke-width:${Math.min(3,0.8+lpps)};opacity:.85`, extra:dash(su.media_xpu_sw)}); }
    // XPUs
    for (let i=0;i<o.n.xpus;i++){ const q=pos[i]; s += g(rect(q.x,q.y,cw,cw,{rx:2,cls:`f-xpu ink2 sel-target ${i===selIdx?'':''}`,style:`stroke-width:.6;${i===selIdx?'fill:var(--select);stroke:var(--select)':''}`}), {cls:'hit', sel:`xpuidx:${i}`}); }
    // tray labels
    for (let t=0;t<trays;t+= (trays>24?4:1)){ const q=pos[t*per]; s += text(q.x-6, q.y+cw/2+3, `T${t+1}`, {cls:'t-mono',anchor:'end',style:'font-size:9px'}); }
    s += text(gx0, gy0-14, `${o.n.xpus} × ${xpuShort(b)} in ${trays} trays`, {cls:'t-eyebrow'});
    // switches
    for (let j=0;j<swN;j++){ s += hit('sw', sel, rect(swX, swY0+j*swH, 150, swH-4, {rx:2,cls:'f-sw ink sel-target',style:'stroke-width:.8'}) + (swH>=14?text(swX+75, swY0+j*swH+swH/2+2, `${SW.name.split(' (')[0]} #${j+1} · ${SW.ports}p`, {cls:'t-tb',anchor:'middle'}):'')); }
    s += text(swX, gy0-14, `${swN} × ${SW.name} in ${r.switch_trays} trays`, {cls:'t-eyebrow'});
    // annotations
    const ax = swX+190, ay = gy0+10;
    const lines = [
      ['SELECTED XPU', `#${selIdx+1} in tray ${Math.floor(selIdx/per)+1} — click any XPU to move`],
      ['PER XPU', `${su.links_per_xpu} links → ${fmt(lpps,2)} per switch × ${swN} switches`],
      ['PER LINK', `${su.lanes_per_link} × ${su.lane_gbps}G = ${fmt(o.link.link_gbps_dir)} Gb/s per direction`],
      ['PER SWITCH', `${SW.ports} ports · ${fmt(SW.ports/ Math.max(1,per*trays),2)} per XPU · ${fmt(SW.tbs_bidir,1)} TB/s`],
      ['FABRIC', `${fmt(T.links)} links vs ${fmt(T.ports_avail)} ports → ${T.util<=1.0001?'non-blocking, one tier':'OVERSUBSCRIBED'}`],
      ['MEDIA', `${M(su.media_xpu_sw).name} · ${fmt(o.segments[0].pairs)} twinax pairs`],
      ['AGGREGATE', `${fmt(o.link.rack_tbs_bidir,0)} TB/s bidirectional across ${o.n.xpus} XPUs`],
    ];
    lines.forEach(([k,v],i)=>{ s += text(ax, ay+i*44, k, {cls:'t-eyebrow'}) + text(ax, ay+i*44+16, v, {cls:'t-label'}); });
    // utilisation bar
    const bx=ax, by=ay+lines.length*44+10; s += text(bx,by,'SWITCH PORT UTILISATION',{cls:'t-eyebrow'}) + rect(bx,by+8,200,10,{cls:'f-panel rule'}) + rect(bx,by+8,Math.min(200,200*T.util),10,{style:`fill:${T.util>1.0001?'var(--bad)':(T.util<.85?'var(--warn)':'var(--good)')}`}) + text(bx+208,by+17,`${fmt(T.util*100,0)}%`,{cls:'t-mono'});
  }
  else if (su.topology==='intray'){
    const per=r.xpus_per_tray, k=r.switch_chips_per_compute_tray, cw=76, gap=22, x0=(W-(per*cw+(per-1)*gap))/2, y0=160;
    for (let i=0;i<per;i++){ const x=x0+i*(cw+gap); s += g(chip(x,y0,cw,60,`${xpuShort(b)} ${i+1}`,'','','f-xpu',null,null),{cls:'hit',sel:`xpuidx:${i}`}); if (i===selIdx) s += rect(x-3,y0-3,cw+6,66,{rx:7,cls:'f-none',style:'stroke:var(--select);stroke-width:2'}); }
    const swW=180, sx0=(W-(k*swW+(k-1)*60))/2, sy=y0+260;
    for (let j=0;j<k;j++){ const sx=sx0+j*(swW+60); s += chip(sx,sy,swW,70,SW.name.split(' (')[0],`${SW.ports} ports`,`${fmt(SW.tbs_bidir,1)} TB/s`,'f-sw','sw',sel);
      for (let i=0;i<per;i++){ const x=x0+i*(cw+gap)+cw/2; const isSel = i===selIdx; s += path(`M${x} ${y0+60} C ${x} ${y0+160}, ${sx+swW/2} ${sy-100}, ${sx+swW/2} ${sy}`, {cls:'f-none',style:`stroke:${suCol};stroke-width:${isSel?2.5:1};opacity:${isSel?.95:.3}`}); }
      s += text(sx+swW/2, sy+92, `${fmt(T.links_per_xpu_per_switch,0)} links per XPU per switch · ${fmt(T.links_per_xpu_per_switch*o.link.link_gbps_dir)} Gb/s`, {cls:'t-small',anchor:'middle'}); }
    s += text(W/2, sy+150, `Scale-up domain = ${per} XPUs on one baseboard (${M(su.media_xpu_sw).name}). ${r.compute_trays} such domains per rack, joined only by the scale-out network.`, {cls:'t-label',anchor:'middle'});
    s += text(W/2, sy+170, `Per XPU: ${o.link.formula}`, {cls:'t-small',anchor:'middle'});
  }
  else if (su.topology==='mesh'){
    const k=r.xpus_per_tray, cx=W/2, cy=440, R=210;
    const P=[]; for (let i=0;i<k;i++){ const a=-Math.PI/2+i*2*Math.PI/k; P.push({x:cx+R*Math.cos(a), y:cy+R*Math.sin(a)}); }
    for (let i=0;i<k;i++) for (let j=i+1;j<k;j++){ const hot = i===selIdx||j===selIdx; s += line(P[i].x,P[i].y,P[j].x,P[j].y,{style:`stroke:${suCol};stroke-width:${hot?2.4:1};opacity:${hot?.95:.25}`}); }
    P.forEach((p,i)=>{ s += g(chip(p.x-38,p.y-24,76,48,`${xpuShort(b)} ${i+1}`,'','','f-xpu',null,null),{cls:'hit',sel:`xpuidx:${i}`}); if(i===selIdx) s+=rect(p.x-41,p.y-27,82,54,{rx:8,cls:'f-none',style:'stroke:var(--select);stroke-width:2'}); });
    s += text(W/2, cy+R+80, `Full mesh: each XPU has ${k-1} direct links (${fmt(o.link.link_gbps_dir)} Gb/s each) · ${fmt(T.links)} links per rack on ${M(su.media_xpu_sw).name}`, {cls:'t-label',anchor:'middle'});
    s += text(W/2, cy+R+100, `Per XPU: ${o.link.formula}`, {cls:'t-small',anchor:'middle'});
  }
  else { // torus
    const dims=T.dims, side=T.side, per=r.xpus_per_tray;
    const layers = dims===3 ? side : 1, sp = dims===3 ? Math.min(46, 900/(layers*side+layers)) : Math.min(60, 700/side);
    const layerW = side*sp, gapL = 40, totalW = layers*layerW + (layers-1)*gapL, x0=(W-totalW)/2, y0=200;
    const idx=(x,y,z)=> z*side*side + y*side + x;
    const P=(x,y,z)=>({x:x0+z*(layerW+gapL)+x*sp+sp/2, y:y0+y*sp+sp/2});
    const tray=i=>Math.floor(i/per);
    const colFor=(i,j,wrap)=>{ if (wrap && su.wrap_external) return {c:M(su.media_ext||su.media_tray_tray).color, d:dash(su.media_ext||su.media_tray_tray)}; return tray(i)===tray(j)?{c:M(su.media_xpu_sw).color,d:dash(su.media_xpu_sw)}:{c:M(su.media_tray_tray).color,d:dash(su.media_tray_tray)}; };
    const edge=(a,b2,pa,pb,wrap,axis)=>{ const hot = a===selIdx||b2===selIdx; const {c,d}=colFor(a,b2,wrap); const w = hot?2.6:1.2, op = hot?1:.45;
      if (!wrap) return line(pa.x,pa.y,pb.x,pb.y,{style:`stroke:${c};stroke-width:${w};opacity:${op}`,extra:d});
      // wrap: arc outside the grid
      const off = axis==='x'? {dx:0,dy:-sp*0.55} : axis==='y' ? {dx:sp*0.55,dy:0} : {dx:0,dy:sp*0.7};
      return path(`M${pa.x} ${pa.y} C ${pa.x+off.dx} ${pa.y+off.dy}, ${pb.x+off.dx} ${pb.y+off.dy}, ${pb.x} ${pb.y}`,{cls:'f-none',style:`stroke:${c};stroke-width:${w};opacity:${op}`,extra:d}); };
    let edges='', nodes='';
    for (let z=0;z<layers;z++) for (let y=0;y<side;y++) for (let x=0;x<side;x++){
      const i=idx(x,y,z), p=P(x,y,z);
      // +x neighbour
      const xn = (x+1)%side; edges += edge(i, idx(xn,y,z), p, P(xn,y,z), xn===0, 'x');
      const yn = (y+1)%side; edges += edge(i, idx(x,yn,z), p, P(x,yn,z), yn===0, 'y');
      if (dims===3){ const zn=(z+1)%side; const j=idx(x,y,zn); if (i===selIdx||j===selIdx) edges += edge(i,j,p,P(x,y,zn), zn===0, 'z'); }
      nodes += g(rect(p.x-9,p.y-9,18,18,{rx:3,cls:'f-xpu ink2 sel-target',style:`stroke-width:.7;${i===selIdx?'fill:var(--select);stroke:var(--select)':''}`}),{cls:'hit',sel:`xpuidx:${i}`});
    }
    s += edges + nodes;
    for (let z=0;z<layers;z++) s += text(x0+z*(layerW+gapL)+layerW/2, y0-16, dims===3?`plane z=${z+1} · trays ${Math.floor(z*side*side/per)+1}–${Math.ceil((z+1)*side*side/per)}`:`${side}×${side} torus`, {cls:'t-eyebrow',anchor:'middle'});
    const ly = y0 + side*sp + 70;
    const segs = o.segments.map(sg=>`${sg.name}: ${fmt(sg.links)} links on ${M(sg.media).name.toLowerCase()}`).join('   ·   ');
    s += text(W/2, ly, `${dims}D torus of ${side}${dims===3?'×'+side:''}×${side} = ${o.n.xpus} chips · ${su.links_per_xpu} neighbours each · ${fmt(T.links)} edges`, {cls:'t-label',anchor:'middle'});
    s += text(W/2, ly+20, segs, {cls:'t-small',anchor:'middle'});
    s += text(W/2, ly+40, `Per chip: ${o.link.formula}. Z-axis edges are drawn for the selected chip only.`, {cls:'t-small',anchor:'middle'});
  }
  s += mediaLegend(28, H-16-58-16*3-40, [su.media_xpu_sw, su.media_tray_tray, su.media_ext].filter(Boolean));
  return sheet(W,H,ctx,s);
}

/* =====================================================================
   5. SCALE-OUT — front-of-tray faceplate with every port and where each connection lands
   ===================================================================== */
function renderScaleOut(b, o, sel){
  const r=b.rack, so=b.scaleout, S=o.so, N=b.blocks.nic, P=b.blocks.dpu, SS=b.blocks.so_sw, W=1240, H=760, ctx=ctxFor(b,'scaleout',5,5);
  const nn = Math.round(r.xpus_per_tray*r.nics_per_xpu);                     // NIC ports per tray
  const cages = so.module_gbps ? Math.ceil(nn*N.gbps/so.module_gbps) : 0;    // pluggable cages per tray
  const portsPerCage = cages ? Math.max(1, Math.round(so.module_gbps/Math.max(1,N.gbps))) : 0;
  const dpuN = r.dpus_per_tray|0, drives = r.drives_per_tray ?? 0, mgmt = r.mgmt_ports_per_tray ?? 1;
  const nicM = M(so.nic_media), dpuM = M(so.dpu_media);
  ctx.sub = `Front of one compute tray (×${r.compute_trays} per rack) · ${nn} × ${N.name} ${N.gbps}G in ${cages} × ${so.module_gbps}G cages → ${fmt(S.per_xpu_gbps)} Gb/s per XPU · ${fmt(S.rack_tbs_dir,1)} Tb/s per rack`;
  let s='';
  const seg=o.so_segments.find(x=>x.id==='so_nic'), dseg=o.so_segments.find(x=>x.id==='so_dpu');

  // ---- faceplate
  const fx=60, fy=170, fw=790, fh=140;
  s += text(fx, fy-30, `COMPUTE TRAY — FRONT FACE  ·  ${r.xpus_per_tray} × ${xpuShort(b)} inside  ·  ×${r.compute_trays} per rack`, {cls:'t-eyebrow'});
  s += hit('tray:compute', sel, rect(fx,fy,fw,fh,{rx:4,cls:'f-tray ink sel-target',style:'stroke-width:1.6'}));
  // mounting ears
  s += rect(fx-14,fy+8,14,fh-16,{rx:2,cls:'f-panel ink2',style:'stroke-width:.8'}) + rect(fx+fw,fy+8,14,fh-16,{rx:2,cls:'f-panel ink2',style:'stroke-width:.8'});
  [[fx-7,fy+24],[fx-7,fy+fh-24],[fx+fw+7,fy+24],[fx+fw+7,fy+fh-24]].forEach(([x,y])=>{ s += `<circle cx="${x}" cy="${y}" r="3" class="f-sheet ink2" style="stroke-width:.8"/>`; });
  let x = fx+18; const cy = fy+fh/2;
  const groups = [];   // {x1,x2,label,color,sel}
  // drive bays
  if (drives){ const bw=16, g0=x; for (let i=0;i<Math.min(drives,12);i++){ s += hit('drives', sel, rect(x, fy+16, bw, fh-32, {rx:2,cls:'f-mem ink2 sel-target',style:'stroke-width:.7'}) + rect(x+4, fy+22, bw-8, 4, {cls:'rule2'})); x += bw+4; }
    groups.push({x1:g0,x2:x-4,label:[`${drives} × E1.S NVMe bays`, 'local storage · no network port'],color:'var(--ink-3)'}); x += 22; }
  // BMC / management
  if (mgmt){ const g0=x; for (let i=0;i<mgmt;i++){ s += hit('mgmt', sel, rect(x, cy-9, 22, 18, {rx:2,cls:'f-conn ink sel-target',style:'stroke-width:.9'}) + rect(x+5, cy+2, 12, 5, {cls:'f-panel ink2',style:'stroke-width:.5'})); x += 28; }
    // status LEDs
    for (let i=0;i<3;i++){ s += `<circle cx="${x+4}" cy="${cy-8+i*8}" r="2.2" style="fill:${['#2E8B57','#C9A227','#4A5D73'][i]}"/>`; }
    x += 14; groups.push({x1:g0,x2:x-4,label:[`${mgmt} × BMC 1 GbE (RJ45) + LEDs`, 'out-of-band management'],color:D.CONNECTOR_CATS.mgmt.color,sel:'mgmt'}); x += 22; }
  // NIC cages
  const nicStart = x; const cageW = Math.max(24, Math.min(56, (fw - (x-fx) - 40 - dpuN*54) / Math.max(1,cages) - 6)), cageH = 40;
  const nicCage = [];
  for (let i=0;i<cages;i++){ const cx0=x; s += hit('soseg:so_nic', sel, block(x, cy-cageH/2, cageW, cageH, nicM.color, '', {op:.92}) + text(x+cageW/2, cy+cageH/2+11, `${so.module_gbps>=1000?(so.module_gbps/1000)+'T':so.module_gbps+'G'}`, {cls:'t-tb',anchor:'middle'}) );
    for (let k=0;k<Math.min(portsPerCage,4);k++){ const pw=(cageW-8)/Math.min(portsPerCage,4); s += rect(x+4+k*pw, cy-cageH/2+6, pw-3, cageH-12, {rx:1,style:'fill:#fff;fill-opacity:.55;stroke:none'}); }
    nicCage.push({x:cx0+cageW/2, y:cy-cageH/2}); x += cageW+6; }
  if (cages) groups.push({x1:nicStart,x2:x-6,label:[`${nn} × ${N.name} ${N.gbps}G → ${cages} × ${so.module_gbps}G ${nicM.short} cage${cages>1?'s':''}${portsPerCage>1?` (${portsPerCage} ports each)`:''}`, `${nicM.name} · ${fmt(nn*N.gbps/1000,1)} Tb/s per tray to the backend leaf`],color:nicM.color,sel:'soseg:so_nic'});
  x += 22;
  // DPU cages
  const dpuStart = x, dpuCage=[];
  for (let i=0;i<dpuN;i++){ s += hit('soseg:so_dpu', sel, block(x, cy-20, 44, 40, dpuM.color, '', {op:.75}) + rect(x+4, cy-14, 36, 28, {rx:1,style:'fill:#fff;fill-opacity:.55;stroke:none'}) + text(x+22, cy+31, `${P.gbps}G`, {cls:'t-tb',anchor:'middle'})); dpuCage.push({x:x+22,y:cy-20}); x += 50; }
  if (dpuN) groups.push({x1:dpuStart,x2:x-6,label:[`${dpuN} × ${P.name} ${P.gbps}G`, `${dpuM.name} · front-end / storage network`],color:dpuM.color,sel:'soseg:so_dpu'});
  // callouts under faceplate (alternate two depths so labels do not collide)
  groups.forEach((g,i)=>{ const mx=(g.x1+g.x2)/2, depth = fy+fh+34+(i%2)*46; s += line(g.x1, fy+fh+6, g.x2, fy+fh+6, {cls:'dim'}) + line(g.x1,fy+fh+2,g.x1,fy+fh+10,{cls:'dim'}) + line(g.x2,fy+fh+2,g.x2,fy+fh+10,{cls:'dim'});
    s += callout(mx, fy+fh+6, mx+14, depth, g.label, g.color); });

  // ---- destinations (right)
  const dx=930, dw=270;
  const dest = (y,h,key,title,l1,l2,fill)=>{ return hit(key, sel, rect(dx,y,dw,h,{rx:3,cls:`${fill} ink sel-target`,style:'stroke-width:1'}) + text(dx+12,y+19,title,{cls:'t-tb-b',style:'font-size:13px'}) + text(dx+12,y+35,l1,{cls:'t-small'}) + (l2?text(dx+12,y+49,l2,{cls:'t-small'}):'')); };
  // spine
  s += rect(dx, 40+30, dw, 34, {rx:3,cls:'f-none ink2',style:'stroke-dasharray:5 4;stroke-width:1'}) + text(dx+dw/2, 40+51, `Spine / pod fabric · ${M(SS.media).short}`, {cls:'t-small',anchor:'middle'});
  const ly=125, lh=62; s += line(dx+dw/2, 104, dx+dw/2, ly, {cls:'ink2',style:'stroke-dasharray:5 4'});
  s += dest(ly, lh, 'leaf', `Backend leaf · ${SS.name.split(' (')[0]}`, `${cages} × ${so.module_gbps}G per tray · ${fmt(S.modules_nic_side)} per rack`, `${fmt(S.leaf_switches)} × leaf (${SS.ports} × ${SS.port_gbps}G, ${so.oversub}:1)`, 'f-sw');
  const fy2 = 250; if (dpuN) s += dest(fy2, lh, 'soseg:so_dpu', 'Front-end / storage leaf', `${dpuN} × ${P.gbps}G per tray · ${fmt(o.n.dpus)} per rack`, `${fmt(S.dpu_gbps_dir/1000,1)} Tb/s · ${dpuM.name}`, 'f-dpu');
  const my = 360; if (mgmt) s += dest(my, 48, 'mgmt', 'Management switch · 1 GbE', `${mgmt} per tray · ${mgmt*r.compute_trays} per rack (+ ${r.switch_trays} switch trays)`, '', 'f-panel');
  // connections: cage → destination
  nicCage.forEach((c,i)=>{ const ty = ly + 12 + (i%5)*8; s += path(`M${c.x} ${c.y} C ${c.x} ${c.y-60}, ${dx-120} ${ty}, ${dx} ${ty}`, {cls:'f-none',style:`stroke:${nicM.color};stroke-width:1.6;opacity:.85`, extra:dash(so.nic_media)}); });
  dpuCage.forEach((c,i)=>{ const ty = fy2 + 14 + i*10; s += path(`M${c.x} ${c.y} C ${c.x} ${c.y-30}, ${dx-100} ${ty}, ${dx} ${ty}`, {cls:'f-none',style:`stroke:${dpuM.color};stroke-width:1.6;opacity:.85`, extra:dash(so.dpu_media)}); });
  if (mgmt){ const g = groups.find(g=>g.sel==='mgmt'); const mx=g.x1+11; s += path(`M${mx} ${cy-9} L${mx} ${fy-14} L${dx-34} ${fy-14} L${dx-34} ${my+24} L${dx} ${my+24}`, {cls:'f-none',style:`stroke:${D.CONNECTOR_CATS.mgmt.color};stroke-width:1.2;opacity:.75`}); }
  // cable count on the backend bundle
  if (seg) s += callout(dx-70, ly+24, dx-70, ly-38, [`${fmt(seg.links)} × ${so.module_gbps}G links per rack`, `${fmt(seg.modules)} ${nicM.family==='optical'?'modules':'cable ends'} · ${fmt(seg.fibers||seg.pairs)} ${nicM.family==='optical'?'fibers':'twinax pairs'}`, `${fmt(seg.media_w/1000,2)} kW media · ≈ $${fmt(seg.media_usd/1000,0)}k`], nicM.color, 'end');

  // ---- port inventory table
  const tx=60, ty=fy+fh+156, cols=[0,170,250,330,470,700]; const cw=[170,80,80,140,230,120];
  s += text(tx, ty-12, 'PORT INVENTORY — PER COMPUTE TRAY AND PER RACK', {cls:'t-eyebrow'});
  const rows = [['Port','Per tray','Speed','Media','Goes to','Per rack']];
  if (nn) rows.push([`${N.name} port`, `${nn}`, `${N.gbps}G`, nicM.short, `Backend leaf (${SS.name.split(' (')[0]})`, `${fmt(o.n.nics)}`]);
  if (cages) rows.push([`${so.module_gbps}G ${nicM.family==='optical'?'optical cage':'copper cage'}`, `${cages}`, `${so.module_gbps}G`, nicM.short, `${portsPerCage>1?portsPerCage+' NIC ports per cage':'1 NIC port per cage'}`, `${fmt(S.modules_nic_side)}`]);
  if (dpuN) rows.push([`${P.name} port`, `${dpuN}`, `${P.gbps}G`, dpuM.short, 'Front-end / storage leaf', `${fmt(o.n.dpus)}`]);
  if (mgmt) rows.push(['BMC RJ45', `${mgmt}`, '1G', 'Cat6', 'Management switch', `${mgmt*r.compute_trays}`]);
  if (drives) rows.push(['E1.S NVMe bay', `${drives}`, 'PCIe', '—', 'Local (no network)', `${drives*r.compute_trays}`]);
  rows.push([`Rear: ${b.scaleup.name} connector`, `${r.xpus_per_tray*b.scaleup.links_per_xpu} links`, `${fmt(o.link.link_gbps_dir)}G`, M(b.scaleup.media_xpu_sw).short, o.n.sw_chips?'Scale-up switch trays (not on the front)':'Neighbouring trays (not on the front)', `${fmt(o.topo.links)}`]);
  rows.forEach((row,i)=>{ const y=ty+i*20; if (i===0) s += line(tx, y+8, tx+840, y+8, {cls:'ink'}); else s += line(tx, y+8, tx+840, y+8, {cls:'rule2'});
    row.forEach((c,j)=>{ s += text(tx+cols[j]+(j===1||j===5?cw[j]-8:0), y+2, c, {cls:i===0?'t-eyebrow':(j===1||j===5?'t-mono':'t-small'), anchor:(j===1||j===5)?'end':'start', style:i===0?'':'fill:var(--ink)'}); }); });

  // ---- headline stats (right, under destinations)
  const ax=dx, ay=428;
  [['PER XPU', `${fmt(S.per_xpu_gbps)} Gb/s`],['PER RACK', `${fmt(S.rack_tbs_dir,1)} Tb/s per direction`],['SCALE-UP : SCALE-OUT', `${fmt(S.ratio_su_so,1)} : 1`],['OPTICS + SERDES POWER', `${fmt(o.power.so_media_kw+o.power.so_serdes_kw,2)} kW per rack`]].forEach(([k,v],i)=>{ s += text(ax, ay+i*44, k, {cls:'t-eyebrow'}) + text(ax, ay+i*44+19, v, {cls:'t-tb-b',style:'font-size:16px'}); });
  s += mediaLegend(dx, ay+4*44+8, [so.nic_media, so.dpu_media, SS.media].filter(Boolean));
  return sheet(W,H,ctx,s);
}

/* ---------- Compare (HTML table) ---------- */
function renderCompare(rows, currentId){
  const cols = ['Architecture','XPUs','Per-XPU scale-up','Rack scale-up','Fabric','Scale-up media','Lanes / XPU','Copper pairs','Scale-out / XPU','Rack scale-out','Optics modules','Interconnect kW','Interconnect $ / XPU','Rack kW','Conf'];
  let h = `<div class="cmp-wrap" style="padding:16px 20px"><h2 style="font:600 22px var(--disp);margin:0 0 4px">Cross-architecture comparison</h2><div class="note" style="margin-bottom:12px">All rows are recomputed with the current assumptions panel, so a change to a media price or SerDes pJ/bit moves every column. The highlighted row is the build you are editing.</div><div style="overflow-x:auto;background:var(--sheet);border:1px solid var(--rule);border-radius:6px"><table class="grid"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>`;
  rows.forEach(({b,o})=>{
    const optics = o.segments.concat(o.so_segments).reduce((a,x)=>a+(D.MEDIA[x.media].family==='optical'?x.modules:0),0);
    const pairs = o.segments.reduce((a,x)=>a+x.pairs,0);
    h += `<tr ${b.id===currentId?'style="background:var(--select-tint)"':''}><td><b>${esc(b.name)}</b><br><span class="c">${esc(b.vendor)} · ${esc(b.status||'')} ${esc(b.year||'')}</span></td><td class="n">${o.n.xpus}<br><span class="c">${esc(xpuShort(b))}</span></td><td class="n">${fmt(o.link.xpu_tbs_bidir,2)} TB/s</td><td class="n">${fmt(o.link.rack_tbs_bidir,0)} TB/s</td><td>${esc(b.scaleup.name)}<br><span class="c">${esc(D.TOPOLOGIES[b.scaleup.topology].name.split(',')[0])}</span></td><td>${o.segments.map(x=>`<span style="color:${x.color}">■</span> ${esc(D.MEDIA[x.media].short)}`).join(' ')}</td><td class="n">${o.link.xpu_lanes}</td><td class="n">${fmt(pairs)}</td><td class="n">${fmt(o.so.per_xpu_gbps)} Gb/s</td><td class="n">${fmt(o.so.rack_tbs_dir,1)} Tb/s</td><td class="n">${fmt(optics)}</td><td class="n">${fmt(o.power.interconnect_kw,1)}</td><td class="n">$${fmt(o.cost.interconnect_per_xpu/1000,1)}k</td><td class="n">${b.rack.power_kw}</td><td><span class="pill ${b.conf}">${b.conf}</span></td></tr>`;
  });
  h += '</tbody></table></div></div>';
  return h;
}

window.RE_RENDER = { renderBoard, renderTray, renderRack, renderScaleUp, renderScaleOut, renderCompare, esc };
})();
