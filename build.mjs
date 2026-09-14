// Inlines css/js into a single self-contained HTML file for sharing (dist/rack-explorer.html)
// and an Artifact-friendly fragment without the document wrapper (dist/rack-explorer.fragment.html).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
let html = read('./index.html');
html = html.replace('<link rel="stylesheet" href="css/app.css">', () => `<style>\n${read('./css/app.css')}\n</style>`);
for (const f of ['data','compute','render','app']) html = html.replace(`<script src="js/${f}.js"></script>`, () => `<script>\n${read(`./js/${f}.js`)}\n</script>`);
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/rack-explorer.html', import.meta.url), html);
// fragment: strip doctype/html/head/body wrappers, keep <title>, <link>, <style>, content, scripts
const RACK = process.env.RE_URL_RACK, WL = process.env.RE_URL_WL;
const xlink = t => t.replace(/href="(index|rack-explorer)\.html"/g, RACK?`href="${RACK}"`:'$&').replace(/href="workload\.html"/g, WL?`href="${WL}"`:'$&');
let frag = html.replace(/^<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, '').replace(/<meta[^>]*>\s*/gi, '').replace(/<\/head>\s*<body>\s*/i, '').replace(/\s*<\/body>\s*<\/html>\s*$/i, '\n');
writeFileSync(new URL('./dist/rack-explorer.fragment.html', import.meta.url), xlink(frag));
console.log('built dist/rack-explorer.html', (html.length/1024).toFixed(0)+'KB');
// second page: LLM workloads
let wl = read('./workload.html');
wl = wl.replace('<link rel="stylesheet" href="css/app.css">', () => `<style>\n${read('./css/app.css')}\n</style>`).replace('<link rel="stylesheet" href="css/workload.css">', () => `<style>\n${read('./css/workload.css')}\n</style>`);
for (const f of ['data','workload']) wl = wl.replace(`<script src="js/${f}.js"></script>`, () => `<script>\n${read(`./js/${f}.js`)}\n</script>`);
wl = wl.replace('href="index.html"', 'href="rack-explorer.html"');
writeFileSync(new URL('./dist/llm-workloads.html', import.meta.url), wl);
let wfrag = wl.replace(/^<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, '').replace(/<meta[^>]*>\s*/gi, '').replace(/<\/head>\s*<body>\s*/i, '').replace(/\s*<\/body>\s*<\/html>\s*$/i, '\n');
writeFileSync(new URL('./dist/llm-workloads.fragment.html', import.meta.url), xlink(wfrag));
console.log('built dist/llm-workloads.html', (wl.length/1024).toFixed(0)+'KB');
