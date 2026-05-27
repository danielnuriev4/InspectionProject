import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const table = "customer_equipment_defaults";

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from(table)
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ defaults: data || [] });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const payload = normalizeDefault(req.body);
    const { data, error } = await req.db
      .from(table)
      .upsert(payload, { onConflict: "customer_id,equipment_catalog_id" })
      .select("*")
      .single();

    if (error) throw error;
    res.status(201).json({ default: data });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const payload = normalizeDefault(req.body);
    const { data, error } = await req.db
      .from(table)
      .update(payload)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) throw error;
    res.json({ default: data });
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

function normalizeDefault(body) {
  return {
    customer_id: emptyToNull(body.customer_id ?? body.customerId),
    equipment_catalog_id: emptyToNull(body.equipment_catalog_id ?? body.equipmentCatalogId ?? body.defaultId),
    suspension_method: body.suspension_method ?? body.suspensionMethod ?? "",
    suspension_params: normalizeObject(body.suspension_params ?? body.suspensionParams),
    scaffold_number: body.scaffold_number ?? body.scaffoldNumber ?? "",
    motor_numbers: normalizeStringArray(body.motor_numbers ?? body.motorNumbers),
    safe_load: body.safe_load ?? body.safeLoad ?? "",
    self_weight: body.self_weight ?? body.selfWeight ?? "",
    rows_json: normalizeRows(body.rows_json ?? body.rowsJson ?? body.rows),
  };
}

function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeRows(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

export default router;
