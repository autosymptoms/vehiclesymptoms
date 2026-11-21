// Safety audit step 2: open built pages in headless Chrome at a phone viewport (390x844) and record where
// each statement's text sits, in px below the header. Needs a static server on :8765 serving dist/.
// node audit/safety/measure.js  -> audit/safety/positions.json
const fs=require('fs');const puppeteer=require('puppeteer-core');
const {S}=JSON.parse(fs.readFileSync('audit/safety/statements.json','utf8'));
const STATIC=new Set(['urgent_if','badge','plain','drive','faq','meaning','flash','todo','dont','safety','intro','help','result-badge','result-now','result-if']);
const byRoute={};for(const s of S){if(!STATIC.has(s.kind))continue;(byRoute[s.route]=byRoute[s.route]||new Set()).add(s.kind==='badge'?'@@BADGE@@':s.text)}
(async()=>{
  const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu']});
  const routes=Object.keys(byRoute);const out={};const N=6;let i=0;
  async function worker(){const p=await b.newPage();await p.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true});
    await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(!u.startsWith('http://127.0.0.1:8765'))r.abort();else r.continue()});
    while(i<routes.length){const r=routes[i++];
      try{await p.goto('http://127.0.0.1:8765'+r,{waitUntil:'domcontentloaded',timeout:20000});
        out[r]=await p.evaluate(targets=>{
          const hb=(document.querySelector('header')||{getBoundingClientRect:()=>({bottom:0})}).getBoundingClientRect().bottom+scrollY;
          const norm=t=>t.replace(/\s+/g,' ');const res={};
          const badge=document.querySelector('#vehicleView .urg')||document.querySelector('main .urg');
          if(badge){const rc=badge.getBoundingClientRect();res['@@BADGE@@']={top:Math.round(rc.top+scrollY-hb),bottom:Math.round(rc.bottom+scrollY-hb),vis:true,text:norm(badge.textContent).trim()}}
          const w=document.createTreeWalker(document.getElementById('vehicleView')||document.querySelector('main')||document.body,NodeFilter.SHOW_TEXT);const nodes=[];let n;while(n=w.nextNode())nodes.push(n);
          for(const t of targets){if(t==='@@BADGE@@')continue;const key=t.slice(0,60);let hit=null;
            for(const nd of nodes){const tx=norm(nd.textContent);const k=tx.indexOf(key);if(k<0)continue;
              const el=nd.parentElement;const closedDetails=el.closest('details:not([open])')&&!el.closest('summary');
              const rg=document.createRange();try{rg.setStart(nd,Math.min(k,nd.length));rg.setEnd(nd,Math.min(k+1,nd.length))}catch(e){}
              const rc=rg.getBoundingClientRect();const top=Math.round(rc.top+scrollY-hb);
              const vis=!closedDetails&&!!el.offsetParent&&rc.height>0;
              if(!hit||(vis&&!hit.vis)||(vis===hit.vis&&top<hit.top))hit={top,vis,inFaq:!!el.closest('.faq'),inDetails:!!el.closest('details')};}
            res[t]=hit||{missing:true}}
          return res},[...byRoute[r]]);
      }catch(e){out[r]={error:String(e).slice(0,100)}}
      if(i%200===0)console.log(i,'/',routes.length)}
    await p.close()}
  await Promise.all(Array.from({length:N},worker));await b.close();
  fs.writeFileSync('audit/safety/positions.json',JSON.stringify(out));console.log('done',Object.keys(out).length);
})();
