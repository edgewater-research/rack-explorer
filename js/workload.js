/* LLM Workload Explorer — how training and inference of a modern LLM map onto rack hardware.
   Pure calculators over (model, hardware, assumptions); every figure on the page is derived. */
(function(){
const D = window.RE_DATA;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const LS = { get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };
const clone = x => JSON.parse(JSON.stringify(x));
const PAL = { w:'#3A6FB5', g:'#B26A2B', o:'#2A9D8F', a:'#8A5FD0', kv:'#2A9D8F', free:'var(--rule-2)' };  // validated categorical set

/* ---------------- number formatting ---------------- */
function fmt(v,d){ if (v===null||v===undefined||!isFinite(v)) return '—'; if (d===undefined) d = Math.abs(v)>=100?0:(Math.abs(v)>=10?1:2); return v.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:0}); }
function si(v, unit='', d){ if (!isFinite(v)) return '—'; const a=Math.abs(v); const u=[[1e15,'P'],[1e12,'T'],[1e9,'G'],[1e6,'M'],[1e3,'k']]; for (const [m,p] of u) if (a>=m) return fmt(v/m,d)+' '+p+unit; return fmt(v,d)+(unit?' '+unit:''); }
function bytes(v,d){ if (!isFinite(v)) return '—'; const a=Math.abs(v); const u=[[1e15,'PB'],[1e12,'TB'],[1e9,'GB'],[1e6,'MB'],[1e3,'kB']]; for (const [m,p] of u) if (a>=m) return fmt(v/m,d)+' '+p; return fmt(v,0)+' B'; }
function params(v){ if (!isFinite(v)) return '—'; return v>=1e12 ? `${fmt(v/1e12,2)}T` : `${fmt(v/1e9,v>=1e10?0:1)}B`; }
function sci(v){ if (!isFinite(v)) return '—'; const e=Math.floor(Math.log10(Math.abs(v))); return `${fmt(v/Math.pow(10,e),2)}×10^${e}`; }
function secs(t){ if (!isFinite(t)) return '—'; if (t<1e-3) return fmt(t*1e6,0)+' µs'; if (t<1) return fmt(t*1e3,1)+' ms'; if (t<90) return fmt(t,2)+' s'; if (t<5400) return fmt(t/60,1)+' min'; if (t<172800) return fmt(t/3600,1)+' h'; return fmt(t/86400,1)+' days'; }

/* ---------------- model presets ---------------- */
const MODELS = [
  { id:'llama405', name:'Llama 3.1 405B', vendor:'Meta', year:'2024', conf:'H', type:'dense', params_b:405, active_b:405, layers:126, d_model:16384, heads:128, kv_heads:8, head_dim:128, experts:0, topk:0, vocab_k:128, ctx_k:128, train_tokens_t:15.6, train_prec:'bf16', kv:'gqa',
    disclosed:{ gpus:16384, gpu:'H100', gpu_hours:30.84e6, bf16_pf:0.989 }, note:'Dense decoder, GQA with 8 KV heads. Meta reports 30.84M H100-hours for pre-training and ~16k GPUs.' },
  { id:'llama70', name:'Llama 3.1 70B', vendor:'Meta', year:'2024', conf:'H', type:'dense', params_b:70.6, active_b:70.6, layers:80, d_model:8192, heads:64, kv_heads:8, head_dim:128, experts:0, topk:0, vocab_k:128, ctx_k:128, train_tokens_t:15, train_prec:'bf16', kv:'gqa',
    disclosed:{ gpus:8192, gpu:'H100', gpu_hours:7.0e6, bf16_pf:0.989 }, note:'The workhorse dense size. Fits in one 8-GPU node at FP8 with room for KV cache.' },
  { id:'dsv3', name:'DeepSeek-V3 / R1', vendor:'DeepSeek', year:'2025', conf:'H', type:'moe', params_b:671, active_b:37, layers:61, d_model:7168, heads:128, kv_heads:128, head_dim:128, experts:256, topk:8, shared:1, vocab_k:129, ctx_k:128, train_tokens_t:14.8, train_prec:'fp8', kv:'mla', mla_dim:576,
    disclosed:{ gpus:2048, gpu:'H800', gpu_hours:2.664e6, bf16_pf:0.989 }, note:'Fine-grained MoE: 256 routed + 1 shared expert, 8 routed per token. Multi-head latent attention compresses KV to 576 values per token per layer. FP8 training on 2,048 H800s, 2.664M GPU-hours for pre-training.' },
  { id:'mixtral', name:'Mixtral 8×22B', vendor:'Mistral', year:'2024', conf:'M', type:'moe', params_b:141, active_b:39, layers:56, d_model:6144, heads:48, kv_heads:8, head_dim:128, experts:8, topk:2, shared:0, vocab_k:32, ctx_k:64, train_tokens_t:8, train_prec:'bf16', kv:'gqa',
    note:'Coarse MoE: 8 large experts, 2 per token. Training token count undisclosed (placeholder).' },
  { id:'gpt4', name:'GPT-4-class (estimate)', vendor:'—', year:'2023', conf:'L', type:'moe', params_b:1800, active_b:280, layers:120, d_model:12288, heads:96, kv_heads:8, head_dim:128, experts:16, topk:2, shared:0, vocab_k:100, ctx_k:128, train_tokens_t:13, train_prec:'bf16', kv:'gqa',
    disclosed:{ gpus:25000, gpu:'A100', gpu_hours:57e6, bf16_pf:0.312 }, note:'Widely circulated estimate, not disclosed: ~1.8T total, 16 experts, ~13T tokens on ~25k A100s for ~95 days.' },
  { id:'frontier', name:'Frontier MoE (illustrative)', vendor:'—', year:'2026', conf:'L', type:'moe', params_b:10000, active_b:1000, layers:160, d_model:24576, heads:192, kv_heads:16, head_dim:128, experts:256, topk:8, shared:1, vocab_k:200, ctx_k:1000, train_tokens_t:40, train_prec:'fp8', kv:'gqa',
    note:'Illustrative 10T-parameter sparse model to show what a 2026-27 training run and serving footprint look like. Every figure is a placeholder.' },
  { id:'custom', name:'Custom model', vendor:'—', year:'', conf:'L', type:'dense', params_b:100, active_b:100, layers:80, d_model:8192, heads:64, kv_heads:8, head_dim:128, experts:0, topk:0, vocab_k:128, ctx_k:128, train_tokens_t:10, train_prec:'bf16', kv:'gqa', note:'Edit freely.' },
];

/* ---------------- assumptions (editable, with confidence) ---------------- */
const ASM_DEF = [
  ['mfu', 'Training MFU', 0.40, '', 'M', 'Model FLOPs utilisation. Meta reports 38–43% for Llama 3 405B at 16k GPUs; small clusters reach 50%+.'],
  ['state_bpp', 'Training state bytes per parameter', 16, 'B', 'H', 'BF16 weights (2) + BF16 grads (2) + FP32 master weights, Adam m and v (12) = 16 B. FP8 recipes land near 14.'],
  ['seq', 'Training sequence length', 8192, 'tokens', 'H', 'Adds the quadratic attention term. Long-context stages run 128k.'],
  ['gbs', 'Global batch per step', 16e6, 'tokens', 'M', 'Llama 3 405B used 16M tokens per step for most of pre-training.'],
  ['micro', 'Micro-batch per GPU', 8192, 'tokens', 'M', 'One sequence per micro-batch at the training sequence length.'],
  ['tp', 'Tensor parallel (TP)', 8, 'GPUs', 'H', 'Must fit inside the scale-up domain. NVL72 allows up to 72.'],
  ['pp', 'Pipeline parallel (PP)', 16, 'stages', 'M', 'Layers split across trays or racks; point-to-point activation traffic.'],
  ['ep', 'Expert parallel (EP, MoE only)', 8, 'GPUs', 'M', 'Experts spread across EP ranks; all-to-all per MoE layer.'],
  ['fsdp', 'Shard weights + optimizer across DP (ZeRO-3 / FSDP)', true, '', 'H', 'Otherwise every DP replica holds the full state.'],
  ['recompute', 'Full activation recompute', false, '', 'M', 'Stores only layer inputs (2·d bytes per token per layer) at ~33% extra FLOPs.'],
  ['gpu_hr_usd', 'GPU-hour price', 3.0, '$', 'L', 'Blended H100/B200 cloud-class rate for context only.'],
  ['pue', 'Facility overhead on GPU TDP', 1.5, '×', 'M', 'Covers CPU, memory, network, cooling and PUE.'],
  ['ckpt_min', 'Checkpoint interval', 30, 'min', 'M', 'Full weights + optimizer written to storage.'],
  ['fail_rate', 'Unexpected interruptions per GPU-day', 0.00048, '', 'M', 'Meta: 419 unexpected interruptions in 54 days on 16,384 H100s.'],
  ['w_prec', 'Serving weight precision', 'fp8', '', 'H', 'FP4 halves bytes per parameter again; accuracy recipes vary.'],
  ['kv_prec', 'KV cache precision', 'fp8', '', 'M', 'FP8 KV is common in production; BF16 doubles the footprint.'],
  ['tp_serve', 'Serving tensor parallel', 0, 'GPUs', 'M', '0 = pick the smallest power of two that holds weights with 35% headroom.'],
  ['batch', 'Concurrent sequences per TP group', 64, '', 'M', 'The batch a decode step serves.'],
  ['in_tok', 'Input tokens per request', 4096, 'tokens', 'M', ''],
  ['out_tok', 'Output tokens per request', 1024, 'tokens', 'M', 'Reasoning models emit 5–30k.'],
  ['bw_eff', 'Achieved fraction of HBM bandwidth', 0.80, '', 'M', ''],
  ['c_eff', 'Achieved fraction of peak FLOPS in decode', 0.60, '', 'M', ''],
  ['mfu_prefill', 'Prefill MFU', 0.65, '', 'M', ''],
  ['ar_us', 'All-reduce latency per op in the NVLink domain', 12, 'µs', 'M', 'Small-message collective latency. Two per layer in TP decode.'],
  ['kv_reserve', 'HBM reserved for runtime / fragmentation', 0.10, '', 'M', ''],
];
const asmDefault = {}; ASM_DEF.forEach(r=>asmDefault[r[0]]=r[2]);

