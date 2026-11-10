const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("./db");

const router = express.Router();
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

function makeAccess(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
}

async function issueTokens(client, user) {
  const refresh = crypto.randomBytes(48).toString("base64url");
  await client.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '7 days')",
    [user.id, sha(refresh)]
  );
  return { access_token: makeAccess(user), refresh_token: refresh, token_type: "bearer" };
}

router.post("/register", async (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !email.includes("@") || !password || password.length < 6)
    return res.status(422).json({ error: "Нужен email и пароль от 6 символов" });
  const r = role === "seller" ? "seller" : "buyer"; // админом через API стать нельзя
  try {
    const hash = await bcrypt.hash(password, 10);
    const q = await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3) RETURNING id, email, role",
      [email.trim().toLowerCase(), hash, r]
    );
    res.status(201).json(q.rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Email уже занят" });
    console.error(e.message);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(422).json({ error: "Нужны email и пароль" });
  const client = await pool.connect();
  try {
    const q = await client.query(
      "SELECT id, email, role, password_hash FROM users WHERE email = $1",
      [email.trim().toLowerCase()]
    );
    const u = q.rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash)))
      return res.status(401).json({ error: "Неверный email или пароль" });
    res.json(await issueTokens(client, u));
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

router.post("/refresh", async (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) return res.status(422).json({ error: "Нужен refresh_token" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const t = await client.query(
      "UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1 AND revoked = false AND expires_at > now() RETURNING user_id",
      [sha(refresh_token)]
    );
    if (!t.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(401).json({ error: "Невалидный refresh-токен" });
    }
    const u = (await client.query("SELECT id, role FROM users WHERE id = $1", [t.rows[0].user_id])).rows[0];
    const tokens = await issueTokens(client, u);
    await client.query("COMMIT");
    res.json(tokens);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e.message);
    res.status(500).json({ error: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

router.post("/logout", async (req, res) => {
  const { refresh_token } = req.body || {};
  if (refresh_token)
    await pool.query("UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1", [sha(refresh_token)]);
  res.json({ status: "logged out" });
});

module.exports = router;
