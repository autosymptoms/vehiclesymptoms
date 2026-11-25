// Builds the "Download this page" PDF for a vehicle page: snapshot, upkeep costs, every documented
// problem, the price guide and safety recalls. Loaded only when a visitor taps the download button.
(function(){
const SEV={high:'Stop soon',med:'Get checked',low:'Monitor'};
const STOP_FIRST=/\b(?:pull over|stop driving|don['’]?t drive|do not drive|turn (?:the engine|it) off|turn off the engine|shut (?:the engine|it) off|have it towed|don['’]?t start|do not start)\b/i;
const sevLabel=i=>i.sev==='high'&&STOP_FIRST.test(String(i.next||'').split(/(?<=[.!])\s/)[0])?'Stop now':SEV[i.sev];
const SEVC={high:[198,47,55],med:[168,100,0],low:[24,128,74]};
const TEXT=[22,34,46],MUTED=[86,99,111],BODY=[46,59,71],BLUE=[11,99,206],LINE=[221,227,234],TILE=[243,246,249],GREEN=[24,128,74];
const money=n=>'$'+Number(n).toLocaleString('en-US');
const rng=c=>money(c.lo)+'–'+money(c.hi);
// The built-in PDF font only covers Western characters, so swap or drop anything else.
const clean=s=>String(s==null?'':s).replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/→/g,'->').replace(/…/g,'...').replace(/—/g,'-').replace(/\s+/g,' ').replace(/[^\x20-\x7E -ÿ–]/g,'').trim();
const yrs=i=>i.y[0]===i.y[1]?String(i.y[0]):i.y[0]+'–'+i.y[1];

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
  const own=v.own,serious=list.filter(i=>i.sev==='high').length;
  const priced=c=>c&&!c.withheld&&!c.free&&typeof c.lo==='number',WH='Insufficient verified pricing for this vehicle and repair';
  const big=list.filter(i=>priced(i.cost)&&!i.cost.recall).sort((a,b)=>b.cost.hi-a.cost.hi)[0];
  const rec=ctx.recalls,tiles=[];
  if(own&&own.annual&&!own.annual.withheld)tiles.push(['Average yearly repair and maintenance',money(own.annual.amount)+' /yr','National average for the '+v.make+' '+v.model+', all years']);
  tiles.push(['Problems documented'+(year?' for '+year:''),list.length?String(list.length):'Not yet',list.length?(serious?serious+' rated serious':'None on file rated serious'):"We haven't documented issues for this year yet. Not a reliability rating."]);
  const recOk=rec&&rec.status==='ok';
  if(year)tiles.push(recOk?['Model-year safety recalls',String(rec.total),rec.total?'Filed for this model year. Individual VIN status unknown.':'None listed for this model year. Individual VIN status unknown.']:['Safety recalls','–','NHTSA campaign count unavailable. Individual VIN status unknown.']);
  if(big)tiles.push(['Highest-cost issue covered here',rng(big.cost),big.cost.job,GREEN]);
  {const gap=8,tw=(CW-gap*(tiles.length-1))/tiles.length,pad=9,iw=tw-pad*2;
   const laid=tiles.map(t=>{font('bold',6.8,MUTED);const a=doc.splitTextToSize(clean(t[0]).toUpperCase(),iw);font('normal',8,BODY);const c=doc.splitTextToSize(clean(t[2]),iw);return{a,c,h:pad*2+a.length*8.8+24+c.length*10.4}});
   const th=Math.max.apply(null,laid.map(l=>l.h));need(th+8);
   tiles.forEach((t,k)=>{const x=M+k*(tw+gap),l=laid[k];doc.setFillColor(TILE[0],TILE[1],TILE[2]);doc.setDrawColor(LINE[0],LINE[1],LINE[2]);doc.setLineWidth(.7);doc.roundedRect(x,y,tw,th,7,7,'FD');
     let ty=y+pad;font('bold',6.8,MUTED);for(const s of l.a){doc.text(s,x+pad,ty,{baseline:'top'});ty+=8.8}
     ty+=4;font('bold',t[1].length>9?12.5:17,t[3]||TEXT);doc.text(clean(t[1]),x+pad,ty,{baseline:'top'});ty+=20;
     font('normal',8,BODY);for(const s of l.c){doc.text(s,x+pad,ty,{baseline:'top'});ty+=10.4}});
   y+=th+12}
  if(own&&own.maint&&own.maint.length){need(60);para('Routine maintenance costs',{size:11,style:'bold',color:TEXT,after:1});
    para('Model-wide, not specific to one year or engine.',{size:8.5,color:MUTED,after:6});rule(6);
    own.maint.forEach(x=>row(x.job,x.every+(x.note?' · '+x.note:''),x.withheld?'Price not verified':rng(x)))}
  if(ctx.note){y+=2;para(ctx.note,{size:8,color:MUTED,after:2})}

  // Known problems: everything for this year and engine, most serious first
  const SR={high:0,med:1,low:2},sorted=list.slice().sort((a,b)=>SR[a.sev]-SR[b.sev]);
  h2('Known problems'+(year?' for the '+name:''),list.length?list.length+' documented issue'+(list.length>1?'s':'')+(year?' apply to '+year:' across all years')+(ctx.ename?' with the '+ctx.ename:'')+', most serious first.':"We haven't documented model-specific issues for this year yet. This is not a reliability rating.");
  sorted.forEach((i,k)=>{need(96);
    const sv=clean(sevLabel(i)).toUpperCase();font('bold',8,SEVC[i.sev]);doc.text(sv,M,y,{baseline:'top'});const sw=doc.getTextWidth(sv);
    font('normal',8,MUTED);doc.text(clean('  ·  '+yrs(i)+'  ·  '+i.sys+(i.eng?'  ·  '+i.eng:'')),M+sw,y,{baseline:'top'});y+=13;
    para(i.t,{size:11.5,style:'bold',color:TEXT,lh:1.25,after:5});
    [["What you'll notice",i.sym],['Why it happens',i.why],['What to do',i.next]].forEach(p=>{if(!p[1])return;label(p[0]);para(p[1],{after:6})});
    const c=i.cost;if(c){label(c.withheld?'Repair cost':'Typical repair cost');
      para((c.withheld?WH:c.free?'No charge if your vehicle is in the recall':rng(c))+'  ·  '+c.job,{style:'bold',color:TEXT,after:c.recall||c.note?1:4});
      if(c.recall)para('May be free under a recall or extended warranty.',{size:8.5,color:MUTED,after:c.note?1:4});
      if(c.note)para(c.note,{size:8.5,color:MUTED,after:4})}
    if(k<sorted.length-1){y+=4;rule(12)}});

  // Price guide
  {const seen=new Set(),uniq=list.filter(i=>i.cost&&!seen.has(i.cost.job)&&seen.add(i.cost.job));
   const pay=uniq.filter(i=>priced(i.cost)&&!i.cost.recall).sort((a,b)=>SR[a.sev]-SR[b.sev]||b.cost.hi-a.cost.hi);
   const rc=uniq.filter(i=>i.cost.free||(i.cost.recall&&!i.cost.withheld)),wh=uniq.filter(i=>i.cost.withheld);
   if(!pay.length&&wh.length){h2('Price guide',WH+'. No price, chart or verdict is shown for these repairs until two independent, dated price sources are matched to this vehicle.');wh.forEach(i=>row(i.cost.job,sevLabel(i),'Not verified'))}
   if(pay.length||rc.length){h2('Price guide: what repairs usually cost',pay.length?'Repairs owners of this vehicle may have to pay for, most serious first. Average estimates, low to high.':'No common out-of-pocket repairs on file for this year. The repairs below are normally covered by recalls.');
    if(pay.length)rule(6);pay.forEach(i=>row(i.cost.job,sevLabel(i),rng(i.cost)));
    if(rc.length){need(60);y+=6;para('Recall repairs: usually free at the dealer',{size:11,style:'bold',color:TEXT,after:1});
      para('A dealer can confirm coverage by VIN. An eligible safety recall repair is provided at no charge.',{size:8.5,color:MUTED,after:6});rule(6);
      rc.forEach(i=>row(i.cost.job.replace(/\s*\(recall\)$/i,''),'If your vehicle is included','No charge',{rc:GREEN}))}
    if(ctx.disc){y+=2;para('Disclaimer: '+ctx.disc,{size:8,color:MUTED})}}}

  // Safety recalls (live from NHTSA when the page loaded)
  if(year){
    if(recOk){h2((rec.total?rec.total+' safety recall'+(rec.total===1?'':'s'):'No safety recalls')+' filed for the '+name,(rec.total?'Campaigns NHTSA lists for this model year. Not every vehicle is included, and this does not show whether a recall is open on your car.':'NHTSA returned no campaigns for this model year.')+' Checked '+new Date(rec.checked).toLocaleDateString('en-US')+'.');
      rec.groups.forEach(g=>{if(rec.groups.length>1){need(30);para(g.label+': '+g.results.length,{size:10.5,style:'bold',color:TEXT,after:4})}
        g.results.forEach((x,k,a)=>{need(70);para([x.NHTSACampaignNumber,(x.Component||'').split(':')[0]].filter(Boolean).join('  ·  '),{size:9.5,style:'bold',color:TEXT,after:4});
          if(x.Summary){label('Problem');para(x.Summary,{size:9,after:5})}if(x.Remedy){label('Fix');para(x.Remedy,{size:9,after:4})}
          if(k<a.length-1){y+=3;rule(10)}})})}
    else h2('Safety recalls: lookup unavailable',"We couldn't confirm the recall list when this was saved. This does not mean there are no recalls.");
    y+=6;para('A model-year search cannot confirm whether your VIN is included or whether a recall repair was completed.',{size:9,color:TEXT});
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
