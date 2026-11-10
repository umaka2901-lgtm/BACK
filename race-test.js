const BASE = "http://localhost:3000";
const VARIANT = 4;
const N = 10;

async function post(path, body, token) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

(async () => {
  const users = [];
  for (let i = 0; i < N; i++) {
    const email = `race${i}@test.com`;
    await post("/auth/register", { email, password: "123456" });
    const l = await post("/auth/login", { email, password: "123456" });
    users.push(l.data.access_token);
    await post("/cart/items", { variant_id: VARIANT, quantity: 1 }, l.data.access_token);
  }
  console.log("Все в корзине, стартуем одновременно...");
  const results = await Promise.all(users.map((t) => post("/orders", {}, t)));
  const ok = results.filter((r) => r.status === 201).length;
  const conflict = results.filter((r) => r.status === 409).length;
  console.log("Успешных заказов:", ok, "| Отказов 409:", conflict);
  console.log(ok === 1 ? "ТЕСТ ПРОЙДЕН" : "ТЕСТ ПРОВАЛЕН");
})();
