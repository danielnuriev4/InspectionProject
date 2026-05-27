import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const table = "suspension_methods";

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from(table)
      .select("*")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    res.json({ methods: data || [] });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const payload = normalizeMethod(req.body);
    const { data, error } = await req.db.from(table).insert(payload).select("*").single();
    if (error) throw error;
    res.status(201).json({ method: data });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const payload = normalizeMethod(req.body);
    const { data, error } = await req.db
      .from(table)
      .update(payload)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) throw error;
    res.json({ method: data });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await req.db.from(table).delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

function normalizeMethod(body) {
  return {
    code: body.code ?? "",
    name: body.name ?? "",
    description_template: body.description_template ?? body.descriptionTemplate ?? "",
    params_json: normalizeParams(body.params_json ?? body.paramsJson ?? body.params),
    sort_order: Number(body.sort_order ?? body.sortOrder ?? 0) || 0,
  };
}

function normalizeParams(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default router;
