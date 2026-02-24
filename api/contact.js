const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const ipHits = new Map();

function tooMany(ip) {
  const now = Date.now();
  const entry = ipHits.get(ip) || [];
  const recent = entry.filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  ipHits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (tooMany(ip)) {
    res.status(429).json({ ok: false, error: 'Rate limited' });
    return;
  }

  const { fromEmail = '', subject = '', platform = '', message = '', userAgent = '', website = '', ts } = req.body || {};

  if (website) {
    res.status(200).json({ ok: true });
    return;
  }

  const cleanEmail = String(fromEmail).trim();
  const cleanSubject = String(subject).trim();
  const cleanPlatform = String(platform).trim().toLowerCase();
  const cleanMessage = String(message).trim();

  if (!cleanEmail || !cleanSubject || !cleanMessage) {
    res.status(400).json({ ok: false, error: 'Missing required fields' });
    return;
  }
  if (cleanSubject.length > 120 || cleanMessage.length > 2000) {
    res.status(400).json({ ok: false, error: 'Input too long' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO;
  const from = process.env.CONTACT_FROM;

  if (!apiKey || !to || !from) {
    res.status(503).json({ ok: false, fallback: true, error: 'Email service not configured' });
    return;
  }

  const bodyText = [
    `From: ${cleanEmail}`,
    `Platform: ${cleanPlatform || 'unknown'}`,
    `User-Agent: ${String(userAgent || '')}`,
    `Timestamp: ${new Date(Number(ts) || Date.now()).toISOString()}`,
    '',
    cleanMessage,
  ].join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `[Poly Oracle Contact] ${cleanSubject} (${cleanPlatform || 'unknown'})`,
        text: bodyText,
        reply_to: cleanEmail,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ ok: false, error: `Resend failed: ${text}` });
      return;
    }

    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to send message' });
  }
}
