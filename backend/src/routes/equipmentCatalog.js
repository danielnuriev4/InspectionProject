import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const table = "equipment_catalog";

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const query = req.db
      .from(table)
      .select("*")
      .is("deleted_at", null)
      .order("type", { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    res.json({ equipment: data || [] });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const payload = normalizeEquipment(req.body);
    const { data, error } = await req.db.from(table).insert(payload).select("*").single();
    if (error) throw error;
    res.status(201).json({ equipment: data });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const payload = normalizeEquipment(req.body);
    const { data, error } = await req.db
      .from(table)
      .update(payload)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) throw error;
    res.json({ equipment: data });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await req.db
      .from(table)
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

function normalizeEquipment(body) {
  const rows = normalizeRows(body.rows_json ?? body.rowsJson ?? body.rows);
  return {
    template_id: emptyToNull(body.template_id ?? body.templateId),
    is_template: true,
    suspension_method: body.suspension_method ?? body.suspensionMethod ?? "",
    suspension_params: normalizeObject(body.suspension_params ?? body.suspensionParams),
    scaffold_number: body.scaffold_number ?? body.scaffoldNumber ?? "",
    motor_numbers: normalizeStringArray(body.motor_numbers ?? body.motorNumbers),
    type: body.type ?? "",
    manufacturer: body.manufacturer ?? "",
    model: body.model ?? "",
    serial: body.serial ?? "",
    safe_load: body.safe_load ?? body.safeLoad ?? firstRowValue(rows, "safeLoad"),
    self_weight: body.self_weight ?? body.selfWeight ?? firstRowValue(rows, "testLoad"),
    description: body.description ?? "",
    rows_json: rows.map(stripRowLoadFields),
  };
}

function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}

function normalizeRows(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function stripRowLoadFields(row) {
  const { safeLoad, safe_load, testLoad, test_load, ...rest } = row || {};
  return rest;
}

function firstRowValue(rows, field) {
  const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  const row = rows.find((item) => item?.[field] || item?.[snakeField]);
  return row?.[field] || row?.[snakeField] || "";
}

export default router;
