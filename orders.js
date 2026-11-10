const express = require("express");
const pool = require("./db");
const { authenticate, requireRole } = require("./middleware");
const { mockPayment } = require("./payment");
const router = express.Router();
router.use(authenticate);

router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cart = await client.query(
      "SELECT variant_id, quantity FROM cart_items WHERE user_id = $1 ORDER BY variant_id",
      [req.user.id]
    );
    if (!cart.rows.length) {
      await client.query("ROLLBACK");
      return res.status(422).json({ error: "Корзина пуста" });
    }
    let total = 0;
    const lines = [];
    for (const it of cart.rows) {
      const u = await client.query(
        `UPDATE product_variants SET stock = stock - $1
         WHERE id = $2 AND stock >= $1 RETURNING product_id`,
        [it.quantity, it.variant_id]
      );
      if (!u.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Недостаточно товара", variant_id: it.variant_id });
      }
      const price = Number((await client.query("SELECT price FROM products WHERE id = $1", [u.rows[0].product_id])).rows[0].price);
      total += price * it.quantity;
      lines.push({ variant_id: it.variant_id, quantity: it.quantity, price });
    }
    const o = await client.query(
      "INSERT INTO orders (user_id, status, total) VALUES ($1,'new',$2) RETURNING id",
      [req.user.id, total.toFixed(2)]
    );
    const orderId = o.rows[0].id;
    for (const l of lines)
      await client.query(
        "INSERT INTO order_items (order_id, variant_id, quantity, price_at_purchase) VALUES ($1,$2,$3,$4)",
        [orderId, l.variant_id, l.quantity, l.price]
      );
    const pay = await mockPayment(total, orderId, req.body && req.body.simulate_fail === true);
    if (pay.status !== "success") {
      await client.query("ROLLBACK");
      return res.status(402).json({ error: "Оплата не прошла, заказ отменён" });
    }
    await client.query("UPDATE orders SET status='paid', payment_id=$1 WHERE id=$2", [pay.payment_id, orderId]);
    await client.query("DELETE FROM cart_items WHERE user_id = $1", [req.user.id]);
    await client.query("COMMIT");
    res.status(201).json({ order_id: orderId, status: "paid", total: total.toFixed(2), payment_id: pay.payment_id });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e.message);
    res.status(500).json({ error: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

router.get("/", async (req, res) => {
  const q = await pool.query(
    "SELECT id, status, total, created_at FROM orders WHERE user_id = $1 ORDER BY id DESC",
    [req.user.id]
  );
  res.json(q.rows);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: "Заказ не найден" });
  const o = await pool.query(
    "SELECT id, user_id, status, total, payment_id, created_at FROM orders WHERE id = $1",
    [id]
  );
  const order = o.rows[0];
  if (!order || (order.user_id !== req.user.id && req.user.role !== "admin"))
    return res.status(404).json({ error: "Заказ не найден" });
  const items = await pool.query(
    `SELECT oi.variant_id, p.name, v.size, oi.quantity, oi.price_at_purchase
     FROM order_items oi
     JOIN product_variants v ON v.id = oi.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE oi.order_id = $1`,
    [id]
  );
  res.json({ ...order, items: items.rows });
});

router.patch("/:id/status", requireRole("admin"), async (req, res) => {
  const allowed = ["new", "paid", "shipped", "done"];
  if (!allowed.includes(req.body.status)) return res.status(422).json({ error: "Неверный статус" });
  const r = await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [req.body.status, Number(req.params.id)]);
  if (!r.rowCount) return res.status(404).json({ error: "Заказ не найден" });
  res.json({ status: "updated" });
});


router.post("/:id/cancel", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: "Заказ не найден" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const o = await client.query("SELECT id, user_id, status FROM orders WHERE id = $1 FOR UPDATE", [id]);
    const order = o.rows[0];
    if (!order || (order.user_id !== req.user.id && req.user.role !== "admin")) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Заказ не найден" });
    }
    if (!["new", "paid"].includes(order.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Этот заказ уже нельзя отменить" });
    }
    const items = await client.query("SELECT variant_id, quantity FROM order_items WHERE order_id = $1 ORDER BY variant_id", [id]);
    for (const it of items.rows)
      await client.query("UPDATE product_variants SET stock = stock + $1 WHERE id = $2", [it.quantity, it.variant_id]);
    await client.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [id]);
    await client.query("COMMIT");
    res.json({ status: "cancelled" });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e.message);
    res.status(500).json({ error: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

module.exports = router;
