const assert = require('node:assert/strict');
const { test } = require('node:test');

const guide = id => require('../src/journeys/' + id + '.json');
const result = (id, key) => guide(id).nodes[key].result;
const driverChecks = r => [r.now, ...r.if, ...r.confirm.you].join(' ');

test('suspected fire leads to evacuation and 911 without waiting for visible flames', () => {
  for (const [id, key] of [
    ['burning-smell', 'r_smoke'], ['burning-rubber-smell', 'r_hood_smoke'],
    ['burning-oil-smell', 'r_smoke'], ['hissing-under-hood', 'r_fluid_on_hot'],
    ['steam-from-under-hood', 'r_fire'], ['steam-from-under-hood', 'r_burning_rubber_plastic']
  ]) {
    const r = result(id, key);
    assert.equal(r.urgency, 'stop', id);
    for (const term of [/100 feet/, /traffic/, /911/, /hood closed/]) assert.match(r.now, term, id);
    assert.deepEqual(r.confirm.you, [], id);
    assert.doesNotMatch(driverChecks(r), /call 911 (only |for )?if (you see|there are) flames/i);
  }
});

test('overheating guidance never asks the driver to reproduce the fault or touch a fan', () => {
  for (const id of ['engine-overheating', 'overheats-only-in-traffic', 'temperature-gauge-fluctuating']) {
    for (const [key, node] of Object.entries(guide(id).nodes)) {
      const copy = node.q ? [node.q, node.help].join(' ') : driverChecks(node.result);
      assert.doesNotMatch(copy, /give the fan a push|then warm the engine|turn on the A\/C with the engine warm|listen for gurgling .*when you start|set the heat to full hot with the fan on\. You can turn it back off/i, id + '/' + key);
    }
  }
  const uncertainFan = guide('overheats-only-in-traffic').nodes.q_fan_running;
  assert.match(uncertainFan.help, /previous observation/i);
  assert.ok(uncertainFan.opts.some(o => /not sure/i.test(o.a)));
  assert.match(result('steam-from-under-hood', 'r_unsure').now, /hood closed/i);
  assert.doesNotMatch(driverChecks(result('white-smoke-from-exhaust', 'r_check_coolant')), /on your next drive/i);
});

test('suspected fuel leaks and exposures never send the driver to sniff, run a test or handle the spill', () => {
  for (const [id, key] of [
    ['gas-smell', 'r_cabin_fuel'], ['gas-smell', 'r_active_leak'], ['gas-smell', 'r_small_leak'],
    ['gas-smell', 'r_filler_tank_leak'], ['gas-smell', 'r_evap_leak'], ['fluid-leak-under-car', 'r_fuel'],
    ['popping-or-backfiring', 'r_rich'], ['black-smoke-from-exhaust', 'r_fuel_leak'], ['hissing-under-hood', 'r_fuel_leak']
  ]) {
    const r = result(id, key);
    assert.equal(r.urgency, 'stop', id + '/' + key);
    assert.match(r.now, /leave it off/i);
    assert.match(r.now, /away from the vehicle/i);
    assert.deepEqual(r.confirm.you, []);
  }
  assert.match(result('gas-smell', 'r_spilled').now, /notify the station attendant/i);
  assert.doesNotMatch(JSON.stringify(guide('fluid-leak-under-car')), /rub a drop|smell the fluid/i);
  assert.doesNotMatch(JSON.stringify(guide('rotten-egg-smell')), /sniff near|open the hood to let it vent/i);
});

test('symptomatic occupants are directed to fresh air and 911 in the result itself', () => {
  for (const [id, key] of [
    ['exhaust-smell-in-cabin', 'r_co_symptoms'], ['rattle-under-car', 'r_exhaust_in_cabin'], ['loud-exhaust-roaring', 'r_fumes']
  ]) {
    const r = result(id, key);
    assert.equal(r.urgency, 'stop');
    assert.match(r.now, /fresh air/i);
    assert.match(r.now, /call 911/i);
    assert.doesNotMatch(JSON.stringify(guide(id)), /if (they|it) do(es)?n.t (clear|quickly improve)|doesn.t clear quickly in fresh air/i);
  }
});