/* ---------------- state ---------------- */
const state = {
  modelId:'llama405', model:null, rackId:'gb200_nvl72', racks:24,
  asm: Object.assign({}, asmDefault, LS.get('wl.asm', {})),
};
function loadModel(id){ state.modelId=id; state.model=clone(MODELS.find(m=>m.id===id)||MODELS[0]); }
function hardware(){
  const p = D.PRESETS.find(x=>x.id===state.rackId) || D.PRESETS[0];
  const X = D.XPUS[p.xpu], su = p.scaleup, r = p.rack;
  const xpus = r.compute_trays*r.xpus_per_tray;
  const domain = (su.topology==='switched'||/torus/.test(su.topology)) ? xpus : r.xpus_per_tray;
  const nic = D.NICS[p.nic];
  return { preset:p, xpu:X, name:p.name, xpu_name:X.name, hbm_gb:X.hbm_gb, hbm_bw:X.hbm_tbs*1e12, tdp:X.tdp_w,
    peak:{ bf16:(X.fp8_pf/2)*1e15, fp8:X.fp8_pf*1e15, fp4:(X.fp4_pf||X.fp8_pf*2)*1e15 },
    su_GBs: su.links_per_xpu*su.lanes_per_link*su.lane_gbps/8*1e9,       // bytes/s per direction per GPU
    so_GBs: r.nics_per_xpu*nic.gbps/8*1e9, domain, xpus_per_rack:xpus, rack_kw:r.power_kw, su_name:su.name, su_media:D.MEDIA[su.media_xpu_sw].name, topology:D.TOPOLOGIES[su.topology].name };
}

/* ---------------- calculators ---------------- */
function calc(){
  const m=state.model, A=state.asm, hw=hardware();
  const N_total=m.params_b*1e9, N_act=m.active_b*1e9, L=m.layers, d=m.d_model;
  const out={hw, m};
  const N = state.racks*hw.xpus_per_rack; out.N=N;
  const b_train = m.train_prec==='fp8' ? 1 : 2;

  /* ---- training ---- */
  const T=out.train={};
  T.prec = m.train_prec; T.peak = hw.peak[m.train_prec];
  T.flops_dense = 6*N_act; T.flops_attn = 12*L*d*A.seq;
  T.flops_tok = (T.flops_dense + T.flops_attn) * (A.recompute?1.33:1);
  T.tokens = m.train_tokens_t*1e12;
  T.total = T.flops_tok*T.tokens;
  T.eff_gpu = T.peak*A.mfu;
  T.gpu_hours = T.total/T.eff_gpu/3600;
  T.days = T.gpu_hours/(N*24);
  T.mwh = T.gpu_hours*hw.tdp*A.pue/1e6;
  T.usd = T.gpu_hours*A.gpu_hr_usd;
  T.tok_per_s_gpu = T.eff_gpu/T.flops_tok;
  T.tok_per_s = T.tok_per_s_gpu*N;
  if (m.disclosed?.gpu_hours){ const eff = T.total/(m.disclosed.gpu_hours*3600*m.disclosed.bf16_pf*1e15); T.disclosed_mfu = eff; }
  // parallelism
  T.tp=Math.max(1,A.tp|0); T.pp=Math.max(1,A.pp|0); T.ep = m.type==='moe'?Math.max(1,A.ep|0):1;
  T.dp = Math.max(1, Math.floor(N/(T.tp*T.pp)));
  T.gpus_used = T.tp*T.pp*T.dp;
  T.tp_fits = T.tp<=hw.domain; T.ep_fits = T.tp*T.ep<=hw.domain;
  // memory per GPU
  const state_bytes = N_total*A.state_bpp;
  T.state_total = state_bytes;
  T.state_per_gpu = state_bytes/(T.tp*T.pp*(A.fsdp?T.dp:1));
  T.min_gpus_state = Math.ceil(state_bytes/(hw.hbm_gb*1e9*0.9));
  const act_per_tok_layer = (A.recompute?2:34)*d;   // bytes, BF16 activations, flash attention
  T.act_per_gpu = A.micro*(L/T.pp)*act_per_tok_layer/T.tp;
  T.weights_per_gpu = N_total*2/(T.tp*T.pp*(A.fsdp?T.dp:1)); T.grads_per_gpu=T.weights_per_gpu; T.opt_per_gpu = T.state_per_gpu - 2*T.weights_per_gpu;
  T.mem_per_gpu = T.state_per_gpu + T.act_per_gpu;
  T.hbm = hw.hbm_gb*1e9; T.mem_fits = T.mem_per_gpu <= T.hbm*0.92;
  // step timing and communication
  T.step_tokens = A.gbs; T.step_time = A.gbs/T.tok_per_s;
  T.microbatches = A.gbs/(T.dp*A.micro);
  const grad_bytes = N_total*2/(T.tp*T.pp);
  T.comm = [];
  const dp_bytes = (A.fsdp?3:2)*grad_bytes*(T.dp-1)/T.dp;
  T.comm.push({k:'DP', name:A.fsdp?'FSDP all-gather ×2 + reduce-scatter':'Gradient all-reduce', bytes:dp_bytes, net:'Scale-out', bw:hw.so_GBs, t:dp_bytes/hw.so_GBs, note:`${T.dp} replicas · ${bytes(grad_bytes)} of BF16 grads per GPU · overlaps with backward`});
  const act_bytes = A.micro*d*2;
  const tp_bytes = T.tp>1 ? 2*2*2*(T.tp-1)/T.tp*act_bytes*(L/T.pp)*T.microbatches : 0;
  T.comm.push({k:'TP', name:'Activation all-reduce (2 per layer, fwd+bwd)', bytes:tp_bytes, net:T.tp_fits?'Scale-up':'Scale-out (does not fit domain)', bw:T.tp_fits?hw.su_GBs:hw.so_GBs, t:tp_bytes/(T.tp_fits?hw.su_GBs:hw.so_GBs), note:`${T.tp}-way · ${fmt(T.microbatches,0)} micro-batches × ${fmt(L/T.pp,0)} layers per step · latency-sensitive`});
  const pp_bytes = T.pp>1 ? 2*act_bytes/T.tp*T.microbatches : 0;
  T.comm.push({k:'PP', name:'Stage-to-stage activations and grads', bytes:pp_bytes, net:'Scale-out', bw:hw.so_GBs, t:pp_bytes/hw.so_GBs, note:`${T.pp} stages · point-to-point · bubble ≈ ${fmt((T.pp-1)/T.microbatches*100,1)}% of step`});
  if (m.type==='moe'){ const ep_bytes = 4*A.micro*m.topk*d*2*(L/T.pp)*T.microbatches/T.tp; const fits=T.ep_fits; T.comm.push({k:'EP', name:'Expert all-to-all (dispatch + combine, fwd+bwd)', bytes:ep_bytes, net:fits?'Scale-up':'Scale-out', bw:fits?hw.su_GBs:hw.so_GBs, t:ep_bytes/(fits?hw.su_GBs:hw.so_GBs), note:`${T.ep}-way · ${m.topk} of ${m.experts} experts per token · ${L} MoE layers`}); }
  T.comm.forEach(c=>c.pct=c.t/T.step_time*100);
  // checkpoint and reliability
  T.ckpt_bytes = N_total*(A.state_bpp-2); // weights + optimizer, no grads
  T.ckpt_bw = T.ckpt_bytes/(A.ckpt_min*60);
  T.frontend_bw = N*(D.DPUS[hw.preset.dpu].gbps*hw.preset.rack.dpus_per_tray/hw.preset.rack.xpus_per_tray)/8*1e9;
  T.ckpt_time_frontend = T.ckpt_bytes/Math.max(1,T.frontend_bw);
  T.interruptions_day = N*A.fail_rate;
  T.mtbf_h = 24/Math.max(1e-9,T.interruptions_day);
  T.lost_pct = Math.min(100, (T.interruptions_day*(A.ckpt_min/2+10)/60)/24*100);  // half interval lost + 10 min restart

  /* ---- inference ---- */
  const I=out.inf={};
  const bw_map={bf16:2,fp8:1,fp4:0.5}; I.b_w=bw_map[A.w_prec]; I.b_kv=bw_map[A.kv_prec]||1; I.prec=A.w_prec;
  I.weights = N_total*I.b_w;
  I.kv_tok = m.kv==='mla' ? L*(m.mla_dim||576)*I.b_kv : 2*L*m.kv_heads*m.head_dim*I.b_kv;
  I.ctx = A.in_tok + A.out_tok;
  I.kv_seq = I.kv_tok*I.ctx;
  const hbm = hw.hbm_gb*1e9*(1-A.kv_reserve);
  let tp = A.tp_serve|0; if (!tp){ tp=1; while (tp<hw.domain && I.weights*1.35 > tp*hbm) tp*=2; if (I.weights*1.35 > tp*hbm) tp=hw.domain; }
  I.tp=tp; I.tp_fits = tp<=hw.domain;
  I.kv_cap = Math.max(0, tp*hbm - I.weights);
  I.max_seqs = Math.floor(I.kv_cap/Math.max(1,I.kv_seq));
  I.max_tokens_cached = I.kv_cap/I.kv_tok;
  I.batch = Math.max(1, A.batch|0);
  I.batch_fits = I.batch <= I.max_seqs;
  I.peak = hw.peak[A.w_prec==='bf16'?'bf16':(A.w_prec==='fp4'?'fp4':'fp8')];
  // MoE: experts touched grows with batch
  const dense_part = m.type==='moe' ? Math.max(0, N_act - (N_total-0)*0) : N_act;  // placeholder replaced below
  const expert_total = m.type==='moe' ? N_total - (N_act - (N_act*0)) : 0; void dense_part; void expert_total;
  const per_expert = m.type==='moe' ? (N_total - N_act*0.35)/(m.experts||1) : 0;   // ~65% of active params are routed experts in fine-grained MoE
  const attn_part = m.type==='moe' ? N_act - m.topk*per_expert : N_act;
  const touched = B => m.type==='moe' ? m.experts*(1-Math.pow(1-m.topk/m.experts, B)) : 0;
  I.weights_read = B => (Math.max(0,attn_part) + touched(B)*per_expert)*I.b_w;
  I.step = B => {
    const avg_ctx = A.in_tok + A.out_tok/2;
    const mem = (I.weights_read(B) + B*I.kv_tok*avg_ctx)/(tp*hw.hbm_bw*A.bw_eff);
    const comp = (2*N_act*B + 4*L*d*avg_ctx*B)/(tp*I.peak*A.c_eff);
    const comm = tp>1 ? 2*L*A.ar_us*1e-6 + (m.type==='moe'?L*A.ar_us*1e-6:0) : 0;
    return { t: Math.max(mem,comp)+comm, mem, comp, comm };
  };
  const st = I.step(I.batch); I.step_t=st.t; I.step_mem=st.mem; I.step_comp=st.comp; I.step_comm=st.comm;
  I.tok_s_user = 1/I.step_t; I.tok_s_group = I.batch/I.step_t;
  I.bound = st.mem>=st.comp ? 'HBM-bandwidth bound' : 'compute bound';
  // crossover batch
  let Bx=1; for (let B=1;B<=65536;B*=1.05){ const s2=I.step(Math.round(B)); if (s2.comp>=s2.mem){ Bx=Math.round(B); break; } Bx=Math.round(B); }
  I.batch_x = Bx;
  I.curve = []; for (let e=0;e<=13;e+=0.25){ const B=Math.round(Math.pow(2,e)); const s2=I.step(B); I.curve.push({B, tps:B/s2.t, user:1/s2.t}); }
  // prefill
  I.ttft = (2*N_act*A.in_tok + 4*L*d*A.in_tok*A.in_tok/2)/(tp*I.peak*A.mfu_prefill) + (tp>1?2*L*A.ar_us*1e-6:0);
  I.decode_total = A.out_tok*I.step_t;
  I.decode_share = I.decode_total/(I.decode_total+I.ttft);
  // disaggregation: KV handoff
  I.kv_transfer = I.kv_tok*A.in_tok;
  I.kv_t_su = I.kv_transfer/hw.su_GBs; I.kv_t_so = I.kv_transfer/hw.so_GBs;
  // rack level
  I.groups_rack = Math.floor(hw.xpus_per_rack/tp);
  I.users_rack = I.groups_rack*I.batch;
  I.tok_s_rack = I.groups_rack*I.tok_s_group;
  I.tok_s_mw = I.tok_s_rack/(hw.rack_kw/1000);
  I.tok_per_kwh = I.tok_s_rack*3600/hw.rack_kw;
  return out;
}

