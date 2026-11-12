require("dotenv").config();
const express = require("express");
const pool = require("./db");
const { authenticate, requireRole } = require("./middleware");

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ status: "db error" });
  }
});

const { validate, credentials, cartAdd } = require("./validate");
app.post("/auth/register", validate(credentials));
app.post("/auth/login", validate(credentials));
app.post("/cart/items", validate(cartAdd));
app.use("/auth", require("./auth"));
app.get("/me", authenticate, (req, res) => res.json(req.user));
app.get("/admin/ping", authenticate, requireRole("admin"), (req, res) =>
  res.json({ status: "admin ok" })
);

app.use("/", require("./catalog"));
app.use("/cart", require("./cart"));
app.use("/orders", require("./orders"));
const { validate: v2, sellerProduct } = require("./validate");
app.post("/seller/products", authenticate, requireRole("seller", "admin"), v2(sellerProduct));
app.use("/seller", require("./seller"));
app.use("/admin", require("./admin"));
app.listen(3000, () => console.log("Server on http://localhost:3000"));
