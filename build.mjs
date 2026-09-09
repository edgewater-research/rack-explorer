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
let frag = html.replace(/^<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, '').replace(/<meta[^>]*>\s*/gi, '').replace(/<\/head>\s*<body>\s*/i, '').replace(/\s*<\/body>\s*<\/html>\s*$/i, '\n');
writeFileSync(new URL('./dist/rack-explorer.fragment.html', import.meta.url), frag);
console.log('built dist/rack-explorer.html', (html.length/1024).toFixed(0)+'KB');
