// Builds the "your saved result" email. Structure follows the StoryBrand framework:
// the driver is the hero, VehicleSymptoms is the guide (empathy + authority), we give a
// simple plan, a clear call to action, name what's at stake, and show what success looks like.
// Email-safe HTML: tables, inline styles, no SVG, no external CSS.
const SITE = 'https://www.vehiclesymptoms.com';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const URG = {
  stop: { label: "Stop — don't drive it", color: '#D93A3F', tint: '#FDECEC',
    stakes: 'Driving on this can turn a smaller repair into a much bigger one, or leave you stranded somewhere worse.' },
  soon: { label: 'Get it checked in the next few days', color: '#C77700', tint: '#FFF4E0',
    stakes: 'Problems like this usually get worse, and more expensive, the longer they wait.' },
  check: { label: 'Book a check when convenient', color: '#0A6FD6', tint: '#E8F2FF',
    stakes: "It's not an emergency, but checking it early is how a small fix stays small." },
  diy: { label: 'Safe to check yourself first', color: '#1F8A53', tint: '#E6F6EE',
    stakes: 'There is a good chance you can check this yourself and save a trip to the shop.' },
};

const FONT = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;";
const h3 = t => `<p style="${FONT}margin:0 0 8px;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;font-weight:bold;color:#5B6B7D">${t}</p>`;
const card = (inner, extra = '') => `<tr><td style="padding:0 24px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #DDE5EE;border-radius:12px;${extra}"><tr><td style="padding:20px 22px">${inner}</td></tr></table></td></tr>`;
const p = (t, s = '') => `<p style="${FONT}margin:0;font-size:16px;line-height:1.55;color:#1B2733;${s}">${t}</p>`;
const bullets = (a, color = '#0A84FF') => a.map(x => `<tr><td valign="top" style="padding:5px 10px 5px 0;${FONT}font-size:16px;line-height:1.5;color:${color};font-weight:bold">&#8226;</td><td style="padding:5px 0;${FONT}font-size:15px;line-height:1.5;color:#1B2733">${esc(x)}</td></tr>`).join('');
const btn = (href, label, bg = '#0A84FF') => `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${bg};border-radius:10px"><a href="${href}" style="${FONT}display:inline-block;padding:14px 26px;font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none">${label}</a></td></tr></table>`;

module.exports = function buildEmail({ j, r, steps, v, y, vehicleId }) {
  const u = URG[r.urgency] || URG.check;
  const vname = v ? (y ? y + ' ' : '') + v.name : '';
  const q = v ? '?v=' + encodeURIComponent(vehicleId) + (y ? '&y=' + y : '') : '';
  const guideLink = SITE + '/symptoms/' + j.id + '/' + q;
  const vehLink = v ? SITE + '/vehicles/' + vehicleId + '/' + (y ? y + '/' : '') : SITE + '/#vehicle';
  const plan2 = r.urgency === 'diy' ? ['Do the simple checks', 'Try the checks you can do yourself, listed below.']
    : ['Show your mechanic the summary', 'It tells them what you noticed, so they can find it faster.'];
  const plan = [
    ['Do what’s in “What to do now”', 'It keeps you safe and stops the problem getting worse.'],
    plan2,
    ['Drive with confidence again', 'Get it fixed knowing what to expect, with no guessing.'],
  ];
  const planRows = plan.map((s, i) => `<tr><td valign="top" style="padding:0 14px 14px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" valign="middle" width="34" height="34" style="width:34px;height:34px;border-radius:17px;background:#0A84FF;${FONT}font-size:16px;font-weight:bold;color:#FFFFFF">${i + 1}</td></tr></table></td><td valign="top" style="padding:4px 0 14px"><p style="${FONT}margin:0;font-size:16px;font-weight:bold;color:#0B1F33">${s[0]}</p><p style="${FONT}margin:2px 0 0;font-size:14px;line-height:1.45;color:#5B6B7D">${s[1]}</p></td></tr>`).join('');
  const causes = r.causes.map(c => `<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;border-left:4px solid #0A84FF;border-radius:6px"><tr><td style="padding:12px 14px"><p style="${FONT}margin:0;font-size:15px;font-weight:bold;color:#0B1F33">${esc(c.name)}</p>${c.clues ? `<p style="${FONT}margin:4px 0 0;font-size:14px;line-height:1.45;color:#43546A">${esc(c.clues)}</p>` : ''}</td></tr></table></td></tr>`).join('');
  const noticed = steps.map(s => `<tr><td style="padding:3px 0;${FONT}font-size:14px;line-height:1.45;color:#1B2733"><span style="color:#5B6B7D">${esc(s[0])}</span><br><b>${esc(s[1])}</b></td></tr>`).join('');
  const preheader = `${u.label}. ${r.title}`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(j.title)}</title></head>
