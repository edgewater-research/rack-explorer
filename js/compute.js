/* Rack Explorer — compute layer. Pure functions: (build, assumptions) → derived metrics. */
(function(){
const D = window.RE_DATA;

function A(asm, key){ return asm[key]; }
function ceil(x){ return Math.ceil(x - 1e-9); }

function compute(build, asm){
  const r = build.rack, su = build.scaleup, so = build.scaleout, B = build.blocks;
  const out = { warnings:[], segments:[], so_segments:[] };

  /* ---- counts ---- */
  const n = out.n = {};
  n.xpus   = r.compute_trays * r.xpus_per_tray;
  n.cpus   = r.compute_trays * r.cpus_per_tray;
  n.boards = r.compute_trays * r.boards_per_tray;
  n.nics   = Math.round(n.xpus * r.nics_per_xpu);
  n.dpus   = r.compute_trays * r.dpus_per_tray;
  n.sw_tray_chips = r.switch_trays * r.switch_chips_per_tray;
  n.sw_intray_chips = r.compute_trays * r.switch_chips_per_compute_tray;
  n.sw_chips = n.sw_tray_chips + n.sw_intray_chips;
  n.dies = n.xpus * (B.xpu.dies || 1);

  /* ---- scale-up link math ---- */
  const L = out.link = {};
  L.lane_gbps = su.lane_gbps;
  L.lanes = su.lanes_per_link;
  L.link_gbps_dir = su.lanes_per_link * su.lane_gbps;
  L.xpu_gbps_dir = su.links_per_xpu * L.link_gbps_dir;
  L.xpu_GBs_dir = L.xpu_gbps_dir / 8;
  L.xpu_tbs_bidir = L.xpu_gbps_dir * 2 / 8000;
  L.xpu_tbs_dir = L.xpu_gbps_dir / 8000;
  L.xpu_lanes = su.links_per_xpu * su.lanes_per_link;
  L.rack_tbs_bidir = L.xpu_tbs_bidir * n.xpus;
  L.formula = `${su.links_per_xpu} links × ${su.lanes_per_link} lanes × ${su.lane_gbps} Gb/s = ${fmt(L.xpu_gbps_dir)} Gb/s per direction = ${fmt(L.xpu_GBs_dir)} GB/s per direction = ${fmt(L.xpu_tbs_bidir,2)} TB/s bidirectional`;
  if (su.vendor_bidir_tbs){
    L.vendor_delta_pct = (L.xpu_tbs_bidir - su.vendor_bidir_tbs) / su.vendor_bidir_tbs * 100;
    if (Math.abs(L.vendor_delta_pct) > 2) out.warnings.push({lvl:'warn', text:`Computed scale-up bandwidth (${fmt(L.xpu_tbs_bidir,2)} TB/s) differs from the vendor figure (${su.vendor_bidir_tbs} TB/s) by ${fmt(L.vendor_delta_pct,0)}%. Adjust links, lanes or lane rate — or the vendor figure.`});
  }

  /* ---- topology / segments ---- */
  const topo = su.topology;
  const sw = B.sw;
  const T = out.topo = { id: topo, name: D.TOPOLOGIES[topo].name };
  const xpu_link_ends = n.xpus * su.links_per_xpu;
  T.xpu_link_ends = xpu_link_ends;

  const mediaIn  = su.media_xpu_sw;
  const mediaTT  = su.media_tray_tray;
  const mediaExt = su.media_ext || su.media_tray_tray;

  if (topo === 'switched' || topo === 'intray'){
    T.domain = topo === 'switched' ? n.xpus : r.xpus_per_tray;
    T.ports_avail = n.sw_chips * (sw.ports || 0);
    T.links = xpu_link_ends;                                // one XPU end + one switch end each
    T.util = T.ports_avail ? T.links / T.ports_avail : Infinity;
    T.chips_required = sw.ports ? ceil(T.links / sw.ports) : 0;
    const chipsInDomain = topo === 'switched' ? n.sw_chips : r.switch_chips_per_compute_tray;
    T.links_per_xpu_per_switch = chipsInDomain ? su.links_per_xpu / chipsInDomain : 0;
    T.switch_bisection_tbs = n.sw_chips * (sw.ports||0) * L.link_gbps_dir * 2 / 8000 / 2;  // half the ports "up" in a flat fabric
    if (!n.sw_chips) out.warnings.push({lvl:'err', text:'Switched topology but zero switch ASICs. Add switch trays or in-tray switch chips.'});
    else if (T.util > 1.0001) out.warnings.push({lvl:'err', text:`XPU links (${fmt(T.links)}) exceed switch ports (${fmt(T.ports_avail)}): fabric is ${fmt(T.util,2)}× oversubscribed. Needs ${T.chips_required} × ${sw.name}.`});
    else if (T.util < 0.85) out.warnings.push({lvl:'info', text:`Switch ports ${fmt((1-T.util)*100,0)}% unused (${fmt(T.ports_avail - T.links)} spare). Spare ports could be scale-out uplinks or a second tier.`});
    if (chipsInDomain && Math.abs(T.links_per_xpu_per_switch - Math.round(T.links_per_xpu_per_switch)) > 1e-6)
      out.warnings.push({lvl:'info', text:`${su.links_per_xpu} links per XPU do not divide evenly across ${chipsInDomain} switch ASICs (${fmt(T.links_per_xpu_per_switch,2)} each). Real designs stripe unevenly or use a different radix.`});
    out.segments.push(seg('xpu_sw', topo==='switched' ? 'XPU → switch tray' : 'XPU → baseboard switch', mediaIn, T.links, L, asm, su, 'One link per XPU per port; both ends counted.'));
  }
  else if (topo === 'mesh'){
    const k = r.xpus_per_tray;
    T.domain = k;
    T.links = r.compute_trays * k * (k-1) / 2;
    if (su.links_per_xpu !== k-1) out.warnings.push({lvl:'warn', text:`Full mesh of ${k} XPUs needs ${k-1} links per XPU (you have ${su.links_per_xpu}).`});
    out.segments.push(seg('mesh', 'XPU ↔ XPU mesh (in tray)', mediaIn, T.links, L, asm, su, 'k(k−1)/2 links per tray.'));
  }
  else { // torus
    const dims = topo === 'torus3d' ? 3 : 2;
    const side = Math.round(Math.pow(n.xpus, 1/dims));
    T.domain = n.xpus; T.dims = dims; T.side = side;
    if (Math.pow(side, dims) !== n.xpus) out.warnings.push({lvl:'warn', text:`${n.xpus} XPUs is not a perfect ${dims}D torus (${side}^${dims} = ${Math.pow(side,dims)}). Counts below assume a regular torus.`});
    const totalLinks = n.xpus * su.links_per_xpu / 2;
    const k = r.xpus_per_tray;
    // intra-tray: chips in a tray form a ring (k<=4 → 2 neighbours) or a 2D plane (4 neighbours)
    const intraNeigh = Math.min(su.links_per_xpu, k >= 9 ? 4 : (k >= 3 ? 2 : (k===2 ? 1 : 0)));
    const intra = r.compute_trays * k * intraNeigh / 2;
    const wrap = su.wrap_external ? dims * Math.pow(side, dims-1) : 0;
    const inter = Math.max(0, totalLinks - intra - wrap);
    T.links = totalLinks; T.intra = intra; T.inter = inter; T.wrap = wrap;
    if (intra) out.segments.push(seg('intra', 'XPU ↔ XPU inside tray', mediaIn, intra, L, asm, su, `${intraNeigh} in-tray neighbours per chip.`));
    if (inter) out.segments.push(seg('inter', 'Tray ↔ tray inside rack', mediaTT, inter, L, asm, su, 'Remaining torus edges between trays.'));
    if (wrap)  out.segments.push(seg('wrap',  'Wrap-around links leaving rack', mediaExt, wrap, L, asm, su, `${dims} × ${side}^${dims-1} torus wrap edges, one per row.`));
  }

  /* ---- reach checks ---- */
  out.segments.forEach(s => {
    const reach = A(asm, `media.${s.media}.reach_m`);
    let need = 0.3;
    if (s.id === 'xpu_sw' && topo === 'switched') need = A(asm,'copper.spine_reach_m');
    if (s.id === 'inter') need = 1.0;
    if (s.id === 'wrap') need = 5;
    s.reach_m = reach; s.need_m = need;
    if (reach < need) out.warnings.push({lvl:'warn', text:`${s.name}: ${D.MEDIA[s.media].name} reach (${reach} m) is below the ~${need} m this segment needs at ${su.lane_gbps}G/lane.`});
    if (s.media === 'dac' && su.lane_gbps >= 200 && reach > 1.5) out.warnings.push({lvl:'info', text:`DAC reach at 200G/lane is typically ≤ 1.5 m; the assumption is ${reach} m.`});
  });

  /* ---- scale-out ---- */
  const S = out.so = {};
  const nic = B.nic, dpu = B.dpu, sosw = B.so_sw;
  S.nic_gbps = nic.gbps; S.nics = n.nics;
  S.rack_gbps_dir = n.nics * nic.gbps;
  S.rack_tbs_dir = S.rack_gbps_dir / 1000;
  S.rack_tbs_bidir = S.rack_tbs_dir * 2;
  S.per_xpu_gbps = n.xpus ? S.rack_gbps_dir / n.xpus : 0;
  S.ratio_su_so = S.per_xpu_gbps ? L.xpu_gbps_dir / S.per_xpu_gbps : Infinity;
  S.module_gbps = so.module_gbps;
  S.modules_nic_side = so.module_gbps ? ceil(S.rack_gbps_dir / so.module_gbps) : 0;
  S.leaf_ports_needed = sosw.port_gbps ? S.rack_gbps_dir / sosw.port_gbps : 0;
  const down_frac = so.oversub ? so.oversub / (1 + so.oversub) : 0.5;
  S.leaf_switches = sosw.ports ? ceil(S.leaf_ports_needed / (sosw.ports * down_frac)) : 0;
  S.lanes = so.module_gbps ? A(asm,'optics.lanes_per_module') : 8;
  S.lane_gbps = so.module_gbps / S.lanes;
  if (S.rack_gbps_dir) out.so_segments.push(soSeg('so_nic', `NIC → leaf (${sosw.name})`, so.nic_media, S.rack_gbps_dir, so.module_gbps, asm));
  S.dpu_gbps_dir = n.dpus * dpu.gbps;
  if (S.dpu_gbps_dir) out.so_segments.push(soSeg('so_dpu', 'DPU → front-end network', so.dpu_media, S.dpu_gbps_dir, Math.min(so.module_gbps, 800), asm));
  if (D.MEDIA[so.nic_media].family === 'copper' && A(asm, `media.${so.nic_media}.reach_m`) < 3)
    out.warnings.push({lvl:'info', text:`Scale-out on ${D.MEDIA[so.nic_media].name}: reach ${A(asm, `media.${so.nic_media}.reach_m`)} m only works with the leaf switch in the same rack.`});
  if (S.per_xpu_gbps && S.ratio_su_so < 4) out.warnings.push({lvl:'info', text:`Scale-up : scale-out bandwidth ratio is only ${fmt(S.ratio_su_so,1)}:1 — unusually scale-out-heavy.`});

  /* ---- power ---- */
  const P = out.power = {};
  P.xpu_kw = n.xpus * B.xpu.tdp_w / 1000;
  P.cpu_kw = n.cpus * B.cpu.tdp_w / 1000;
  P.nic_kw = (n.nics * nic.tdp_w + n.dpus * dpu.tdp_w) / 1000;
  P.sw_kw  = n.sw_chips * (sw.tdp_w||0) / 1000;
  P.su_media_kw = sum(out.segments.map(s=>s.media_w)) / 1000;
  P.su_serdes_kw = sum(out.segments.map(s=>s.serdes_w)) / 1000;
  P.so_media_kw = sum(out.so_segments.map(s=>s.media_w)) / 1000;
  P.so_serdes_kw = sum(out.so_segments.map(s=>s.serdes_w)) / 1000;
  P.interconnect_kw = P.su_media_kw + P.su_serdes_kw + P.so_media_kw + P.so_serdes_kw;
  P.silicon_kw = P.xpu_kw + P.cpu_kw + P.nic_kw + P.sw_kw;
  P.computed_rack_kw = (P.silicon_kw + P.interconnect_kw) * (1 + A(asm,'power.overhead_pct')/100);
  P.vendor_rack_kw = r.power_kw;
  P.interconnect_share = P.computed_rack_kw ? P.interconnect_kw / P.computed_rack_kw : 0;
  if (r.power_kw && Math.abs(P.computed_rack_kw - r.power_kw)/r.power_kw > 0.25)
    out.warnings.push({lvl:'info', text:`Computed rack power (${fmt(P.computed_rack_kw,0)} kW) is ${fmt((P.computed_rack_kw/r.power_kw-1)*100,0)}% off the stated ${r.power_kw} kW. Check TDPs or the overhead assumption.`});

  /* ---- cost ---- */
  const C = out.cost = {};
  C.su_media = sum(out.segments.map(s=>s.media_usd));
  C.so_media = sum(out.so_segments.map(s=>s.media_usd));
  C.su_switch = n.sw_chips * A(asm,'cost.su_switch_usd');
  C.nic = n.nics * A(asm,'cost.nic_usd') * (nic.gbps/800);
  C.xpu = n.xpus * A(asm,'cost.xpu_usd');
  C.interconnect = C.su_media + C.so_media + C.su_switch + C.nic;
  C.interconnect_per_xpu = n.xpus ? C.interconnect / n.xpus : 0;

  /* ---- BOM (hardware counts) ---- */
  const bom = out.bom = [];
  bom.push({cat:'Compute', item:B.xpu.name, qty:n.xpus, unit:'pkg', note:`${n.dies} dies · ${fmt(n.xpus*B.xpu.hbm_gb/1000,1)} TB HBM · ${fmt(n.xpus*B.xpu.hbm_tbs,0)} TB/s HBM`});
  if (n.cpus) bom.push({cat:'Compute', item:B.cpu.name, qty:n.cpus, unit:'CPU', note:B.cpu.mem});
  bom.push({cat:'Compute', item:`${build.board.name}`, qty:n.boards, unit:'boards', note:`${build.board.xpus} XPU + ${build.board.cpus} CPU each`});
  bom.push({cat:'Compute', item:'Compute trays', qty:r.compute_trays, unit:'trays', note:`${r.xpus_per_tray} XPU / ${r.cpus_per_tray} CPU per tray`});
  if (n.sw_chips) bom.push({cat:'Scale-up', item:sw.name, qty:n.sw_chips, unit:'ASICs', note:`${sw.ports} ports × ${L.link_gbps_dir} Gb/s · ${r.switch_trays} switch trays` + (n.sw_intray_chips?` + ${r.switch_chips_per_compute_tray}/compute tray`:'')});
  out.segments.forEach(s => {
    const m = D.MEDIA[s.media];
    if (m.family === 'copper') bom.push({cat:'Scale-up', item:`${m.name} — ${s.name}`, qty:s.links, unit:'links', note:`${fmt(s.pairs)} twinax pairs · ${fmt(s.lanes_total)} lanes per direction`});
    else bom.push({cat:'Scale-up', item:`${m.name} — ${s.name}`, qty:s.modules, unit:'modules', note:`${fmt(s.fibers)} fibers · ${s.links} links`});
  });
  if (n.nics) bom.push({cat:'Scale-out', item:nic.name, qty:n.nics, unit:'NICs', note:`${nic.gbps} Gb/s each · ${nic.form}`});
  if (n.dpus) bom.push({cat:'Scale-out', item:dpu.name, qty:n.dpus, unit:'DPUs', note:`${dpu.gbps} Gb/s each`});
  out.so_segments.forEach(s => {
    const m = D.MEDIA[s.media];
    bom.push({cat:'Scale-out', item:`${m.name} — ${s.name}`, qty:s.modules, unit: m.family==='copper' ? 'cable ends' : 'modules', note:`${fmt(s.gbps_dir/1000,1)} Tb/s per direction · ${s.module_gbps}G`});
  });
  if (S.leaf_switches) bom.push({cat:'Scale-out', item:`${sosw.name} leaf share`, qty:S.leaf_switches, unit:'switches', note:`${fmt(S.leaf_ports_needed,0)} × ${sosw.port_gbps}G downlinks at ${so.oversub}:1`});

  return out;
}

/* One scale-up segment: link count, lanes, media & SerDes power, cost, pairs/fibers. */
function seg(id, name, media, links, L, asm, su, note){
  const m = D.MEDIA[media];
  const both = A(asm,'conv.both_ends');
  const ends = links * (both ? 2 : 1);
  const eq800 = L.link_gbps_dir / 800;
  const lanes_total = links * L.lanes;               // per direction
  const pj = m.id === 'cpo' ? A(asm,'serdes.xsr_pj') : A(asm,'serdes.lr_pj');
  const serdesEnds = A(asm,'serdes.count_switch_side') ? 2 : 1;
  const serdes_w = lanes_total * serdesEnds * L.lane_gbps * pj / 1000;   // Gb/s × pJ/bit = mW
  const media_w = ends * eq800 * A(asm, `media.${media}.w_end`);
  const media_usd = ends * eq800 * A(asm, `media.${media}.usd_end`);
  const pairs = m.family === 'copper' ? lanes_total * 2 * A(asm,'copper.pairs_per_lane') : 0;
  const lpm = A(asm,'optics.lanes_per_module');
  const modules = m.family === 'optical' ? ceil(lanes_total / lpm) * (both ? 2 : 1) : 0;
  const fibers = m.family === 'optical' ? ceil(lanes_total / lpm) * A(asm,'optics.fiber_pairs_per_module') * 2 : 0;
  return { id, name, media, color:m.color, links, ends, lanes_total, gbps_dir: links * L.link_gbps_dir, tbs_bidir: links*L.link_gbps_dir*2/8000,
           serdes_w, media_w, media_usd, pairs, modules, fibers, note, pj };
}
function soSeg(id, name, media, gbps_dir, module_gbps, asm){
  const m = D.MEDIA[media];
  const both = A(asm,'conv.both_ends');
  const links = module_gbps ? ceil(gbps_dir / module_gbps) : 0;       // one module/cable per port
  const ends = links * (both ? 2 : 1);
  const eq800 = module_gbps / 800;
  const lanes = A(asm,'optics.lanes_per_module');
  const lane_gbps = module_gbps / lanes;
  const pj = m.id === 'cpo' ? A(asm,'serdes.xsr_pj') : A(asm,'serdes.lr_pj');
  const serdes_w = links * lanes * 2 * lane_gbps * pj / 1000;
  const media_w = ends * eq800 * A(asm, `media.${media}.w_end`);
  const media_usd = ends * eq800 * A(asm, `media.${media}.usd_end`);
  const modules = ends;
  const fibers = m.family === 'optical' ? links * A(asm,'optics.fiber_pairs_per_module') * 2 : 0;
  const pairs = m.family === 'copper' ? links * lanes * 2 : 0;
  return { id, name, media, color:m.color, links, ends, modules, module_gbps, gbps_dir, tbs_bidir:gbps_dir*2/1000, serdes_w, media_w, media_usd, fibers, pairs, lanes, lane_gbps, pj };
}

function sum(a){ return a.reduce((x,y)=>x+y,0); }
function fmt(v, d){
  if (v === null || v === undefined || !isFinite(v)) return '—';
  if (d === undefined) d = Math.abs(v) >= 100 ? 0 : (Math.abs(v) >= 10 ? 1 : 2);
  return v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}
window.RE_COMPUTE = { compute, fmt };
})();