/* ---------------- SVG helpers (house drawing vocabulary) ---------------- */
function rect(x,y,w,h,o={}){ return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx??0}" class="${o.cls||''}" ${o.style?`style="${o.style}"`:''}/>`; }
function text(x,y,s,o={}){ return `<text x="${x}" y="${y}" class="${o.cls||'t-label'}" text-anchor="${o.anchor||'start'}" ${o.style?`style="${o.style}"`:''}>${esc(s)}</text>`; }
function line(x1,y1,x2,y2,o={}){ return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${o.cls||''}" ${o.style?`style="${o.style}"`:''} ${o.extra||''}/>`; }
function path(dd,o={}){ return `<path d="${dd}" class="${o.cls||'f-none'}" ${o.style?`style="${o.style}"`:''} ${o.extra||''}/>`; }
function svg(w,h,inner,label){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label||'')}"><defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:var(--ink-2)"/></marker><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" style="stroke:var(--ink-3);stroke-width:.8;opacity:.6"/></pattern></defs>${inner}</svg>`; }
function box(x,y,w,h,title,lines,fill,o={}){ let s = rect(x,y,w,h,{rx:6,cls:`${fill} ink`,style:'stroke-width:1.2'}) + text(x+w/2,y+20,title,{cls:'t-chip',anchor:'middle'}); (lines||[]).forEach((l,i)=>{ s += text(x+w/2,y+36+i*13,l,{cls:'t-chip-s',anchor:'middle'}); }); if (o.tag) s += rect(x+8,y-9,o.tag.length*6.4+12,16,{rx:8,style:`fill:${o.tagColor||'var(--brand)'}`}) + text(x+14,y+3,o.tag,{cls:'t-tb',style:'fill:#fff;font-weight:600'}); return s; }
function arrow(x1,y1,x2,y2,color,label,o={}){ let s = path(`M${x1} ${y1} L${x2} ${y2}`,{style:`stroke:${color||'var(--ink-2)'};stroke-width:${o.w||1.6}${o.dash?';stroke-dasharray:6 4':''}`, extra:'marker-end="url(#ar)"'}); if (label) s += text((x1+x2)/2+(o.dx||0),(y1+y2)/2+(o.dy||-6),label,{cls:'t-small',anchor:'middle'}); return s; }

