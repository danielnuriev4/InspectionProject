import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    let query = req.db
      .from("reports")
      .select("*, report_equipment(*)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!includeArchived) {
      query = query.is("archived_at", null);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ reports: (data || []).map(mapReportFromDb) });
  } catch (error) {
    next(error);
  }
});

router.get("/archive", async (req, res, next) => {
  try {
    const from = normalizeDateQuery(req.query.from);
    const to = normalizeDateQuery(req.query.to);
    const filters = parseArchiveFilters(req.query.filters);

    let query = req.db
      .from("reports")
      .select("*, report_equipment(*)")
      .is("deleted_at", null);

    if (from) query = query.gte("inspection_date", from);
    if (to) query = query.lte("inspection_date", to);

    const { data, error } = await query
      .order("inspection_date", { ascending: false, nullsFirst: false })
      .order("report_number", { ascending: false });

    if (error) throw error;

    const reports = (data || []).map(mapReportFromDb).filter((report) => archiveReportMatchesFilters(report, filters));
    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

router.get("/next-number", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from("reports")
      .select("report_number")
      .is("deleted_at", null);

    if (error) throw error;

    const maxNumber = (data || []).reduce((max, report) => {
      const value = String(report.report_number || "").trim();
      if (!/^\d+$/.test(value)) return max;
      return Math.max(max, Number(value));
    }, 0);

    res.json({ nextNumber: maxNumber > 0 ? String(maxNumber + 1) : "" });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from("reports")
      .select("*, report_equipment(*)")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.json({ report: mapReportFromDb(data) });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const report = normalizeReport(req.body);
    const equipment = Array.isArray(req.body.equipment) ? req.body.equipment : [];

    const { data, error } = await req.db.from("reports").insert(report).select("*").single();
    if (error) throw error;

    if (equipment.length) {
      const rows = equipment.map((item, index) => normalizeReportEquipment(item, data.id, index));
      const { error: equipmentError } = await req.db.from("report_equipment").insert(rows);
      if (equipmentError) throw equipmentError;
    }

    const created = await loadReport(req.db, data.id);
    res.status(201).json({ report: created });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const report = normalizeReport(req.body);
    const equipment = Array.isArray(req.body.equipment) ? req.body.equipment : [];

    const { error } = await req.db.from("reports").update(report).eq("id", req.params.id);
    if (error) throw error;

    const { error: deleteEquipmentError } = await req.db
      .from("report_equipment")
      .delete()
      .eq("report_id", req.params.id);
    if (deleteEquipmentError) throw deleteEquipmentError;

    if (equipment.length) {
      const rows = equipment.map((item, index) => normalizeReportEquipment(item, req.params.id, index));
      const { error: equipmentError } = await req.db.from("report_equipment").insert(rows);
      if (equipmentError) throw equipmentError;
    }

    const updated = await loadReport(req.db, req.params.id);
    res.json({ report: updated });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/archive", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from("reports")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) throw error;
    res.json({ report: data });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await req.db
      .from("reports")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

async function loadReport(db, id) {
  const { data, error } = await db
    .from("reports")
    .select("*, report_equipment(*)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return mapReportFromDb(data);
}

function normalizeReport(body) {
  return {
    report_title: body.report_title ?? body.reportTitle ?? "",
    report_number: body.report_number ?? body.reportNumber ?? "",
    previous_report_number: body.previous_report_number ?? body.previousReportNumber ?? "",
    inspection_date: emptyToNull(body.inspection_date ?? body.inspectionDate),
    valid_until: emptyToNull(body.valid_until ?? body.validUntil),
    document_date: emptyToNull(body.document_date ?? body.documentDate),
    final_status: body.final_status ?? body.finalStatus ?? "",
    customer_id: emptyToNull(body.customer_id ?? body.customerId),
    customer_name: body.customer_name ?? body.customerName ?? "",
    contact_name: body.contact_name ?? body.contactName ?? "",
    contact_phone: body.contact_phone ?? body.contactPhone ?? "",
    contact_email: body.contact_email ?? body.contactEmail ?? "",
    site_address: body.site_address ?? body.siteAddress ?? "",
    inspector_name: body.inspector_name ?? body.inspectorName ?? "",
    inspector_license: body.inspector_license ?? body.inspectorLicense ?? "",
    findings: body.findings ?? "",
    general_notes: body.general_notes ?? body.generalNotes ?? "",
    final_status_class: body.final_status_class ?? body.finalStatusClass ?? "",
  };
}

function normalizeReportEquipment(item, reportId, index) {
  const rows = Array.isArray(item.rows_json ?? item.rowsJson ?? item.rows) ? (item.rows_json ?? item.rowsJson ?? item.rows) : [];
  return {
    report_id: reportId,
    equipment_catalog_id: emptyToNull(item.equipment_catalog_id ?? item.defaultId),
    equipment_template_id: emptyToNull(item.equipment_template_id ?? item.templateId),
    sort_order: index,
    suspension_method: item.suspension_method ?? item.suspensionMethod ?? "",
    suspension_params: normalizeObject(item.suspension_params ?? item.suspensionParams),
    scaffold_number: item.scaffold_number ?? item.scaffoldNumber ?? firstRowValue(rows, "scaffoldNumber"),
    motor_numbers: normalizeStringArray(item.motor_numbers ?? item.motorNumbers ?? collectMotorNumbers(rows)),
    type: item.type ?? "",
    manufacturer: item.manufacturer ?? "",
    model: item.model ?? "",
    serial: item.serial ?? "",
    safe_load: item.safe_load ?? item.safeLoad ?? firstRowValue(rows, "safeLoad"),
    self_weight: item.self_weight ?? item.selfWeight ?? firstRowValue(rows, "testLoad"),
    description: item.description ?? "",
    rows_json: rows.map(stripRowLoadFields),
  };
}

function mapReportFromDb(row) {
  return {
    id: row.id,
    savedAt: row.updated_at || row.created_at,
    reportTitle: row.report_title || "",
    reportNumber: row.report_number || "",
    previousReportNumber: row.previous_report_number || "",
    inspectionDate: row.inspection_date || "",
    validUntil: row.valid_until || "",
    documentDate: row.document_date || "",
    finalStatus: row.final_status || "",
    customerId: row.customer_id || "",
    customerName: row.customer_name || "",
    contactName: row.contact_name || "",
    contactPhone: row.contact_phone || "",
    contactEmail: row.contact_email || "",
    siteAddress: row.site_address || "",
    inspectorName: row.inspector_name || "",
    inspectorLicense: row.inspector_license || "",
    findings: row.findings || "",
    generalNotes: row.general_notes || "",
    archivedAt: row.archived_at || "",
    equipment: (row.report_equipment || [])
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((item) => ({
        id: item.id,
        defaultId: item.equipment_catalog_id || "",
        templateId: item.equipment_template_id || "",
        suspensionMethod: item.suspension_method || "",
        suspensionParams: normalizeObject(item.suspension_params),
        platformType: item.platform_type || "",
        platformParams: normalizeObject(item.platform_params),
        scaffoldNumber: item.scaffold_number || firstRowValue(item.rows_json || [], "scaffoldNumber"),
        motorNumbers: normalizeStringArray(item.motor_numbers || collectMotorNumbers(item.rows_json || [])),
        type: item.type || "",
        manufacturer: item.manufacturer || "",
        model: item.model || "",
        serial: item.serial || "",
        safeLoad: item.safe_load || firstRowValue(item.rows_json || [], "safeLoad"),
        selfWeight: item.self_weight || firstRowValue(item.rows_json || [], "testLoad"),
        description: item.description || "",
        rows: Array.isArray(item.rows_json) ? item.rows_json.map(stripRowLoadFields) : [],
      })),
    checks: [],
  };
}

function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}

function stripRowLoadFields(row) {
  const { safeLoad, safe_load, testLoad, test_load, ...rest } = row || {};
  return rest;
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function collectMotorNumbers(rows) {
  return normalizeStringArray(
    (Array.isArray(rows) ? rows : [])
      .map((row) => row?.motorNumber || row?.motor_number || row?.serial)
      .filter(Boolean)
  );
}

function firstRowValue(rows, field) {
  const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  const row = Array.isArray(rows) ? rows.find((item) => item?.[field] || item?.[snakeField]) : null;
  return row?.[field] || row?.[snakeField] || "";
}

function normalizeDateQuery(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function parseArchiveFilters(value) {
  if (!value) return {};
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function archiveReportMatchesFilters(report, filters = {}) {
  return Object.entries(filters).every(([key, rawValue]) => {
    const value = String(rawValue || "").trim().toLowerCase();
    if (!value) return true;
    return archiveFieldValues(report, key).some((item) => String(item || "").toLowerCase().includes(value));
  });
}

function archiveFieldValues(report, key) {
  const equipment = Array.isArray(report.equipment) ? report.equipment : [];
  const rows = equipment.flatMap((item) => Array.isArray(item.rows) ? item.rows : []);

  const fieldValues = {
    reportNumber: [report.reportNumber],
    previousReportNumber: [report.previousReportNumber],
    customerName: [report.customerName],
    contactName: [report.contactName],
    contactPhone: [report.contactPhone],
    contactEmail: [report.contactEmail],
    siteAddress: [report.siteAddress],
    inspectorName: [report.inspectorName],
    inspectorLicense: [report.inspectorLicense],
    finalStatus: [report.finalStatus],
    findings: [report.findings],
    generalNotes: [report.generalNotes],
    equipmentDescription: rows.map((row) => row.description),
    makerModel: rows.map((row) => row.makerModel),
    serial: rows.map((row) => row.serial),
    testLoad: equipment.map((item) => item.selfWeight),
    safeLoad: equipment.map((item) => item.safeLoad),
  };

  return (fieldValues[key] || []).flat().filter(Boolean);
}

export default router;
