import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import authRouter from "./routes/auth.js";
import customerEquipmentDefaultsRouter from "./routes/customerEquipmentDefaults.js";
import customerEquipmentRowParamsRouter from "./routes/customerEquipmentRowParams.js";
import customersRouter from "./routes/customers.js";
import equipmentCatalogRouter from "./routes/equipmentCatalog.js";
import reportFilesRouter from "./routes/reportFiles.js";
import reportsRouter from "./routes/reports.js";
import sessionRouter from "./routes/session.js";
import suspensionMethodsRouter from "./routes/suspensionMethods.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "../../frontend");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/session", sessionRouter);
app.use("/api/customers", customersRouter);
app.use("/api/customer-equipment-defaults", customerEquipmentDefaultsRouter);
app.use("/api/customer-equipment-row-params", customerEquipmentRowParamsRouter);
app.use("/api/equipment-catalog", equipmentCatalogRouter);
app.use("/api/suspension-methods", suspensionMethodsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/report-files", reportFilesRouter);

app.use(express.static(frontendDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  const status = Number(error.status || error.statusCode || 500);
  res.status(status >= 400 ? status : 500).json({
    error: error.message || "Unexpected server error",
    details: error.details || undefined,
  });
});

export default app;
