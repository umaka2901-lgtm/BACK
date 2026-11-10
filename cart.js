const express = require("express");
const pool = require("./db");
const { authenticate } = require("./middleware");
const router = express.Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const q = await pool.query(
    `SELECT ci.variant_id, p.id AS product_id, p.name, p.image_url, v.size,
            ci.quantity, p.price, (p.price * ci.quantity) AS subtotal
     FROM cart_items ci
     JOIN product_variants v ON v.id = ci.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE ci.user_id = $1 ORDER BY ci.variant_id`,
    [req.user.id]
  );
  const total = q.rows.reduce((s, r) => s + Number(r.subtotal), 0);
  res.json({ items: q.rows, total: total.toFixed(2) });
});

router.post("/items", async (req, res) => {
  const variantId = Number(req.body.variant_id);
  const qty = Number(req.body.quantity || 1);
  if (!Number.isInteger(variantId) || !Number.isInteger(qty) || qty < 1)
    return res.status(422).json({ error: "Нужны variant_id и quantity (целое от 1)" });
  const v = await pool.query(
    `SELECT v.stock FROM product_variants v
     JOIN products p ON p.id = v.product_id
     WHERE v.id = $1 AND p.is_active = true AND p.is_approved = true`,
    [variantId]
  );
  if (!v.rows[0]) return res.status(404).json({ error: "Вариант не найден" });
  if (v.rows[0].stock < 1) return res.status(409).json({ error: "Нет в наличии" });
  await pool.query(
    `INSERT INTO cart_items (user_id, variant_id, quantity) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, variant_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
    [req.user.id, variantId, qty]
  );
  res.status(201).json({ status: "added" });
});

router.patch("/items/:variantId", async (req, res) => {
  const qty = Number(req.body.quantity);
  if (!Number.isInteger(qty) || qty < 1) return res.status(422).json({ error: "quantity от 1" });
  const r = await pool.query(
    "UPDATE cart_items SET quantity = $1 WHERE user_id = $2 AND variant_id = $3",
    [qty, req.user.id, Number(req.params.variantId)]
  );
  if (!r.rowCount) return res.status(404).json({ error: "Нет в корзине" });
  res.json({ status: "updated" });
});

router.delete("/items/:variantId", async (req, res) => {
  await pool.query("DELETE FROM cart_items WHERE user_id = $1 AND variant_id = $2", [
    req.user.id,
    Number(req.params.variantId),
  ]);
  res.json({ status: "removed" });
});

module.exports = router;
