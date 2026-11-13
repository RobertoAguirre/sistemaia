const rateLimit = require('express-rate-limit');
const config = require('../config');

// Balance de cargas global: protege toda la API.
const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta más tarde' },
});

// Balance de cargas estricto para autenticación y check-in.
const authLimiter = rateLimit({
  windowMs: config.rateLimitAuthWindowMs,
  max: config.rateLimitAuthMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, intenta más tarde' },
});

module.exports = { globalLimiter, authLimiter };
