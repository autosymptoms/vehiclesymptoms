// Tells Bing (and other IndexNow engines) about every page on the site.
// Runs once a day from the Vercel cron in vercel.json, and can be triggered by hand
// with /api/indexnow?run=<indexnow key>. Submitting the same URLs again is harmless.
const VERIFY=require('../src/verify.json');
const URLS=require('./_data/urls.json');
module.exports=async(req,res)=>{
  const ua=String(req.headers['user-agent']||'');
  const ok=ua.includes('vercel-cron')||(req.query&&req.query.run===VERIFY.indexnow);
  if(!ok){res.status(403).json({ok:false});return}
  const host='www.vehiclesymptoms.com',key=VERIFY.indexnow,out=[];
  // Bing directly first (it shares submissions with the other IndexNow engines), then the shared relay
  for(const ep of ['https://www.bing.com/indexnow','https://api.indexnow.org/indexnow']){
    for(let i=0;i<URLS.length;i+=10000){
      let status=0,body='';
      try{const r=await fetch(ep,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},
        body:JSON.stringify({host,key,keyLocation:`https://${host}/${key}.txt`,urlList:URLS.slice(i,i+10000)})});
        status=r.status;if(status>=300)body=(await r.text()).slice(0,200)}catch(e){body=String(e).slice(0,200)}
      out.push({endpoint:ep.replace('https://',''),urls:Math.min(10000,URLS.length-i),status,...(body?{detail:body}:{})});
    }
  }
  res.status(200).json({ok:out.some(x=>x.status===200||x.status===202),submitted:URLS.length,results:out});
};
