import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const table = "customers";

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from(table)
      .select("*")
      .is("deleted_at", null)
      .order("customer_name", { ascending: true });

    if (error) throw error;
    res.json({ customers: data || [] });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const payload = normalizeCustomer(req.body);
    const { data, error } = await req.db.from(table).insert(payload).select("*").single();
    if (error) throw error;
    res.status(201).json({ customer: data });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const payload = normalizeCustomer(req.body);
    const { data, error } = await req.db
      .from(table)
      .update(payload)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) throw error;
    res.json({ customer: data });
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

function normalizeCustomer(body) {
  return {
    customer_name: body.customer_name ?? body.customerName ?? "",
    contact_name: body.contact_name ?? body.contactName ?? "",
    contact_phone: body.contact_phone ?? body.contactPhone ?? "",
    contact_email: body.contact_email ?? body.contactEmail ?? "",
    site_address: body.site_address ?? body.siteAddress ?? "",
  };
}

export default router;