/* ---------------- figures ---------------- */
function figLifecycle(c){
  const W=980,H=250, m=c.m, T=c.train, I=c.inf;
  const steps=[
    ['Data','f-mem',[`${fmt(m.train_tokens_t,1)}T tokens`,'crawl · code · synthetic','filter · dedupe · mix'],'CPU + storage'],
    ['Pre-training','f-xpu',[`${sci(T.total)} FLOPs`,`${fmt(T.days,0)} days on ${si(c.N,'',1)} GPUs`,'next-token prediction'],'GPUs · scale-up · scale-out'],
    ['Post-training','f-cpu',['SFT on curated dialogues','RL: RLHF / verifiable rewards','rollouts = inference at scale'],'GPUs + inference fleet'],
    ['Evals & safety','f-panel',['benchmarks · red-team','distill smaller variants','quantise: FP8 / FP4'],'Inference GPUs'],
    ['Serving','f-nic',[`prefill: TTFT ${secs(I.ttft)}`,`decode: ${fmt(I.tok_s_user,0)} tok/s per user`,`${fmt(I.users_rack)} users per rack`],'HBM · NVLink domain · optics'],
  ];
  const bw=170, gap=(W-40-steps.length*bw)/(steps.length-1); let s='';
  steps.forEach((st,i)=>{ const x=20+i*(bw+gap); s += box(x,50,bw,110,st[0],st[2],st[1]); s += text(x+bw/2,182,st[3],{cls:'t-eyebrow',anchor:'middle'}); if (i<steps.length-1) s += arrow(x+bw+2,105,x+bw+gap-2,105,'var(--ink-2)'); });
  s += path(`M${20+4*(bw+gap)+bw/2} 160 C ${20+4*(bw+gap)+bw/2} 230, ${20+2*(bw+gap)+bw/2} 230, ${20+2*(bw+gap)+bw/2} 162`,{style:'stroke:var(--brand);stroke-width:1.4;stroke-dasharray:6 4',extra:'marker-end="url(#ar)"'});
  s += text(20+3*(bw+gap)+bw/2, 224, 'RL rollouts and synthetic data: inference feeds training', {cls:'t-small',anchor:'middle',style:'fill:var(--brand)'});
  return svg(W,H,s,'LLM lifecycle');
}
function figTrainStep(c){
  const W=980,H=300,T=c.train,hw=c.hw; let s='';
  const cx=[110,350,590,830], y=70, w=200, h=120;
  const phases=[
    ['Forward','f-xpu',[`2·N·tokens = ${sci(2*c.m.active_b*1e9*T.step_tokens)} FLOPs`,'reads weights from HBM','TP all-reduce ×2 per layer'],'Tensor cores + HBM + NVLink'],
    ['Backward','f-xpu',[`4·N·tokens = ${sci(4*c.m.active_b*1e9*T.step_tokens)} FLOPs`,'activations read back or recomputed','grads produced layer by layer'],'Tensor cores + HBM + NVLink'],
    ['Gradient sync','f-sw',[`${bytes(T.comm[0].bytes)} per GPU per step`,`${T.dp}-way ${state.asm.fsdp?'FSDP collectives':'all-reduce'}`,`${secs(T.comm[0].t)} at ${bytes(hw.so_GBs,0)}/s`],'Scale-out NICs + leaf/spine'],
    ['Optimizer step','f-cpu',['Adam: m, v, FP32 master → BF16',`${bytes(T.state_per_gpu)} state per GPU`,'pure HBM read-modify-write'],'HBM bandwidth'],
  ];
  phases.forEach((p,i)=>{ s += box(cx[i]-w/2,y,w,h,p[0],p[2],p[1],{tag:`${i+1}`}); s += text(cx[i],y+h+22,p[3],{cls:'t-eyebrow',anchor:'middle'}); if (i<3) s += arrow(cx[i]+w/2+2,y+h/2,cx[i+1]-w/2-2,y+h/2,'var(--ink-2)'); });
  s += path(`M${cx[3]} ${y+h+40} C ${cx[3]} ${H-20}, ${cx[0]} ${H-20}, ${cx[0]} ${y+h+40}`,{style:'stroke:var(--ink-2);stroke-width:1.4',extra:'marker-end="url(#ar)"'});
  s += text(W/2, H-18, `one step = ${si(T.step_tokens,'tokens',0)} → ${secs(T.step_time)} on ${si(T.gpus_used,'',1)} GPUs · ${fmt(T.tokens/T.step_tokens,0)} steps in the run`, {cls:'t-mono',anchor:'middle'});
  s += text(20,30,'ONE TRAINING ITERATION',{cls:'t-eyebrow'});
  return svg(W,H,s,'Training step');
}
function figParallelism(c){
  const T=c.train, hw=c.hw, W=980, H=360; let s='';
  const tp=T.tp, pp=T.pp, dp=T.dp;
  const showDp=Math.min(dp,3), showPp=Math.min(pp,6), showTp=Math.min(tp,8);
  const cell=14, gap=3, gridW=showTp*(cell+gap), gridH=showPp*(cell+gap);
  const repW=gridW+90, repGap=30, x0=(W-(showDp*repW+(showDp-1)*repGap))/2+10, y0=70;
  for (let r=0;r<showDp;r++){
    const rx=x0+r*(repW+repGap);
    s += rect(rx-10,y0-30,repW,gridH+70,{rx:6,cls:'f-none ink2',style:'stroke-dasharray:5 4'}) + text(rx,y0-14,`DP replica ${r+1}${r===showDp-1&&dp>showDp?` … ${dp}`:''}`,{cls:'t-eyebrow'});
    for (let p=0;p<showPp;p++){
      const gy=y0+p*(cell+gap);
      s += rect(rx-2,gy-2,gridW+2,cell+4,{rx:3,style:`fill:${PAL.g};fill-opacity:.12`});   // TP group = NVLink domain slice
      for (let t=0;t<showTp;t++){ s += rect(rx+t*(cell+gap),gy,cell,cell,{rx:2,cls:'f-xpu ink2',style:'stroke-width:.6'}); }
      s += text(rx+gridW+8,gy+cell-3,`stage ${p+1}${p===showPp-1&&pp>showPp?` … ${pp}`:''}`,{cls:'t-tb'});
    }
    if (tp>showTp) s += text(rx+gridW/2, y0+gridH+8, `TP ${tp} (8 drawn)`, {cls:'t-tb',anchor:'middle'});
    else s += text(rx+gridW/2, y0+gridH+8, `TP ${tp}`, {cls:'t-tb',anchor:'middle'});
    // PP arrows down the stages
    s += arrow(rx-6, y0, rx-6, y0+gridH-4, PAL.a, '', {w:1.2});
  }
  // DP arcs between replicas
  for (let r=0;r<showDp-1;r++){ const ax=x0+r*(repW+repGap)+repW-10, bx=x0+(r+1)*(repW+repGap)-10; s += path(`M${ax} ${y0+gridH/2} L${bx} ${y0+gridH/2}`,{style:`stroke:${PAL.w};stroke-width:2`,extra:'marker-end="url(#ar)" marker-start="url(#ar)"'}); }
  // legend & networks
  const ly=y0+gridH+70;
  const items=[[PAL.g,`TP ${tp}: tensor slices of every layer · all-reduce on ${hw.su_name} (${T.tp_fits?'fits the '+hw.domain+'-GPU domain':'EXCEEDS the '+hw.domain+'-GPU domain'})`],[PAL.a,`PP ${pp}: layer stages · activations hop tray-to-tray on the scale-out NICs`],[PAL.w,`DP ${dp}: ${A_fsdp()} · gradients synced across racks on the scale-out network`]];
  if (c.m.type==='moe') items.push([PAL.o,`EP ${T.ep}: experts spread over ${T.ep} GPUs · all-to-all per MoE layer ${T.ep_fits?'inside the NVLink domain':'crosses the scale-out network'}`]);
  items.forEach((it,i)=>{ s += rect(24,ly+i*18-9,12,10,{rx:2,style:`fill:${it[0]}`}) + text(44,ly+i*18,it[1],{cls:'t-small'}); });
  s += text(24,30,`${si(T.gpus_used,'',1)} GPUs = TP ${tp} × PP ${pp} × DP ${dp}${c.m.type==='moe'?` (EP ${T.ep} inside DP)`:''}`,{cls:'t-eyebrow'});
  function A_fsdp(){ return state.asm.fsdp?'weights + optimizer sharded (FSDP)':'full replicas'; }
  return svg(W,H,s,'Parallelism map');
}
function figMemory(c){
  const T=c.train, I=c.inf, hw=c.hw, W=980, H=190; let s='';
  const bx=200, bw=620, bh=22;
  const bar=(y,label,segs,total,cap,capLabel)=>{
    s += text(bx-12,y+bh-6,label,{cls:'t-label',anchor:'end'});
    const scale = bw/Math.max(cap, total);
    let x=bx; segs.forEach(sg=>{ const w=Math.max(0,sg.v*scale-2); if (w>0){ s += rect(x,y,w,bh,{rx:0,style:`fill:${sg.c}`}); if (w>70) s += text(x+w/2,y+bh-7,`${sg.n} ${bytes(sg.v,0)}`,{cls:'t-tb',anchor:'middle',style:'fill:#fff;font-weight:600'}); } x += sg.v*scale; });
    s += line(bx+cap*scale, y-6, bx+cap*scale, y+bh+6, {style:'stroke:var(--bad);stroke-width:1.5'}) + text(bx+cap*scale+6, y+bh-6, capLabel, {cls:'t-mono',style:'fill:var(--bad)'});
    s += text(bx+bw+8, y+bh-6, '', {cls:'t-mono'});
  };
  bar(40, 'Training, per GPU', [{n:'weights',v:T.weights_per_gpu,c:PAL.w},{n:'grads',v:T.grads_per_gpu,c:PAL.g},{n:'optimizer',v:T.opt_per_gpu,c:PAL.o},{n:'activations',v:T.act_per_gpu,c:PAL.a}], T.mem_per_gpu, T.hbm, `${hw.hbm_gb} GB HBM`);
  bar(110, `Serving, per ${I.tp}-GPU group`, [{n:'weights',v:I.weights,c:PAL.w},{n:`KV cache × ${I.batch}`,v:I.batch*I.kv_seq,c:PAL.o}], I.weights+I.batch*I.kv_seq, I.tp*hw.hbm_gb*1e9, `${fmt(I.tp*hw.hbm_gb)} GB`);
  s += text(bx, 28, `Training total ${bytes(T.mem_per_gpu)} of ${hw.hbm_gb} GB (${fmt(T.mem_per_gpu/T.hbm*100,0)}%) · ${T.mem_fits?'fits':'DOES NOT FIT — raise TP/PP or enable FSDP'}`, {cls:'t-small'});
  s += text(bx, 98, `Serving: weights ${bytes(I.weights)} + KV ${bytes(I.batch*I.kv_seq)} for ${I.batch} × ${si(I.ctx,'',0)}-token sequences · room for ${fmt(I.max_seqs)} sequences`, {cls:'t-small'});
  s += text(bx, 160, `${I.max_seqs<I.batch?'Batch exceeds KV capacity: cut context, batch, or add GPUs to the group.':'Headroom '+bytes(I.kv_cap - I.batch*I.kv_seq)+' of KV cache remains.'}`, {cls:'t-small',style:I.max_seqs<I.batch?'fill:var(--bad)':''});
  const leg = `<div class="legend"><span style="--c:${PAL.w}">weights</span><span style="--c:${PAL.g}">gradients</span><span style="--c:${PAL.o}">optimizer state / KV cache</span><span style="--c:${PAL.a}">activations</span><span style="--c:var(--bad)">HBM limit</span></div>`;
  return svg(W,H,s,'Memory budget') + leg;
}
function figRoofline(c){
  const I=c.inf, W=980, H=320, px=70, py=30, pw=W-px-40, ph=H-py-70; let s='';
  const xs=I.curve.map(p=>Math.log2(p.B)), ys=I.curve.map(p=>p.tps);
  const xmax=13, ymax=Math.max(...ys)*1.15;
  const X=b=>px+Math.log2(b)/xmax*pw, Y=v=>py+ph-v/ymax*ph;
  // regions
  const bx=X(I.batch_x);
  s += rect(px,py,Math.max(0,bx-px),ph,{style:`fill:${PAL.o};fill-opacity:.07`}) + rect(bx,py,Math.max(0,px+pw-bx),ph,{style:`fill:${PAL.w};fill-opacity:.07`});
  s += text(px+8,py+16,'HBM-bandwidth bound: every step re-reads the weights',{cls:'t-small'}) + text(px+pw-8,py+16,'compute bound: tensor cores saturate',{cls:'t-small',anchor:'end'});
  // grid & axes
  const ticks=5; for (let i=0;i<=ticks;i++){ const v=ymax*i/ticks, y=Y(v); s += line(px,y,px+pw,y,{cls:'rule2'}) + text(px-8,y+4,si(v,'',0),{cls:'t-mono',anchor:'end'}); }
  for (let e=0;e<=xmax;e+=2){ const x=X(Math.pow(2,e)); s += line(x,py+ph,x,py+ph+4,{cls:'ink2'}) + text(x,py+ph+18,fmt(Math.pow(2,e),0),{cls:'t-mono',anchor:'middle'}); }
  s += text(px+pw/2,H-14,'concurrent sequences per TP group (batch)',{cls:'t-small',anchor:'middle'}) + text(16,py+ph/2,'tokens / s',{cls:'t-small',anchor:'middle',style:`transform:rotate(-90deg);transform-origin:16px ${py+ph/2}px`});
  // line
  let dd=''; I.curve.forEach((p,i)=>{ dd += (i?'L':'M')+X(p.B).toFixed(1)+' '+Y(p.tps).toFixed(1)+' '; });
  s += path(dd,{style:`stroke:${PAL.w};stroke-width:2;stroke-linejoin:round`});
  // crossover marker
  s += line(bx,py,bx,py+ph,{style:'stroke:var(--ink-3);stroke-dasharray:3 3'}) + text(bx+6,py+ph-8,`knee ≈ batch ${fmt(I.batch_x,0)}`,{cls:'t-mono'});
  // current batch marker
  const cur=I.curve.reduce((a,p)=>Math.abs(p.B-I.batch)<Math.abs(a.B-I.batch)?p:a, I.curve[0]);
  s += `<circle cx="${X(I.batch)}" cy="${Y(I.tok_s_group)}" r="6" style="fill:${PAL.w};stroke:var(--sheet);stroke-width:2"/>`;
  s += text(X(I.batch)+10,Y(I.tok_s_group)-8,`batch ${I.batch}: ${si(I.tok_s_group,'tok/s',1)} · ${fmt(I.tok_s_user,0)} tok/s per user`,{cls:'t-mono',anchor:X(I.batch)>W*0.6?'end':'start'});
  void cur;
  return `<div style="position:relative" id="roof-wrap">${svg(W,H,s,'Decode throughput vs batch')}<div class="tip" id="roof-tip"></div></div>`;
}
function figInference(c){
  const I=c.inf, hw=c.hw, W=980, H=330; let s='';
  s += text(20,26,'DISAGGREGATED SERVING: PREFILL AND DECODE ON DIFFERENT GPU POOLS',{cls:'t-eyebrow'});
  s += box(20,60,150,90,'Request',[`${si(state.asm.in_tok,'',0)} input tokens`,`${si(state.asm.out_tok,'',0)} output tokens`],'f-panel');
  s += arrow(172,105,238,105,'var(--ink-2)');
  s += box(240,50,230,110,'Prefill pool',[`compute bound · ${I.prec.toUpperCase()}`,`2·N·prompt = ${sci(2*c.m.active_b*1e9*state.asm.in_tok)} FLOPs`,`TTFT ≈ ${secs(I.ttft)} on TP ${I.tp}`,`writes ${bytes(I.kv_transfer)} of KV`],'f-xpu',{tag:'compute'});
  s += arrow(472,105,548,105,PAL.o,'',{w:2.4});
  s += text(510,92,'KV handoff',{cls:'t-small',anchor:'middle'}) + text(510,124,`${secs(I.kv_t_su)} on ${hw.su_name}`,{cls:'t-mono',anchor:'middle'}) + text(510,137,`${secs(I.kv_t_so)} on scale-out`,{cls:'t-mono',anchor:'middle'});
  s += box(550,50,230,110,'Decode pool',[`HBM-bandwidth bound`,`reads ${bytes(I.weights_read(I.batch))} weights + KV per step`,`${secs(I.step_t)} per token · ${fmt(I.tok_s_user,0)} tok/s per user`,`batch ${I.batch} → ${si(I.tok_s_group,'tok/s',1)}`],'f-nic',{tag:'memory',tagColor:PAL.o});
  s += arrow(782,105,850,105,'var(--ink-2)'); s += box(852,60,110,90,'Stream',['tokens to user',`${fmt(I.tok_s_user,0)} tok/s`],'f-panel');
  // KV cache store
  s += rect(520,200,300,44,{rx:5,cls:'f-mem ink2'}) + rect(526,206,288,32,{cls:'hatch'}) + text(670,226,`KV cache · ${bytes(I.kv_seq)} per sequence · ${fmt(I.max_seqs)} fit`,{cls:'t-tb-b',anchor:'middle',style:'font-size:11px'});
  s += arrow(665,162,665,196,PAL.o,'',{w:1.6}); s += arrow(600,196,600,162,PAL.o,'',{w:1.6});
  // MoE all-to-all
  if (c.m.type==='moe'){ s += rect(240,200,230,70,{rx:5,cls:'f-sw ink2'}) + text(355,222,'MoE expert parallel',{cls:'t-chip',anchor:'middle',style:'font-size:12px'}) + text(355,238,`${c.m.experts} experts over ${Math.min(hw.domain,I.tp*Math.max(1,state.asm.ep))} GPUs · ${c.m.topk} per token`,{cls:'t-chip-s',anchor:'middle'}) + text(355,252,`all-to-all every layer: ${hw.su_name} latency sets the floor`,{cls:'t-chip-s',anchor:'middle'}); s += arrow(355,162,355,196,PAL.g,'',{w:1.4}); }
  else { s += text(355,230,'Dense model: TP all-reduce twice per layer',{cls:'t-small',anchor:'middle'}) + text(355,246,`${2*c.m.layers} collectives per token · ${secs(I.step_comm)} floor`,{cls:'t-mono',anchor:'middle'}); }
  s += text(20,300,`Per rack: ${I.groups_rack} groups of TP ${I.tp} → ${fmt(I.users_rack)} concurrent users at ${si(I.ctx,'',0)} tokens · ${si(I.tok_s_rack,'tok/s',1)} · ${si(I.tok_s_mw,'tok/s per MW',1)}`,{cls:'t-label'});
  s += text(20,318,`Decode is ${fmt(I.decode_share*100,0)}% of request time at ${si(state.asm.out_tok,'',0)} output tokens — reasoning-length outputs make serving a memory-bandwidth and interconnect problem.`,{cls:'t-small'});
  return svg(W,H,s,'Inference dataflow');
}

