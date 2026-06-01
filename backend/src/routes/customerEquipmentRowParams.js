import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const table = "customer_equipment_row_params";

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from(table)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("row_number", { ascending: true });

    if (error) throw error;
    res.json({ params: data || [] });
  } catch (error) {
    next(error);
  }
});

router.put("/customer/:customerId", async (req, res, next) => {
  try {
    const customerId = req.params.customerId;
    const params = Array.isArray(req.body.params) ? req.body.params : [];

    const { error: deleteError } = await req.db
      .from(table)
      .delete()
      .eq("customer_id", customerId);
    if (deleteError) throw deleteError;

    const rows = params
      .map((item, index) => normalizeParam({ ...item, customerId, sortOrder: index }))
      .filter((item) => item.customer_id && item.equipment_catalog_id && item.row_number > 0);

    if (!rows.length) {
      res.json({ params: [] });
      return;
    }

    const { data, error } = await req.db.from(table).insert(rows).select("*");
    if (error) throw error;
    res.json({ params: data || [] });
  } catch (error) {
    next(error);
  }
});

function normalizeParam(body) {
  return {
    customer_id: body.customer_id ?? body.customerId ?? "",
    equipment_catalog_id: body.equipment_catalog_id ?? body.equipmentCatalogId ?? "",
    row_number: Number(body.row_number ?? body.rowNumber ?? 0) || 0,
    maker_model: body.maker_model ?? body.makerModel ?? "",
    serial: body.serial ?? "",
    sort_order: Number(body.sort_order ?? body.sortOrder ?? 0) || 0,
  };
}

export default router;
