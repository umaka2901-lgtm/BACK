const { z } = require("zod");

const credentials = z.object({
  email: z.string().trim().email("Неверный email").max(120),
  password: z.string().min(6, "Пароль от 6 символов").max(100),
  role: z.enum(["buyer", "seller"]).optional(),
});

const cartAdd = z.object({
  variant_id: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20).default(1),
});

const sellerProduct = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().max(2000).nullish(),
  price: z.number().min(0).max(100000),
  category_id: z.number().int().positive(),
  brand_id: z.number().int().positive(),
  image_url: z.string().url().max(500).nullish(),
  variants: z
    .array(z.object({ size: z.string().trim().min(1).max(20), stock: z.number().int().min(0).max(100000) }))
    .min(1)
    .max(60)
    .optional(),
});

function validate(schema) {
  return (req, res, next) => {
    const r = schema.safeParse(req.body || {});
    if (!r.success) {
      const msg = r.error.issues.map((i) => (i.path.join(".") ? i.path.join(".") + ": " : "") + i.message).join("; ");
      return res.status(422).json({ error: msg });
    }
    req.body = r.data;
    next();
  };
}

module.exports = { validate, credentials, cartAdd, sellerProduct };
