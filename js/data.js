/* Rack Explorer — data layer
   Media types, building blocks (GPU/XPU, CPU, NIC, DPU, switches), rack presets,
   and default assumptions. Every figure here is a default that the UI can override.
   Confidence: H = vendor-documented and widely corroborated, M = vendor-stated but
   ambiguous or partially disclosed, L = estimate / placeholder chosen to reproduce a
   vendor aggregate. */

const MEDIA = {
  pcb:       { id:'pcb',       name:'On-board PCB trace',          short:'PCB',        family:'copper',  color:'#7B6A58', reach_m:0.4,  w_end:0,    usd_end:5,    conf:'H',
               note:'Baseboard traces (e.g. HGX NVSwitch baseboard). SerDes power is inside the ASICs.' },
  backplane: { id:'backplane', name:'Copper backplane / cartridge',short:'Backplane',  family:'copper',  color:'#B26A2B', reach_m:1.5,  w_end:0,    usd_end:35,   conf:'M',
               note:'Blind-mate copper cartridge / cable backplane inside the rack (NVL72 NVLink spine ≈ 5,000 twinax pairs).' },
  dac:       { id:'dac',       name:'DAC (passive copper)',        short:'DAC',        family:'copper',  color:'#4A5D73', reach_m:1.5,    w_end:0,    usd_end:120,  conf:'H',
               note:'Passive twinax. Reach falls with lane rate: ~2 m at 100G/lane, ~1–1.5 m at 200G/lane.' },
  acc:       { id:'acc',       name:'ACC (linear active copper)',  short:'ACC',        family:'copper',  color:'#2F8F83', reach_m:3,    w_end:0.6,  usd_end:220,  conf:'M',
               note:'Linear amplifier in the plug, no retimer. Host SerDes still closes the link.' },
  aec:       { id:'aec',       name:'AEC (retimed active copper)', short:'AEC',        family:'copper',  color:'#7A4FB5', reach_m:7,    w_end:4,    usd_end:400,  conf:'M',
               note:'Retimer/DSP in each plug. ~7–8 W per 800G cable. Rack-to-rack and rack-scale copper reach extender.' },
  pluggable: { id:'pluggable', name:'Pluggable optics (DSP)',      short:'Pluggable',  family:'optical', color:'#E07A1F', reach_m:500,  w_end:15,   usd_end:1000, conf:'H',
               note:'OSFP / QSFP-DD with DSP. 800G DR8 ≈ 14–16 W, 1.6T DR8 ≈ 25–30 W.' },
  lpo:       { id:'lpo',       name:'LPO (linear pluggable optics)',short:'LPO',       family:'optical', color:'#C9A227', reach_m:500,  w_end:8.5,  usd_end:750,  conf:'M',
               note:'No DSP in the module; relies on host SerDes. ~40–50% lower power than DSP pluggables.' },
  cpo:       { id:'cpo',       name:'CPO / NPO (co-packaged optics)',short:'CPO',      family:'optical', color:'#C2308C', reach_m:500,  w_end:5.5,  usd_end:600,  conf:'L',
               note:'Optical engine on the switch/XPU package, external laser source. NVIDIA claims ~3.5× power efficiency vs pluggables.' },
  ocs:       { id:'ocs',       name:'Optical circuit switch (via pluggables)', short:'OCS', family:'optical', color:'#1F8A4C', reach_m:500, w_end:15, usd_end:1400, conf:'M',
               note:'MEMS mirror switch (Google Palomar/Apollo). Passive; transceivers on each end carry the cost/power.' },
};

const MEDIA_ORDER = ['pcb','backplane','dac','acc','aec','pluggable','lpo','cpo','ocs'];

/* ---------------- Building blocks ---------------- */

