# Rack Explorer

Interactive AI rack network explorer for the scale-up and scale-out architectures Edgewater Research analyzes repeatedly: GB200/GB300 NVL72, Vera Rubin NVL144, Rubin Ultra NVL576 (Kyber), HGX B200, Trainium2/3 UltraServers, TPU v7 Ironwood, AMD Helios and MI355X — plus a blank builder for anything new.

Open `index.html` in a browser. No build step, no dependencies, no server.

## What it does

- **Five drawing sheets per architecture**, in a consistent engineering-drawing house style with a title block: Board (component & connector map), Tray (compute and switch tray plan view), Rack (elevation with scale-up spine and scale-out exits), Scale-up fabric (bipartite / mesh / 2D-3D torus topology), Scale-out network (NICs → optics → leaf).
- **Every figure is derived from inputs you can change**: chip counts, trays, links per XPU, lanes per link, lane rate, switch radix, NIC speed and count, module speed, oversubscription. The link math is shown as a formula (`18 links × 2 lanes × 200 Gb/s = 7,200 Gb/s per direction = 1.8 TB/s bidirectional`).
- **Media are first-class and colour-coded**: on-board PCB, copper backplane / cartridge, DAC, ACC, AEC, pluggable optics (DSP), LPO, CPO/NPO, and OCS. Each scale-up and scale-out segment can be switched between media; reach, power per 800G end, and cost per 800G end come from the assumptions panel.
- **Assumptions panel** for disputed numbers: bandwidth convention (bidirectional vs per direction), end-counting, SerDes pJ/bit, lanes per module, twinax pairs per lane, rack overhead, unit costs, and per-media reach / power / cost. Each row carries a confidence tag (H documented, M vendor-stated / partial, L estimate) and a source note.
- **Building blocks library**: XPUs (B200, B300, Rubin, Rubin Ultra, Trainium2/3, TPU v7, MI355X, MI450), CPUs (Grace, Vera, Xeon, EPYC), NICs (ConnectX-7/8/9, Nitro, Pollara, Vulcano, Thor Ultra), DPUs, scale-up switch ASICs (NVSwitch 5/6/7, Tomahawk 6 / Ultra, UALink, NeuronSwitch, OCS), scale-out switches (Quantum-X800, Spectrum-X800 / Photonics CPO, Tomahawk 5/6, Davisson CPO). Click a block to drop it into the current build; click it in the drawing to edit its specs.
- **Consistency checks**: computed vs vendor bandwidth, switch ports vs XPU links (utilisation / oversubscription), uneven link striping, torus regularity, media reach vs required run length, computed vs stated rack power.
- **Bill of interconnect**: hardware counts (links, twinax pairs, modules, fibers), power budget (silicon vs SerDes vs media), interconnect cost estimate.
- **Compare** tab: all architectures recomputed under the current assumptions in one table.
- Save custom builds (browser storage), export / import JSON, download any sheet as SVG, light / dark theme.

## Files

| Path | Role |
| --- | --- |
| `index.html` | App shell |
| `css/app.css` | House style tokens and layout |
| `js/data.js` | Media, building blocks, rack presets, default assumptions — the place to correct a figure |
| `js/compute.js` | Pure functions: build + assumptions → link math, segments, power, cost, BOM, checks |
| `js/render.js` | SVG drawing engine for the five sheets and the compare table |
| `js/app.js` | State, panels, events, persistence |
| `build.mjs` | `node build.mjs` inlines everything into `dist/rack-explorer.html` (single shareable file) |

## Data caveats

Preset values are defaults, not a source of record. Anything tagged **L** is a placeholder chosen to reproduce a vendor aggregate (for example the NVLink 6 lane/link split, Trainium2 NeuronLink per-chip bandwidth, Helios switch ASIC). Sources and caveats for each preset are listed in the Inspector when the rack is selected. Correct figures in `js/data.js` or override them in the UI and save a variant.
