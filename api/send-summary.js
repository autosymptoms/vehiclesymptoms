// POST /api/send-summary — emails a guide result to the visitor who asked for it.
// The email is built on the server from the site's own guide data (guide id, answer choices,
// vehicle id), never from text the browser sends, so this can't be used to send arbitrary mail.
// Env vars (set in Vercel): RESEND_API_KEY (required), EMAIL_FROM (e.g. "VehicleSymptoms <help@vehiclesymptoms.com>"),
// Addresses are used only to deliver this one email. Nothing is added to a contact list.
const JOURNEYS = require('./_data/journeys.json');
const VEHICLES = require('./_data/vehicles-lite.json');
const buildEmail = require('./_email.js');
const SITE = 'https://www.vehiclesymptoms.com';
const hits = new Map();

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
  const mail = buildEmail({ j, r, steps, v, y, vehicleId: b.vehicle });
  const from = clean(process.env.EMAIL_FROM) || 'VehicleSymptoms <onboarding@resend.dev>';
  try {
    const s = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: mail.subject, html: mail.html, text: mail.text }) });
    if (!s.ok) { const t = await s.text(); console.error('resend', s.status, t); let m = ''; try { m = JSON.parse(t).message || '' } catch (e) {}
      return res.status(502).json({ error: 'Could not send right now. Please try again later. (code ' + s.status + ')', detail: String(m).slice(0, 160) }) }
    return res.status(200).json({ ok: true });
  } catch (e) { console.error(e); return res.status(502).json({ error: 'Could not send right now. Please try again later. (code net)', detail: String(e && e.message || e).slice(0, 160) }) }
};
