const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const guide = require('../src/journeys/grinding-brakes.json');
const buildEmail = require('../api/_email');
const script = readFileSync(require.resolve('../src/guide'), 'utf8');
const question = guide.nodes[guide.start];
const stopChoice = question.opts[1];
const stopResult = guide.nodes[stopChoice.go].result;
const vehicle = { id: 'toyota-camry', make: 'Toyota', model: 'Camry', years: [2000, 2020], issues: [] };

function openGuide(t, query = '') {
  const dom = new JSDOM('<main id="guideApp"></main>', {
    runScripts: 'outside-only',
    url: 'https://www.vehiclesymptoms.com/symptoms/grinding-brakes/' + query
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.JOURNEY = guide;
  w.VEHICLES = [vehicle];
  w.fetch = async () => ({ ok: true, json: async () => ({ enabled: true }) });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.eval(script);
  return {
    w, get: id => w.document.getElementById(id),
    choose: index => w.document.querySelector('.opt[data-i="' + index + '"]').click()
  };
}

test('a shared result carries the chosen outcome, the safety action and only the selected vehicle details', async t => {
  const { w, get, choose } = openGuide(t, '?v=toyota-camry&y=2015&vin=private-vin');
  let shared;
  w.navigator.share = async data => { shared = data; };
  choose(1);
  get('emailIn').value = 'private@example.test';
  await get('shareResult').onclick();
  assert.deepEqual(Object.keys(shared), ['text']);
  const urgency = w.document.querySelector('.result .urg > span:not(.sr-only)').textContent;
  for (const phrase of [guide.title, stopResult.title, urgency, stopResult.now, question.q, stopChoice.a, ...stopResult.if, '2015 Toyota Camry']) {
    assert.ok(shared.text.includes(phrase), phrase);
  }
  assert.doesNotMatch(shared.text, /private-vin|private@example|toyota-camry|https?:/);
  assert.equal(get('shareText').hidden, true);
});

test('clipboard fallback follows changed answers and keeps the mechanic copy and print controls', async t => {
  const { w, get, choose } = openGuide(t);
  let copied;
  w.navigator.clipboard = { writeText: async text => { copied = text; } };
  choose(1);
  await get('shareResult').onclick();
  assert.match(get('shareStatus').textContent, /paste/i);
  assert.ok(copied.includes(stopResult.now));
  assert.doesNotMatch(copied, /Toyota|add year|Vehicle:/);
  get('back').click();
  choose(0);
  const nextQuestion = guide.nodes[question.opts[0].go];
  choose(0);
  const nextResult = guide.nodes[nextQuestion.opts[0].go].result;
  await get('shareResult').onclick();
  assert.ok(copied.includes(nextQuestion.opts[0].a) && copied.includes(question.opts[0].a));
  assert.ok(copied.includes(nextResult.now) && !copied.includes(stopResult.now));
  await get('copy').onclick();
  assert.equal(copied, get('sum').textContent);
  assert.ok(copied.includes(nextResult.now) && copied.includes(nextResult.confirm.shop[0]));
  let printCalled = false;
  w.print = () => { printCalled = true; };
  get('print').click();
  assert.equal(printCalled, true);
});

test('cancelling a native share leaves the clipboard alone; a denied copy selects the whole message', async t => {
  const { w, get, choose } = openGuide(t);
  choose(1);
  let copyAttempts = 0;
  w.navigator.clipboard = { writeText: async () => { copyAttempts++; throw new Error('Denied'); } };
  w.navigator.share = async () => { throw new w.DOMException('Cancelled', 'AbortError'); };
  await get('shareResult').onclick();
  assert.equal(copyAttempts, 0);
  assert.equal(get('shareStatus').textContent, '');
  w.navigator.share = async () => { throw new w.DOMException('Denied', 'NotAllowedError'); };
  await get('shareResult').onclick();
  assert.equal(copyAttempts, 1);
  const field = get('shareText');
  assert.equal(field.hidden, false);
  assert.equal(w.document.activeElement, field);
  assert.equal(field.selectionStart, 0);
  assert.equal(field.selectionEnd, field.value.length);
  assert.ok(field.value.includes(stopResult.now));
});

test('the mechanic section of both email formats preserves the exact urgency and action', () => {
  const email = buildEmail({ j: guide, r: stopResult, steps: [[question.q, stopChoice.a]] });
  const doc = new JSDOM(email.html);
  try {
    const htmlSection = doc.window.document.body.textContent.split('Show this to your mechanic')[1];
    const textSection = email.text.split('SHOW THIS TO YOUR MECHANIC')[1];
    for (const section of [htmlSection, textSection]) {
      assert.ok(section.includes("Stop — don't drive it"));
      assert.ok(section.includes(stopResult.now));
      assert.ok(section.includes(stopChoice.a));
    }
  } finally {
    doc.window.close();
  }
});