/* ---------------- page ---------------- */
function tiles(c){
  const T=c.train, I=c.inf;
  return `<div class="tiles">
    <div class="tile"><span class="k">Pre-training compute</span><span class="v">${sci(T.total)}<small>FLOPs</small></span><span class="s">6·N·D with N = ${params(c.m.active_b*1e9)} active params, D = ${fmt(c.m.train_tokens_t,1)}T tokens</span></div>
    <div class="tile"><span class="k">Wall clock</span><span class="v">${fmt(T.days,0)}<small>days</small></span><span class="s">${si(T.gpu_hours,'',1)} GPU-hours on ${si(c.N,'',1)} × ${c.hw.xpu_name.split(' (')[0]} at ${fmt(state.asm.mfu*100,0)}% MFU</span></div>
    <div class="tile"><span class="k">Decode speed</span><span class="v">${fmt(I.tok_s_user,0)}<small>tok/s per user</small></span><span class="s">batch ${I.batch} on TP ${I.tp} · ${I.bound}</span></div>
    <div class="tile"><span class="k">KV cache per user</span><span class="v">${bytes(I.kv_seq,1)}</span><span class="s">${si(I.ctx,'',0)} tokens × ${bytes(I.kv_tok,1)} per token (${c.m.kv==='mla'?'MLA':'GQA'} · ${state.asm.kv_prec.toUpperCase()})</span></div>
  </div>`;
}
function kv(rows){ return `<div class="kv">${rows.filter(Boolean).map(([k,v])=>`<span class="k">${k}</span><span class="v">${v}</span>`).join('')}</div>`; }
function pill(c){ return `<span class="pill ${c}">${c}</span>`; }

