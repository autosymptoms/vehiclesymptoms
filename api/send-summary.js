// POST /api/send-summary — emails a guide result to the visitor who asked for it.
// The email is built on the server from the site's own guide data (guide id, answer choices,
// vehicle id), never from text the browser sends, so this can't be used to send arbitrary mail.
// Env vars (set in Vercel): RESEND_API_KEY (required), EMAIL_FROM (e.g. "VehicleSymptoms <help@vehiclesymptoms.com>"),
// Every requester is saved to Resend Contacts (marked unsubscribed; no marketing email is sent).
const JOURNEYS = require('./_data/journeys.json');
const VEHICLES = require('./_data/vehicles-lite.json');
const SITE = 'https://www.vehiclesymptoms.com';
const URG = { stop: "Stop — don't drive it", soon: 'Get it checked in the next few days', check: 'Book a check when convenient', diy: 'Safe to check yourself first' };
const hits = new Map();
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

module.exports = async (req, res) => {
  const clean = v => String(v || '').trim().replace(/^["']+|["']+$/g, '').trim();
  const key = clean(process.env.RESEND_API_KEY);
  if (req.method === 'GET') return res.status(200).json({ enabled: !!key });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!key) return res.status(503).json({ error: 'Email is not set up yet' });
  if (!/^re_[\x21-\x7e]{10,}$/.test(key)) { console.error('RESEND_API_KEY malformed, length', key.length); return res.status(503).json({ error: 'Could not send right now. Please try again later. (code key)' }) }
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b) } catch (e) { b = {} } }
  b = b || {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot field: bots fill it, people never see it
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'x', now = Date.now();
  const h = (hits.get(ip) || []).filter(t => now - t < 3600e3); if (h.length >= 5) return res.status(429).json({ error: 'Too many requests. Try again later.' }); h.push(now); hits.set(ip, h);

  const j = JOURNEYS[b.guide]; if (!j) return res.status(400).json({ error: 'Unknown guide' });
  // replay the answers from the start to reach the result
  let cur = j.start; const steps = [];
  for (const i of (Array.isArray(b.answers) ? b.answers.slice(0, 12) : [])) {
    const n = j.nodes[cur]; if (!n || !n.q || !n.opts[i]) return res.status(400).json({ error: 'Bad answers' });
    steps.push([n.q, n.opts[i].a]); cur = n.opts[i].go;
  }
  const r = j.nodes[cur] && j.nodes[cur].result; if (!r) return res.status(400).json({ error: 'Bad answers' });
  const v = VEHICLES[b.vehicle]; const y = v && +b.year >= v.y0 && +b.year <= v.y1 ? +b.year : null;
  const vname = v ? (y ? y + ' ' : '') + v.name : '';
  const link = SITE + '/symptoms/' + j.id + '/' + (v ? '?v=' + encodeURIComponent(b.vehicle) + (y ? '&y=' + y : '') : '');
  const li = a => a.map(x => `<li style="margin:4px 0">${esc(x)}</li>`).join('');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;color:#111;line-height:1.5">
<p style="font-size:13px;color:#555;margin:0">VehicleSymptoms.com · Your saved result</p>
<h1 style="font-size:22px;margin:8px 0">${esc(j.title)}${vname ? ' — ' + esc(vname) : ''}</h1>
<p style="display:inline-block;background:#eef3ff;border-radius:6px;padding:6px 10px;font-weight:bold;margin:4px 0">${esc(URG[r.urgency])}</p>
<h2 style="font-size:18px;margin:16px 0 6px">${esc(r.title)}</h2>
<h3 style="font-size:15px;margin:14px 0 4px">What to do now</h3><p style="margin:0">${esc(r.now)}</p>${r.if.length ? `<ul>${li(r.if)}</ul>` : ''}
<h3 style="font-size:15px;margin:14px 0 4px">Why</h3><p style="margin:0">${esc(r.why)}</p>
<h3 style="font-size:15px;margin:14px 0 4px">Possible causes</h3><ul>${r.causes.map(c => `<li style="margin:4px 0"><b>${esc(c.name)}</b>${c.clues ? ' — ' + esc(c.clues) : ''}</li>`).join('')}</ul>
<h3 style="font-size:15px;margin:14px 0 4px">Summary for your mechanic</h3>
<div style="background:#f5f7fa;border:1px solid #dde3ea;border-radius:8px;padding:12px;font-size:14px">
<b>Vehicle:</b> ${esc(vname || 'not specified')}<br><b>Main concern:</b> ${esc(j.title)}<br><b>What I noticed:</b><ul style="margin:6px 0">${steps.map(s => `<li>${esc(s[0])} → ${esc(s[1])}</li>`).join('')}</ul>
<b>Possible causes to check:</b> ${esc(r.causes.map(c => c.name).join('; '))}<br><b>Tests a shop usually does:</b> ${esc(r.confirm.shop.join('; '))}</div>
<p style="margin:18px 0"><a href="${link}" style="background:#0A84FF;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold">Open this guide again</a></p>
<p style="font-size:12px;color:#666">This is a general guide, not a diagnosis. If a red warning light is flashing, you smell fuel or burning, or the brakes or steering feel wrong, pull over safely and get help.<br>You received this because you asked VehicleSymptoms.com to email you this result.</p></div>`;
  const text = `${j.title}${vname ? ' — ' + vname : ''}\n${URG[r.urgency]}\n\n${r.title}\n\nWhat to do now: ${r.now}\n${r.if.map(x => '- ' + x).join('\n')}\n\nWhy: ${r.why}\n\nPossible causes: ${r.causes.map(c => c.name).join('; ')}\nTests a shop usually does: ${r.confirm.shop.join('; ')}\n\nOpen the guide: ${link}\n\nA general guide, not a diagnosis.`;
  const from = clean(process.env.EMAIL_FROM) || 'VehicleSymptoms <onboarding@resend.dev>';
  try {
    const s = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: `Your result: ${j.title}${vname ? ' (' + vname + ')' : ''}`, html, text }) });
    if (!s.ok) { const t = await s.text(); console.error('resend', s.status, t); let m = ''; try { m = JSON.parse(t).message || '' } catch (e) {}
      return res.status(502).json({ error: 'Could not send right now. Please try again later. (code ' + s.status + ')', detail: String(m).slice(0, 160) }) }
    // Save to Resend Contacts (global contacts). Marked unsubscribed: we don't send marketing email.
    await fetch('https://api.resend.com/contacts', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, unsubscribed: true }) }).catch(() => {});
    return res.status(200).json({ ok: true });
  } catch (e) { console.error(e); return res.status(502).json({ error: 'Could not send right now. Please try again later. (code net)', detail: String(e && e.message || e).slice(0, 160) }) }
};
