// Verified source and CC0 dedication, retained for the published excerpt.
// https://freesound.org/people/watercool/sounds/410235/
// https://creativecommons.org/publicdomain/zero/1.0/
const clip = 'whir-while-driving.mp3';
const section = 'whir-while-driving';
const guide = 'humming-noise-at-speed';
const html = `<nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/symptoms/#noise">Noise guides</a> › Car sounds</nav>
  <div class="ghead"><h1>Car sounds</h1><p class="sub">Listen while parked. Notice what sounds similar and when it happens in your car.</p></div>
  <section class="card csec" id="${section}" aria-labelledby="whir-heading">
    <h2 id="whir-heading">A whir inside a moving car</h2>
    <p>A steady whir is audible over the background of the drive. The driver who recorded it did not identify the cause.</p>
    <audio controls preload="none" aria-label="Eight-second recording of a whir inside a moving car" style="display:block;width:100%;max-width:34rem">
      <source src="/sounds/${clip}" type="audio/mpeg">
      <a href="/sounds/${clip}">Open the MP3 recording</a>
    </audio>
    <p class="fine">8-second excerpt from “As.m4a” by watercool on Freesound. Creative Commons CC0 1.0. Trimmed and converted to mono MP3.</p>
    <a class="walk" href="/symptoms/${guide}/">My car hums or whirs while moving →</a>
  </section>`;
module.exports = {clip,section,guide,html};