function renderPage(){
  const c=calc(), m=c.m, T=c.train, I=c.inf, hw=c.hw, A=state.asm;
  const p = $('#page');
  p.innerHTML = `
  <div class="hero">
    <div><span class="pill ${m.conf}">${m.conf}</span> <span class="note">${esc(m.vendor)} ${esc(m.year)} · ${m.type==='moe'?'sparse mixture-of-experts':'dense transformer'} · hardware: ${esc(hw.name)}</span></div>
    <h1>How ${esc(m.name)} is trained and served, and what each step asks of the rack</h1>
    <p class="lede">A modern LLM is two workloads with opposite shapes. Training is a months-long synchronous loop that needs every GPU in a cluster to finish the same step together; serving is millions of short latency-bound loops that re-read the whole model for every token. Change the model or the rack on the left and every number below recomputes.</p>
  </div>
  ${tiles(c)}

  <article id="model">
    <h2><span class="n">01</span>The model as numbers</h2>
    <p class="sub">Everything downstream follows from a handful of shape parameters. Two matter most: how many parameters are <em>active</em> per token (compute and bandwidth per token) and how many exist in <em>total</em> (memory).</p>
    <div class="grid2">
      <div class="card"><h4>Shape</h4>${kv([['Total parameters', params(m.params_b*1e9)],['Active per token', params(m.active_b*1e9)+(m.type==='moe'?` (${fmt(m.active_b/m.params_b*100,1)}%)`:'')],['Layers × d_model', `${m.layers} × ${fmt(m.d_model,0)}`],['Attention heads / KV heads', `${m.heads} / ${m.kv_heads}`+(m.kv==='mla'?' (MLA)':' (GQA)')], m.type==='moe'?['Experts · routed per token', `${m.experts} · ${m.topk}${m.shared?` + ${m.shared} shared`:''}`]:null,['Vocabulary · max context', `${m.vocab_k}k · ${m.ctx_k}k`],['Training tokens', `${fmt(m.train_tokens_t,1)}T`],['Training precision', m.train_prec.toUpperCase()]])}</div>
      <div class="card"><h4>What it weighs</h4>${kv([['Weights, BF16', bytes(m.params_b*1e9*2)],['Weights, FP8', bytes(m.params_b*1e9)],['Weights, FP4', bytes(m.params_b*1e9*0.5)],['Training state (16 B/param)', bytes(T.state_total)],['KV per token', bytes(I.kv_tok,1)],['KV per 128k-token sequence', bytes(I.kv_tok*128e3,1)],['Minimum GPUs to hold training state', `${fmt(T.min_gpus_state)} × ${hw.hbm_gb} GB`]])}
      <div class="note" style="margin-top:8px">${esc(m.note)}</div></div>
    </div>
    <div class="callout"><b>Why MoE changed the hardware conversation.</b> A sparse model like DeepSeek-V3 does the compute of a ${params(m.type==='moe'?m.active_b*1e9:37e9)}-parameter model per token but must keep ${params(m.type==='moe'?m.params_b*1e9:671e9)} parameters resident. Memory capacity and the fabric that lets experts live on many GPUs (expert parallelism over NVLink) matter more than raw FLOPS. That is the argument for a 72-GPU NVLink domain rather than an 8-GPU node.</div>
  </article>

  <article id="training">
    <h2><span class="n">02</span>Training: one synchronous loop, repeated ${si(T.tokens/T.step_tokens,'',1)} times</h2>
    <p class="sub">Pre-training pushes ${fmt(m.train_tokens_t,1)} trillion tokens through the network once. Each step processes a ${si(T.step_tokens,'',0)}-token global batch: forward pass, backward pass, gradient synchronisation across every data-parallel replica, optimizer update. Nothing proceeds until the slowest GPU finishes.</p>
    <div class="fig">${figLifecycle(c)}<div class="cap">The lifecycle. Post-training (SFT, RLHF, RL with verifiable rewards) is a smaller compute budget than pre-training but generates its own inference load: RL rollouts are decode at scale.</div></div>
    <h3>Compute budget</h3>
    <div class="formula">FLOPs per token ≈ 6 × N_active + 12 × layers × d_model × seq  =  ${sci(T.flops_dense)} + ${sci(T.flops_attn)}${A.recompute?' (× 1.33 for recompute)':''}<br>Total = ${sci(T.flops_tok)} × ${si(T.tokens,'tokens',1)} = <b>${sci(T.total)} FLOPs</b></div>
    <div class="grid2">
      <div class="card"><h4>On ${esc(hw.name)} × ${state.racks} racks</h4>${kv([['GPUs', `${si(c.N,'',1)} × ${esc(hw.xpu_name)}`],['Peak per GPU', `${si(T.peak,'FLOPS',1)} ${T.prec.toUpperCase()} dense`],['Sustained at MFU', `${si(T.eff_gpu,'FLOPS',1)} · ${si(T.tok_per_s_gpu,'tok/s',1)} per GPU`],['Cluster throughput', si(T.tok_per_s,'tok/s',1)],['GPU-hours', si(T.gpu_hours,'',2)],['Wall clock', `${fmt(T.days,1)} days`],['Energy', `${si(T.mwh*1e6,'Wh',1)} at ${A.pue}× overhead`],[`Cost at $${A.gpu_hr_usd}/GPU-hr`, `$${si(T.usd,'',1)}`]])}</div>
      <div class="card"><h4>Reality check</h4>${m.disclosed?kv([['Disclosed run', `${si(m.disclosed.gpus,'',1)} × ${m.disclosed.gpu} · ${si(m.disclosed.gpu_hours,'',2)} GPU-hours`],['Implied MFU vs 6·N·D', `${fmt(T.disclosed_mfu*100,0)}%`],['Same run on this hardware', `${fmt(T.gpu_hours/m.disclosed.gpu_hours*100,0)}% of the GPU-hours`]]):'<div class="note">No disclosed training run for this model.</div>'}
      <div class="note" style="margin-top:8px">MFU is the number to argue about. The gap between peak and sustained is where interconnect, stragglers, recompute and restarts hide. Scale-out bandwidth per GPU and the failure rate below set the ceiling.</div></div>
    </div>
    <h3>Where the time goes in one step</h3>
    <div class="fig">${figTrainStep(c)}</div>
    <h3>Parallelism: which network carries what</h3>
    <p>No single GPU holds the model, so the step is split four ways. Each split creates a different traffic pattern and lands on a different piece of the rack. The table shows bytes each GPU must move per step and how long that takes at this rack's link speeds, next to the compute time of the step.</p>
    <div class="fig">${figParallelism(c)}</div>
    <div class="card"><table class="grid"><thead><tr><th>Split</th><th>Traffic per GPU per step</th><th style="text-align:right">Bytes</th><th>Network</th><th style="text-align:right">Time</th><th style="text-align:right">% of step</th><th>Notes</th></tr></thead><tbody>
      ${T.comm.map(cm=>`<tr><td><span class="tag" style="background:${{DP:PAL.w,TP:PAL.g,PP:PAL.a,EP:PAL.o}[cm.k]}">${cm.k}</span></td><td>${esc(cm.name)}</td><td class="n">${bytes(cm.bytes)}</td><td>${esc(cm.net)} · ${bytes(cm.bw,0)}/s</td><td class="n">${secs(cm.t)}</td><td class="n" style="${cm.pct>50?'color:var(--bad)':(cm.pct>15?'color:var(--warn)':'')}">${fmt(cm.pct,1)}%</td><td class="c">${esc(cm.note)}</td></tr>`).join('')}
      <tr class="cat"><td colspan="4">Compute per step at ${fmt(A.mfu*100,0)}% MFU</td><td class="n">${secs(T.step_time)}</td><td class="n">100%</td><td></td></tr></tbody></table>
      <div class="note" style="margin-top:8px">Rule of thumb: communication that overlaps with backward (DP) is tolerable up to roughly the step time; TP and EP collectives sit on the critical path of every layer and must be fast, which is why they are confined to the ${esc(hw.su_name)} domain (${bytes(hw.su_GBs,0)}/s per GPU) rather than the NICs (${bytes(hw.so_GBs,0)}/s per GPU).</div></div>
    <h3>Memory</h3>
    <div class="fig">${figMemory(c)}<div class="cap">Training state is 16 bytes per parameter in mixed precision; FSDP shards it across the ${T.dp} data-parallel replicas. Activations scale with micro-batch tokens × layers × 34·d_model bytes and are the lever engineers pull (recompute) when a GPU runs out of HBM.</div></div>
    <h3>Checkpoints and failures: the storage and front-end network</h3>
    <div class="grid2">
      <div class="card"><h4>Checkpointing</h4>${kv([['Checkpoint size (weights + optimizer)', bytes(T.ckpt_bytes)],['Interval', `${A.ckpt_min} min`],['Sustained write bandwidth needed', `${bytes(T.ckpt_bw,1)}/s`],['Cluster front-end / DPU bandwidth', `${bytes(T.frontend_bw,1)}/s`],['Time to write one checkpoint', secs(T.ckpt_time_frontend)]])}<div class="note" style="margin-top:8px">This is the job of the DPU / front-end network and the storage cluster, not the compute fabric. Async checkpointing to host memory first (Grace LPDDR5X, 480 GB per CPU) hides most of it.</div></div>
      <div class="card"><h4>Reliability at scale</h4>${kv([['Unexpected interruptions', `${fmt(T.interruptions_day,1)} per day`],['Mean time between failures', secs(T.mtbf_h*3600)],['Goodput lost to restarts', `${fmt(T.lost_pct,1)}%`]])}<div class="note" style="margin-top:8px">Meta logged 419 unexpected interruptions in 54 days on 16k H100s, 58% of them GPU or HBM faults. Larger clusters fail more often, so checkpoint intervals shrink and storage bandwidth grows with cluster size.</div></div>
    </div>
  </article>

  <article id="inference">
    <h2><span class="n">03</span>Inference: prefill is a compute problem, decode is a memory problem</h2>
    <p class="sub">A request has two phases. <b>Prefill</b> processes the prompt in one parallel pass: ${sci(2*m.active_b*1e9*A.in_tok)} FLOPs for ${si(A.in_tok,'',0)} tokens, limited by tensor cores. <b>Decode</b> then produces one token at a time; every step must read all ${bytes(I.weights_read(1))} of active weights from HBM plus the KV cache, so at low batch it is limited by HBM bandwidth, not FLOPS.</p>
    <div class="fig">${figInference(c)}</div>
    <h3>The decode roofline</h3>
    <div class="formula">Step time ≈ max( bytes read ÷ HBM bandwidth , 2·N_active·batch ÷ FLOPS ) + collective latency<br>= max( ${bytes(I.weights_read(I.batch)+I.batch*I.kv_tok*(A.in_tok+A.out_tok/2))} ÷ ${bytes(I.tp*hw.hbm_bw*A.bw_eff,1)}/s , ${sci(2*m.active_b*1e9*I.batch)} ÷ ${si(I.tp*I.peak*A.c_eff,'FLOPS',1)} ) + ${secs(I.step_comm)} = <b>${secs(I.step_t)}</b></div>
    <div class="fig">${figRoofline(c)}<div class="cap">Aggregate tokens per second for one TP-${I.tp} group as batch grows. Left of the knee every extra concurrent user is nearly free because the weights are read once per step regardless of batch. Right of the knee the tensor cores are the limit and per-user speed falls. Hover for values.${m.type==='moe'?' For MoE the bytes per step grow with batch as more experts are touched: E·(1−(1−k/E)^batch) of '+m.experts+' experts, with ~65% of active parameters assumed to sit in routed experts.':''}</div></div>
    <div class="grid2">
      <div class="card"><h4>Serving on ${esc(hw.name)}</h4>${kv([['Weights at '+I.prec.toUpperCase(), bytes(I.weights)],['TP group', `${I.tp} × ${esc(hw.xpu_name.split(' (')[0])} (${fmt(I.tp*hw.hbm_gb)} GB, ${bytes(I.tp*hw.hbm_bw,0)}/s)`],['KV capacity after weights', `${bytes(I.kv_cap)} = ${si(I.max_tokens_cached,'tokens',1)}`],['Max concurrent sequences at '+si(I.ctx,'',0)+' tokens', fmt(I.max_seqs)],['Time to first token (prefill)', secs(I.ttft)],['Per-token decode latency', secs(I.step_t)],['Per-user speed', `${fmt(I.tok_s_user,0)} tok/s`],['Group throughput at batch '+I.batch, si(I.tok_s_group,'tok/s',1)],['Knee batch (memory → compute bound)', fmt(I.batch_x,0)]])}</div>
      <div class="card"><h4>Per rack and per megawatt</h4>${kv([['TP groups per rack', `${I.groups_rack} (${hw.xpus_per_rack} GPUs ÷ ${I.tp})`],['Concurrent users per rack', fmt(I.users_rack)],['Rack throughput', si(I.tok_s_rack,'tok/s',1)],['Tokens per second per MW', si(I.tok_s_mw,'',1)],['Tokens per kWh', si(I.tok_per_kwh,'',1)],['Decode share of request time', `${fmt(I.decode_share*100,0)}%`],['KV handoff prefill → decode', `${bytes(I.kv_transfer)} · ${secs(I.kv_t_su)} on ${esc(hw.su_name)} · ${secs(I.kv_t_so)} on NICs`]])}
      <div class="note" style="margin-top:8px">Tokens per MW is the metric operators sell against. It rises with HBM bandwidth (faster steps), HBM capacity (bigger batches before the KV runs out), FP4 (half the bytes per weight) and a larger NVLink domain (more GPUs share one model without paying NIC latency).</div></div>
    </div>
    <div class="callout"><b>Why disaggregate.</b> Prefill wants FLOPS and short residency; decode wants HBM bandwidth, capacity and low-latency collectives. Serving both on the same GPU forces a compromise batch. Splitting them into pools and shipping the KV cache across ${esc(hw.su_name)} (${secs(I.kv_t_su)} for this request) lets each pool run at its own knee. This is the workload NVL72-class racks and CPO-connected inference fabrics are built around.</div>
  </article>

  <article id="hardware">
    <h2><span class="n">04</span>What each hardware attribute buys</h2>
    <p class="sub">The same attributes appear in both workloads with different weights. The right-hand column is the live value for ${esc(hw.name)}.</p>
    <div class="card" style="padding:0;overflow-x:auto"><table class="grid matrix"><thead><tr><th>Attribute</th><th>Training</th><th>Inference</th><th>${esc(hw.name)}</th></tr></thead><tbody>
      <tr><td>HBM capacity</td><td>Fewer GPUs to hold state; bigger micro-batches; less recompute</td><td>Bigger KV cache → longer context and more concurrent users per GPU</td><td class="n">${hw.hbm_gb} GB · ${fmt(hw.xpus_per_rack*hw.hbm_gb/1000,1)} TB per rack</td></tr>
      <tr><td>HBM bandwidth</td><td>Optimizer step and activation traffic; secondary to FLOPS</td><td><b>The</b> decode limiter: step time = bytes ÷ bandwidth</td><td class="n">${bytes(hw.hbm_bw,1)}/s · ${bytes(hw.hbm_bw*hw.xpus_per_rack,1)}/s per rack</td></tr>
      <tr><td>Tensor FLOPS and precision</td><td>Sets the run length; FP8 doubles BF16 throughput</td><td>Prefill speed; FP4 halves weight bytes for decode too</td><td class="n">${si(hw.peak.bf16,'',1)} BF16 · ${si(hw.peak.fp8,'',1)} FP8 · ${si(hw.peak.fp4,'',1)} FP4</td></tr>
      <tr><td>Scale-up bandwidth and domain size</td><td>TP and EP collectives every layer; domain caps TP × EP</td><td>How many GPUs can share one model with µs collectives; expert parallel; KV handoff</td><td class="n">${bytes(hw.su_GBs,0)}/s per GPU · ${hw.domain}-GPU domain (${esc(hw.su_name)}, ${esc(hw.su_media)})</td></tr>
      <tr><td>Scale-out bandwidth</td><td>Gradient sync across replicas and pipeline hops; sets max cluster efficiency</td><td>Rarely on the token path; KV transfer between pools if not on NVLink</td><td class="n">${bytes(hw.so_GBs,0)}/s per GPU · ${bytes(hw.so_GBs*hw.xpus_per_rack,1)}/s per rack</td></tr>
      <tr><td>Host CPU and LPDDR</td><td>Data loading, tokenisation, async checkpoint staging</td><td>KV offload tier, request scheduling, speculative-decoding drafts</td><td class="n">${esc(D.CPUS[hw.preset.cpu].name)} · ${esc(D.CPUS[hw.preset.cpu].mem)} · ${esc(D.CPUS[hw.preset.cpu].c2c)}</td></tr>
      <tr><td>Front-end / storage network (DPU)</td><td>Checkpoints every ${A.ckpt_min} min at ${bytes(T.ckpt_bw,1)}/s; dataset streaming</td><td>Model loading, logging, KV spill to storage</td><td class="n">${esc(D.DPUS[hw.preset.dpu].name)} · ${D.DPUS[hw.preset.dpu].gbps} Gb/s × ${hw.preset.rack.dpus_per_tray} per tray</td></tr>
      <tr><td>Power and cooling</td><td>${fmt(T.mwh/Math.max(1,T.days)/24,1)} MW average draw for this run</td><td>Tokens per MW is the unit economics</td><td class="n">${hw.rack_kw} kW per rack · ${fmt(hw.rack_kw/hw.xpus_per_rack*1000,0)} W per GPU all-in</td></tr>
      <tr><td>Optics and media</td><td>Cluster size: copper stops at the rack, optics carry DP traffic between ${state.racks} racks</td><td>Pool-to-pool KV traffic and front-end; CPO cuts the watts per bit that decode margins pay for</td><td class="n">${esc(D.MEDIA[hw.preset.scaleout.nic_media].name)} scale-out · ${esc(hw.su_media)} scale-up</td></tr>
    </tbody></table></div>
    <div class="callout"><b>Reading the two workloads together.</b> Training is bought by the FLOP and won by MFU, so it rewards fast scale-out and reliability. Inference is sold by the token and won by tokens per MW, so it rewards HBM bandwidth, capacity, low-precision math and a large low-latency scale-up domain. A rack that leads on both is the one that gets deployed twice: first to train the model, then re-imaged to serve it.</div>
    <div class="note" style="margin-top:14px">Formulas: compute 6·N·D (Kaplan / Hoffmann); activation memory 34·s·b·h (Korthikanti et al., Megatron); ring collectives at 2(n−1)/n; decode roofline per Pope et al. Inputs and every unit assumption are on the left and editable. Confidence tags: <span class="pill H">H</span> documented, <span class="pill M">M</span> common practice, <span class="pill L">L</span> estimate.</div>
  </article>`;
  wireRoofline(c);
}

