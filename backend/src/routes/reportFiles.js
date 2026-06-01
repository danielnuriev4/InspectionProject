import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const bucket = "report-files";

router.use(requireAuth);

router.get("/:reportId", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from("report_files")
      .select("*")
      .eq("report_id", req.params.reportId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ files: data || [] });
  } catch (error) {
    next(error);
  }
});

router.post("/:reportId", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing file" });
    }

    const path = `${req.user.id}/${req.params.reportId}/${Date.now()}-${sanitizeFileName(req.file.originalname)}`;
    const { error: uploadError } = await req.db.storage
      .from(bucket)
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data, error } = await req.db
      .from("report_files")
      .insert({
        report_id: req.params.reportId,
        bucket,
        path,
        file_name: req.file.originalname,
        content_type: req.file.mimetype,
        size_bytes: req.file.size,
      })
      .select("*")
      .single();

    if (error) throw error;
    res.status(201).json({ file: data });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await req.db
      .from("report_files")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", req.params.id);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

function sanitizeFileName(name) {
  return String(name || "file").replace(/[^\w.\-א-ת]+/g, "_");
}

export default router;