const XPUS = {
  b200:   { id:'b200',   vendor:'NVIDIA', name:'B200 (Blackwell)',            dies:2, hbm_gb:192, hbm_tbs:8,    fp8_pf:4.5,  fp4_pf:9,    tdp_w:1200, conf:'H',
            pcie:'PCIe Gen6 x16', c2c:'NVLink-C2C 900 GB/s to Grace', note:'GB200 configuration TDP. 1.8 TB/s NVLink 5.' },
  b300:   { id:'b300',   vendor:'NVIDIA', name:'B300 (Blackwell Ultra)',      dies:2, hbm_gb:288, hbm_tbs:8,    fp8_pf:4.5,  fp4_pf:15,   tdp_w:1400, conf:'H',
            pcie:'PCIe Gen6 x16', c2c:'NVLink-C2C 900 GB/s', note:'GB300 NVL72 configuration. Same 1.8 TB/s NVLink 5 port.' },
  rubin:  { id:'rubin',  vendor:'NVIDIA', name:'Rubin (2-die package)',       dies:2, hbm_gb:288, hbm_tbs:13,   fp8_pf:8.3,  fp4_pf:50,   tdp_w:1800, conf:'M',
            pcie:'PCIe Gen6 x16', c2c:'NVLink-C2C 1.8 TB/s to Vera', note:'2H26. FP4 50 PF inference per package per GTC 2025. TDP is an estimate.' },
  rubinu: { id:'rubinu', vendor:'NVIDIA', name:'Rubin Ultra (4-die package)', dies:4, hbm_gb:1024,hbm_tbs:32,   fp8_pf:35,   fp4_pf:100,  tdp_w:3600, conf:'L',
            pcie:'PCIe Gen7 x16 (est.)', c2c:'NVLink-C2C', note:'2027 Kyber rack. HBM4e 1 TB per package. Most figures are placeholders.' },
  trn2:   { id:'trn2',   vendor:'AWS',    name:'Trainium2',                    dies:2, hbm_gb:96,  hbm_tbs:2.9,  fp8_pf:1.3,  fp4_pf:null, tdp_w:500,  conf:'M',
            pcie:'PCIe Gen5 x16', c2c:'—', note:'FP8 dense 1.3 PF. TDP is an estimate.' },
  trn3:   { id:'trn3',   vendor:'AWS',    name:'Trainium3',                    dies:2, hbm_gb:144, hbm_tbs:4.9,  fp8_pf:2.52, fp4_pf:null, tdp_w:800,  conf:'L',
            pcie:'PCIe Gen5 x16', c2c:'—', note:'3 nm, announced Dec 2025. TDP is an estimate.' },
  tpuv7:  { id:'tpuv7',  vendor:'Google', name:'TPU v7 (Ironwood)',            dies:2, hbm_gb:192, hbm_tbs:7.37, fp8_pf:4.6,  fp4_pf:null, tdp_w:1000, conf:'M',
            pcie:'PCIe Gen5 x16', c2c:'—', note:'4.6 PF FP8 per chip; 9.6 Tb/s ICI. TDP is an estimate.' },
  mi355x: { id:'mi355x', vendor:'AMD',    name:'MI355X (CDNA 4)',              dies:8, hbm_gb:288, hbm_tbs:8,    fp8_pf:5,    fp4_pf:10,   tdp_w:1400, conf:'H',
            pcie:'PCIe Gen5 x16', c2c:'—', note:'8-GPU Infinity Fabric mesh in UBB, no scale-up switch.' },
  mi450:  { id:'mi450',  vendor:'AMD',    name:'MI450 (CDNA 5, Helios)',       dies:8, hbm_gb:432, hbm_tbs:19.6, fp8_pf:20,   fp4_pf:40,   tdp_w:1800, conf:'L',
            pcie:'PCIe Gen6 x16', c2c:'—', note:'2H26 Helios rack. 3.6 TB/s UALink per GPU per AMD. TDP is an estimate.' },
  custom: { id:'custom', vendor:'Custom', name:'Custom XPU',                   dies:2, hbm_gb:192, hbm_tbs:8,    fp8_pf:4,    fp4_pf:8,    tdp_w:1200, conf:'L',
            pcie:'PCIe Gen6 x16', c2c:'—', note:'Edit in the inspector.' },
};

const CPUS = {
  grace:  { id:'grace',  vendor:'NVIDIA', name:'Grace',            cores:72, mem:'LPDDR5X 480 GB', mem_modules:2, c2c:'NVLink-C2C 900 GB/s', tdp_w:300, conf:'H' },
  vera:   { id:'vera',   vendor:'NVIDIA', name:'Vera',             cores:88, mem:'LPDDR5X 1.5 TB', mem_modules:2, c2c:'NVLink-C2C 1.8 TB/s',  tdp_w:350, conf:'M' },
  xeon6:  { id:'xeon6',  vendor:'Intel',  name:'Xeon 6 (Granite Rapids)', cores:64, mem:'DDR5 8-ch', mem_modules:8, c2c:'UPI', tdp_w:350, conf:'H' },
  turin:  { id:'turin',  vendor:'AMD',    name:'EPYC Turin',       cores:128,mem:'DDR5 12-ch', mem_modules:12, c2c:'Infinity Fabric', tdp_w:400, conf:'H' },
  venice: { id:'venice', vendor:'AMD',    name:'EPYC Venice',      cores:256,mem:'DDR5 16-ch', mem_modules:16, c2c:'Infinity Fabric', tdp_w:500, conf:'L' },
  spr:    { id:'spr',    vendor:'Intel',  name:'Xeon (Sapphire Rapids)', cores:48, mem:'DDR5 8-ch', mem_modules:8, c2c:'UPI', tdp_w:350, conf:'M' },
  none:   { id:'none',   vendor:'—',      name:'No host CPU on tray', cores:0, mem:'—', mem_modules:0, c2c:'—', tdp_w:0, conf:'H' },
};

const NICS = {
  cx7:     { id:'cx7',     vendor:'NVIDIA',   name:'ConnectX-7',         gbps:400,  ports:1, form:'OSFP (twin-port 800G cage)', pcie:'Gen5 x16', tdp_w:25, conf:'H' },
  cx8:     { id:'cx8',     vendor:'NVIDIA',   name:'ConnectX-8 SuperNIC',gbps:800,  ports:1, form:'OSFP 800G',            pcie:'Gen6 x16 + PCIe switch', tdp_w:35, conf:'H' },
  cx9:     { id:'cx9',     vendor:'NVIDIA',   name:'ConnectX-9',         gbps:1600, ports:1, form:'OSFP 1.6T',            pcie:'Gen6 x16 ×2', tdp_w:50, conf:'M' },
  nitro5:  { id:'nitro5',  vendor:'AWS',      name:'Nitro v5 / EFAv3',   gbps:400,  ports:1, form:'OSFP / QSFP-DD',       pcie:'Gen5 x16', tdp_w:30, conf:'L' },
  nitro6:  { id:'nitro6',  vendor:'AWS',      name:'Nitro v6 / EFAv4 (est.)', gbps:800, ports:1, form:'OSFP 800G',       pcie:'Gen6 x16', tdp_w:40, conf:'L' },
  pollara: { id:'pollara', vendor:'AMD Pensando', name:'Pollara 400',    gbps:400,  ports:1, form:'QSFP112',              pcie:'Gen5 x16', tdp_w:25, conf:'H' },
  vulcano: { id:'vulcano', vendor:'AMD Pensando', name:'Vulcano 800',    gbps:800,  ports:1, form:'OSFP 800G',            pcie:'Gen6 x16 / UALink', tdp_w:40, conf:'M' },
  thoru:   { id:'thoru',   vendor:'Broadcom', name:'Thor Ultra 800G',    gbps:800,  ports:1, form:'OSFP 800G',            pcie:'Gen6 x16', tdp_w:35, conf:'M' },
  tpuhost: { id:'tpuhost', vendor:'Google',   name:'Host NIC (Titanium)',gbps:400,  ports:1, form:'OSFP',                 pcie:'Gen5 x16', tdp_w:25, conf:'L' },
  none:    { id:'none',    vendor:'—',        name:'No scale-out NIC',   gbps:0,    ports:0, form:'—', pcie:'—', tdp_w:0, conf:'H' },
};