function wireRoofline(c){
  const wrap=$('#roof-wrap'); if(!wrap) return; const svgEl=wrap.querySelector('svg'), tip=$('#roof-tip'); const I=c.inf;
  const W=980, px=70, pw=W-px-40, xmax=13;
  svgEl.addEventListener('mousemove', e=>{ const r=svgEl.getBoundingClientRect(); const fx=(e.clientX-r.left)/r.width*W; if (fx<px||fx>px+pw){ tip.style.opacity=0; return; } const B=Math.max(1,Math.round(Math.pow(2,(fx-px)/pw*xmax))); const s=I.step(B); tip.textContent=`batch ${fmt(B,0)} · ${si(B/s.t,'tok/s',1)} · ${fmt(1/s.t,0)} tok/s per user · ${s.mem>=s.comp?'memory':'compute'} bound`; tip.style.left=(e.clientX-r.left)+'px'; tip.style.top=(e.clientY-r.top)+'px'; tip.style.opacity=1; });
  svgEl.addEventListener('mouseleave', ()=>{ tip.style.opacity=0; });
}

/* ---------------- controls ---------------- */
function inp(label, key, opts={}){
  const v = opts.model ? state.model[key] : (opts.top ? state[key] : state.asm[key]);
  const lab = opts.raw ? label : esc(label); const title = opts.title ? ` title="${esc(opts.title)}"` : '';
  const attr = opts.model ? `data-model="${key}"` : (opts.top ? `data-top="${key}"` : `data-asm="${key}"`);
  if (opts.select) return `<label${title}>${lab}${opts.small?`<small>${esc(opts.small)}</small>`:''}</label><select ${attr}>${opts.select.map(([val,lab])=>`<option value="${val}" ${String(val)===String(v)?'selected':''}>${esc(lab)}</option>`).join('')}</select>`;
  if (typeof v==='boolean') return `<label${title}>${lab}${opts.small?`<small>${esc(opts.small)}</small>`:''}</label><select ${attr} data-type="bool"><option value="true" ${v?'selected':''}>yes</option><option value="false" ${!v?'selected':''}>no</option></select>`;
  return `<label${title}>${lab}${opts.small?`<small>${esc(opts.small)}</small>`:''}</label><input type="${opts.text?'text':'number'}" step="any" ${attr} value="${esc(v)}">`;
}
function renderControls(){
  const m=state.model, hw=hardware();
  const grp=(title,inner,open)=>`<details ${open?'open':''}><summary>${title}<span></span></summary><div class="sec"><div class="form">${inner}</div></div></details>`;
  const asmRows = keys => keys.map(k=>{ const r=ASM_DEF.find(x=>x[0]===k); const sel = k==='w_prec'||k==='kv_prec' ? {select:[['bf16','BF16'],['fp8','FP8'],['fp4','FP4']]} : {}; return inp(`${esc(r[1])} <span class="pill ${r[4]}">${r[4]}</span>`, k, Object.assign({raw:true, title:r[5], small:r[3]||undefined}, sel)); }).join('');
  $('#ctl').innerHTML = `
    <h3>Model</h3><div class="sec"><div class="form">
      <label>Preset</label><select data-top="modelId">${MODELS.map(x=>`<option value="${x.id}" ${x.id===state.modelId?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
      ${inp('Architecture','type',{model:true,select:[['dense','Dense'],['moe','Mixture of experts']]})}
      ${inp('Total parameters','params_b',{model:true,small:'billions'})}
      ${inp('Active per token','active_b',{model:true,small:'billions'})}
      ${inp('Layers','layers',{model:true})}${inp('d_model','d_model',{model:true})}
      ${inp('Attention heads','heads',{model:true})}${inp('KV heads','kv_heads',{model:true})}${inp('Head dim','head_dim',{model:true})}
      ${m.type==='moe'?inp('Experts','experts',{model:true})+inp('Routed per token','topk',{model:true}):''}
      ${inp('KV scheme','kv',{model:true,select:[['gqa','GQA / MHA'],['mla','MLA (latent)']]})}
      ${m.kv==='mla'?inp('MLA latent dim','mla_dim',{model:true,small:'values per token per layer'}):''}
      ${inp('Training tokens','train_tokens_t',{model:true,small:'trillions'})}
      ${inp('Training precision','train_prec',{model:true,select:[['bf16','BF16'],['fp8','FP8']]})}
    </div><div class="note small" style="margin-top:6px">${esc(m.note||'')}</div></div>
    <h3>Hardware</h3><div class="sec"><div class="form">
      <label>Rack architecture</label><select data-top="rackId">${D.PRESETS.map(x=>`<option value="${x.id}" ${x.id===state.rackId?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
      ${inp('Racks in the training cluster','racks',{top:true})}
    </div>${kv([['GPUs', si(state.racks*hw.xpus_per_rack,'',1)],['Per GPU', `${hw.hbm_gb} GB · ${bytes(hw.hbm_bw,1)}/s · ${si(hw.peak.fp8,'',1)} FP8`],['Scale-up', `${bytes(hw.su_GBs,0)}/s · ${hw.domain}-GPU domain`],['Scale-out', `${bytes(hw.so_GBs,0)}/s per GPU`]])}<div class="note small" style="margin-top:6px">Specs come from Rack Explorer's presets. Edit them there; this page reads the same data file.</div></div>
    ${grp('Training assumptions', asmRows(['mfu','seq','gbs','micro','tp','pp','ep','fsdp','recompute','state_bpp','gpu_hr_usd','pue','ckpt_min','fail_rate']), true)}
    ${grp('Inference assumptions', asmRows(['w_prec','kv_prec','tp_serve','batch','in_tok','out_tok','bw_eff','c_eff','mfu_prefill','ar_us','kv_reserve']), true)}
    <div class="hint">Every input here is an assumption. Hover a label for its source note. Confidence <span class="pill H">H</span> documented · <span class="pill M">M</span> common practice · <span class="pill L">L</span> estimate.</div>`;
}

/* ---------------- events ---------------- */
document.addEventListener('change', e=>{
  const el=e.target; let v=el.value; if (el.dataset.type==='bool') v = v==='true'; else if (el.type==='number'){ v=Number(v); if (Number.isNaN(v)) return; }
  if (el.dataset.top){ if (el.dataset.top==='modelId'){ loadModel(v); } else state[el.dataset.top]=v; }
  else if (el.dataset.model){ state.model[el.dataset.model]=v; if (el.dataset.model==='type' && v==='moe' && !state.model.experts){ state.model.experts=8; state.model.topk=2; } if (el.dataset.model==='type' && v==='dense'){ state.model.active_b=state.model.params_b; } }
  else if (el.dataset.asm){ state.asm[el.dataset.asm]=v; LS.set('wl.asm', state.asm); }
  else return;
  LS.set('wl.state', {modelId:state.modelId, rackId:state.rackId, racks:state.racks});
  renderControls(); renderPage();
});
document.addEventListener('input', e=>{ const el=e.target; if (!el.matches('[data-asm],[data-model],[data-top]') || el.tagName==='SELECT') return; let v=el.value; if (el.type==='number'){ v=Number(v); if (Number.isNaN(v)||v===0&&el.dataset.top!=='racks') return; } if (el.dataset.top) state[el.dataset.top]=v; else if (el.dataset.model) state.model[el.dataset.model]=v; else state.asm[el.dataset.asm]=v; renderPage(); });
document.addEventListener('click', e=>{
  if (e.target.id==='btn-reset'){ state.asm=Object.assign({},asmDefault); LS.set('wl.asm',state.asm); loadModel(state.modelId); renderControls(); renderPage(); }
  if (e.target.id==='btn-theme'){ const root=document.documentElement; const cur=root.dataset.reTheme||'light'; root.dataset.reTheme = cur==='dark'?'light':'dark'; LS.set('re.theme', root.dataset.reTheme); }
});

/* ---------------- boot ---------------- */
const th=LS.get('re.theme',null); if (th==='dark') document.documentElement.dataset.reTheme='dark';
const saved=LS.get('wl.state',null); if (saved){ state.modelId=saved.modelId||state.modelId; state.rackId=saved.rackId||state.rackId; state.racks=saved.racks||state.racks; }
loadModel(state.modelId); renderControls(); renderPage();
window.WL=state;
})();
