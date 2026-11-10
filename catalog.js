const express = require("express");
const pool = require("./db");
const router = express.Router();

router.get("/categories", async (req, res) => {
  const q = await pool.query("SELECT id, name FROM categories ORDER BY id");
  res.json(q.rows);
});

router.get("/products", async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
  const where = ["p.is_active = true", "p.is_approved = true"];
  const params = [];
  const add = (cond, val) => {
    params.push(val);
    where.push(cond.replace("?", "$" + params.length));
  };
  if (req.query.q) add("p.name ILIKE ?", "%" + req.query.q + "%");
  if (req.query.category_id) add("p.category_id = ?", Number(req.query.category_id));
  if (req.query.brand_id) add("p.brand_id = ?", Number(req.query.brand_id));
  if (req.query.min_price) add("p.price >= ?", Number(req.query.min_price));
  if (req.query.max_price) add("p.price <= ?", Number(req.query.max_price));
  if (req.query.in_stock === "true")
    where.push("EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock > 0)");

  const order =
    { price_asc: "p.price ASC", price_desc: "p.price DESC", name: "p.name ASC" }[req.query.sort] || "p.id ASC";
  const w = where.join(" AND ");
  try {
    const total = Number((await pool.query(`SELECT COUNT(*) FROM products p WHERE ${w}`, params)).rows[0].count);
    const rows = await pool.query(
      `SELECT p.id, p.name, p.description, p.price, p.image_url, p.ijf_approved,
              b.name AS brand, c.name AS category
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
       WHERE ${w} ORDER BY ${order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    );
    res.json({ items: rows.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.get("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: "Товар не найден" });
  const p = await pool.query(
    `SELECT p.id, p.name, p.description, p.price, p.image_url, p.ijf_approved, p.density_gsm,
            b.name AS brand, c.name AS category
     FROM products p
     JOIN brands b ON b.id = p.brand_id
     JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1 AND p.is_active = true AND p.is_approved = true`,
    [id]
  );
  if (!p.rows[0]) return res.status(404).json({ error: "Товар не найден" });
  const v = await pool.query(
    "SELECT id AS variant_id, size, stock FROM product_variants WHERE product_id = $1 ORDER BY id",
    [id]
  );
  res.json({ ...p.rows[0], variants: v.rows });
});

module.exports = router;