const DPUS = {
  bf3:  { id:'bf3',  vendor:'NVIDIA', name:'BlueField-3 DPU', gbps:400, tdp_w:75,  conf:'H', note:'Front-end / storage network per tray.' },
  bf4:  { id:'bf4',  vendor:'NVIDIA', name:'BlueField-4 DPU', gbps:800, tdp_w:100, conf:'M', note:'Vera Rubin generation.' },
  nitro:{ id:'nitro',vendor:'AWS',    name:'Nitro controller', gbps:100, tdp_w:30,  conf:'M', note:'Hypervisor offload / management.' },
  none: { id:'none', vendor:'—',      name:'No DPU',          gbps:0,   tdp_w:0,   conf:'H', note:'' },
};

/* Scale-up switch ASICs. `ports` are ports of the fabric link type
   (lanes_per_link × lane_gbps); `serdes` is total lane count for reference. */
const SU_SWITCHES = {
  nvsw5:   { id:'nvsw5',   vendor:'NVIDIA',   name:'NVLink 5 Switch (NVSwitch 5)', ports:72,  serdes:144, serdes_gbps:200, tbs_bidir:7.2,  tdp_w:200, conf:'H',
             note:'72 NVLink 5 ports × 2 lanes × 200G. Two per 1U NVLink switch tray in NVL72.' },
  nvsw6:   { id:'nvsw6',   vendor:'NVIDIA',   name:'NVLink 6 Switch',              ports:72,  serdes:288, serdes_gbps:200, tbs_bidir:14.4, tdp_w:300, conf:'M',
             note:'14.4 TB/s per chip (Vera Rubin NVL144). Port/lane split is inferred.' },
  nvsw7:   { id:'nvsw7',   vendor:'NVIDIA',   name:'NVLink 7 Switch (est.)',       ports:208, serdes:832, serdes_gbps:200, tbs_bidir:57.6, tdp_w:500, conf:'L',
             note:'Placeholder for Rubin Ultra / Kyber.' },
  th6:     { id:'th6',     vendor:'Broadcom', name:'Tomahawk 6 (102.4T)',          ports:128, serdes:512, serdes_gbps:200, tbs_bidir:25.6, tdp_w:900, conf:'H',
             note:'512 × 200G SerDes. As scale-up: 128 × 800G or 64 × 1.6T; SUE / UALoE.' },
  thultra: { id:'thultra', vendor:'Broadcom', name:'Tomahawk Ultra (51.2T)',       ports:64,  serdes:512, serdes_gbps:100, tbs_bidir:12.8, tdp_w:500, conf:'M',
             note:'Low-latency scale-up Ethernet (SUE). 64 × 800G.' },
  ualink:  { id:'ualink',  vendor:'UALink (Astera/Marvell class)', name:'UALink switch (est.)', ports:128, serdes:512, serdes_gbps:200, tbs_bidir:25.6, tdp_w:700, conf:'L',
             note:'UALink 200G spec-class switch. Placeholder radix.' },
  neuronsw:{ id:'neuronsw',vendor:'AWS',      name:'NeuronSwitch-v1',              ports:64,  serdes:512, serdes_gbps:200, tbs_bidir:12.8, tdp_w:500, conf:'L',
             note:'Trainium3 UltraServer switch. Radix undisclosed — placeholder.' },
  ocs:     { id:'ocs',     vendor:'Google',   name:'Palomar OCS (136×136)',        ports:136, serdes:0,   serdes_gbps:0,   tbs_bidir:0,    tdp_w:100, conf:'M',
             note:'MEMS optical circuit switch between TPU cubes; rate-agnostic.' },
  none:    { id:'none',    vendor:'—',        name:'No switch (direct / torus)',   ports:0,   serdes:0,   serdes_gbps:0,   tbs_bidir:0,    tdp_w:0,   conf:'H', note:'' },
};

const SO_SWITCHES = {
  qx800:  { id:'qx800',  vendor:'NVIDIA',   name:'Quantum-X800 (IB, 144×800G)',  ports:144, port_gbps:800,  tbs:115.2, media:'pluggable', conf:'H' },
  sx800:  { id:'sx800',  vendor:'NVIDIA',   name:'Spectrum-X800 (64×800G)',      ports:64,  port_gbps:800,  tbs:51.2,  media:'pluggable', conf:'H' },
  sxp:    { id:'sxp',    vendor:'NVIDIA',   name:'Spectrum-X Photonics (128×800G CPO)', ports:128, port_gbps:800, tbs:102.4, media:'cpo', conf:'M' },
  qxp:    { id:'qxp',    vendor:'NVIDIA',   name:'Quantum-X Photonics (144×800G CPO)',  ports:144, port_gbps:800, tbs:115.2, media:'cpo', conf:'M' },
  th6:    { id:'th6',    vendor:'Broadcom', name:'Tomahawk 6 (64×1.6T)',         ports:64,  port_gbps:1600, tbs:102.4, media:'pluggable', conf:'H' },
  th6cpo: { id:'th6cpo', vendor:'Broadcom', name:'Tomahawk 6 Davisson (CPO)',    ports:64,  port_gbps:1600, tbs:102.4, media:'cpo', conf:'M' },
  th5:    { id:'th5',    vendor:'Broadcom', name:'Tomahawk 5 (64×800G)',         ports:64,  port_gbps:800,  tbs:51.2,  media:'pluggable', conf:'H' },
  jupiter:{ id:'jupiter',vendor:'Google',   name:'Jupiter DC fabric (OCS)',      ports:128, port_gbps:400,  tbs:51.2,  media:'ocs', conf:'L' },
};