<body style="margin:0;padding:0;background:#E9EEF4">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#E9EEF4">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#E9EEF4" style="background:#E9EEF4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#F7F9FC;border-radius:16px;overflow:hidden">

<tr><td bgcolor="#061A2E" style="background:#061A2E;background-image:linear-gradient(135deg,#020B16 0%,#0B2440 100%);padding:22px 24px 26px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td valign="middle" style="padding-right:10px"><img src="${SITE}/email/logo.png" width="32" height="32" alt="" style="display:block;border:0;border-radius:8px"></td>
    <td valign="middle" style="${FONT}font-size:19px;font-weight:bold;color:#FFFFFF">Vehicle<span style="color:#5AB0FF">Symptoms</span></td>
  </tr></table>
  <p style="${FONT}margin:22px 0 6px;font-size:14px;color:#9FB3C8">Your saved result${vname ? ' for your <b style="color:#FFFFFF">' + esc(vname) + '</b>' : ''}</p>
  <h1 style="${FONT}margin:0;font-size:26px;line-height:1.25;font-weight:bold;color:#FFFFFF">${esc(j.title)}</h1>
  <p style="${FONT}margin:12px 0 0;font-size:15px;line-height:1.55;color:#C9D7E6">Car trouble is stressful, especially when you don’t know how serious it is. You did the right thing by checking first. Here’s what you need to know.</p>
</td></tr>

<tr><td style="padding:20px 24px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${u.tint};border:2px solid ${u.color};border-radius:12px"><tr><td style="padding:16px 20px">
  <p style="${FONT}margin:0;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;font-weight:bold;color:${u.color}">How urgent is this?</p>
  <p style="${FONT}margin:4px 0 0;font-size:20px;font-weight:bold;color:${u.color}">${u.label}</p>
  <p style="${FONT}margin:8px 0 0;font-size:15px;line-height:1.5;color:#1B2733">${esc(r.title)}</p>
</td></tr></table></td></tr>

