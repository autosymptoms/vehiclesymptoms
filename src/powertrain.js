// Powertrain classification and repair eligibility. Shared by build.js (Node) and the browser (window.VS_PT).
// A repair is offered, linked, priced or given a verdict only when it applies to every powertrain the
// vehicle had in the chosen year (or to the chosen engine). Unknown or mixed answers are "depends", never "yes".
(function(root){
  // Order matters: plug-in before hybrid, electric last so "electric motor" in a hybrid name is not read as a BEV.
  function classify(e){
    const n=((e&&e.k)||'')+' '+((e&&e.name)||'');const s=n.toLowerCase();
    if(/plug-in|\bphev\b|\bprime\b|\b4xe\b|energi|e-hybrid|range-extended|range extender|\brex\b|\brecharge\b/.test(s))return 'phev';
    if(/hybrid|eassist/.test(s))return 'hev';
    if(/\bev\b|electric|\bkwh\b|motor\b|motors\b/.test(s))return 'bev';
    if(/diesel|\btdi\b|duramax|cummins|power ?stroke|ecodiesel|bluetec|\bcrd\b|\b\d{3}l?d\b/.test(s))return 'diesel';
    return 'gas';
  }
  // Powertrains present for a vehicle in a year (and optionally one engine key).
  function powertrains(v,year,engineKey){
    const es=(v&&v.engines||[]).filter(e=>(!year||!e.y||(year>=e.y[0]&&year<=e.y[1]))&&(!engineKey||e.k===engineKey));
    return [...new Set(es.map(classify))];
  }
  const ICE=['gas','diesel','hev','phev'],SPARK=['gas','hev','phev'],CONV=['gas','diesel'],ALL=['gas','diesel','hev','phev','bev'];
  // Each rule: job-name pattern -> powertrains it applies to. First match wins. A job with no rule is "depends".
  const RULES=[
    [/spark plug|ignition coil|coil pack|knock sensor|evap|purge valve|vent valve|pcv|throttle body|catalytic|oxygen sensor|o2 sensor|mass air ?flow|\bmaf\b/i,SPARK],
    [/glow plug|\bdef\b|diesel exhaust fluid|\bdpf\b|particulate filter|injection pump/i,['diesel']],
    [/alternator|starter|serpentine|drive belt|belt tensioner|a\/?c compressor|clutch\b|clutch replacement/i,CONV],
    [/oil change|oil and filter|engine oil|oil pan|oil pressure|oil cooler|oil leak|rear main|valve cover|head gasket|timing (belt|chain)|camshaft|crankshaft|vvt|variable valve|fuel pump|fuel filter|fuel injector|fuel tank|intake manifold|exhaust manifold|exhaust|muffler|egr|turbo|engine air filter|air filter \(engine\)|thermostat|water pump|radiator|coolant|engine mount|transmission|cv joint boot|power steering|hydraulic steering|torque converter|differential/i,ICE],
    [/motor mount|engine or motor mount/i,ALL],
    [/brake|rotor|caliper|pad|shoe|master cylinder|abs |wheel bearing|hub|ball joint|control arm|tie rod|sway bar|stabilizer|strut|shock|coil spring|alignment|tire|tpms|wheel|cv axle|axle|steering rack|steering column|clock spring|airbag|seat belt|wiper|washer|headlight|tail ?light|bulb|door lock|window regulator|window motor|mirror|blower|blend door|cabin air filter|cabin filter|a\/?c recharge|refrigerant|heater core|12 ?v|battery replacement|car battery|low-voltage battery|key fob|infotainment|camera|sensor calibration|horn|fuse|relay|latch|handle|trunk|liftgate|hood|sunroof|seat|harness/i,ALL]
  ];
  // Some ALL jobs differ by powertrain enough that a car-wide range is wrong. Keep them out of BEVs unless a rule says otherwise.
  const NOT_BEV=/heater core|a\/?c recharge|refrigerant/i;
  function rule(job){for(const [re,pts] of RULES)if(re.test(job))return pts;return null}
  // Returns {ok:true}, {ok:false,reason} or {ok:null,reason} ("depends": show no price and no verdict).
  function eligible(job,v,year,engineKey){
    const pts=rule(job);if(!pts)return {ok:null,reason:'We have not checked which engines and powertrains this repair applies to.'};
    if(!v)return {ok:null,general:true,reason:'Pick your vehicle to check that this repair applies to it.'};
    const have=powertrains(v,year,engineKey);
    if(!have.length)return {ok:null,reason:'We do not have engine details for this vehicle and year.'};
    const allowed=pts.filter(p=>!(p==='bev'&&NOT_BEV.test(job)));
    const fit=have.filter(p=>allowed.includes(p));
    if(fit.length===have.length)return {ok:true,powertrains:have};
    const N={gas:'gasoline',diesel:'diesel',hev:'hybrid',phev:'plug-in hybrid',bev:'battery-electric'};
    // "Does not apply" only when it is definitive: no combustion engine, or the wrong fuel for a fuel-specific part.
    const definite=p=>p==='bev'||(pts===SPARK&&p==='diesel')||(pts.length===1&&pts[0]==='diesel'&&p!=='diesel');
    if(!fit.length&&have.every(definite))return {ok:false,powertrains:have,reason:'This repair does not apply to a '+have.map(p=>N[p]).join(' or ')+' vehicle.'};
    return {ok:null,powertrains:have,reason:'Whether this repair applies depends on the engine. This model year was sold as '+have.map(p=>N[p]).join(' and ')+'.'};
  }
  const api={classify,powertrains,eligible,rule};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VS_PT=api;
})(typeof window!=='undefined'?window:this);