/* Topologies for the scale-up fabric */
const TOPOLOGIES = {
  switched:   { id:'switched',   name:'Switched, rack-scale (all XPUs ↔ switch trays)', desc:'Every XPU link lands on a switch ASIC in a switch tray. Single-tier, non-blocking when XPU links ≤ switch ports.' },
  intray:     { id:'intray',     name:'Switched, in-tray (baseboard NVSwitch / UBB)',   desc:'Scale-up domain is one tray. Switch ASICs sit on the baseboard; scale-out optics carry everything beyond the node.' },
  mesh:       { id:'mesh',       name:'Direct mesh, in-tray (Infinity Fabric)',          desc:'Every XPU in the tray links directly to every other XPU. links_per_xpu = XPUs per tray − 1.' },
  torus2d:    { id:'torus2d',    name:'2D torus (4 neighbors)',                          desc:'Direct chip-to-chip links; each chip has 4 neighbors. Wrap-around links leave the tray.' },
  torus3d:    { id:'torus3d',    name:'3D torus (6 neighbors)',                          desc:'Direct links, 6 neighbors per chip. Cube of n³ chips; wrap-around links exit the rack (via OCS for TPU).' },
};

/* ---------------- Rack presets ---------------- */

const PRESETS = [
  {
    id:'gb200_nvl72', name:'GB200 NVL72', vendor:'NVIDIA', status:'Shipping', conf:'H', year:'2024–25',
    tagline:'72 Blackwell GPUs, 36 Grace, one NVLink domain over a copper spine.',
    xpu:'b200', cpu:'grace', nic:'cx7', dpu:'bf3',
    rack:{ compute_trays:18, xpus_per_tray:4, cpus_per_tray:2, boards_per_tray:2, switch_trays:9, switch_chips_per_tray:2,
           switch_chips_per_compute_tray:0, nics_per_xpu:1, dpus_per_tray:2, rack_u:48, power_kw:120, cooling:'Direct liquid (cold plates)', form:'Oberon (MGX) rack' },
    scaleup:{ name:'NVLink 5', topology:'switched', links_per_xpu:18, lanes_per_link:2, lane_gbps:200, sw:'nvsw5',
              media_xpu_sw:'backplane', media_tray_tray:'backplane', vendor_bidir_tbs:1.8 },
    scaleout:{ nic_media:'pluggable', module_gbps:800, so_sw:'qx800', dpu_media:'pluggable', oversub:1 },
    board:{ name:'Bianca board', xpus:2, cpus:1, mem_per_cpu:2, mem_type:'LPDDR5X',
      connectors:[
        {n:'NVLink 5 connector (×2)', side:'top', cat:'scaleup'},
        {n:'12 V power connector', side:'left', cat:'power'},
        {n:'CMOS battery', side:'left', cat:'mgmt'},
        {n:'BMC', side:'left', cat:'mgmt'},
        {n:'Mirror Mezz connector', side:'left', cat:'pcie'},
        {n:'8× connector', side:'right', cat:'pcie'},
        {n:'MCIO x16 (PCIe Gen5 → ConnectX-7)', side:'right', cat:'pcie'},
        {n:'225 W power connector', side:'right', cat:'power'},
        {n:'SlimSAS PCIe x8 (E1.S / BlueField-3)', side:'right', cat:'pcie'},
        {n:'Grace–Grace C2C connector', side:'right', cat:'c2c'},
        {n:'8-pin fan connectors (×6)', side:'bottom', cat:'power'},
      ]},
    sources:['NVIDIA GB200 NVL72 datasheet: 1.8 TB/s NVLink per GPU, 130 TB/s aggregate, 5,000+ NVLink copper cables.',
             'NVIDIA GTC 2024 keynote: 18 compute trays, 9 NVLink switch trays, ~120 kW.'],
  },
  {
    id:'gb300_nvl72', name:'GB300 NVL72', vendor:'NVIDIA', status:'Shipping', conf:'H', year:'2H25',
    tagline:'Blackwell Ultra: 288 GB HBM3e, ConnectX-8 800G per GPU, same NVLink 5 spine.',
    xpu:'b300', cpu:'grace', nic:'cx8', dpu:'bf3',
    rack:{ compute_trays:18, xpus_per_tray:4, cpus_per_tray:2, boards_per_tray:2, switch_trays:9, switch_chips_per_tray:2,
           switch_chips_per_compute_tray:0, nics_per_xpu:1, dpus_per_tray:2, rack_u:48, power_kw:135, cooling:'Direct liquid (cold plates)', form:'Oberon (MGX) rack' },
    scaleup:{ name:'NVLink 5', topology:'switched', links_per_xpu:18, lanes_per_link:2, lane_gbps:200, sw:'nvsw5',
              media_xpu_sw:'backplane', media_tray_tray:'backplane', vendor_bidir_tbs:1.8 },
    scaleout:{ nic_media:'pluggable', module_gbps:800, so_sw:'qx800', dpu_media:'pluggable', oversub:1 },
    board:{ name:'Bianca board (GB300)', xpus:2, cpus:1, mem_per_cpu:2, mem_type:'LPDDR5X',
      connectors:[
        {n:'NVLink 5 connector (×2)', side:'top', cat:'scaleup'},
        {n:'12 V power connector', side:'left', cat:'power'},
        {n:'BMC', side:'left', cat:'mgmt'},
        {n:'MCIO x16 (PCIe Gen6 → ConnectX-8)', side:'right', cat:'pcie'},
        {n:'ConnectX-8 mezzanine (PCIe switch + 800G)', side:'right', cat:'pcie'},
        {n:'Grace–Grace C2C connector', side:'right', cat:'c2c'},
        {n:'E1.S storage (SlimSAS)', side:'right', cat:'pcie'},
        {n:'Fan connectors', side:'bottom', cat:'power'},
      ]},
    sources:['NVIDIA GB300 NVL72 product page: 288 GB HBM3e per GPU, ConnectX-8 SuperNIC 800 Gb/s per GPU.'],
  },
  {
    id:'vr_nvl144', name:'Vera Rubin NVL144', vendor:'NVIDIA', status:'Announced', conf:'M', year:'2H26',
    tagline:'72 Rubin packages (144 dies), NVLink 6 at 3.6 TB/s per package, ConnectX-9 1.6T.',
    xpu:'rubin', cpu:'vera', nic:'cx9', dpu:'bf4',
    rack:{ compute_trays:18, xpus_per_tray:4, cpus_per_tray:2, boards_per_tray:2, switch_trays:9, switch_chips_per_tray:2,
           switch_chips_per_compute_tray:0, nics_per_xpu:1, dpus_per_tray:2, rack_u:48, power_kw:190, cooling:'100% liquid', form:'Oberon (MGX) rack, cable-free trays' },
    scaleup:{ name:'NVLink 6', topology:'switched', links_per_xpu:18, lanes_per_link:4, lane_gbps:200, sw:'nvsw6',
              media_xpu_sw:'backplane', media_tray_tray:'backplane', vendor_bidir_tbs:3.6 },
    scaleout:{ nic_media:'pluggable', module_gbps:1600, so_sw:'th6', dpu_media:'pluggable', oversub:1 },
    board:{ name:'Rubin compute board', xpus:2, cpus:1, mem_per_cpu:2, mem_type:'LPDDR5X',
      connectors:[
        {n:'NVLink 6 connector (×2)', side:'top', cat:'scaleup'},
        {n:'48 V / 800 V DC power', side:'left', cat:'power'},
        {n:'BMC', side:'left', cat:'mgmt'},
        {n:'ConnectX-9 1.6T mezzanine', side:'right', cat:'pcie'},
        {n:'Vera–Vera C2C', side:'right', cat:'c2c'},
        {n:'BlueField-4 (front-end)', side:'right', cat:'pcie'},
        {n:'Liquid cold-plate manifold', side:'bottom', cat:'mgmt'},
      ]},
    sources:['NVIDIA GTC 2025: Vera Rubin NVL144 — 3.6 EF FP4 inference, 260 TB/s NVLink 6, 28.8 Tb/s ConnectX-9 per rack; 2H26.',
             'Lane/link split for NVLink 6 is inferred to reproduce 3.6 TB/s per package (L).'],
  },
  {
    id:'rubin_ultra_nvl576', name:'Rubin Ultra NVL576 (Kyber)', vendor:'NVIDIA', status:'Roadmap', conf:'L', year:'2027',
    tagline:'144 four-die packages in a 600 kW Kyber rack; NVLink 7 at 1.5 PB/s aggregate.',
    xpu:'rubinu', cpu:'vera', nic:'cx9', dpu:'bf4',
    rack:{ compute_trays:72, xpus_per_tray:2, cpus_per_tray:1, boards_per_tray:1, switch_trays:18, switch_chips_per_tray:2,
           switch_chips_per_compute_tray:0, nics_per_xpu:2, dpus_per_tray:1, rack_u:60, power_kw:600, cooling:'100% liquid', form:'Kyber rack: vertical blades, 4 pods × 18' },
    scaleup:{ name:'NVLink 7', topology:'switched', links_per_xpu:52, lanes_per_link:4, lane_gbps:200, sw:'nvsw7',
              media_xpu_sw:'backplane', media_tray_tray:'backplane', vendor_bidir_tbs:10.4 },
    scaleout:{ nic_media:'cpo', module_gbps:1600, so_sw:'qxp', dpu_media:'pluggable', oversub:1 },
    board:{ name:'Kyber compute blade', xpus:2, cpus:1, mem_per_cpu:2, mem_type:'LPDDR6 (est.)',
      connectors:[
        {n:'NVLink 7 midplane connector', side:'top', cat:'scaleup'},
        {n:'800 V DC busbar', side:'left', cat:'power'},
        {n:'ConnectX-9 / CPO scale-out', side:'right', cat:'pcie'},
        {n:'Cold-plate quick disconnect', side:'bottom', cat:'mgmt'},
      ]},
    sources:['NVIDIA GTC 2025 roadmap: Rubin Ultra NVL576, 15 EF FP4, 1.5 PB/s NVLink 7, 600 kW Kyber rack.',
             'Blade/switch counts and the 52×4×200G link split are placeholders that reproduce the vendor aggregate.'],
  },
  {
    id:'hgx_b200', name:'HGX B200 node rack (4 × 8-GPU)', vendor:'NVIDIA / OEM', status:'Shipping', conf:'H', year:'2024–25',
    tagline:'Classic scale-out design: NVLink stays on the baseboard, everything else rides pluggable optics.',
    xpu:'b200', cpu:'xeon6', nic:'cx7', dpu:'bf3',
    rack:{ compute_trays:4, xpus_per_tray:8, cpus_per_tray:2, boards_per_tray:1, switch_trays:0, switch_chips_per_tray:0,
           switch_chips_per_compute_tray:2, nics_per_xpu:1, dpus_per_tray:2, rack_u:42, power_kw:60, cooling:'Air (or hybrid)', form:'8–10U HGX servers' },
    scaleup:{ name:'NVLink 5 (in-node)', topology:'intray', links_per_xpu:18, lanes_per_link:2, lane_gbps:200, sw:'nvsw5',
              media_xpu_sw:'pcb', media_tray_tray:'pluggable', vendor_bidir_tbs:1.8 },
    scaleout:{ nic_media:'pluggable', module_gbps:800, so_sw:'qx800', dpu_media:'pluggable', oversub:1 },
    board:{ name:'HGX B200 baseboard (UBB)', xpus:8, cpus:0, mem_per_cpu:0, mem_type:'—',
      connectors:[
        {n:'NVSwitch ×2 on baseboard', side:'top', cat:'scaleup'},
        {n:'PCIe Gen5 x16 to host (×8)', side:'bottom', cat:'pcie'},
        {n:'54 V power (×4)', side:'left', cat:'power'},
        {n:'BMC / I²C', side:'right', cat:'mgmt'},
      ]},
    sources:['NVIDIA HGX B200 datasheet: 8 GPUs, 2 NVSwitch, 1.8 TB/s NVLink per GPU, 14.4 TB/s aggregate.'],
  },
  {
    id:'trn2_ultraserver', name:'Trn2 UltraServer (64-chip)', vendor:'AWS', status:'Shipping', conf:'M', year:'2024–25',
    tagline:'Four 16-chip Trn2 servers joined by NeuronLink into a 64-chip torus; no scale-up switch.',
    xpu:'trn2', cpu:'spr', nic:'nitro5', dpu:'nitro',
    rack:{ compute_trays:4, xpus_per_tray:16, cpus_per_tray:2, boards_per_tray:2, switch_trays:0, switch_chips_per_tray:0,
           switch_chips_per_compute_tray:0, nics_per_xpu:0.5, dpus_per_tray:2, rack_u:42, power_kw:45, cooling:'Air', form:'4 × 2U-class Trn2 servers' },
    scaleup:{ name:'NeuronLink-v3', topology:'torus3d', links_per_xpu:6, lanes_per_link:8, lane_gbps:100, sw:'none',
              media_xpu_sw:'pcb', media_tray_tray:'aec', media_ext:'aec', wrap_external:false, vendor_bidir_tbs:1.28 },
    scaleout:{ nic_media:'pluggable', module_gbps:400, so_sw:'th5', dpu_media:'pluggable', oversub:1 },
    board:{ name:'Trn2 accelerator board (8-chip)', xpus:8, cpus:0, mem_per_cpu:0, mem_type:'—',
      connectors:[
        {n:'NeuronLink cable connectors (to sibling servers)', side:'top', cat:'scaleup'},
        {n:'PCIe Gen5 to host / Nitro', side:'bottom', cat:'pcie'},
        {n:'12 V / 48 V power', side:'left', cat:'power'},
        {n:'BMC', side:'right', cat:'mgmt'},
      ]},
    sources:['AWS Trn2 documentation: 16 chips per instance, 3.2 Tb/s EFAv3; UltraServer = 64 chips over NeuronLink.',
             'NeuronLink-v3 per-chip bandwidth and the 2D/3D torus link split are placeholders (L).'],
  },
  {
    id:'trn3_ultraserver', name:'Trn3 UltraServer (144-chip)', vendor:'AWS', status:'Announced', conf:'L', year:'2026',
    tagline:'Trainium3 moves to a switched scale-up fabric: NeuronSwitch-v1, 144 chips per UltraServer.',
    xpu:'trn3', cpu:'spr', nic:'nitro6', dpu:'nitro',
    rack:{ compute_trays:9, xpus_per_tray:16, cpus_per_tray:2, boards_per_tray:2, switch_trays:9, switch_chips_per_tray:2,
           switch_chips_per_compute_tray:0, nics_per_xpu:0.5, dpus_per_tray:2, rack_u:48, power_kw:150, cooling:'Liquid', form:'Multi-rack UltraServer (placeholder layout)' },
    scaleup:{ name:'NeuronLink-v4', topology:'switched', links_per_xpu:8, lanes_per_link:8, lane_gbps:200, sw:'neuronsw',
              media_xpu_sw:'backplane', media_tray_tray:'aec', vendor_bidir_tbs:3.2 },
    scaleout:{ nic_media:'pluggable', module_gbps:800, so_sw:'th6', dpu_media:'pluggable', oversub:1 },
    board:{ name:'Trn3 accelerator board (8-chip)', xpus:8, cpus:0, mem_per_cpu:0, mem_type:'—',
      connectors:[
        {n:'NeuronLink to NeuronSwitch (backplane)', side:'top', cat:'scaleup'},
        {n:'PCIe Gen5 to host / Nitro', side:'bottom', cat:'pcie'},
        {n:'48 V power', side:'left', cat:'power'},
      ]},
    sources:['AWS re:Invent 2025: Trn3 UltraServer with 144 Trainium3 chips and NeuronSwitch. Radix, lane rates and tray layout are placeholders.'],
  },
  {
    id:'tpu_v7_rack', name:'TPU v7 Ironwood rack (64-chip cube)', vendor:'Google', status:'Shipping', conf:'M', year:'2025',
    tagline:'4×4×4 ICI torus in copper inside the rack; wrap-around links exit through optical circuit switches.',
    xpu:'tpuv7', cpu:'spr', nic:'tpuhost', dpu:'none',
    rack:{ compute_trays:16, xpus_per_tray:4, cpus_per_tray:1, boards_per_tray:1, switch_trays:0, switch_chips_per_tray:0,
           switch_chips_per_compute_tray:0, nics_per_xpu:0.5, dpus_per_tray:0, rack_u:42, power_kw:80, cooling:'Liquid', form:'Google TPU rack, 64 chips' },
    scaleup:{ name:'ICI (Ironwood)', topology:'torus3d', links_per_xpu:6, lanes_per_link:4, lane_gbps:200, sw:'ocs',
              media_xpu_sw:'pcb', media_tray_tray:'dac', media_ext:'ocs', wrap_external:true, vendor_bidir_tbs:1.2 },
    scaleout:{ nic_media:'pluggable', module_gbps:400, so_sw:'jupiter', dpu_media:'pluggable', oversub:1 },
    board:{ name:'Ironwood host tray (4 TPU)', xpus:4, cpus:1, mem_per_cpu:8, mem_type:'DDR5',
      connectors:[
        {n:'ICI copper (intra-cube) ×6 per chip', side:'top', cat:'scaleup'},
        {n:'ICI optical (to OCS) — wrap-around', side:'right', cat:'scaleup'},
        {n:'Host NIC to Jupiter', side:'right', cat:'pcie'},
        {n:'48 V power', side:'left', cat:'power'},
        {n:'Liquid cold-plate manifold', side:'bottom', cat:'mgmt'},
      ]},
    sources:['Google Cloud Ironwood announcement: 9.6 Tb/s ICI per chip, 192 GB HBM3e, 7.37 TB/s, 9,216-chip pods over OCS.',
             'Chips per tray and per-rack power are estimates.'],
  },
  {
    id:'amd_helios', name:'AMD Helios (72 × MI450)', vendor:'AMD', status:'Announced', conf:'M', year:'2H26',
    tagline:'UALink over Ethernet scale-up at 3.6 TB/s per GPU, Vulcano 800G scale-out, double-wide rack.',
    xpu:'mi450', cpu:'venice', nic:'vulcano', dpu:'none',
    rack:{ compute_trays:18, xpus_per_tray:4, cpus_per_tray:1, boards_per_tray:1, switch_trays:9, switch_chips_per_tray:2,
           switch_chips_per_compute_tray:0, nics_per_xpu:3, dpus_per_tray:0, rack_u:48, power_kw:200, cooling:'Liquid', form:'Double-wide OCP rack' },
    scaleup:{ name:'UALink / UALoE', topology:'switched', links_per_xpu:18, lanes_per_link:4, lane_gbps:200, sw:'th6',
              media_xpu_sw:'backplane', media_tray_tray:'backplane', vendor_bidir_tbs:3.6 },
    scaleout:{ nic_media:'pluggable', module_gbps:800, so_sw:'th6', dpu_media:'pluggable', oversub:1 },
    board:{ name:'Helios compute tray board', xpus:4, cpus:1, mem_per_cpu:12, mem_type:'DDR5',
      connectors:[
        {n:'UALink backplane connectors', side:'top', cat:'scaleup'},
        {n:'Vulcano 800G NIC ×12 (3 per GPU)', side:'right', cat:'pcie'},
        {n:'48 V power', side:'left', cat:'power'},
        {n:'BMC', side:'left', cat:'mgmt'},
      ]},
    sources:['AMD Advancing AI 2025: Helios — 72 MI450, 432 GB HBM4, 260 TB/s scale-up, 43 TB/s scale-out.',
             'Switch ASIC choice, tray layout, and 3 NICs per GPU are inferred from aggregates (L).'],
  },
  {
    id:'mi355x_rack', name:'MI355X UBB rack (4 × 8-GPU)', vendor:'AMD / OEM', status:'Shipping', conf:'H', year:'2025',
    tagline:'8-GPU Infinity Fabric mesh per node, Pollara 400 scale-out; no scale-up switch at all.',
    xpu:'mi355x', cpu:'turin', nic:'pollara', dpu:'none',
    rack:{ compute_trays:4, xpus_per_tray:8, cpus_per_tray:2, boards_per_tray:1, switch_trays:0, switch_chips_per_tray:0,
           switch_chips_per_compute_tray:0, nics_per_xpu:1, dpus_per_tray:0, rack_u:42, power_kw:60, cooling:'Air or liquid', form:'8–10U UBB servers' },
    scaleup:{ name:'Infinity Fabric (XGMI)', topology:'mesh', links_per_xpu:7, lanes_per_link:16, lane_gbps:38.4, sw:'none',
              media_xpu_sw:'pcb', media_tray_tray:'pluggable', vendor_bidir_tbs:1.075 },
    scaleout:{ nic_media:'pluggable', module_gbps:400, so_sw:'th5', dpu_media:'pluggable', oversub:1 },
    board:{ name:'MI355X UBB', xpus:8, cpus:0, mem_per_cpu:0, mem_type:'—',
      connectors:[
        {n:'Infinity Fabric mesh on UBB (7 links / GPU)', side:'top', cat:'scaleup'},
        {n:'PCIe Gen5 x16 to host (×8)', side:'bottom', cat:'pcie'},
        {n:'54 V power', side:'left', cat:'power'},
      ]},
    sources:['AMD MI355X spec: 288 GB HBM3e, 8 TB/s, 153.6 GB/s per IF link × 7.'],
  },
];