${card(h3('What to do now') + p(esc(r.now)) + (r.if.length ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:10px">${bullets(r.if)}</table>` : ''))}

${card(h3('Your simple plan') + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:6px">${planRows}</table>`)}

${card(h3('Why this matters') + p(esc(r.why)) + `<p style="${FONT}margin:12px 0 0;font-size:15px;line-height:1.5;color:${u.color};font-weight:bold">${u.stakes}</p>`)}

${card(h3('What it’s most likely to be') + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px">${causes}</table>`)}

${r.confirm.you.length ? card(h3('Checks you can do yourself') + `<table role="presentation" cellpadding="0" cellspacing="0">${bullets(r.confirm.you, '#1F8A53')}</table>`) : ''}

${card(`<p style="${FONT}margin:0 0 4px;font-size:18px;font-weight:bold;color:#0B1F33">Show this to your mechanic</p><p style="${FONT}margin:0 0 14px;font-size:14px;color:#5B6B7D">Hand them your phone or print this email. It saves time and helps avoid paying for guesswork.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;border:1px dashed #9FB3C8;border-radius:10px"><tr><td style="padding:16px 18px">
<p style="${FONT}margin:0 0 8px;font-size:14px;color:#1B2733"><b>Vehicle:</b> ${esc(vname || 'Not specified')}</p>
<p style="${FONT}margin:0 0 8px;font-size:14px;color:#1B2733"><b>Main concern:</b> ${esc(j.title)}</p>
${steps.length ? `<p style="${FONT}margin:0 0 4px;font-size:14px;color:#1B2733"><b>What I noticed:</b></p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px">${noticed}</table>` : ''}
<p style="${FONT}margin:0 0 8px;font-size:14px;color:#1B2733"><b>Urgency:</b> ${esc(u.label)}</p>
<p style="${FONT}margin:0 0 8px;font-size:14px;line-height:1.45;color:#1B2733"><b>What to do next:</b> ${esc(r.now)}</p>
<p style="${FONT}margin:0 0 8px;font-size:14px;line-height:1.45;color:#1B2733"><b>Possible causes to check:</b> ${esc(r.causes.map(c => c.name).join('; '))}</p>
<p style="${FONT}margin:0;font-size:14px;line-height:1.45;color:#1B2733"><b>Tests a shop usually does:</b> ${esc(r.confirm.shop.join('; '))}</p>
</td></tr></table>`, 'border-color:#0A84FF;border-width:2px')}

<tr><td align="center" style="padding:8px 24px 6px">
  ${btn(guideLink, 'Open your guide again')}
  <p style="${FONT}margin:14px 0 0;font-size:14px;color:#43546A"><a href="${vehLink}" style="color:#0A6FD6;font-weight:bold;text-decoration:underline">${v ? 'See common problems and recalls for your ' + esc(vname) : 'Look up your vehicle or VIN for free'}</a></p>
</td></tr>

<tr><td style="padding:22px 24px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0B2440" style="background:#0B2440;border-radius:12px"><tr><td style="padding:18px 20px">
  <p style="${FONT}margin:0;font-size:16px;font-weight:bold;color:#FFFFFF">Built by people who fix cars</p>
  <p style="${FONT}margin:6px 0 0;font-size:14px;line-height:1.5;color:#C9D7E6">Our guides are written for drivers and checked against recalls, service bulletins and real repair records, so you can walk into the shop knowing what to ask.</p>
</td></tr></table></td></tr>

<tr><td align="center" style="padding:18px 28px 0">
  <p style="${FONT}margin:0;font-size:14px;line-height:1.5;color:#43546A">Know someone whose car is acting up? Forward this email, or send them to <a href="${SITE}/" style="color:#0A6FD6;font-weight:bold">VehicleSymptoms.com</a>. It\u2019s free.</p>
</td></tr>

<tr><td style="padding:18px 28px 26px">
  <p style="${FONT}margin:0;font-size:12px;line-height:1.55;color:#6B7B8D">This is a general guide, not a diagnosis. If a red warning light is flashing, you smell fuel or burning, or the brakes or steering feel wrong, pull over safely and get help.</p>
  <p style="${FONT}margin:10px 0 0;font-size:12px;line-height:1.55;color:#6B7B8D">You got this email because you asked VehicleSymptoms.com to send you this result. We don’t send marketing email. <a href="${SITE}/privacy/" style="color:#6B7B8D;text-decoration:underline">Privacy</a></p>
</td></tr>

</table></td></tr></table></body></html>`;

  const text = `VehicleSymptoms.com: your saved result${vname ? ' for your ' + vname : ''}

${j.title}
How urgent: ${u.label}
${r.title}

WHAT TO DO NOW
${r.now}
${r.if.map(x => '- ' + x).join('\n')}

YOUR SIMPLE PLAN
${plan.map((s, i) => `${i + 1}. ${s[0]}`).join('\n')}

WHY THIS MATTERS
${r.why}
${u.stakes}

MOST LIKELY CAUSES
${r.causes.map(c => '- ' + c.name + (c.clues ? ': ' + c.clues : '')).join('\n')}

SHOW THIS TO YOUR MECHANIC
Vehicle: ${vname || 'Not specified'}
Main concern: ${j.title}
${steps.map(s => '- ' + s[0] + ' ' + s[1]).join('\n')}
Urgency: ${u.label}
What to do next: ${r.now}
Possible causes to check: ${r.causes.map(c => c.name).join('; ')}
Tests a shop usually does: ${r.confirm.shop.join('; ')}

Open your guide again: ${guideLink}

A general guide, not a diagnosis. You got this because you asked VehicleSymptoms.com to send it.`;

  return { subject: `Your result: ${j.title}${vname ? ' (' + vname + ')' : ''}`, html, text };
};
