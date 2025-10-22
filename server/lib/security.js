const os = require('os');

function parseAuthToken(req) {
  const hdr = (req.headers['authorization'] || '').toString();
  if (hdr.toLowerCase().startsWith('bearer ')) return hdr.slice(7).trim();
  const key = (req.headers['x-api-key'] || '').toString().trim();
  return key || '';
}

function authMiddleware() {
  const required = (process.env.AUTH_TOKEN || process.env.API_KEY || '').toString();
  if (!required) {
    // No token configured: allow all
    return (_req, _res, next) => next();
  }
  return (req, res, next) => {
    const tok = parseAuthToken(req);
    if (tok && tok === required) return next();
    res.status(401).json({ ok: false, error: 'Unauthorized' });
  };
}

function rateLimitMiddleware() {
  const windowSec = Math.max(10, Number(process.env.RATE_LIMIT_WINDOW_SEC || 60));
  const max = Math.max(10, Number(process.env.RATE_LIMIT_MAX || 120));
  const buckets = new Map(); // key -> { count, resetAt }
  const cleanupEvery = Math.max(30, Math.min(600, windowSec));
  let lastCleanup = Date.now();

  function keyFromReq(req) {
    // Per-IP basic key
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < cleanupEvery * 1000) return;
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
    lastCleanup = now;
  }

  return (req, res, next) => {
    cleanup();
    const now = Date.now();
    const key = keyFromReq(req);
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowSec * 1000 };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > max) {
      const retry = Math.max(0, Math.ceil((b.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ ok: false, error: 'Too Many Requests' });
    }
    next();
  };
}

function requireJson() {
  return (req, res, next) => {
    const ct = (req.headers['content-type'] || '').toString().toLowerCase();
    if (!ct.includes('application/json')) {
      return res.status(415).json({ ok: false, error: 'Content-Type must be application/json' });
    }
    next();
  };
}

module.exports = { authMiddleware, rateLimitMiddleware, requireJson };

