const express = require("express");
const pool = require("./db");
const { authenticate, requireRole } = require("./middleware");
const router = express.Router();
router.use(authenticate, requireRole("admin"));

router.get("/products/pending", async (req, res) => {
  const q = await pool.query(
    "SELECT id, seller_id, name, price FROM products WHERE is_approved = false AND is_active = true ORDER BY id"
  );
  res.json(q.rows);
});

router.patch("/products/:id/approve", async (req, res) => {
  const r = await pool.query("UPDATE products SET is_approved = true WHERE id = $1", [Number(req.params.id)]);
  if (!r.rowCount) return res.status(404).json({ error: "Товар не найден" });
  res.json({ status: "approved" });
});

module.exports = router;
