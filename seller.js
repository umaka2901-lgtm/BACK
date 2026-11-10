const express = require("express");
const pool = require("./db");
const { authenticate, requireRole } = require("./middleware");
const router = express.Router();
router.use(authenticate, requireRole("seller", "admin"));

router.get("/meta", async (req, res) => {
  const b = await pool.query("SELECT id, name FROM brands ORDER BY id");
  const c = await pool.query("SELECT id, name FROM categories ORDER BY id");
  res.json({ brands: b.rows, categories: c.rows });
});

router.get("/products", async (req, res) => {
  const q = await pool.query(
    "SELECT id, name, price, is_active, is_approved FROM products WHERE seller_id = $1 ORDER BY id DESC",
    [req.user.id]
  );
  res.json(q.rows);
});

router.post("/products", async (req, res) => {
  const { name, description, price, category_id, brand_id, image_url, variants } = req.body || {};
  const okVariants =
    Array.isArray(variants) && variants.length &&
    variants.every((v) => v.size && Number.isInteger(v.stock) && v.stock >= 0);
  if (!name || typeof price !== "number" || price < 0 || !Number.isInteger(category_id) ||
      !Number.isInteger(brand_id) || !okVariants)
    return res.status(422).json({ error: "Нужны name, price, category_id, brand_id и variants [{size, stock}]" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const approved = req.user.role === "admin";
    const p = await client.query(
      `INSERT INTO products (seller_id, category_id, brand_id, name, description, price, image_url, is_approved)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [req.user.id, category_id, brand_id, name, description || null, price, image_url || null, approved]
    );
    const id = p.rows[0].id;
    for (const v of variants)
      await client.query("INSERT INTO product_variants (product_id, size, stock) VALUES ($1,$2,$3)", [id, String(v.size), v.stock]);
    await client.query("COMMIT");
    res.status(201).json({ id, is_approved: approved });
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.code === "23503") return res.status(422).json({ error: "Категория или бренд не найдены" });
    if (e.code === "23505") return res.status(409).json({ error: "Повторяющийся размер" });
    console.error(e.message);
    res.status(500).json({ error: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

router.put("/products/:id", async (req, res) => {
  const { name, description, price, category_id, brand_id, image_url } = req.body || {};
  if (!name || typeof price !== "number" || price < 0 || !Number.isInteger(category_id) || !Number.isInteger(brand_id))
    return res.status(422).json({ error: "Нужны name, price, category_id, brand_id" });
  try {
    const r = await pool.query(
      `UPDATE products SET name=$1, description=$2, price=$3, category_id=$4, brand_id=$5, image_url=$6,
              is_approved = (is_approved AND $7)
       WHERE id=$8 AND seller_id=$9`,
      [name, description || null, price, category_id, brand_id, image_url || null,
       req.user.role === "admin", Number(req.params.id), req.user.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Товар не найден" });
    res.json({ status: "updated" });
  } catch (e) {
    if (e.code === "23503") return res.status(422).json({ error: "Категория или бренд не найдены" });
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.patch("/variants/:id", async (req, res) => {
  const stock = req.body && req.body.stock;
  if (!Number.isInteger(stock) || stock < 0) return res.status(422).json({ error: "stock от 0" });
  const r = await pool.query(
    `UPDATE product_variants v SET stock = $1 FROM products p
     WHERE v.id = $2 AND p.id = v.product_id AND p.seller_id = $3`,
    [stock, Number(req.params.id), req.user.id]
  );
  if (!r.rowCount) return res.status(404).json({ error: "Размер не найден" });
  res.json({ status: "updated" });
});

router.delete("/products/:id", async (req, res) => {
  const r = await pool.query(
    "UPDATE products SET is_active = false WHERE id = $1 AND seller_id = $2 AND is_active = true",
    [Number(req.params.id), req.user.id]
  );
  if (!r.rowCount) return res.status(404).json({ error: "Товар не найден" });
  res.json({ status: "deleted" });
});

module.exports = router;