/* ---------------- Assumptions ---------------- */
/* Flat, keyed list. `media.*` rows are generated from MEDIA. */
function defaultAssumptions() {
  const rows = [
    { key:'conv.bidir',        group:'Conventions', label:'Report link bandwidth as', type:'select', options:['bidirectional','per direction'], value:'bidirectional', conf:'H',
      note:'NVIDIA (NVLink), Google (ICI) and AMD (UALink) quote bidirectional totals. AWS NeuronLink figures are ambiguous.' },
    { key:'conv.both_ends',    group:'Conventions', label:'Count cable / optic ends at both sides', type:'bool', value:true, conf:'H',
      note:'A DAC has two ends; a pluggable link needs two modules. Switch-side ends are counted when on.' },
    { key:'conv.gb_decimal',   group:'Conventions', label:'GB/s = Gb/s ÷ 8 (decimal)', type:'bool', value:true, conf:'H', note:'No encoding overhead applied to NVLink / ICI. Ethernet lanes are quoted at nominal rate.' },
    { key:'serdes.lr_pj',      group:'SerDes power', label:'Long-reach SerDes (host side)', unit:'pJ/bit', type:'num', value:5, conf:'M',
      note:'Per lane end, 200G PAM4 LR class. Applies to backplane, DAC, ACC, AEC, pluggable, LPO.' },
    { key:'serdes.xsr_pj',     group:'SerDes power', label:'XSR / die-to-optics SerDes (CPO)', unit:'pJ/bit', type:'num', value:1.5, conf:'M',
      note:'Short-reach electrical hop inside a CPO package.' },
    { key:'serdes.count_switch_side', group:'SerDes power', label:'Include switch-side SerDes power', type:'bool', value:true, conf:'H', note:'Both ends of every scale-up link burn SerDes energy.' },
    { key:'optics.lanes_per_module', group:'Optics sizing', label:'Lanes per pluggable module', unit:'lanes', type:'num', value:8, conf:'H', note:'OSFP / QSFP-DD 8-lane. 800G = 8 × 100G, 1.6T = 8 × 200G.' },
    { key:'optics.fiber_pairs_per_module', group:'Optics sizing', label:'Fiber pairs per module (DR8)', unit:'pairs', type:'num', value:8, conf:'H', note:'DR8 parallel fiber; FR/LR variants use fewer fibers via WDM.' },
    { key:'copper.pairs_per_lane', group:'Copper sizing', label:'Differential pairs per lane per direction', unit:'pairs', type:'num', value:1, conf:'H', note:'One twinax pair per lane per direction → 2 pairs per full-duplex lane.' },
    { key:'copper.spine_reach_m', group:'Copper sizing', label:'Longest in-rack backplane run', unit:'m', type:'num', value:1.4, conf:'M', note:'Top compute tray to bottom switch tray in a 48U Oberon rack.' },
    { key:'power.overhead_pct', group:'Rack power', label:'Rack overhead over silicon TDPs', unit:'%', type:'num', value:15, conf:'M', note:'Fans/pumps, PSU losses, memory, misc boards. Used only for the computed rack estimate.' },
    { key:'cost.xpu_usd',      group:'Cost (est.)', label:'XPU package', unit:'$', type:'num', value:35000, conf:'L', note:'Blended ASP placeholder for context only; interconnect cost is the focus.' },
    { key:'cost.su_switch_usd',group:'Cost (est.)', label:'Scale-up switch ASIC + tray share', unit:'$', type:'num', value:6000, conf:'L', note:'Per switch chip incl. its share of the tray.' },
    { key:'cost.nic_usd',      group:'Cost (est.)', label:'Scale-out NIC', unit:'$', type:'num', value:1500, conf:'L', note:'800G class SuperNIC. 400G ≈ $900, 1.6T ≈ $2,500.' },
  ];
  MEDIA_ORDER.forEach(id => {
    const m = MEDIA[id];
    rows.push({ key:`media.${id}.reach_m`, group:'Media reach', label:m.name, unit:'m', type:'num', value:m.reach_m, conf:m.conf, note:m.note, media:id });
    rows.push({ key:`media.${id}.w_end`,   group:'Media power', label:m.name, unit:'W per 800G end', type:'num', value:m.w_end, conf:m.conf, note:'Excludes host SerDes (counted separately). Scaled linearly with lane rate × lanes.', media:id });
    rows.push({ key:`media.${id}.usd_end`, group:'Media cost',  label:m.name, unit:'$ per 800G end', type:'num', value:m.usd_end, conf:m.conf, note:'Street-price class estimate per 800G-equivalent end.', media:id });
  });
  return rows;
}

const CONNECTOR_CATS = {
  scaleup:{ name:'Scale-up fabric', color:'#B26A2B' },
  pcie:   { name:'PCIe / scale-out', color:'#1E4E8C' },
  power:  { name:'Power', color:'#B9890B' },
  mgmt:   { name:'Management / misc', color:'#3E8A5A' },
  c2c:    { name:'CPU-to-CPU / C2C', color:'#6B6F7A' },
};

window.RE_DATA = { MEDIA, MEDIA_ORDER, XPUS, CPUS, NICS, DPUS, SU_SWITCHES, SO_SWITCHES, TOPOLOGIES, PRESETS, CONNECTOR_CATS, defaultAssumptions };
