#!/usr/bin/env node
// Merges reviewed make files (tools/resets/makes/<slug>.json) into src/resets.json, keyed by slug.
// Existing makes are only replaced when --replace is passed.
const fs=require('fs'),path=require('path');const ROOT=path.join(__dirname,'..','..');
const RF=path.join(ROOT,'src/resets.json'),KD=path.join(__dirname,'makes');
const R=JSON.parse(fs.readFileSync(RF,'utf8'));const replace=process.argv.includes('--replace');let added=0;
for(const f of fs.readdirSync(KD).filter(f=>f.endsWith('.json'))){const slug=f.replace(/\.json$/,'');const d=JSON.parse(fs.readFileSync(path.join(KD,f),'utf8'));
  if(slug!==d.make.toLowerCase().replace(/[^a-z0-9]+/g,'-')){console.log('skip '+f+': file name must be the make slug');continue}
  if(R[slug]&&!replace){console.log('skip '+slug+': already in src/resets.json');continue}
  const o={make:d.make};for(const k of ['oil','tpms','notes'])if(d[k])o[k]=d[k];R[slug]=o;added++}
const out={};for(const k of Object.keys(R).sort())out[k]=R[k];
fs.writeFileSync(RF,JSON.stringify(out,null,1));console.log(added+' makes merged; '+Object.keys(out).length+' makes in src/resets.json');
