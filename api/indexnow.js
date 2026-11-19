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
  for(let i=0;i<URLS.length;i+=10000){
    const r=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},
      body:JSON.stringify({host,key,keyLocation:`https://${host}/${key}.txt`,urlList:URLS.slice(i,i+10000)})});
    out.push({batch:i/10000+1,urls:Math.min(10000,URLS.length-i),status:r.status});
  }
  res.status(200).json({ok:out.every(x=>x.status===200||x.status===202),submitted:URLS.length,batches:out});
};
