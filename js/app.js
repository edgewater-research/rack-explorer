/* Rack Explorer — application layer: state, panels, events, persistence. */
(function(){
const D = window.RE_DATA, C = window.RE_COMPUTE, R = window.RE_RENDER;
const fmt = C.fmt, esc = R.esc;
const $ = s => document.querySelector(s);
const LS = { get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };
const clone = x => JSON.parse(JSON.stringify(x));

/* ---------------- state ---------------- */
const asmRows = D.defaultAssumptions();
const asmDefault = {}; asmRows.forEach(r=>asmDefault[r.key]=r.value);
const state = {
  presetId:'gb200_nvl72', build:null, out:null,
  asm: Object.assign({}, asmDefault, LS.get('re.asm', {})),
  view:'rack', side:'inspect', sel:'rack', selXpu:0, zoom:1,
  custom: LS.get('re.custom', []),
};
function allPresets(){ return D.PRESETS.concat(state.custom); }
function makeBuild(p){
  const b = clone(p);
  b.blocks = b.blocks || {};
  const pick = (tbl, id, fallback) => clone(tbl[id] || tbl[fallback]);
  b.blocks.xpu  = b.blocks.xpu  || pick(D.XPUS, p.xpu, 'custom');
  b.blocks.cpu  = b.blocks.cpu  || pick(D.CPUS, p.cpu, 'none');
  b.blocks.nic  = b.blocks.nic  || pick(D.NICS, p.nic, 'none');
  b.blocks.dpu  = b.blocks.dpu  || pick(D.DPUS, p.dpu, 'none');
  b.blocks.sw   = b.blocks.sw   || pick(D.SU_SWITCHES, p.scaleup.sw, 'none');
  b.blocks.so_sw= b.blocks.so_sw|| pick(D.SO_SWITCHES, p.scaleout.so_sw, 'th5');
  return b;
}
function loadPreset(id){
  const p = allPresets().find(x=>x.id===id) || D.PRESETS[0];
  state.presetId = p.id; state.build = makeBuild(p); state.sel='rack'; state.selXpu=0;
  recompute(); renderAll(); writeHash();
}
function recompute(){ state.out = C.compute(state.build, state.asm); }
function get(obj, path){ return path.split('.').reduce((o,k)=>o?.[k], obj); }
function set(obj, path, v){ const ks=path.split('.'); const last=ks.pop(); const o=ks.reduce((o,k)=>o[k]??(o[k]={}), obj); o[last]=v; }

/* ---------------- rendering: rail ---------------- */
function renderPresets(){
  const el = $('#preset-list'); const cur = state.presetId;
  el.innerHTML = allPresets().map(p=>`<button class="preset" aria-pressed="${p.id===cur}" data-preset="${p.id}">
    <span class="pn">${esc(p.name)}</span><span class="pill ${p.conf}">${p.conf}</span>
    <span class="pv">${esc(p.vendor)} · ${esc(p.status||'custom')}${p.year?' · '+esc(p.year):''}</span>
    <span class="pt">${esc(p.tagline||'')}</span>${p.custom?`<button class="del" data-del="${p.id}" title="Delete this saved build">×</button>`:''}</button>`).join('');
  const sel = $('#preset-select'); sel.innerHTML = allPresets().map(p=>`<option value="${p.id}" ${p.id===cur?'selected':''}>${esc(p.name)}</option>`).join('');
}
function renderBlocks(){
  const b = state.build;
  const grp = (title, tbl, type, sub, color) => `<details class="blockgrp" ${type==='xpu'?'open':''}><summary>${title}<span></span></summary>` +
    Object.values(tbl).map(x=>`<button class="block" data-block="${type}" data-id="${x.id}" aria-pressed="${b.blocks[type]?.id===x.id}">
      <span class="sw" style="background:${color}"></span><span><div class="bn">${esc(x.name)}</div><div class="bs">${esc(sub(x))}</div></span><span class="use">use</span></button>`).join('') + '</details>';
  $('#blocks').innerHTML =
    grp('XPU / GPU / accelerator', D.XPUS, 'xpu', x=>`${x.hbm_gb} GB · ${x.hbm_tbs} TB/s · ${x.tdp_w} W`, 'var(--brand)') +
    grp('Host CPU', D.CPUS, 'cpu', x=>x.cores?`${x.cores} cores · ${x.mem}`:'—', '#7A4FB5') +
    grp('Scale-out NIC', D.NICS, 'nic', x=>x.gbps?`${x.gbps} Gb/s · ${x.form}`:'—', '#2F8F83') +
    grp('DPU / front-end', D.DPUS, 'dpu', x=>x.gbps?`${x.gbps} Gb/s · ${x.tdp_w} W`:'—', '#3E8A5A') +
    grp('Scale-up switch ASIC', D.SU_SWITCHES, 'sw', x=>x.ports?`${x.ports} ports · ${x.tbs_bidir} TB/s`:'—', '#B26A2B') +
    grp('Scale-out switch', D.SO_SWITCHES, 'so_sw', x=>`${x.ports} × ${x.port_gbps}G · ${x.tbs} Tb/s`, '#E07A1F');
}
function renderMediaLegend(){
  $('#media-legend').innerHTML = D.MEDIA_ORDER.map(id=>{ const m=D.MEDIA[id]; return `<div class="media-row" title="${esc(m.note)}"><span class="line ${m.family}" style="border-color:${m.color}"></span><span>${esc(m.name)}</span><span class="fam">${m.family}</span></div>`; }).join('');
}

/* ---------------- rendering: centre ---------------- */
function bw(tbs){ return state.asm['conv.bidir']==='bidirectional' ? {v:tbs, u:'TB/s', s:'bidirectional'} : {v:tbs/2, u:'TB/s', s:'per direction'}; }
function renderStats(){
  const o=state.out, b=state.build, su=b.scaleup, T=o.topo, S=o.so, P=o.power;
  const per = bw(o.link.xpu_tbs_bidir), rack = bw(o.link.rack_tbs_bidir);
  const pairs = o.segments.reduce((a,s)=>a+s.pairs,0), mods = o.segments.reduce((a,s)=>a+s.modules,0);
  const swTile = T.ports_avail!==undefined ? {cls: T.util>1.0001?'bad':(T.util<.85?'warn':'good'), v:`${fmt(T.util*100,0)}<small>%</small>`, s:`${fmt(T.links)} links / ${fmt(T.ports_avail)} ports`, k:'Switch ports'} : {cls:'', v:`${fmt(T.links)}`, s:`${D.TOPOLOGIES[su.topology].name.split(',')[0]} · no switch`, k:'Fabric edges'};
  const tiles = [
    {k:'Scale-up / XPU', v:`${fmt(per.v,2)}<small>${per.u}</small>`, s:`${su.links_per_xpu} × ${su.lanes_per_link} × ${su.lane_gbps}G · ${per.s}`},
    {k:'Rack scale-up', v:`${fmt(rack.v,0)}<small>${rack.u}</small>`, s:`${o.n.xpus} × ${b.blocks.xpu.name.split(' (')[0]} · ${su.name}`},
    swTile,
    {k: pairs?'Copper pairs':'Scale-up modules', v: pairs?fmt(pairs):fmt(mods), s: o.segments.map(s=>D.MEDIA[s.media].short).filter((x,i,a)=>a.indexOf(x)===i).join(' + ')},
    {k:'Scale-out / XPU', v:`${fmt(S.per_xpu_gbps)}<small>Gb/s</small>`, s:`${b.blocks.nic.name} · SU:SO ${fmt(S.ratio_su_so,1)}:1`},
    {k:'Rack scale-out', v:`${fmt(S.rack_tbs_dir,1)}<small>Tb/s</small>`, s:`${fmt(S.modules_nic_side)} × ${b.scaleout.module_gbps}G ${D.MEDIA[b.scaleout.nic_media].short}`},
    {k:'Interconnect kW', v:`${fmt(P.interconnect_kw,1)}<small>kW</small>`, s:`${fmt(P.interconnect_share*100,0)}% of ${fmt(P.computed_rack_kw,0)} kW computed`},
    {k:'Interconnect $', v:`$${fmt(o.cost.interconnect/1000,0)}<small>k</small>`, s:`$${fmt(o.cost.interconnect_per_xpu/1000,1)}k per XPU · est.`},
    {k:'Rack power', v:`${fmt(b.rack.power_kw,0)}<small>kW</small>`, s:`stated · ${fmt(P.silicon_kw,0)} kW silicon TDP`},
  ];
  $('#stats').innerHTML = tiles.map(t=>`<div class="stat ${t.cls||''}"><span class="k">${t.k}</span><span class="v">${t.v}</span><span class="s">${esc(t.s)}</span></div>`).join('');
  $('#notices').innerHTML = o.warnings.map(w=>`<div class="notice ${w.lvl}"><b>${w.lvl==='err'?'check':w.lvl}</b><span>${esc(w.text)}</span></div>`).join('');
}
function renderCanvas(){
  const el = $('#canvas'), b=state.build, o=state.out, sel=state.sel;
  let html='';
  switch(state.view){
    case 'board': html = R.renderBoard(b,o,sel); break;
    case 'tray': html = R.renderTray(b,o,sel); break;
    case 'rack': html = R.renderRack(b,o,sel); break;
    case 'scaleup': html = R.renderScaleUp(b,o,sel,state.selXpu); break;
    case 'scaleout': html = R.renderScaleOut(b,o,sel); break;
    case 'compare': { const rows = allPresets().map(p=>{ const bb = p.id===state.presetId ? b : makeBuild(p); return {b:bb,o:C.compute(bb,state.asm)}; }); html = R.renderCompare(rows, state.presetId); break; }
  }
  el.innerHTML = html;
  el.style.width = state.view==='compare' ? 'calc(100% - 28px)' : `calc((100% - 28px) * ${state.zoom})`;
  document.querySelectorAll('#view-tabs button').forEach(bt=>bt.setAttribute('aria-selected', bt.dataset.view===state.view));
}

/* ---------------- rendering: side panel ---------------- */
function kv(pairs){ return `<div class="kv">${pairs.filter(p=>p).map(([k,v,dim])=>`<span class="k">${esc(k)}</span><span class="v ${dim?'dim':''}">${v}</span>`).join('')}</div>`; }
function inp(label, path, opts={}){
  const v = get(state.build, path);
  const base = get(allPresets().find(p=>p.id===state.presetId)||{}, path.replace(/^blocks\./,'__'));
  if (opts.select){ return `<label>${esc(label)}${opts.small?`<small>${esc(opts.small)}</small>`:''}</label><select data-path="${path}">${opts.select.map(([val,lab])=>`<option value="${val}" ${String(val)===String(v)?'selected':''}>${esc(lab)}</option>`).join('')}</select>`; }
  if (opts.bool){ return `<label>${esc(label)}${opts.small?`<small>${esc(opts.small)}</small>`:''}</label><select data-path="${path}" data-type="bool"><option value="true" ${v?'selected':''}>yes</option><option value="false" ${!v?'selected':''}>no</option></select>`; }
  const type = opts.text ? 'text' : 'number';
  return `<label>${esc(label)}${opts.small?`<small>${esc(opts.small)}</small>`:''}</label><input type="${type}" data-path="${path}" value="${esc(v)}" ${type==='number'?`step="${opts.step||'any'}" min="${opts.min??0}"`:''} class="${base!==undefined && base!==v?'changed':''}">`;
}
function mediaSel(label, path, small){ return inp(label, path, {select: D.MEDIA_ORDER.map(id=>[id, D.MEDIA[id].name]), small}); }
function conf(c){ return `<span class="pill ${c}">${c}</span>`; }

function renderInspector(){
  const b=state.build, o=state.out, sel=state.sel||'rack', su=b.scaleup, so=b.scaleout, L=o.link;
  const X=b.blocks.xpu, Cp=b.blocks.cpu, N=b.blocks.nic, P=b.blocks.dpu, SW=b.blocks.sw, SS=b.blocks.so_sw;
  const head = (t, s, c) => `<div class="panel-h"><h2>${esc(t)}</h2>${c?conf(c):''}</div>${s?`<div class="hint" style="padding-top:0">${esc(s)}</div>`:''}`;
  const per = bw(L.xpu_tbs_bidir);
  let h='';
  const [kind, arg] = sel.split(':');
  if (kind==='xpu'){
    h += head(X.name, `${X.vendor} · accelerator package · ${o.n.xpus} per rack`, X.conf);
    h += `<div class="sec"><h4>Scale-up link budget</h4><div class="formula">${esc(L.formula)}</div>${kv([['SerDes lanes per XPU (per direction)', fmt(L.xpu_lanes)],['Link rate per direction', `${fmt(L.link_gbps_dir)} Gb/s`],['Vendor figure', su.vendor_bidir_tbs?`${su.vendor_bidir_tbs} TB/s bidir`:'—', !su.vendor_bidir_tbs],['Scale-out per XPU', `${fmt(o.so.per_xpu_gbps)} Gb/s`],['Scale-up : scale-out', `${fmt(o.so.ratio_su_so,1)} : 1`],['HBM per XPU', `${X.hbm_gb} GB · ${X.hbm_tbs} TB/s`],['HBM : NVLink-class ratio', `${fmt(X.hbm_tbs / Math.max(0.01,L.xpu_tbs_bidir),1)} : 1`]])}</div>`;
    h += `<div class="sec"><h4>Edit fabric</h4><div class="form">${inp('Links per XPU','scaleup.links_per_xpu',{step:1,min:1})}${inp('Lanes per link','scaleup.lanes_per_link',{step:1,min:1})}${inp('Lane rate','scaleup.lane_gbps',{small:'Gb/s per lane per direction',step:'any'})}${inp('Vendor bidirectional figure','scaleup.vendor_bidir_tbs',{small:'TB/s, for the consistency check'})}</div></div>`;
    h += `<div class="sec"><h4>Edit package</h4><div class="form">${inp('Name','blocks.xpu.name',{text:true})}${inp('Dies per package','blocks.xpu.dies',{step:1})}${inp('HBM capacity','blocks.xpu.hbm_gb',{small:'GB'})}${inp('HBM bandwidth','blocks.xpu.hbm_tbs',{small:'TB/s'})}${inp('FP8 dense','blocks.xpu.fp8_pf',{small:'PFLOPS'})}${inp('FP4 dense','blocks.xpu.fp4_pf',{small:'PFLOPS'})}${inp('TDP','blocks.xpu.tdp_w',{small:'W'})}</div><div class="note small" style="margin-top:6px">${esc(X.note||'')} ${esc(X.c2c && X.c2c!=='—' ? '· '+X.c2c : '')}</div></div>`;
  } else if (kind==='cpu'){
    h += head(Cp.name, `${Cp.vendor} · host CPU · ${o.n.cpus} per rack`, Cp.conf);
    h += `<div class="sec">${kv([['Cores', Cp.cores],['Memory', esc(Cp.mem)],['CPU ↔ XPU link', esc(Cp.c2c)],['XPUs per CPU', fmt(o.n.xpus/Math.max(1,o.n.cpus),1)],['TDP', `${Cp.tdp_w} W`]])}</div>`;
    h += `<div class="sec"><h4>Edit</h4><div class="form">${inp('Name','blocks.cpu.name',{text:true})}${inp('Cores','blocks.cpu.cores',{step:1})}${inp('Memory','blocks.cpu.mem',{text:true})}${inp('Memory modules drawn','blocks.cpu.mem_modules',{step:1})}${inp('TDP','blocks.cpu.tdp_w',{small:'W'})}${inp('CPUs per tray','rack.cpus_per_tray',{step:1})}</div></div>`;
  } else if (kind==='mem'){
    h += head(`${b.board.mem_type} memory`, 'Host memory on the compute board');
    h += `<div class="sec">${kv([['Per CPU', esc(Cp.mem)],['Modules drawn per CPU', b.board.mem_per_cpu]])}<div class="form" style="margin-top:8px">${inp('Memory type label','board.mem_type',{text:true})}${inp('Modules per CPU','board.mem_per_cpu',{step:1})}</div></div>`;
  } else if (kind==='nic'){
    h += head(N.name, `${N.vendor} · scale-out NIC · ${o.n.nics} per rack`, N.conf);
    h += `<div class="sec">${kv([['Port speed', `${N.gbps} Gb/s`],['Form factor', esc(N.form)],['Host interface', esc(N.pcie)],['NICs per XPU', b.rack.nics_per_xpu],['Rack scale-out', `${fmt(o.so.rack_tbs_dir,1)} Tb/s per direction`],['Modules NIC-side', fmt(o.so.modules_nic_side)],['TDP', `${N.tdp_w} W`]])}</div>`;
    h += `<div class="sec"><h4>Edit</h4><div class="form">${inp('Name','blocks.nic.name',{text:true})}${inp('Port speed','blocks.nic.gbps',{small:'Gb/s'})}${inp('TDP','blocks.nic.tdp_w',{small:'W'})}${inp('NICs per XPU','rack.nics_per_xpu',{step:'any'})}${mediaSel('Media','scaleout.nic_media')}${inp('Module / port speed','scaleout.module_gbps',{select:[[400,'400G'],[800,'800G'],[1600,'1.6T'],[3200,'3.2T']]})}</div></div>`;
  } else if (kind==='dpu'){
    h += head(P.name, `${P.vendor} · DPU · ${o.n.dpus} per rack`, P.conf);
    h += `<div class="sec">${kv([['Port speed', `${P.gbps} Gb/s`],['Per tray', b.rack.dpus_per_tray],['Front-end bandwidth', `${fmt(o.so.dpu_gbps_dir/1000,1)} Tb/s`],['TDP', `${P.tdp_w} W`]])}<div class="note small" style="margin-top:6px">${esc(P.note||'')}</div></div>`;
    h += `<div class="sec"><h4>Edit</h4><div class="form">${inp('Name','blocks.dpu.name',{text:true})}${inp('Port speed','blocks.dpu.gbps',{small:'Gb/s'})}${inp('DPUs per tray','rack.dpus_per_tray',{step:1})}${mediaSel('Media','scaleout.dpu_media')}${inp('TDP','blocks.dpu.tdp_w',{small:'W'})}</div></div>`;
  } else if (kind==='sw'){
    const T=o.topo;
    h += head(SW.name, `${SW.vendor} · scale-up switch ASIC · ${o.n.sw_chips} per rack`, SW.conf);
    h += `<div class="sec"><div class="formula">${esc(`${o.n.sw_chips} ASICs × ${SW.ports} ports = ${fmt(T.ports_avail)} ports  vs  ${o.n.xpus} XPUs × ${su.links_per_xpu} links = ${fmt(T.links)} links  →  ${fmt(T.util*100,0)}% used`)}</div>${kv([['Ports per ASIC', SW.ports],['Port rate', `${fmt(L.link_gbps_dir)} Gb/s per direction`],['SerDes per ASIC', SW.serdes?`${SW.serdes} × ${SW.serdes_gbps}G`:'—'],['ASIC bandwidth (bidir)', `${fmt(SW.tbs_bidir,1)} TB/s`],['Links per XPU per ASIC', fmt(T.links_per_xpu_per_switch,2)],['ASICs required', T.chips_required],['Switch trays', `${b.rack.switch_trays} × ${b.rack.switch_chips_per_tray}` + (b.rack.switch_chips_per_compute_tray?` + ${b.rack.switch_chips_per_compute_tray} per compute tray`:'')],['TDP per ASIC', `${SW.tdp_w} W`]])}<div class="note small" style="margin-top:6px">${esc(SW.note||'')}</div></div>`;
    h += `<div class="sec"><h4>Edit</h4><div class="form">${inp('Name','blocks.sw.name',{text:true})}${inp('Ports per ASIC','blocks.sw.ports',{step:1})}${inp('ASIC bandwidth','blocks.sw.tbs_bidir',{small:'TB/s bidir (label only)'})}${inp('TDP','blocks.sw.tdp_w',{small:'W'})}${inp('Switch trays','rack.switch_trays',{step:1})}${inp('ASICs per switch tray','rack.switch_chips_per_tray',{step:1})}${inp('ASICs per compute tray','rack.switch_chips_per_compute_tray',{step:1,small:'baseboard NVSwitch style'})}</div></div>`;
  } else if (kind==='seg'){
    const s = o.segments.find(x=>x.id===arg) || o.segments[0]; if (!s){ h += head('No scale-up segment',''); }
    else { const m=D.MEDIA[s.media]; const pathKey = s.id==='xpu_sw'||s.id==='mesh'||s.id==='intra' ? 'scaleup.media_xpu_sw' : (s.id==='inter' ? 'scaleup.media_tray_tray' : 'scaleup.media_ext');
      h += head(s.name, `${m.name} · ${su.name}`, m.conf);
      h += `<div class="sec"><div class="formula">${esc(`${fmt(s.links)} links × ${su.lanes_per_link} lanes × ${su.lane_gbps}G = ${fmt(s.gbps_dir/1000,1)} Tb/s per direction = ${fmt(s.tbs_bidir,1)} TB/s bidirectional`)}</div>
        ${kv([['Links', fmt(s.links)],['Ends counted', fmt(s.ends)],['Lanes per direction', fmt(s.lanes_total)], m.family==='copper'?['Twinax pairs', fmt(s.pairs)]:['Optical modules', fmt(s.modules)], m.family==='optical'?['Fibers', fmt(s.fibers)]:null,['Reach needed / available', `${s.need_m} m / ${s.reach_m} m`],['Media power', `${fmt(s.media_w/1000,2)} kW`],['SerDes power', `${fmt(s.serdes_w/1000,2)} kW @ ${s.pj} pJ/bit`],['Media cost (est.)', `$${fmt(s.media_usd/1000,0)}k`]])}
        <div class="note small" style="margin-top:6px">${esc(s.note)} ${esc(m.note)}</div></div>`;
      h += `<div class="sec"><h4>Change media</h4><div class="form">${mediaSel('Media for this segment', pathKey)}${inp('Lane rate','scaleup.lane_gbps',{small:'Gb/s per lane'})}${inp('Lanes per link','scaleup.lanes_per_link',{step:1})}</div><div class="hint" style="padding:6px 0 0">Power and cost per 800G end come from the Assumptions tab.</div></div>`; }
  } else if (kind==='soseg'){
    const s = o.so_segments.find(x=>x.id===arg) || o.so_segments[0]; if (!s){ h += head('No scale-out network','Set a NIC and NICs per XPU in Build.'); }
    else { const m=D.MEDIA[s.media]; const isNic = s.id==='so_nic';
      h += head(s.name, `${m.name} · ${isNic?N.name:P.name}`, m.conf);
      h += `<div class="sec"><div class="formula">${esc(isNic?`${o.n.nics} NICs × ${N.gbps}G = ${fmt(s.gbps_dir/1000,1)} Tb/s → ${fmt(s.links)} × ${s.module_gbps}G ports → ${fmt(s.modules)} ${m.family==='optical'?'modules':'cable ends'}`:`${o.n.dpus} DPUs × ${P.gbps}G = ${fmt(s.gbps_dir/1000,1)} Tb/s → ${fmt(s.links)} × ${s.module_gbps}G ports`)}</div>
        ${kv([['Ports', fmt(s.links)],['Lanes × rate per port', `${s.lanes} × ${fmt(s.lane_gbps)}G`], m.family==='optical'?['Fibers', fmt(s.fibers)]:['Twinax pairs', fmt(s.pairs)],['Media power', `${fmt(s.media_w/1000,2)} kW`],['SerDes power', `${fmt(s.serdes_w/1000,2)} kW @ ${s.pj} pJ/bit`],['Media cost (est.)', `$${fmt(s.media_usd/1000,0)}k`], isNic?['Leaf switches (share)', `${o.so.leaf_switches} × ${SS.name}`]:null])}
        <div class="note small" style="margin-top:6px">${esc(m.note)}</div></div>`;
      h += `<div class="sec"><h4>Change</h4><div class="form">${mediaSel('Media', isNic?'scaleout.nic_media':'scaleout.dpu_media')}${isNic?inp('Port speed','scaleout.module_gbps',{select:[[400,'400G'],[800,'800G'],[1600,'1.6T'],[3200,'3.2T']]}):''}${isNic?inp('Leaf oversubscription','scaleout.oversub',{small:'downlinks : uplinks'}):''}</div></div>`; }
  } else if (kind==='leaf'){
    h += head(SS.name, `${SS.vendor} · scale-out leaf · ${o.so.leaf_switches} needed (share)`, SS.conf);
    h += `<div class="sec">${kv([['Radix', `${SS.ports} × ${SS.port_gbps}G`],['Throughput', `${SS.tbs} Tb/s`],['Native media', esc(D.MEDIA[SS.media].name)],['Downlinks needed', fmt(o.so.leaf_ports_needed,0)],['Oversubscription', `${so.oversub}:1`]])}<div class="form" style="margin-top:8px">${inp('Leaf switch','scaleout.so_sw',{select:Object.values(D.SO_SWITCHES).map(x=>[x.id,x.name])})}${inp('Oversubscription','scaleout.oversub')}</div></div>`;
  } else if (kind==='board'){
    const bd=b.board;
    h += head(bd.name, `${bd.xpus} XPU + ${bd.cpus} CPU per board · ${b.rack.boards_per_tray} per tray · ${o.n.boards} per rack`);
    h += `<div class="sec"><div class="form">${inp('Board name','board.name',{text:true})}${inp('XPUs per board','board.xpus',{step:1})}${inp('CPUs per board','board.cpus',{step:1})}${inp('Memory modules per CPU','board.mem_per_cpu',{step:1})}${inp('Memory type','board.mem_type',{text:true})}${inp('Boards per tray','rack.boards_per_tray',{step:1})}</div></div>`;
    h += `<div class="sec"><h4>Connectors</h4><div class="conn-list">${(bd.connectors||[]).map((c,i)=>`<div class="conn-item"><input data-path="board.connectors.${i}.n" value="${esc(c.n)}"><select data-path="board.connectors.${i}.side">${['top','left','right','bottom'].map(s=>`<option ${c.side===s?'selected':''}>${s}</option>`).join('')}</select><select data-path="board.connectors.${i}.cat">${Object.entries(D.CONNECTOR_CATS).map(([k,v])=>`<option value="${k}" ${c.cat===k?'selected':''}>${esc(v.name)}</option>`).join('')}</select><button data-conn-del="${i}" title="Remove">×</button></div>`).join('')}</div><div class="row" style="margin-top:8px"><button class="btn small" id="conn-add">+ Add connector</button></div></div>`;
  } else if (kind==='conn'){
    const c = b.board.connectors[+arg]; const cat = D.CONNECTOR_CATS[c?.cat];
    h += head(c?.n||'Connector', cat?cat.name:'');
    h += `<div class="sec"><div class="form">${inp('Label',`board.connectors.${arg}.n`,{text:true})}${inp('Side',`board.connectors.${arg}.side`,{select:['top','left','right','bottom'].map(s=>[s,s])})}${inp('Category',`board.connectors.${arg}.cat`,{select:Object.entries(D.CONNECTOR_CATS).map(([k,v])=>[k,v.name])})}</div></div>`;
  } else if (kind==='tray'){
    const r=b.rack; const isC = arg==='compute';
    if (isC){ h += head('Compute tray', `${r.compute_trays} per rack · ${r.xpus_per_tray} × ${X.name.split(' (')[0]} · ${r.cpus_per_tray} × ${Cp.name}`);
      h += `<div class="sec">${kv([['Boards', `${r.boards_per_tray} × ${b.board.name}`],['NICs', `${Math.round(r.xpus_per_tray*r.nics_per_xpu)} × ${N.name}`],['DPUs', `${r.dpus_per_tray} × ${P.name}`],['Scale-up out of tray', `${fmt(r.xpus_per_tray*L.xpu_tbs_bidir,1)} TB/s · ${fmt(r.xpus_per_tray*L.xpu_lanes)} lanes/dir`],['Scale-out out of tray', `${fmt(r.xpus_per_tray*r.nics_per_xpu*N.gbps/1000,1)} Tb/s`],['Silicon power', `${fmt((r.xpus_per_tray*X.tdp_w + r.cpus_per_tray*Cp.tdp_w)/1000,1)} kW`],['Cooling', esc(r.cooling)]])}</div>`;
      h += `<div class="sec"><h4>Edit</h4><div class="form">${inp('Compute trays per rack','rack.compute_trays',{step:1})}${inp('XPUs per tray','rack.xpus_per_tray',{step:1})}${inp('CPUs per tray','rack.cpus_per_tray',{step:1})}${inp('Boards per tray','rack.boards_per_tray',{step:1})}${inp('NICs per XPU','rack.nics_per_xpu',{step:'any'})}${inp('DPUs per tray','rack.dpus_per_tray',{step:1})}${inp('Tray height','rack.tray_u',{small:'U (blank = auto)',step:1})}${inp('Cooling','rack.cooling',{text:true})}</div></div>`; }
    else { h += head('Switch tray', `${r.switch_trays} per rack · ${r.switch_chips_per_tray} × ${SW.name}`);
      h += `<div class="sec">${kv([['Ports per tray', fmt(r.switch_chips_per_tray*SW.ports)],['Bandwidth per tray', `${fmt(r.switch_chips_per_tray*SW.tbs_bidir,1)} TB/s`],['Rear media', esc(D.MEDIA[su.media_xpu_sw].name)],['Power per tray (ASIC)', `${fmt(r.switch_chips_per_tray*SW.tdp_w/1000,2)} kW`]])}</div>`;
      h += `<div class="sec"><h4>Edit</h4><div class="form">${inp('Switch trays','rack.switch_trays',{step:1})}${inp('ASICs per tray','rack.switch_chips_per_tray',{step:1})}${inp('Switch ASIC','scaleup.sw',{select:Object.values(D.SU_SWITCHES).map(x=>[x.id,x.name])})}${mediaSel('XPU → switch media','scaleup.media_xpu_sw')}</div></div>`; }
  } else { // rack
    const r=b.rack;
    h += head(b.name, `${b.vendor} · ${b.status||'custom build'} · ${b.year||''}`, b.conf);
    h += `<div class="sec"><div class="note">${esc(b.tagline||'')}</div></div>`;
    h += `<div class="sec"><h4>Composition</h4>${kv([['XPUs', `${o.n.xpus} × ${X.name}`],['Dies', fmt(o.n.dies)],['Host CPUs', `${o.n.cpus} × ${Cp.name}`],['Compute trays', `${r.compute_trays} × ${r.xpus_per_tray} XPU`],['Switch ASICs', o.n.sw_chips?`${o.n.sw_chips} × ${SW.name}`:'none'],['NICs', `${o.n.nics} × ${N.name}`],['DPUs', o.n.dpus?`${o.n.dpus} × ${P.name}`:'none'],['Rack', `${r.rack_u}U · ${esc(r.form)}`],['Cooling', esc(r.cooling)],['HBM', `${fmt(o.n.xpus*X.hbm_gb/1000,1)} TB · ${fmt(o.n.xpus*X.hbm_tbs/1000,1)} PB/s`],['FP8 dense', X.fp8_pf?`${fmt(o.n.xpus*X.fp8_pf/1000,2)} EFLOPS`:'—'],['FP4 dense', X.fp4_pf?`${fmt(o.n.xpus*X.fp4_pf/1000,2)} EFLOPS`:'—']])}</div>`;
    h += `<div class="sec"><h4>Scale-up</h4><div class="formula">${esc(L.formula)}</div>${kv([['Topology', esc(o.topo.name)],['Rack aggregate', `${fmt(per.v*o.n.xpus,0)} TB/s ${per.s}`],['Media', o.segments.map(s=>esc(D.MEDIA[s.media].name)).filter((x,i,a)=>a.indexOf(x)===i).join(', ')], o.topo.ports_avail!==undefined?['Switch port use', `${fmt(o.topo.util*100,0)}%`]:null])}</div>`;
    h += `<div class="sec"><h4>Scale-out</h4>${kv([['Per XPU', `${fmt(o.so.per_xpu_gbps)} Gb/s (${N.name})`],['Per rack', `${fmt(o.so.rack_tbs_dir,1)} Tb/s per direction`],['Media', esc(D.MEDIA[so.nic_media].name)],['Leaf', `${o.so.leaf_switches} × ${SS.name}`]])}</div>`;
    h += `<div class="sec"><h4>Power</h4>${kv([['Stated rack power', `${r.power_kw} kW`],['Computed', `${fmt(o.power.computed_rack_kw,0)} kW`],['XPU TDPs', `${fmt(o.power.xpu_kw,1)} kW`],['CPU + NIC + DPU + switch', `${fmt(o.power.cpu_kw+o.power.nic_kw+o.power.sw_kw,1)} kW`],['Interconnect (media + SerDes)', `${fmt(o.power.interconnect_kw,1)} kW`]])}</div>`;
    if (b.sources?.length) h += `<div class="sec"><h4>Sources & caveats</h4><ul class="srcs">${b.sources.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div>`;
  }
  return h || head('Nothing selected','Click an element in the drawing.');
}

function renderBuild(){
  const b=state.build, r=b.rack, su=b.scaleup, so=b.scaleout;
  const opt = tbl => Object.values(tbl).map(x=>[x.id,x.name]);
  const isTorus = /torus/.test(su.topology);
  return `<div class="panel-h"><h2>Build</h2><span class="sub">based on ${esc(allPresets().find(p=>p.id===state.presetId)?.name||'')}</span></div>
  <div class="tools"><button class="btn small primary" id="save-custom">Save as new architecture</button><button class="btn small" id="reset-build">Reset to preset</button></div>
  <div class="sec"><h4>Identity</h4><div class="form">${inp('Name','name',{text:true})}${inp('Vendor','vendor',{text:true})}${inp('Status','status',{text:true})}${inp('Year','year',{text:true})}${inp('Confidence','conf',{select:[['H','H — documented'],['M','M — vendor-stated / partial'],['L','L — estimate']]})}<label class="wide">Tagline</label><input class="wide" data-path="tagline" value="${esc(b.tagline||'')}"></div></div>
  <div class="sec"><h4>Rack</h4><div class="form">${inp('Compute trays','rack.compute_trays',{step:1})}${inp('XPUs per tray','rack.xpus_per_tray',{step:1})}${inp('CPUs per tray','rack.cpus_per_tray',{step:1})}${inp('Boards per tray','rack.boards_per_tray',{step:1})}${inp('Switch trays','rack.switch_trays',{step:1})}${inp('Switch ASICs per switch tray','rack.switch_chips_per_tray',{step:1})}${inp('Switch ASICs per compute tray','rack.switch_chips_per_compute_tray',{step:1,small:'baseboard NVSwitch / UBB'})}${inp('Rack height','rack.rack_u',{small:'U',step:1})}${inp('Compute tray height','rack.tray_u',{small:'U (blank = auto)',step:1})}${inp('Stated rack power','rack.power_kw',{small:'kW'})}${inp('Cooling','rack.cooling',{text:true})}${inp('Form factor','rack.form',{text:true})}</div></div>
  <div class="sec"><h4>Building blocks</h4><div class="form">${inp('XPU','xpu',{select:opt(D.XPUS)})}${inp('Host CPU','cpu',{select:opt(D.CPUS)})}${inp('Scale-out NIC','nic',{select:opt(D.NICS)})}${inp('NICs per XPU','rack.nics_per_xpu',{step:'any'})}${inp('DPU','dpu',{select:opt(D.DPUS)})}${inp('DPUs per tray','rack.dpus_per_tray',{step:1})}</div><div class="hint" style="padding:6px 0 0">Pick from the library on the left or here; edit a block's specs from the Inspector after clicking it in the drawing.</div></div>
  <div class="sec"><h4>Scale-up fabric</h4><div class="form">${inp('Fabric name','scaleup.name',{text:true})}${inp('Topology','scaleup.topology',{select:Object.values(D.TOPOLOGIES).map(t=>[t.id,t.name])})}${inp('Links per XPU','scaleup.links_per_xpu',{step:1})}${inp('Lanes per link','scaleup.lanes_per_link',{step:1})}${inp('Lane rate','scaleup.lane_gbps',{small:'Gb/s per lane per direction'})}${inp('Switch ASIC','scaleup.sw',{select:opt(D.SU_SWITCHES)})}${mediaSel(isTorus?'In-tray links':'XPU → switch media','scaleup.media_xpu_sw')}${mediaSel(isTorus?'Tray ↔ tray links':'Tray ↔ tray / inter-node media','scaleup.media_tray_tray')}${isTorus?mediaSel('Wrap-around (leaving rack)','scaleup.media_ext'):''}${isTorus?inp('Wrap-around leaves the rack','scaleup.wrap_external',{bool:true}):''}${inp('Vendor bidirectional figure','scaleup.vendor_bidir_tbs',{small:'TB/s per XPU, for the check'})}</div><div class="note small" style="margin-top:6px">${esc(D.TOPOLOGIES[su.topology].desc)}</div></div>
  <div class="sec"><h4>Scale-out network</h4><div class="form">${mediaSel('NIC media','scaleout.nic_media')}${inp('Port / module speed','scaleout.module_gbps',{select:[[400,'400G'],[800,'800G'],[1600,'1.6T'],[3200,'3.2T']]})}${inp('Leaf switch','scaleout.so_sw',{select:opt(D.SO_SWITCHES)})}${inp('Leaf oversubscription','scaleout.oversub',{small:'downlinks : uplinks'})}${mediaSel('DPU media','scaleout.dpu_media')}</div></div>
  <div class="sec"><h4>Board</h4><div class="form">${inp('Board name','board.name',{text:true})}${inp('XPUs per board','board.xpus',{step:1})}${inp('CPUs per board','board.cpus',{step:1})}${inp('Memory modules per CPU','board.mem_per_cpu',{step:1})}${inp('Memory type','board.mem_type',{text:true})}</div><div class="hint" style="padding:6px 0 0">Connectors are edited by clicking the board in the Board view.</div></div>
  <div class="sec"><h4>Import / export</h4><div class="row"><button class="btn small" id="btn-export2">Download JSON</button><button class="btn small" id="btn-copy">Copy JSON</button></div><textarea class="io" id="io" placeholder="Paste a Rack Explorer JSON export here and click Load" style="margin:8px 0 0;width:100%"></textarea><div class="row" style="margin-top:6px"><button class="btn small" id="btn-load">Load pasted JSON</button></div></div>`;
}

function renderAssumptions(){
  const groups = [...new Set(asmRows.map(r=>r.group))];
  let h = `<div class="panel-h"><h2>Assumptions</h2><span class="sub">${Object.keys(state.asm).filter(k=>state.asm[k]!==asmDefault[k]).length} changed</span></div>
  <div class="hint">Every disputed figure lives here rather than in the model. Yellow = changed from default. Hover ⓘ for the source note. Confidence: <span class="pill H">H</span> documented · <span class="pill M">M</span> vendor-stated / partial · <span class="pill L">L</span> estimate.</div>
  <div class="tools"><button class="btn small" id="asm-reset">Reset all to defaults</button></div>`;
  groups.forEach(gname=>{
    h += `<div class="asm-group"><h4>${esc(gname)}</h4>`;
    asmRows.filter(r=>r.group===gname).forEach(r=>{
      const v = state.asm[r.key], changed = v!==asmDefault[r.key];
      let ctl;
      if (r.type==='select') ctl = `<select data-asm="${r.key}">${r.options.map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join('')}</select>`;
      else if (r.type==='bool') ctl = `<select data-asm="${r.key}" data-type="bool"><option value="true" ${v?'selected':''}>yes</option><option value="false" ${!v?'selected':''}>no</option></select>`;
      else ctl = `<input type="number" step="any" data-asm="${r.key}" value="${v}" class="${changed?'changed':''}">`;
      const mk = r.media ? `<span class="mk" style="background:${D.MEDIA[r.media].color}"></span>` : '';
      h += `<div class="asm"><div class="l">${mk}<span class="t" title="${esc(r.label)}">${esc(r.label)}</span> <span class="pill ${r.conf}">${r.conf}</span></div>${ctl}<span class="i" title="${esc(r.note||'')}">i</span>${r.unit?`<span class="u">${esc(r.unit)}</span>`:''}</div>`;
    });
    h += '</div>';
  });
  return h;
}

function renderBOM(){
  const o=state.out, b=state.build;
  let h = `<div class="panel-h"><h2>Bill of interconnect</h2><span class="sub">${esc(b.name)}</span></div>`;
  h += `<div class="sec"><table class="grid"><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th>Notes</th></tr></thead><tbody>`;
  let cat='';
  o.bom.forEach(row=>{ if (row.cat!==cat){ cat=row.cat; h += `<tr class="cat"><td colspan="3">${esc(cat)}</td></tr>`; } h += `<tr><td>${esc(row.item)}</td><td class="n">${fmt(row.qty)} <span class="c">${esc(row.unit)}</span></td><td class="c">${esc(row.note)}</td></tr>`; });
  h += '</tbody></table></div>';
  const P=o.power, Cc=o.cost;
  h += `<div class="sec"><h4>Power budget</h4><table class="grid"><tbody>
    <tr><td>XPU TDPs</td><td class="n">${fmt(P.xpu_kw,1)} kW</td></tr><tr><td>Host CPUs</td><td class="n">${fmt(P.cpu_kw,1)} kW</td></tr><tr><td>NICs + DPUs</td><td class="n">${fmt(P.nic_kw,1)} kW</td></tr><tr><td>Scale-up switch ASICs</td><td class="n">${fmt(P.sw_kw,1)} kW</td></tr>
    <tr><td>Scale-up SerDes (${state.asm['serdes.lr_pj']} pJ/bit LR)</td><td class="n">${fmt(P.su_serdes_kw,2)} kW</td></tr><tr><td>Scale-up media (cables / optics)</td><td class="n">${fmt(P.su_media_kw,2)} kW</td></tr>
    <tr><td>Scale-out SerDes</td><td class="n">${fmt(P.so_serdes_kw,2)} kW</td></tr><tr><td>Scale-out media (optics / AEC)</td><td class="n">${fmt(P.so_media_kw,2)} kW</td></tr>
    <tr class="cat"><td>Interconnect total</td><td class="n">${fmt(P.interconnect_kw,1)} kW · ${fmt(P.interconnect_share*100,0)}%</td></tr>
    <tr><td>Computed rack (+${state.asm['power.overhead_pct']}% overhead)</td><td class="n">${fmt(P.computed_rack_kw,0)} kW</td></tr><tr><td>Stated rack power</td><td class="n">${fmt(P.vendor_rack_kw,0)} kW</td></tr></tbody></table></div>`;
  h += `<div class="sec"><h4>Interconnect cost (estimates)</h4><table class="grid"><tbody>
    <tr><td>Scale-up media</td><td class="n">$${fmt(Cc.su_media/1000,0)}k</td></tr><tr><td>Scale-up switch ASICs</td><td class="n">$${fmt(Cc.su_switch/1000,0)}k</td></tr><tr><td>Scale-out NICs</td><td class="n">$${fmt(Cc.nic/1000,0)}k</td></tr><tr><td>Scale-out media</td><td class="n">$${fmt(Cc.so_media/1000,0)}k</td></tr>
    <tr class="cat"><td>Interconnect total</td><td class="n">$${fmt(Cc.interconnect/1000,0)}k · $${fmt(Cc.interconnect_per_xpu/1000,1)}k / XPU</td></tr>
    <tr><td>XPU silicon for scale (at $${fmt(state.asm['cost.xpu_usd'])})</td><td class="n">$${fmt(Cc.xpu/1e6,1)}M</td></tr><tr><td>Interconnect as % of XPU spend</td><td class="n">${fmt(Cc.interconnect/Math.max(1,Cc.xpu)*100,1)}%</td></tr></tbody></table>
    <div class="note small" style="margin-top:8px">Unit costs are per-800G-end street-price classes from the Assumptions tab. They are placeholders for relative comparison, not a BOM quote.</div></div>`;
  return h;
}

function renderSide(){
  const body = $('#side-body');
  body.innerHTML = state.side==='inspect' ? renderInspector() : state.side==='build' ? renderBuild() : state.side==='assume' ? renderAssumptions() : renderBOM();
  document.querySelectorAll('#side-tabs button').forEach(bt=>bt.setAttribute('aria-selected', bt.dataset.tab===state.side));
}
function renderAll(){ renderPresets(); renderBlocks(); renderStats(); renderCanvas(); renderSide(); }
function renderLight(){ recompute(); renderStats(); renderCanvas(); }

/* ---------------- events ---------------- */
function setBlock(type, id){
  const tbl = {xpu:D.XPUS, cpu:D.CPUS, nic:D.NICS, dpu:D.DPUS, sw:D.SU_SWITCHES, so_sw:D.SO_SWITCHES}[type];
  if (!tbl[id]) return;
  state.build.blocks[type] = clone(tbl[id]);
  if (type==='sw') state.build.scaleup.sw = id; else if (type==='so_sw') state.build.scaleout.so_sw = id; else state.build[type] = id;
  if (type==='cpu') state.build.board.mem_per_cpu = Math.min(4, tbl[id].mem_modules||0) || state.build.board.mem_per_cpu;
}
function applyInput(el, full){
  const asmKey = el.dataset.asm, path = el.dataset.path;
  let v = el.value;
  if (el.dataset.type==='bool') v = v==='true';
  else if (el.type==='number' || (el.tagName==='SELECT' && /^-?\d+(\.\d+)?$/.test(v) && !/^(xpu|cpu|nic|dpu|scaleup\.sw|scaleout\.so_sw|scaleup\.topology|scaleup\.media|scaleout\.\w+_media)/.test(path||''))) { v = v===''? undefined : Number(v); if (v!==undefined && Number.isNaN(v)) return; }
  if (asmKey){ state.asm[asmKey] = v; LS.set('re.asm', state.asm); }
  else if (path){
    if (['xpu','cpu','nic','dpu'].includes(path)) setBlock(path, v);
    else if (path==='scaleup.sw') setBlock('sw', v);
    else if (path==='scaleout.so_sw') setBlock('so_sw', v);
    else set(state.build, path, v);
    if (path==='scaleup.topology'){ const t=v, b=state.build; if (t==='mesh') b.scaleup.links_per_xpu = Math.max(1,b.rack.xpus_per_tray-1); if (t==='torus2d') b.scaleup.links_per_xpu=4; if (t==='torus3d') b.scaleup.links_per_xpu=6; if (t==='switched' && !b.rack.switch_trays){ b.rack.switch_trays = Math.max(1, Math.round(b.rack.compute_trays/2)); b.rack.switch_chips_per_tray = b.rack.switch_chips_per_tray||2; if (b.blocks.sw.id==='none') setBlock('sw','nvsw5'); } if (t==='intray' && !b.rack.switch_chips_per_compute_tray){ b.rack.switch_chips_per_compute_tray = 2; if (b.blocks.sw.id==='none') setBlock('sw','nvsw5'); } }
  }
  if (full) { recompute(); renderAll(); } else renderLight();
}
document.addEventListener('input', e=>{ const el=e.target; if (el.matches('[data-path],[data-asm]') && el.tagName!=='SELECT') applyInput(el,false); });
document.addEventListener('change', e=>{ const el=e.target; if (el.matches('[data-path],[data-asm]')) applyInput(el, true); });
document.addEventListener('click', e=>{
  const t = e.target;
  const del = t.closest('[data-del]'); if (del){ e.stopPropagation(); const id=del.dataset.del; state.custom = state.custom.filter(p=>p.id!==id); LS.set('re.custom', state.custom); if (state.presetId===id) loadPreset(D.PRESETS[0].id); else renderPresets(); return; }
  const pr = t.closest('[data-preset]'); if (pr){ loadPreset(pr.dataset.preset); return; }
  const bl = t.closest('[data-block]'); if (bl){ setBlock(bl.dataset.block, bl.dataset.id); state.sel = bl.dataset.block; state.side='inspect'; recompute(); renderAll(); return; }
  const vt = t.closest('#view-tabs [data-view]'); if (vt){ state.view = vt.dataset.view; renderCanvas(); writeHash(); return; }
  const st = t.closest('#side-tabs [data-tab]'); if (st){ state.side = st.dataset.tab; renderSide(); return; }
  const hitEl = t.closest('[data-sel]'); if (hitEl){ let k = hitEl.dataset.sel; if (k.startsWith('xpuidx:')){ state.selXpu = +k.split(':')[1]; k='xpu'; } state.sel = k; state.side='inspect'; renderCanvas(); renderSide(); return; }
  if (t.id==='conn-add'){ (state.build.board.connectors ||= []).push({n:'New connector', side:'right', cat:'pcie'}); renderLight(); renderSide(); return; }
  const cd = t.closest('[data-conn-del]'); if (cd){ state.build.board.connectors.splice(+cd.dataset.connDel,1); if (state.sel.startsWith('conn:')) state.sel='board'; renderLight(); renderSide(); return; }
  if (t.id==='save-custom'){ const name = prompt('Name for this architecture', state.build.name + ' (variant)'); if (!name) return; const p = clone(state.build); p.id = 'custom_' + Date.now().toString(36); p.name = name; p.custom = true; p.status = 'custom'; delete p.sources; state.custom.push(p); LS.set('re.custom', state.custom); loadPreset(p.id); return; }
  if (t.id==='reset-build'){ loadPreset(state.presetId); return; }
  if (t.id==='asm-reset'){ state.asm = Object.assign({}, asmDefault); LS.set('re.asm', state.asm); recompute(); renderAll(); return; }
  if (t.id==='btn-export' || t.id==='btn-export2'){ download(`${state.build.id||'rack'}.json`, exportJSON(), 'application/json'); return; }
  if (t.id==='btn-copy'){ navigator.clipboard?.writeText(exportJSON()); t.textContent='Copied'; setTimeout(()=>t.textContent='Copy JSON',1200); return; }
  if (t.id==='btn-load'){ importJSON($('#io').value); return; }
  if (t.id==='btn-import'){ $('#file-import').click(); return; }
  if (t.id==='btn-svg'){ saveSVG(); return; }
  if (t.id==='btn-theme'){ const root=document.documentElement; const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'); root.dataset.theme = cur==='dark'?'light':'dark'; LS.set('re.theme', root.dataset.theme); return; }
  if (t.id==='zoom-in'){ state.zoom=Math.min(2.5,state.zoom*1.25); renderCanvas(); return; }
  if (t.id==='zoom-out'){ state.zoom=Math.max(.5,state.zoom/1.25); renderCanvas(); return; }
  if (t.id==='zoom-fit'){ state.zoom=1; renderCanvas(); return; }
});
$('#preset-select').addEventListener('change', e=>loadPreset(e.target.value));
$('#file-import').addEventListener('change', e=>{ const f=e.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>importJSON(rd.result); rd.readAsText(f); e.target.value=''; });

function exportJSON(){ return JSON.stringify({ app:'rack-explorer', version:1, exported:new Date().toISOString(), build: state.build, assumptions: state.asm }, null, 2); }
function importJSON(txt){
  try { const j = JSON.parse(txt); const b = j.build || j; if (!b.rack || !b.scaleup) throw new Error('missing rack/scaleup');
    b.id = b.id || 'import_'+Date.now().toString(36); b.custom = true; b.status = b.status||'imported'; if (!b.name) b.name='Imported build';
    if (!state.custom.find(p=>p.id===b.id)) { state.custom.push(b); LS.set('re.custom', state.custom); }
    if (j.assumptions) { state.asm = Object.assign({}, asmDefault, j.assumptions); LS.set('re.asm', state.asm); }
    loadPreset(b.id);
  } catch(err){ alert('Could not load that JSON: ' + err.message); }
}
/* Saves a generated file. Inside the claude.ai artifact viewer plain download links are inert, so use the
   `downloads` capability when it resolves; anywhere else (repo build, local file) fall back to an anchor. */
const downloadsCap = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('downloads').catch(()=>null) : Promise.resolve(null);
async function download(name, content, type){
  const cap = await downloadsCap;
  if (cap){ try { await cap.save({ filename:name, data:content }); } catch(err){ if (err && err.code !== 'declined') alert('Could not save the file here: ' + (err.message || err.code || err)); } return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},500);
}
function saveSVG(){
  const svg = $('#canvas svg'); if (!svg) return;
  const cs = getComputedStyle(document.documentElement);
  let css=''; for (const sh of document.styleSheets){ let rules; try{ rules=sh.cssRules; }catch(e){ continue; } for (const r of rules){ if (r.selectorText && /^svg/.test(r.selectorText)) css += r.cssText.replace(/^svg\s*/,'').replace(/,\s*svg\s*/g,', ') + '\n'; } }
  css = css.replace(/var\((--[\w-]+)\)/g, (m,v)=>cs.getPropertyValue(v).trim()||m);
  css = css.replace(/'Barlow Condensed'/g,"'Barlow Condensed',Arial Narrow,sans-serif").replace(/var\(--ui\)/g,'Barlow,Arial,sans-serif');
  const clone = svg.cloneNode(true); clone.insertAdjacentHTML('afterbegin', `<style>${css}</style>`);
  clone.style.background = cs.getPropertyValue('--sheet');
  download(`${state.build.id||'rack'}-${state.view}.svg`, '<?xml version="1.0" encoding="UTF-8"?>\n'+clone.outerHTML, 'image/svg+xml');
}
function writeHash(){ try{ history.replaceState(null,'',`#arch=${encodeURIComponent(state.presetId)}&view=${state.view}`); }catch(e){} }
function readHash(){ const m = Object.fromEntries(location.hash.slice(1).split('&').filter(Boolean).map(kv=>kv.split('=').map(decodeURIComponent))); if (m.view && ['board','tray','rack','scaleup','scaleout','compare'].includes(m.view)) state.view = m.view; return m.arch; }

/* ---------------- boot ---------------- */
const th = LS.get('re.theme', null); if (th) document.documentElement.dataset.theme = th;
renderMediaLegend();
const archFromHash = readHash();
loadPreset(archFromHash && allPresets().find(p=>p.id===archFromHash) ? archFromHash : 'gb200_nvl72');
window.RE = state;
})();
