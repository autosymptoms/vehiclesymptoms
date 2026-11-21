// The Freesound creator describes a whir heard while driving. The failed part was not confirmed.
const clip='whir-while-driving.mp3';
const recordings=[
  {
    id:'whir-while-driving',guide:'humming-noise-at-speed',title:'A whir or hum while moving',
    note:'This eight-second recording captures a loud, steady whir inside a moving car. The driver did not identify which part made it.',
    audio:true,youtube:'eqw0rFjsMjg',label:'wheel-bearing demonstration on a lift',video:'https://www.1aauto.com/noisy-car-or-truck-wheel-while-driving-could-be-a-bad-wheel-bearing/video/51114',
    link:'Watch a mechanic demonstrate a wheel-bearing noise on a lift at 1A Auto',next:'My car hums as road speed changes'
  },
  {
    id:'grinding-when-braking',guide:'grinding-brakes',title:'Grinding when braking',
    note:'In this video, 1A Auto records the noise during braking, then takes the wheel off to inspect the brakes.',
    youtube:'jA3xgegNVDg',label:'brake grinding demonstration',video:'https://www.1aauto.com/grinding-noise-when-braking-whats-that-noise-in-my-car-truck-or-suv/video/50331',
    link:'Watch the brake grinding example at 1A Auto',next:'My car grinds when I brake'
  },
  {
    id:'clicking-when-turning',guide:'clicking-when-turning',title:'Clicking when turning',
    note:'In this video, 1A Auto demonstrates a repeated click under acceleration during a turn and inspects the CV axle on that vehicle.',
    youtube:'K8jPtyBVdsg',label:'clicking on turns demonstration',video:'https://www.1aauto.com/clicking-noise-coming-from-the-front-end-of-your-car-or-truck-how-to-diagnose-cv-axle-problems/video/55555',
    link:'Watch the clicking example at 1A Auto',next:'My car clicks when I turn'
  }
];
function card(record){
  const player=record.audio?`<audio controls preload="none" aria-label="Eight-second recording of a whir inside a moving car" style="display:block;width:100%;max-width:34rem"><source src="/sounds/${clip}" type="audio/mpeg"><a href="/sounds/${clip}">Open the MP3 recording</a></audio>
    <p class="fine">Excerpt from <a href="https://freesound.org/people/watercool/sounds/410235/">As.m4a by watercool</a>, <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>. Trimmed and converted to mono.</p>`:'';
  return `<section class="card csec" id="${record.id}"><h2>${record.title}</h2><p>${record.note}</p>${player}
    <div data-sound-video="${record.youtube}"><button type="button" hidden class="btn ghost" style="padding:10px 14px" aria-expanded="false" aria-controls="${record.id}-player" data-title="1A Auto ${record.label}" data-open="Load ${record.label}">Load ${record.label}</button><div id="${record.id}-player" data-player-host></div></div>
    <p><a href="${record.video}">${record.link}</a></p><a class="walk" href="/symptoms/${record.guide}/">${record.next} →</a></section>`;
}
const html=`<div class="crumb"><a href="/">Home</a> › <a href="/symptoms/">Symptom guides</a> › Car sounds</div>
  <div class="ghead"><h1>What does that noise sound like?</h1><p class="sub">Listen while parked. Compare a recording with what you heard, then choose the guide that matches when it happens. Similar sounds can have different causes.</p><p class="fine">The audio clip plays here. Loading a mechanic demonstration connects to YouTube.</p></div>
  ${recordings.map(card).join('')}
  <p><a href="/symptoms/#noise">See all noise guides</a></p>`;
module.exports={clip,html,recordings};
