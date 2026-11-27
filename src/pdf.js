// Builds the "Download this page" PDF for a vehicle page: snapshot, every documented problem with its
// sources, the manufacturer's known fixes (bulletins) and safety recalls. Loaded only when a visitor taps the download button.
(function(){
const SEV={high:'Stop soon',med:'Get checked',low:'Monitor'};
const STOP_FIRST=/\b(?:pull over|stop driving|don['’]?t drive|do not drive|turn (?:the engine|it) off|turn off the engine|shut (?:the engine|it) off|have it towed|don['’]?t start|do not start)\b/i;
const sevLabel=i=>i.sev==='high'&&STOP_FIRST.test(String(i.next||'').split(/(?<=[.!])\s/)[0])?'Stop now':SEV[i.sev];
const SEVC={high:[198,47,55],med:[168,100,0],low:[24,128,74]};
const TEXT=[22,34,46],MUTED=[86,99,111],BODY=[46,59,71],BLUE=[11,99,206],LINE=[221,227,234],TILE=[243,246,249],GREEN=[24,128,74];
// The built-in PDF font only covers Western characters, so swap or drop anything else.
const clean=s=>String(s==null?'':s).replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/→/g,'->').replace(/…/g,'...').replace(/—/g,'-').replace(/\s+/g,' ').replace(/[^\x20-\x7E -ÿ–]/g,'').trim();
const yrs=i=>i.y[0]===i.y[1]?String(i.y[0]):i.y[0]+'–'+i.y[1];
// Publisher names (contract 3 `sl`, or the older `src` labels) and NHTSA recall ids ("21V-649") for an issue.
const srcOf=i=>Array.isArray(i.sl)?i.sl.filter(x=>x&&x.n).map(x=>String(x.n)):(i.src||[]).map(x=>String(x||'').trim()).filter(x=>x&&!/^https?:/i.test(x));
const ridsOf=i=>{const seen=new Set();return [...(Array.isArray(i.rid)?i.rid:[]),...(String((i.t||'')+' '+(i.next||'')).match(/\b\d{2}[VECT]-?\d{3}(?:\d{3})?\b/gi)||[])]
  .map(x=>{const m=String(x).toUpperCase().match(/^(\d{2})([VECT])-?(\d{3})/);return m?m[1]+m[2]+'-'+m[3]:''}).filter(x=>x&&!seen.has(x)&&seen.add(x))};

window.VS_PDF=function(ctx){
  const v=ctx.v,year=ctx.year,list=ctx.list||[],name=ctx.name;
  const doc=new window.jspdf.jsPDF({unit:'pt',format:'letter'});
  const W=612,H=792,M=48,CW=W-2*M,BOTTOM=H-58;
  let y=M;
  const font=(style,size,color)=>{doc.setFont('helvetica',style);doc.setFontSize(size);doc.setTextColor(color[0],color[1],color[2])};
  const need=h=>{if(y+h>BOTTOM){doc.addPage();y=M}};
  const rule=(gap)=>{doc.setDrawColor(LINE[0],LINE[1],LINE[2]);doc.setLineWidth(.7);doc.line(M,y,W-M,y);y+=gap||0};
  // Wrapped text that flows onto new pages line by line.
  const para=(txt,o)=>{o=Object.assign({size:9.5,style:'normal',color:BODY,x:M,w:CW,lh:1.4,after:0},o);
    font(o.style,o.size,o.color);const lines=doc.splitTextToSize(clean(txt),o.w-6),step=o.size*o.lh;
    for(const l of lines){need(step);font(o.style,o.size,o.color);doc.text(l,o.x,y,{baseline:'top'});y+=step}
    y+=o.after};
  const h2=(t,sub)=>{need(70);y+=14;font('bold',15,TEXT);doc.text(clean(t),M,y,{baseline:'top'});y+=21;rule(9);if(sub)para(sub,{size:9,color:MUTED,after:6})};
  const label=t=>{need(24);font('bold',7.5,MUTED);doc.text(clean(t).toUpperCase(),M,y,{baseline:'top'});y+=11};
  // Left text with a value pinned to the right edge.
  const row=(left,sub,right,o)=>{o=o||{};const rw=right?90:0;font('bold',9.5,TEXT);
    const ll=doc.splitTextToSize(clean(left),CW-rw-(o.indent||0));font('normal',8.5,MUTED);
    const sl=sub?doc.splitTextToSize(clean(sub),CW-rw-(o.indent||0)):[];
    need(ll.length*13+sl.length*11.5+10);
    if(right){font('bold',9.5,o.rc||TEXT);doc.text(clean(right),W-M,y,{baseline:'top',align:'right'})}
    font('bold',9.5,TEXT);for(const l of ll){doc.text(l,M+(o.indent||0),y,{baseline:'top'});y+=13}
    font('normal',8.5,MUTED);for(const l of sl){doc.text(l,M+(o.indent||0),y,{baseline:'top'});y+=11.5}
    y+=4;rule(6)};

  // Masthead
  font('bold',12,BLUE);doc.text('VehicleSymptoms.com',M,y,{baseline:'top'});
  font('normal',8.5,MUTED);doc.text('Saved '+new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}),W-M,y+2,{baseline:'top',align:'right'});
  y+=20;rule(16);
  para(name,{size:23,style:'bold',color:TEXT,lh:1.15,after:3});
  para('Problems and recalls'+(ctx.ename?' · '+ctx.ename:'')+(year?'':' · all model years '+v.years[0]+'–'+v.years[1]),{size:11,color:MUTED,after:4});
  if(v.alt)para(v.alt,{size:9,color:MUTED,after:2});

  // Ownership snapshot
  h2('At a glance');
  const serious=list.filter(i=>i.sev==='high').length;
  const rec=ctx.recalls,tiles=[];
  tiles.push(['Problems documented'+(year?' for '+year:''),list.length?String(list.length):'Not yet',list.length?(serious?serious+' rated serious':'None on file rated serious'):"We haven't documented issues for this year yet. Not a reliability rating."]);
  const recOk=rec&&rec.status==='ok';
  if(year)tiles.push(recOk?['Model-year safety recalls',String(rec.total),rec.total?'Filed for this model year. Individual VIN status unknown.':'None listed for this model year. Individual VIN status unknown.']:['Safety recalls','–','NHTSA campaign count unavailable. Individual VIN status unknown.']);
  {const gap=8,tw=(CW-gap*(tiles.length-1))/tiles.length,pad=9,iw=tw-pad*2;
   const laid=tiles.map(t=>{font('bold',6.8,MUTED);const a=doc.splitTextToSize(clean(t[0]).toUpperCase(),iw);font('normal',8,BODY);const c=doc.splitTextToSize(clean(t[2]),iw);return{a,c,h:pad*2+a.length*8.8+24+c.length*10.4}});
   const th=Math.max.apply(null,laid.map(l=>l.h));need(th+8);
   tiles.forEach((t,k)=>{const x=M+k*(tw+gap),l=laid[k];doc.setFillColor(TILE[0],TILE[1],TILE[2]);doc.setDrawColor(LINE[0],LINE[1],LINE[2]);doc.setLineWidth(.7);doc.roundedRect(x,y,tw,th,7,7,'FD');
     let ty=y+pad;font('bold',6.8,MUTED);for(const s of l.a){doc.text(s,x+pad,ty,{baseline:'top'});ty+=8.8}
     ty+=4;font('bold',t[1].length>9?12.5:17,t[3]||TEXT);doc.text(clean(t[1]),x+pad,ty,{baseline:'top'});ty+=20;
     font('normal',8,BODY);for(const s of l.c){doc.text(s,x+pad,ty,{baseline:'top'});ty+=10.4}});
   y+=th+12}
  if(ctx.note){y+=2;para(ctx.note,{size:8,color:MUTED,after:2})}

  // Known problems: everything for this year and engine, most serious first
  const SR={high:0,med:1,low:2},sorted=list.slice().sort((a,b)=>SR[a.sev]-SR[b.sev]);
  h2('Known problems'+(year?' for the '+name:''),list.length?list.length+' documented issue'+(list.length>1?'s':'')+(year?' apply to '+year:' across all years')+(ctx.ename?' with the '+ctx.ename:'')+', most serious first.':"We haven't documented model-specific issues for this year yet. This is not a reliability rating.");
  sorted.forEach((i,k)=>{need(96);
    const sv=clean(sevLabel(i)).toUpperCase();font('bold',8,SEVC[i.sev]);doc.text(sv,M,y,{baseline:'top'});const sw=doc.getTextWidth(sv);
    font('normal',8,MUTED);doc.text(clean('  ·  '+yrs(i)+'  ·  '+i.sys+(i.eng?'  ·  '+i.eng:'')),M+sw,y,{baseline:'top'});y+=13;
    para(i.t,{size:11.5,style:'bold',color:TEXT,lh:1.25,after:5});
    [["What you'll notice",i.sym],['Why it happens',i.why],['What to do',i.next]].forEach(p=>{if(!p[1])return;label(p[0]);para(p[1],{after:6})});
    // Bulletins, recall ids and sources, as on the page (plain text: no link annotations in the PDF).
    (ctx.bulletins||[]).filter(b=>(b.links_to_issue||[]).includes(i.t)).forEach(b=>para('Manufacturer bulletin '+b.mfr_no+(b.type==='warranty_ext'?'  ·  extended warranty':''),{size:8.5,color:TEXT,after:3}));
    const rids=ridsOf(i);if(rids.length)para('NHTSA recall '+rids.join(', '),{size:8.5,color:TEXT,after:3});
    const src=srcOf(i);if(src.length)para('Sources: '+src.join('  ·  '),{size:8,color:MUTED,after:i.wk?1:3});
    if(i.wk)para('Reported by owners; not yet confirmed by a primary source.',{size:8,color:MUTED,after:3});
    if(k<sorted.length-1){y+=4;rule(12)}});

  // Known fixes from the manufacturer (bulletins), after every problem: never above the urgent items.
  {const B=ctx.bulletins||[];if(year&&B.length){h2('Known fixes from the manufacturer ('+B.length+')','A bulletin is not a recall. If your car has an open recall, that comes first. A bulletin is a note from the maker to its dealers about a known problem and how to fix it.');
    B.forEach(b=>{const E=v.engines||[],eng=(b.engines||[]).length?b.engines.map(k=>(E.find(e=>e.k===k)||{name:k}).name).join(', '):'may apply to some engines';
      row(b.title+(b.type==='warranty_ext'?'  (extended warranty: repair may be covered)':''),'Ask the dealer about bulletin '+b.mfr_no+'  ·  '+(b.years[0]===b.years[1]?b.years[0]:b.years[0]+'–'+b.years[1])+'  ·  '+eng+(b.plain_summary?'. '+b.plain_summary:''),'')})}}

  // Safety recalls (live from NHTSA when the page loaded)
  if(year){
    if(recOk){h2((rec.total?rec.total+' safety recall'+(rec.total===1?'':'s'):'No safety recalls')+' filed for the '+name,(rec.total?'Campaigns NHTSA lists for this model year. Not every vehicle is included, and this does not show whether a recall is open on your car.':'NHTSA returned no campaigns for this model year.')+' Checked '+new Date(rec.checked).toLocaleDateString('en-US')+'.');
      rec.groups.forEach(g=>{if(rec.groups.length>1){need(30);para(g.label+': '+g.results.length,{size:10.5,style:'bold',color:TEXT,after:4})}
        g.results.forEach((x,k,a)=>{need(70);para([x.NHTSACampaignNumber,(x.Component||'').split(':')[0]].filter(Boolean).join('  ·  '),{size:9.5,style:'bold',color:TEXT,after:4});
          if(x.Summary){label('Problem');para(x.Summary,{size:9,after:5})}if(x.Remedy){label('Fix');para(x.Remedy,{size:9,after:4})}
          if(k<a.length-1){y+=3;rule(10)}})})}
    else h2('Safety recalls: lookup unavailable',"We couldn't confirm the recall list when this was saved. This does not mean there are no recalls.");
    y+=6;para('A model-year search cannot confirm whether your VIN is included or whether a recall repair was completed. Check your VIN for recalls at NHTSA: www.nhtsa.gov/recalls. A dealer can also check it.',{size:9,color:TEXT});
    para('Question for your dealer: Could you check my '+name+' by VIN for any open safety recalls and tell me which repairs are outstanding?',{size:9,style:'bold',color:TEXT})}


  y+=14;need(50);rule(10);
  para("This is a general guide based on widely reported problems. Not every vehicle is affected, and it doesn't replace an in-person diagnosis.",{size:8.5,color:MUTED});

  // Footer on every page
  const n=doc.getNumberOfPages(),link='vehiclesymptoms.com'+location.pathname;
  for(let p=1;p<=n;p++){doc.setPage(p);doc.setDrawColor(LINE[0],LINE[1],LINE[2]);doc.setLineWidth(.7);doc.line(M,H-44,W-M,H-44);
    font('normal',8,MUTED);doc.text(clean(name)+'  ·  '+link,M,H-36,{baseline:'top'});doc.text('Page '+p+' of '+n,W-M,H-36,{baseline:'top',align:'right'})}
  doc.save('vehiclesymptoms-'+v.id+(year?'-'+year:'')+'.pdf');
};
})();
