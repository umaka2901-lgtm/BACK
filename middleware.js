const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Нет токена" });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: Number(p.sub), role: p.role };
    next();
  } catch {
    res.status(401).json({ error: "Невалидный или просроченный токен" });
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: "Недостаточно прав" });

module.exports = { authenticate, requireRole };
