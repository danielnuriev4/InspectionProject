const state = {
  currentId: null,
  currentUser: null,
  session: null,
  customers: [],
  equipmentCatalog: [],
  customerEquipmentDefaults: [],
  suspensionMethods: [],
  reports: [],
  equipment: [],
  checks: [],
  activeSettingsPanel: "customers",
  selectedCustomerDefaultId: "",
  selectedEquipmentCustomerId: "",
  selectedEquipmentDefaultId: "",
  selectedSuspensionMethodId: "",
  loading: false,
};

const authScreen = document.getElementById("authScreen");
const appShell = document.getElementById("appShell");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const authMessage = document.getElementById("authMessage");
const appMessage = document.getElementById("appMessage");

const screens = document.querySelectorAll(".screen");
const screenButtons = document.querySelectorAll("[data-screen]");
const equipmentType = document.getElementById("equipmentType");
const customerSelect = document.getElementById("customerSelect");
const equipmentList = document.getElementById("equipmentList");
const checksList = document.getElementById("checksList");
const archiveList = document.getElementById("archiveList");
const equipmentDefaultsList = document.getElementById("equipmentDefaultsList");
const customerDefaultsList = document.getElementById("customerDefaultsList");
const manageCustomerSelect = document.getElementById("manageCustomerSelect");
const manageEquipmentSelect = document.getElementById("manageEquipmentSelect");
const equipmentCustomerSelect = document.getElementById("equipmentCustomerSelect");
const copyEquipmentPanel = document.getElementById("copyEquipmentPanel");
const copyEquipmentSourceCustomerSelect = document.getElementById("copyEquipmentSourceCustomerSelect");
const copyEquipmentSourceEquipmentSelect = document.getElementById("copyEquipmentSourceEquipmentSelect");
const manageSuspensionSelect = document.getElementById("manageSuspensionSelect");
const suspensionMethodsList = document.getElementById("suspensionMethodsList");
const editorStepPanels = document.querySelectorAll("[data-editor-step]");
const editorStepButtons = document.querySelectorAll("[data-editor-step-button]");
const prevEditorStepBtn = document.getElementById("prevEditorStepBtn");
const nextEditorStepBtn = document.getElementById("nextEditorStepBtn");
let activeEditorStep = 1;
function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(message, type = "") {
  appMessage.textContent = message || "";
  appMessage.className = `app-message ${type}`.trim();
}

function showAuthMessage(message, type = "") {
  authMessage.textContent = message || "";
  authMessage.className = `app-message ${type}`.trim();
}

function setLoading(isLoading, message = "") {
  state.loading = isLoading;
  document.body.classList.toggle("is-loading", isLoading);
  if (message) showMessage(message);
}

async function getAccessToken() {
  if (state.session?.expires_at && Date.now() / 1000 > state.session.expires_at - 60) {
    await refreshSession();
  }

  const token = state.session?.access_token;
  if (!token) throw new Error("אין חיבור פעיל. יש להתחבר מחדש.");
  return token;
}

async function refreshSession() {
  if (!state.session?.refresh_token) return;

  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: state.session.refresh_token }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    state.session = null;
    state.currentUser = null;
    showLogin();
    throw new Error(payload.error || "Connection expired. Please log in again.");
  }

  state.session = payload.session;
  state.currentUser = payload.user;
}

async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "פעולה נכשלה");
  }
  return payload;
}

async function initAuth() {
  showLogin();
}

function showLogin() {
  appShell.classList.add("hidden");
  authScreen.classList.remove("hidden");
}

function showApp() {
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
}

async function loadInitialData() {
  try {
    setLoading(true, "טוען נתונים מ-Supabase...");
    const [customers, equipment, customerEquipmentDefaults, suspensionMethods, reports] = await Promise.all([
      apiFetch("/api/customers"),
      apiFetch("/api/equipment-catalog"),
      apiFetch("/api/customer-equipment-defaults"),
      apiFetch("/api/suspension-methods"),
      apiFetch("/api/reports?includeArchived=true"),
    ]);

    state.customers = (customers.customers || []).map(mapCustomerFromApi);
    state.equipmentCatalog = (equipment.equipment || []).map(mapEquipmentFromApi);
    state.customerEquipmentDefaults = (customerEquipmentDefaults.defaults || []).map(mapCustomerEquipmentDefaultFromApi);
    state.suspensionMethods = (suspensionMethods.methods || []).map(mapSuspensionMethodFromApi);
    state.reports = reports.reports || [];

    populateCustomerSelect();
    populateEquipmentTypes();
    renderArchive();
    renderSettings();
    resetDraft();
    showMessage("הנתונים נטענו בהצלחה", "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    setLoading(false);
  }
}

function mapCustomerFromApi(row) {
  return {
    id: row.id,
    customerName: row.customer_name || "",
    contactName: row.contact_name || "",
    contactPhone: row.contact_phone || "",
    contactEmail: row.contact_email || "",
    siteAddress: row.site_address || "",
  };
}

function mapEquipmentFromApi(row) {
  const rawRows = row.rows_json || row.rows || [];
  const rows = normalizeEquipmentRows(rawRows, row);
  return {
    id: row.id,
    customerId: row.customer_id || "",
    templateId: row.template_id || row.templateId || "",
    isTemplate: Boolean(row.is_template ?? row.isTemplate ?? !row.customer_id),
    suspensionMethod: row.suspension_method || row.suspensionMethod || "",
    suspensionParams: normalizeObject(row.suspension_params || row.suspensionParams),
    platformType: row.platform_type || row.platformType || "",
    platformParams: normalizeObject(row.platform_params || row.platformParams),
    scaffoldNumber: row.scaffold_number || row.scaffoldNumber || "",
    motorNumbers: normalizeStringList(row.motor_numbers || row.motorNumbers),
    type: row.type || "",
    manufacturer: row.manufacturer || "",
    model: row.model || "",
    serial: row.serial || "",
    safeLoad: row.safe_load || firstRowValue(rawRows, "safeLoad"),
    selfWeight: row.self_weight || firstRowValue(rawRows, "testLoad"),
    description: row.description || "",
    rows,
  };
}

function mapCustomerEquipmentDefaultFromApi(row) {
  return {
    id: row.id,
    customerId: row.customer_id || row.customerId || "",
    equipmentCatalogId: row.equipment_catalog_id || row.equipmentCatalogId || "",
    suspensionMethod: row.suspension_method || row.suspensionMethod || "",
    suspensionParams: normalizeObject(row.suspension_params || row.suspensionParams),
    platformType: row.platform_type || row.platformType || "",
    platformParams: normalizeObject(row.platform_params || row.platformParams),
    scaffoldNumber: row.scaffold_number || row.scaffoldNumber || "",
    motorNumbers: normalizeStringList(row.motor_numbers || row.motorNumbers),
    safeLoad: row.safe_load || row.safeLoad || "",
    selfWeight: row.self_weight || row.selfWeight || "",
    rows: normalizeEquipmentRows(row.rows_json || row.rows || []),
  };
}

function mapSuspensionMethodFromApi(row) {
  return {
    id: row.id,
    code: row.code || "",
    name: row.name || "",
    descriptionTemplate: row.description_template || row.descriptionTemplate || "",
    params: Array.isArray(row.params_json || row.paramsJson) ? (row.params_json || row.paramsJson) : [],
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0) || 0,
    isDefaultEquipmentRow: Boolean(row.is_default_equipment_row ?? row.isDefaultEquipmentRow),
    defaultMakerModel: row.default_maker_model || row.defaultMakerModel || "",
    defaultSerial: row.default_serial || row.defaultSerial || "",
  };
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeStringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

const suspensionMethods = [
  { value: "", label: "בחר שיטת תילוי" },
  { value: "clamp", label: "מערכת תילוי תפסי מעקה" },
  { value: "drilled_chairs", label: "מערכת תילוי כיסאות קידוחים" },
  { value: "aluminum_platform", label: "בימת אלומיניום" },
  { value: "other", label: "אחר" },
];

const platformTypes = [
  { value: "", label: "בחר במה" },
  { value: "standard_stage", label: "במה תקנית" },
  { value: "aluminum_stage", label: "בימת אלומיניום" },
  { value: "custom_stage", label: "במה אחרת" },
];

const platformDefinitions = {
  standard_stage: {
    params: [
      { key: "stageWidth", label: "רוחב במה", value: "" },
      { key: "stageLength", label: "אורך במה", value: "" },
    ],
    description(params) {
      return [
        "במה תקנית.",
        params.stageWidth ? `רוחב במה ${params.stageWidth}.` : "",
        params.stageLength ? `אורך במה ${params.stageLength}.` : "",
      ].filter(Boolean).join("\n");
    },
  },
  aluminum_stage: {
    params: [
      { key: "stageWidth", label: "רוחב במה", value: "" },
      { key: "stageLength", label: "אורך במה", value: "" },
      { key: "motorDistance", label: "מרחק בין מנועים", value: "" },
    ],
    description(params) {
      return [
        "בימת אלומיניום.",
        params.stageWidth ? `רוחב במה ${params.stageWidth}.` : "",
        params.stageLength ? `אורך במה ${params.stageLength}.` : "",
        params.motorDistance ? `מרחק בין מנועים ${params.motorDistance}.` : "",
      ].filter(Boolean).join("\n");
    },
  },
  custom_stage: {
    params: [
      { key: "stageText", label: "תיאור במה", value: "" },
    ],
    description(params) {
      return params.stageText || "במה אחרת.";
    },
  },
};

function renderPlatformOptions(selected = "") {
  return platformTypes.map((platform) => `
    <option value="${platform.value}" ${platform.value === selected ? "selected" : ""}>${escapeHtml(platform.label)}</option>
  `).join("");
}

const rowKinds = [
  { value: "", label: "טקסט רגיל" },
  { value: "equipment_description", label: "תיאור ציוד" },
  { value: "fixed", label: "מלל קבוע" },
];

function renderRowKindOptions(selected = "") {
  return rowKinds.map((kind) => `
    <option value="${kind.value}" ${kind.value === selected ? "selected" : ""}>${escapeHtml(kind.label)}</option>
  `).join("");
}

function renderPlatformParamFields(platformType, params = {}) {
  const definition = platformDefinitions[platformType];
  if (!definition) return "";
  return definition.params.map((field) => `
    <label>${escapeHtml(field.label)}
      <input data-platform-param-field="${field.key}" value="${escapeHtml(params[field.key] ?? field.value ?? "")}" />
    </label>
  `).join("");
}

function defaultPlatformParams(platformType, current = {}) {
  const definition = platformDefinitions[platformType];
  if (!definition) return normalizeObject(current);
  return definition.params.reduce((result, field) => {
    result[field.key] = current[field.key] ?? field.value ?? "";
    return result;
  }, {});
}

const suspensionMethodDefinitions = {
  clamp: {
    params: [
      { key: "clampCount", label: "מספר תפסי מעקה", value: "2" },
      { key: "railThickness", label: "עובי המעקה", value: "" },
      { key: "armHeight", label: "גובה זרועות", value: "" },
      { key: "armLength", label: "אורך שלוחות", value: "" },
    ],
    description(params) {
      return [
        `מערכת תילוי: ${params.clampCount || "2"} תפסי מעקה.`,
        params.railThickness ? `עובי המעקה ${params.railThickness}.` : "",
        params.armHeight ? `גובה זרועות ${params.armHeight}.` : "",
        params.armLength ? `אורך שלוחות ${params.armLength}.` : "",
        "כבל העבודה והמשני נתפסים ע\"י לוכבים מאובטחים.",
        "צלחות עצירה לכבלים עליונים תלויות בקצה כלי התילוי.",
        "כבלי האבטחה עוברים דרך סופיות בכבלי התילוי ותפוסים למבנה.",
      ].filter(Boolean).join("\n");
    },
  },
  drilled_chairs: {
    params: [
      { key: "chairCount", label: "מספר כיסאות קידוחים", value: "2" },
      { key: "anchorDiameter", label: "קוטר קידוח / עוגן", value: "" },
      { key: "spacing", label: "מרחקים", value: "" },
    ],
    description(params) {
      return [
        `מערכת תילוי: ${params.chairCount || "2"} כיסאות קידוחים בקומה עליונה.`,
        params.anchorDiameter ? `קוטר קידוח / עוגן ${params.anchorDiameter}.` : "",
        params.spacing ? `מרחקים ${params.spacing}.` : "",
        "כבל העבודה והמשני נתפסים ע\"י לוכבים מאובטחים.",
        "צלחות עצירה לכבלים עליונים תלויות בקצה כלי התילוי.",
        "כבלי האבטחה עוברים דרך סופיות בכבלי התילוי ותפוסים למבנה.",
      ].filter(Boolean).join("\n");
    },
  },
  aluminum_platform: {
    params: [
      { key: "width", label: "רוחב במה", value: "" },
      { key: "length", label: "אורך במה", value: "" },
      { key: "motorDistance", label: "מרחק בין מנועים", value: "" },
    ],
    description(params) {
      return [
        "בימת אלומיניום.",
        params.width ? `רוחב במה ${params.width}.` : "",
        params.length ? `אורך במה ${params.length}.` : "",
        params.motorDistance ? `מרחק בין מנועים ${params.motorDistance}.` : "",
      ].filter(Boolean).join("\n");
    },
  },
};

function renderSuspensionMethodOptions(selected = "") {
  const dbMethods = state.suspensionMethods.map((method) => ({
    value: method.code || method.id,
    label: method.name || method.code || "תיאור ציוד ללא שם",
  }));
  const methods = dbMethods.length
    ? [{ value: "", label: "בחר תיאור ציוד" }, ...dbMethods]
    : [{ value: "", label: "אין תיאורי ציוד ב-DB" }];
  return methods.map((method) => `
    <option value="${method.value}" ${method.value === selected ? "selected" : ""}>${escapeHtml(method.label)}</option>
  `).join("");
}

function getEquipmentDescriptionDefinition(choice) {
  if (suspensionMethodDefinitions[choice]) return suspensionMethodDefinitions[choice];
  if (platformDefinitions[choice]) return platformDefinitions[choice];
  const method = state.suspensionMethods.find((item) => item.code === choice || item.id === choice);
  if (!method) return null;
  return {
    params: method.params || [],
    description(params) {
      return applyTemplate(method.descriptionTemplate, params);
    },
  };
}

function getSuspensionDefinition(choice) {
  return getEquipmentDescriptionDefinition(choice);
}

function applyTemplate(template = "", params = {}) {
  return String(template).replace(/\{\{\s*([\w-]+)\s*\}\}/g, (match, key) => params[key] || "");
}

function renderRowChoiceOptions(kind, selected = "") {
  if (["equipment_description", "suspension", "platform", "motors"].includes(kind)) return renderSuspensionMethodOptions(selected);
  return "";
}

function renderDefinitionParamFields(kind, choice, params = {}) {
  const definition = ["equipment_description", "suspension", "platform", "motors"].includes(kind)
    ? getEquipmentDescriptionDefinition(choice)
    : null;
  if (!definition) return "";
  return definition.params.map((field) => `
    <label>${escapeHtml(field.label)}
      <input data-row-param-field="${field.key}" value="${escapeHtml(params[field.key] ?? field.value ?? "")}" />
    </label>
  `).join("");
}

function buildConfiguredRow(row = {}) {
  const params = normalizeObject(row.descriptionParams);
  if (["equipment_description", "suspension", "platform", "motors"].includes(row.kind)) {
    const definition = getEquipmentDescriptionDefinition(row.descriptionChoice);
    if (definition) return { ...row, description: definition.description(defaultSuspensionParams(row.descriptionChoice, params)) };
  }
  return row;
}

function renderSuspensionParamFields(method, params = {}) {
  const definition = getSuspensionDefinition(method);
  if (!definition) {
    return `
      <label class="wide-label">נתוני תיאור ציוד
        <textarea data-field="suspensionParamsText" rows="3">${escapeHtml(formatSuspensionParams(params))}</textarea>
      </label>
    `;
  }

  return definition.params.map((field) => `
    <label>${escapeHtml(field.label)}
      <input data-param-field="${field.key}" value="${escapeHtml(params[field.key] ?? field.value ?? "")}" />
    </label>
  `).join("");
}

function renderDefaultSuspensionParamFields(method, params = {}) {
  return renderSuspensionParamFields(method, params).replaceAll("data-field=", "data-equipment-default-field=");
}

function defaultSuspensionParams(method, current = {}) {
  const definition = getEquipmentDescriptionDefinition(method);
  if (!definition) return normalizeObject(current);
  return definition.params.reduce((result, field) => {
    result[field.key] = current[field.key] ?? field.value ?? "";
    return result;
  }, {});
}

function buildSuspensionRows(item) {
  const definition = getEquipmentDescriptionDefinition(item.suspensionMethod);
  const platformDefinition = platformDefinitions[item.platformType];
  const rows = normalizeEquipmentRows(item.rows, item);
  const nextRows = [];

  if (definition) {
    const source = rows.find((row) => row.kind === "suspension") || rows[0] || emptyEquipmentRow("suspension");
    nextRows.push({
      ...source,
      kind: "suspension",
      description: definition.description(defaultSuspensionParams(item.suspensionMethod, item.suspensionParams)),
    });
  }

  if (platformDefinition) {
    const source = rows.find((row) => row.kind === "platform") || rows[definition ? 1 : 0] || emptyEquipmentRow("platform");
    nextRows.push({
      ...source,
      kind: "platform",
      description: platformDefinition.description(defaultPlatformParams(item.platformType, item.platformParams)),
    });
  }

  const motorNumbers = normalizeStringList(item.motorNumbers);
  if (motorNumbers.length) {
    const source = rows.find((row) => row.kind === "motors") || rows.find((row) => normalizeStringList(row.serial).some((serial) => motorNumbers.includes(serial))) || emptyEquipmentRow("motors");
    nextRows.push({
      ...source,
      kind: "motors",
      description: source.description || "מערכת הרמה: 2 יחידות הנעה.\nעם מערכת הורדה בחירום וגלגלים עליונים.",
      serial: motorNumbers.join("\n"),
    });
  }

  const usedIds = new Set(nextRows.map((row) => row.id));
  const manualRows = rows.filter((row) => !usedIds.has(row.id) && !["equipment_description", "suspension", "platform", "motors"].includes(row.kind));
  return nextRows.length ? [...nextRows, ...manualRows] : rows;
}

function formatSuspensionParams(params = {}) {
  return Object.entries(normalizeObject(params))
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function formatStringList(value = []) {
  return normalizeStringList(value).join("\n");
}

function parseSuspensionParams(value = "") {
  return String(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((result, line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        result[line] = "";
      } else {
        const key = line.slice(0, separatorIndex).trim();
        const itemValue = line.slice(separatorIndex + 1).trim();
        if (key) result[key] = itemValue;
      }
      return result;
    }, {});
}

function normalizeEquipmentRows(rows, fallback = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  if (sourceRows.length) {
    return sourceRows.map((row) => ({
      id: row.id || crypto.randomUUID(),
      kind: row.kind || "",
      descriptionChoice: row.descriptionChoice || row.description_choice || "",
      descriptionParams: normalizeObject(row.descriptionParams || row.description_params),
      description: row.description || "",
      makerModel: row.makerModel || row.maker_model || "",
      serial: row.serial || "",
    }));
  }

  return [{
    id: crypto.randomUUID(),
    description: fallback.description || "",
    kind: fallback.kind || "",
    descriptionChoice: fallback.descriptionChoice || "",
    descriptionParams: normalizeObject(fallback.descriptionParams),
    makerModel: [fallback.manufacturer, fallback.model].filter(Boolean).join("\n"),
    serial: fallback.serial || "",
  }];
}

function emptyEquipmentRow(kind = "") {
  return {
    id: crypto.randomUUID(),
    kind,
    descriptionChoice: "",
    descriptionParams: {},
    description: "",
    makerModel: "",
    serial: "",
  };
}

function defaultCustomerEquipmentRows() {
  const defaultMethods = state.suspensionMethods
    .filter((method) => method.isDefaultEquipmentRow)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || (a.name || "").localeCompare(b.name || ""));

  return defaultMethods.map((method) => {
    const choice = method.code || method.id;
    const params = defaultSuspensionParams(choice, {});
    return buildConfiguredRow({
      id: crypto.randomUUID(),
      kind: "equipment_description",
      descriptionChoice: choice,
      descriptionParams: params,
      description: "",
      makerModel: method.defaultMakerModel || "",
      serial: method.defaultSerial || "",
    });
  });
}

function defaultCustomerEquipmentTemplate(overrides = {}) {
  const rows = defaultCustomerEquipmentRows();
  return {
    id: `tmp-${crypto.randomUUID()}`,
    customerId: "",
    templateId: "",
    isTemplate: true,
    suspensionMethod: "",
    suspensionParams: {},
    platformType: "",
    platformParams: {},
    scaffoldNumber: "",
    motorNumbers: [],
    type: "מבנה ציוד",
    manufacturer: "",
    model: "",
    serial: "",
    safeLoad: "",
    selfWeight: "",
    description: "",
    rows: rows.length ? rows : [emptyEquipmentRow("equipment_description")],
    ...overrides,
  };
}

function firstRowValue(rows, field) {
  const row = Array.isArray(rows) ? rows.find((item) => item?.[field] || item?.[field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)]) : null;
  return row?.[field] || row?.[field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] || "";
}

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle("active-screen", screen.id === id));
  document.querySelectorAll(".step").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === id);
  });
  if (id === "editor") showEditorStep(activeEditorStep);
  if (id === "preview") renderPreview();
  if (id === "archive") renderArchive();
  if (id === "settings") renderSettings();
  updateStats();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showEditorStep(step) {
  activeEditorStep = Math.min(3, Math.max(1, Number(step) || 1));
  editorStepPanels.forEach((panel) => {
    panel.classList.toggle("active-editor-step", Number(panel.dataset.editorStep) === activeEditorStep);
  });
  editorStepButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.editorStepButton) === activeEditorStep);
  });
  prevEditorStepBtn.disabled = activeEditorStep === 1;
  nextEditorStepBtn.textContent = activeEditorStep === 3 ? "שמור לארכיון" : "הבא";
}

function goToNextEditorStep() {
  if (activeEditorStep < 3) {
    showEditorStep(activeEditorStep + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  saveReport();
}

function goToPreviousEditorStep() {
  if (activeEditorStep > 1) {
    showEditorStep(activeEditorStep - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function formValue(id) {
  return byId(id).value.trim();
}

function setValue(id, value) {
  byId(id).value = value || "";
}

function israelDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function datePartsToIso(parts) {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function todayIsraelIso() {
  return datePartsToIso(israelDateParts());
}

function addMonthsToIsoDate(isoDate, months) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

function formatIsraeliDate(value) {
  if (!value) return "-";
  const [datePart] = String(value).split("T");
  const [year, month, day] = datePart.split("-");
  if (!year || !month || !day) return value;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

function parseIsraeliDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return raw;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function dateFormValue(id) {
  return parseIsraeliDate(formValue(id));
}

function setDateValue(id, value) {
  setValue(id, value ? formatIsraeliDate(value) : "");
}

function getReportData() {
  return {
    id: state.currentId,
    reportTitle: formValue("reportTitle"),
    reportNumber: formValue("reportNumber"),
    previousReportNumber: formValue("previousReportNumber"),
    inspectionDate: dateFormValue("inspectionDate"),
    validUntil: dateFormValue("validUntil"),
    documentDate: dateFormValue("documentDate"),
    finalStatus: formValue("finalStatus"),
    customerId: customerSelect.value || "",
    customerName: formValue("customerName"),
    contactName: formValue("contactName"),
    contactPhone: formValue("contactPhone"),
    contactEmail: formValue("contactEmail"),
    siteAddress: formValue("siteAddress"),
    inspectorName: formValue("inspectorName"),
    inspectorLicense: formValue("inspectorLicense"),
    findings: formValue("findings"),
    generalNotes: formValue("generalNotes"),
    equipment: collectEquipment(),
    checks: collectChecks(),
  };
}

function loadReport(report) {
  state.currentId = report.id;
  [
    "reportTitle",
    "reportNumber",
    "previousReportNumber",
    "finalStatus",
    "customerName",
    "contactName",
    "contactPhone",
    "contactEmail",
    "siteAddress",
    "inspectorName",
    "inspectorLicense",
    "findings",
    "generalNotes",
  ].forEach((key) => setValue(key, report[key]));
  setDateValue("inspectionDate", report.inspectionDate);
  setDateValue("validUntil", report.validUntil);
  setDateValue("documentDate", report.documentDate);
  customerSelect.value = report.customerId || "";
  populateEquipmentTypes();
  state.equipment = report.equipment || [];
  state.checks = report.checks || [];
  renderEquipment();
  showEditorStep(1);
  showScreen("preview");
}

function resetDraft() {
  state.currentId = null;
  byId("reportForm").reset();
  const today = todayIsraelIso();
  setValue("reportTitle", "תסקיר ניסוי ובדיקה למכונות ואביזרי הרמה");
  setDateValue("inspectionDate", today);
  setDateValue("validUntil", addMonthsToIsoDate(today, 6));
  setDateValue("documentDate", today);
  setValue("finalStatus", "תקין לשימוש");
  setValue("inspectorName", "דרור חזן");
  setValue("inspectorLicense", "31580");
  state.equipment = [];
  state.checks = [];
  customerSelect.value = "";
  populateEquipmentTypes();
  renderEquipment();
  renderPreview();
  showEditorStep(1);
  updateStats();
}

async function saveReport() {
  try {
    setLoading(true, "שומר תסקיר...");
    const report = getReportData();
    const method = state.currentId ? "PUT" : "POST";
    const path = state.currentId ? `/api/reports/${state.currentId}` : "/api/reports";
    const payload = await apiFetch(path, {
      method,
      body: JSON.stringify(report),
    });

    const saved = payload.report;
    state.currentId = saved.id;
    const index = state.reports.findIndex((item) => item.id === saved.id);
    if (index >= 0) state.reports[index] = saved;
    else state.reports.unshift(saved);
    loadReport(saved);
    renderArchive();
    showMessage("התסקיר נשמר בהצלחה", "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    setLoading(false);
  }
}

function populateEquipmentTypes() {
  const availableEquipment = equipmentForReportCustomer(customerSelect.value);
  equipmentType.innerHTML = availableEquipment.length
    ? availableEquipment
        .map((item) => `<option value="${item.defaultId || item.id}">${escapeHtml(item.type || "ציוד ללא שם")}</option>`)
        .join("")
    : customerSelect.value
      ? '<option value="">אין ציוד משויך ללקוח הזה</option>'
      : '<option value="">בחר לקוח כדי לראות את הציוד שלו</option>';
}

function equipmentForCustomer() {
  if (!state.selectedEquipmentCustomerId) return [];
  const customerEquipment = equipmentForReportCustomer(state.selectedEquipmentCustomerId);
  const selectedDraft = state.equipmentCatalog.find((item) => item.id === state.selectedEquipmentDefaultId && item.id.startsWith("tmp-"));
  return selectedDraft ? [selectedDraft, ...customerEquipment] : customerEquipment;
}

function equipmentForReportCustomer(customerId) {
  if (!customerId) return [];
  return state.customerEquipmentDefaults
    .filter((defaults) => defaults.customerId === customerId)
    .map((defaults) => {
      const catalogItem = state.equipmentCatalog.find((item) => item.id === defaults.equipmentCatalogId);
      return catalogItem
        ? { ...applyCustomerEquipmentDefault(catalogItem, defaults), defaultId: catalogItem.id }
        : null;
    })
    .filter(Boolean);
}

function findCustomerEquipmentDefault(customerId, equipmentCatalogId) {
  if (!customerId || !equipmentCatalogId) return null;
  return state.customerEquipmentDefaults.find((item) =>
    item.customerId === customerId && item.equipmentCatalogId === equipmentCatalogId
  ) || null;
}

function applyCustomerEquipmentDefault(equipment, defaults) {
  if (!defaults) return equipment;
  return {
    ...equipment,
    customerEquipmentDefaultId: defaults.id,
    suspensionMethod: defaults.suspensionMethod || equipment.suspensionMethod,
    suspensionParams: Object.keys(defaults.suspensionParams || {}).length ? defaults.suspensionParams : equipment.suspensionParams,
    platformType: defaults.platformType || equipment.platformType,
    scaffoldNumber: defaults.scaffoldNumber || equipment.scaffoldNumber,
    motorNumbers: defaults.motorNumbers?.length ? defaults.motorNumbers : equipment.motorNumbers,
    safeLoad: defaults.safeLoad || equipment.safeLoad,
    selfWeight: defaults.selfWeight || equipment.selfWeight,
    rows: defaults.rows?.length ? defaults.rows : equipment.rows,
  };
}

function populateCustomerSelect() {
  customerSelect.innerHTML = [
    '<option value="">בחר לקוח לתסקיר</option>',
    ...state.customers.map((item) => `<option value="${item.id}">${escapeHtml(item.customerName || "לקוח ללא שם")}</option>`),
  ].join("");
}

function applyCustomerDefaults() {
  const customer = state.customers.find((item) => item.id === customerSelect.value);
  if (!customer) return;
  setValue("customerName", customer.customerName);
  setValue("contactName", customer.contactName);
  setValue("contactPhone", customer.contactPhone);
  setValue("contactEmail", customer.contactEmail);
  setValue("siteAddress", customer.siteAddress);
  populateEquipmentTypes();
  state.equipment = equipmentForReportCustomer(customer.id).map((item) => {
    const { id, defaultId = id, ...equipment } = item;
    return {
      ...equipment,
      id: crypto.randomUUID(),
      defaultId,
      rows: buildSuspensionRows({
        ...equipment,
        rows: normalizeEquipmentRows(equipment.rows, equipment),
      }),
    };
  });
  renderEquipment();
  updateStats();
}

function addEquipment() {
  const item = equipmentForReportCustomer(customerSelect.value)
    .find((entry) => (entry.defaultId || entry.id) === equipmentType.value);
  if (!item) return;
  const { id, defaultId = id, ...equipmentWithCustomerDefaults } = item;
  state.equipment.push({
    ...equipmentWithCustomerDefaults,
    rows: buildSuspensionRows({
      ...equipmentWithCustomerDefaults,
      rows: normalizeEquipmentRows(equipmentWithCustomerDefaults.rows, equipmentWithCustomerDefaults),
    }),
    id: crypto.randomUUID(),
    defaultId,
  });
  renderEquipment();
  updateStats();
}

function renderEquipmentLegacy() {
  if (!state.equipment.length) {
    equipmentList.innerHTML = '<div class="empty-state">עדיין לא נוסף ציוד לתסקיר.</div>';
    return;
  }

  equipmentList.innerHTML = state.equipment
    .map(
      (item, index) => `
        <article class="equipment-card" data-id="${item.id}">
          <header>
            <h4>${index + 1}. ${escapeHtml(item.type)}</h4>
            <button class="remove" type="button" data-remove-equipment="${item.id}" aria-label="הסר ציוד">X</button>
          </header>
          <div class="input-grid">
            <label>שם / סוג ציוד
              <input data-field="type" value="${escapeHtml(item.type)}" />
            </label>
            <label>יצרן
              <input data-field="manufacturer" value="${escapeHtml(item.manufacturer)}" />
            </label>
            <label>דגם
              <input data-field="model" value="${escapeHtml(item.model)}" />
            </label>
            <label>מספר סידורי
              <input data-field="serial" value="${escapeHtml(item.serial)}" />
            </label>
            <label>עומס עבודה בטוח
              <input data-field="safeLoad" value="${escapeHtml(item.safeLoad)}" />
            </label>
            <label>משקל עצמי
              <input data-field="selfWeight" value="${escapeHtml(item.selfWeight)}" />
            </label>
            <label class="wide-label">תיאור ציוד / פרמטרים
              <textarea data-field="description" rows="3">${escapeHtml(item.description)}</textarea>
            </label>
            <button class="secondary small" type="button" data-add-description-block>הוסף תיאור ציוד</button>
          </div>
        </article>
      `
    )
    .join("");
}

function collectEquipmentLegacy() {
  return [...equipmentList.querySelectorAll(".equipment-card")].map((card) => {
    const source = state.equipment.find((item) => item.id === card.dataset.id) || {};
    const result = { id: card.dataset.id };
    card.querySelectorAll("[data-field]").forEach((input) => {
      if (input.dataset.field === "suspensionParamsText") {
        result.suspensionParams = parseSuspensionParams(input.value);
      } else if (input.dataset.field === "motorNumbersText") {
        result.motorNumbers = normalizeStringList(input.value);
      } else {
        result[input.dataset.field] = input.value.trim();
      }
    });
    return { ...source, ...result };
  });
}

function renderEquipment() {
  if (!state.equipment.length) {
    equipmentList.innerHTML = '<div class="empty-state">עדיין לא נוסף ציוד לתסקיר.</div>';
    return;
  }

  equipmentList.innerHTML = state.equipment
    .map((item, index) => `
      <article class="equipment-card" data-id="${item.id}">
        <header>
          <h4>${index + 1}. ${escapeHtml(item.type || "ציוד ללא שם")}</h4>
          <button class="remove" type="button" data-remove-equipment="${item.id}" aria-label="הסר ציוד">X</button>
        </header>
        <div class="input-grid">
          <label>עומס עבודה בטוח
            <input data-field="safeLoad" value="${escapeHtml(item.safeLoad)}" />
          </label>
          <label>עומס מבחן
            <input data-field="selfWeight" value="${escapeHtml(item.selfWeight)}" />
          </label>
        </div>
        ${renderEquipmentRowsEditor(item.rows || normalizeEquipmentRows([], item), "row")}
        <button class="secondary small" type="button" data-add-equipment-row="${item.id}">+ הוסף שורת ציוד</button>
      </article>
    `)
    .join("");
}

function renderEquipmentRowsEditor(rows, prefix) {
  const html = `
    <div class="equipment-row-editor">
      <table>
        <colgroup>
          <col class="equipment-col-actions" />
          <col class="equipment-col-description" />
          <col class="equipment-col-maker" />
          <col class="equipment-col-serial" />
        </colgroup>
        <thead>
          <tr>
            <th class="equipment-col-actions">מיקום</th>
            <th>תיאור הציוד הנבדק / הערה נלווית</th>
            <th>יצרן ודגם</th>
            <th>מס"ד / מס' רישוי</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => `
            <tr data-equipment-row-id="${row.id}" data-equipment-row-kind="${escapeHtml(row.kind || "")}">
              <td class="equipment-row-actions">
                <button class="secondary small icon-row-btn" type="button" data-move-equipment-row="${row.id}" data-direction="up" ${index === 0 ? "disabled" : ""}>↑</button>
                <button class="secondary small icon-row-btn" type="button" data-move-equipment-row="${row.id}" data-direction="down" ${index === rows.length - 1 ? "disabled" : ""}>↓</button>
                <button class="remove small icon-row-btn" type="button" data-remove-equipment-row="${row.id}">X</button>
              </td>
              <td>
                <div class="row-config">
                  <select data-${prefix}-field="kind">
                    ${renderRowKindOptions(row.kind || "")}
                  </select>
                  ${["equipment_description", "suspension", "platform", "motors"].includes(row.kind) ? `
                    <select data-${prefix}-field="descriptionChoice">
                      ${renderRowChoiceOptions(row.kind, row.descriptionChoice)}
                    </select>
                    <div class="row-param-grid">
                      ${renderDefinitionParamFields(row.kind, row.descriptionChoice, row.descriptionParams)}
                    </div>
                  ` : ""}
                </div>
                <textarea class="auto-size-textarea equipment-table-textarea" data-${prefix}-field="description" rows="3">${escapeHtml(row.description)}</textarea>
              </td>
              <td><textarea class="auto-size-textarea equipment-table-textarea" data-${prefix}-field="makerModel" rows="2">${escapeHtml(row.makerModel)}</textarea></td>
              <td><textarea class="auto-size-textarea equipment-table-textarea" data-${prefix}-field="serial" rows="2">${escapeHtml(row.serial)}</textarea></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  requestAnimationFrame(() => resizeAutoTextareas());
  return html;
}

function collectEquipment() {
  return [...equipmentList.querySelectorAll(".equipment-card")].map((card) => {
    const source = state.equipment.find((item) => item.id === card.dataset.id) || {};
    const result = { id: card.dataset.id };
    card.querySelectorAll("[data-field]").forEach((input) => {
      if (input.dataset.field === "suspensionParamsText") {
        result.suspensionParams = parseSuspensionParams(input.value);
      } else {
        result[input.dataset.field] = input.value.trim();
      }
    });
    const paramInputs = [...card.querySelectorAll("[data-param-field]")];
    if (paramInputs.length) {
      result.suspensionParams = paramInputs.reduce((params, input) => {
        params[input.dataset.paramField] = input.value.trim();
        return params;
      }, {});
    }
    const platformParamInputs = [...card.querySelectorAll("[data-platform-param-field]")];
    if (platformParamInputs.length) {
      result.platformParams = platformParamInputs.reduce((params, input) => {
        params[input.dataset.platformParamField] = input.value.trim();
        return params;
      }, {});
    }
    const currentRows = [...card.querySelectorAll("[data-equipment-row-id]")].map((row) => ({
      id: row.dataset.equipmentRowId,
      kind: row.querySelector('[data-row-field="kind"]')?.value.trim() || row.dataset.equipmentRowKind || "",
      descriptionChoice: row.querySelector('[data-row-field="descriptionChoice"]')?.value.trim() || "",
      descriptionParams: [...row.querySelectorAll("[data-row-param-field]")].reduce((params, input) => {
        params[input.dataset.rowParamField] = input.value.trim();
        return params;
      }, {}),
      description: row.querySelector('[data-row-field="description"]').value.trim(),
      makerModel: row.querySelector('[data-row-field="makerModel"]').value.trim(),
      serial: row.querySelector('[data-row-field="serial"]').value.trim(),
    }));
    result.rows = currentRows;
    return { ...source, ...result };
  });
}

function collectChecks() {
  return checksList ? [...checksList.querySelectorAll(".check-row")].map((row) => ({
    id: row.dataset.id,
    text: row.querySelector('[data-check-field="text"]').value.trim(),
    status: row.querySelector('[data-check-field="status"]').value,
  })) : state.checks;
}

function addEquipmentDefault() {
  const equipment = defaultCustomerEquipmentTemplate();
  state.equipmentCatalog.unshift(equipment);
  state.selectedEquipmentDefaultId = equipment.id;
  state.activeSettingsPanel = "equipment";
  renderSettings();
}

function addCustomerDefault() {
  const id = `tmp-${crypto.randomUUID()}`;
  state.customers.unshift({
    id,
    customerName: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    siteAddress: "",
  });
  state.selectedCustomerDefaultId = id;
  state.activeSettingsPanel = "customers";
  renderSettings();
}

function renderSettings() {
  ensureSelectedDefaults();
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsTab === state.activeSettingsPanel);
  });
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    panel.classList.toggle("active-settings-panel", panel.dataset.settingsPanel === state.activeSettingsPanel);
  });
  renderCustomerDefaults();
  renderEquipmentDefaults();
  renderSuspensionMethods();
}

function ensureSelectedDefaults() {
  if (!state.customers.some((item) => item.id === state.selectedCustomerDefaultId)) {
    state.selectedCustomerDefaultId = state.customers[0]?.id || "";
  }
  if (!state.customers.some((item) => item.id === state.selectedEquipmentCustomerId)) {
    state.selectedEquipmentCustomerId = state.selectedCustomerDefaultId || state.customers[0]?.id || "";
  }

  if (!state.equipmentCatalog.some((item) => item.id === state.selectedEquipmentDefaultId)) {
    state.selectedEquipmentDefaultId = state.equipmentCatalog[0]?.id || "";
  }
  if (!state.suspensionMethods.some((item) => item.id === state.selectedSuspensionMethodId)) {
    state.selectedSuspensionMethodId = state.suspensionMethods[0]?.id || "";
  }
}

function renderManageSelectsLegacy() {
  manageCustomerSelect.innerHTML = state.customers.length
    ? state.customers.map((customer) => `<option value="${customer.id}">${escapeHtml(customer.customerName || "לקוח ללא שם")}</option>`).join("")
    : '<option value="">אין לקוחות</option>';
  manageCustomerSelect.value = state.selectedCustomerDefaultId;

  manageEquipmentSelect.innerHTML = state.equipmentCatalog.length
    ? state.equipmentCatalog.map((item) => `<option value="${item.id}">${escapeHtml(item.type || "ציוד ללא שם")}</option>`).join("")
    : '<option value="">אין ציוד</option>';
  manageEquipmentSelect.value = state.selectedEquipmentDefaultId;
}

function renderManageSelects() {
  manageCustomerSelect.innerHTML = state.customers.length
    ? state.customers.map((customer) => `<option value="${customer.id}">${escapeHtml(customer.customerName || "לקוח ללא שם")}</option>`).join("")
    : '<option value="">אין לקוחות</option>';
  manageCustomerSelect.value = state.selectedCustomerDefaultId;

  equipmentCustomerSelect.innerHTML = state.customers.length
    ? state.customers.map((customer) => `<option value="${customer.id}">${escapeHtml(customer.customerName || "לקוח ללא שם")}</option>`).join("")
    : '<option value="">אין לקוחות</option>';
  equipmentCustomerSelect.value = state.selectedEquipmentCustomerId;

  if (copyEquipmentSourceCustomerSelect && copyEquipmentSourceEquipmentSelect) {
    copyEquipmentSourceCustomerSelect.innerHTML = [
      '<option value="">בחר לקוח מקור</option>',
      ...state.customers
        .filter((customer) => customer.id !== state.selectedEquipmentCustomerId)
        .map((customer) => `<option value="${customer.id}">${escapeHtml(customer.customerName || "לקוח ללא שם")}</option>`),
    ].join("");
    renderCopyEquipmentOptions();
  }

  const customerEquipment = equipmentForCustomer();
  manageEquipmentSelect.innerHTML = customerEquipment.length
    ? customerEquipment.map((item) => `<option value="${item.defaultId || item.id}">${escapeHtml(item.type || "ציוד ללא שם")}</option>`).join("")
    : '<option value="">אין ציוד ללקוח הזה</option>';
  manageEquipmentSelect.value = state.selectedEquipmentDefaultId;

  if (manageSuspensionSelect) {
    manageSuspensionSelect.innerHTML = state.suspensionMethods.length
      ? state.suspensionMethods.map((method) => `<option value="${method.id}">${escapeHtml(method.name || method.code || "שיטה ללא שם")}</option>`).join("")
      : '<option value="">אין תיאורי ציוד</option>';
    manageSuspensionSelect.value = state.selectedSuspensionMethodId;
  }
}

function renderCopyEquipmentOptions() {
  if (!copyEquipmentSourceEquipmentSelect) return;
  const sourceCustomerId = copyEquipmentSourceCustomerSelect?.value || "";
  const sourceEquipment = equipmentForReportCustomer(sourceCustomerId);
  copyEquipmentSourceEquipmentSelect.innerHTML = sourceEquipment.length
    ? sourceEquipment.map((item) => `<option value="${item.defaultId || item.id}">${escapeHtml(item.type || "ציוד ללא שם")}</option>`).join("")
    : '<option value="">אין ציוד משויך ללקוח המקור</option>';
}

function renderCustomerDefaults() {
  renderManageSelects();
  if (!state.customers.length) {
    customerDefaultsList.innerHTML = '<div class="empty-state">אין לקוחות שמורים.</div>';
    return;
  }

  const customer = state.customers.find((item) => item.id === state.selectedCustomerDefaultId);
  if (!customer) {
    customerDefaultsList.innerHTML = '<div class="empty-state">בחר לקוח לעריכה.</div>';
    return;
  }

  customerDefaultsList.innerHTML = `
    <article class="default-card" data-customer-default-id="${customer.id}">
      <header>
        <h4>${escapeHtml(customer.customerName || "לקוח ללא שם")}</h4>
        <button class="remove" type="button" data-remove-customer-default="${customer.id}" aria-label="מחק לקוח">X</button>
      </header>
      <div class="input-grid">
        <label>שם לקוח
          <input data-customer-default-field="customerName" value="${escapeHtml(customer.customerName)}" />
        </label>
        <label>איש קשר
          <input data-customer-default-field="contactName" value="${escapeHtml(customer.contactName)}" />
        </label>
        <label>טלפון
          <input data-customer-default-field="contactPhone" value="${escapeHtml(customer.contactPhone)}" />
        </label>
        <label>אימייל
          <input data-customer-default-field="contactEmail" type="email" value="${escapeHtml(customer.contactEmail)}" />
        </label>
      </div>
    </article>
  `;
}

function renderEquipmentDefaultsLegacy() {
  renderManageSelects();
  if (!state.equipmentCatalog.length) {
    equipmentDefaultsList.innerHTML = '<div class="empty-state">אין ציוד שמור בקטלוג.</div>';
    return;
  }

  const item = state.equipmentCatalog.find((entry) => entry.id === state.selectedEquipmentDefaultId);
  if (!item) {
    equipmentDefaultsList.innerHTML = '<div class="empty-state">בחר ציוד לעריכה.</div>';
    return;
  }

  equipmentDefaultsList.innerHTML = `
    <article class="default-card" data-equipment-default-id="${item.id}">
      <header>
        <h4>${escapeHtml(item.type || "ציוד ללא שם")}</h4>
        <button class="remove" type="button" data-remove-equipment-default="${item.id}" aria-label="מחק ציוד">X</button>
      </header>
      <div class="input-grid">
        <label>שם / סוג ציוד
          <input data-equipment-default-field="type" value="${escapeHtml(item.type)}" />
        </label>
        <label>יצרן
          <input data-equipment-default-field="manufacturer" value="${escapeHtml(item.manufacturer)}" />
        </label>
        <label>דגם
          <input data-equipment-default-field="model" value="${escapeHtml(item.model)}" />
        </label>
        <label>מספר סידורי ברירת מחדל
          <input data-equipment-default-field="serial" value="${escapeHtml(item.serial)}" />
        </label>
        <label>עומס עבודה בטוח
          <input data-equipment-default-field="safeLoad" value="${escapeHtml(item.safeLoad)}" />
        </label>
        <label>משקל עצמי
          <input data-equipment-default-field="selfWeight" value="${escapeHtml(item.selfWeight)}" />
        </label>
        <label class="wide-label">תיאור ציוד / פרמטרים
          <textarea data-equipment-default-field="description" rows="3">${escapeHtml(item.description)}</textarea>
        </label>
      </div>
    </article>
  `;
}

function renderEquipmentDefaultsPrevious() {
  renderManageSelects();

  if (!state.customers.length) {
    equipmentDefaultsList.innerHTML = '<div class="empty-state">אין לקוחות שמורים. יש ליצור לקוח לפני הוספת ציוד.</div>';
    return;
  }

  const customerEquipment = equipmentForCustomer();
  if (!customerEquipment.length) {
    equipmentDefaultsList.innerHTML = '<div class="empty-state">אין ציוד שמור בקטלוג. לחץ הוסף ציוד כדי ליצור ציוד חדש.</div>';
    return;
  }

  const item = customerEquipment.find((entry) => entry.id === state.selectedEquipmentDefaultId);
  if (!item) {
    equipmentDefaultsList.innerHTML = '<div class="empty-state">בחר ציוד לעריכה.</div>';
    return;
  }

  equipmentDefaultsList.innerHTML = `
    <article class="default-card" data-equipment-default-id="${item.id}">
      <header>
        <h4>${escapeHtml(item.type || "ציוד ללא שם")}</h4>
        <button class="remove" type="button" data-remove-equipment-default="${item.id}" aria-label="מחק ציוד">X</button>
      </header>
      <div class="input-grid">
        <label>שם / סוג ציוד
          <input data-equipment-default-field="type" value="${escapeHtml(item.type)}" />
        </label>
        <label>יצרן
          <input data-equipment-default-field="manufacturer" value="${escapeHtml(item.manufacturer)}" />
        </label>
        <label>דגם
          <input data-equipment-default-field="model" value="${escapeHtml(item.model)}" />
        </label>
        <label>מספר סידורי / רישוי
          <input data-equipment-default-field="serial" value="${escapeHtml(item.serial)}" />
        </label>
        <label>עומס עבודה בטוח
          <input data-equipment-default-field="safeLoad" value="${escapeHtml(item.safeLoad)}" />
        </label>
        <label>עומס מבחן
          <input data-equipment-default-field="selfWeight" value="${escapeHtml(item.selfWeight)}" />
        </label>
        <label class="wide-label">תיאורי ציוד / מלל חופשי
          <textarea data-equipment-default-field="description" rows="5">${escapeHtml(item.description)}</textarea>
        </label>
        <button class="secondary small" type="button" data-add-default-description-block>הוסף תיאור ציוד</button>
      </div>
      ${renderEquipmentRowsEditor(item.rows || normalizeEquipmentRows([], item), "default-row")}
      <button class="secondary small" type="button" data-add-default-equipment-row="${item.id}">+ הוסף שורת ציוד</button>
    </article>
  `;
}

function readCustomerForm() {
  const card = customerDefaultsList.querySelector("[data-customer-default-id]");
  if (!card) return null;
  const result = { id: card.dataset.customerDefaultId };
  card.querySelectorAll("[data-customer-default-field]").forEach((input) => {
    result[input.dataset.customerDefaultField] = input.value.trim();
  });
  const existingCustomer = state.customers.find((item) => item.id === result.id);
  result.siteAddress = existingCustomer?.siteAddress || "";
  return result;
}

function readEquipmentDefaultForm() {
  const card = equipmentDefaultsList.querySelector("[data-equipment-default-id]");
  if (!card) return null;
  const result = { id: card.dataset.equipmentDefaultId, customerId: state.selectedEquipmentCustomerId };
  card.querySelectorAll("[data-equipment-default-field]").forEach((input) => {
    if (input.dataset.equipmentDefaultField === "suspensionParamsText") {
      result.suspensionParams = parseSuspensionParams(input.value);
    } else if (input.dataset.equipmentDefaultField === "motorNumbersText") {
      result.motorNumbers = normalizeStringList(input.value);
    } else {
      result[input.dataset.equipmentDefaultField] = input.value.trim();
    }
  });
  const paramInputs = [...card.querySelectorAll("[data-param-field]")];
  if (paramInputs.length) {
    result.suspensionParams = paramInputs.reduce((params, input) => {
      params[input.dataset.paramField] = input.value.trim();
      return params;
    }, {});
  }
  const platformParamInputs = [...card.querySelectorAll("[data-platform-param-field]")];
  if (platformParamInputs.length) {
    result.platformParams = platformParamInputs.reduce((params, input) => {
      params[input.dataset.platformParamField] = input.value.trim();
      return params;
    }, {});
  }
  const rows = [...card.querySelectorAll("[data-equipment-row-id]")].map((row) => ({
    id: row.dataset.equipmentRowId,
    kind: row.querySelector('[data-default-row-field="kind"]')?.value.trim() || row.dataset.equipmentRowKind || "",
    descriptionChoice: row.querySelector('[data-default-row-field="descriptionChoice"]')?.value.trim() || "",
    descriptionParams: [...row.querySelectorAll("[data-row-param-field]")].reduce((params, input) => {
      params[input.dataset.rowParamField] = input.value.trim();
      return params;
    }, {}),
    description: row.querySelector('[data-default-row-field="description"]').value.trim(),
    makerModel: row.querySelector('[data-default-row-field="makerModel"]').value.trim(),
    serial: row.querySelector('[data-default-row-field="serial"]').value.trim(),
  }));
  result.rows = rows;
  return result;
}

function updateEquipmentEditorState(equipment) {
  if (!equipment) return;
  if (state.selectedEquipmentCustomerId && !equipment.id.startsWith("tmp-")) {
    const localDefault = {
      ...equipment,
      id: findCustomerEquipmentDefault(state.selectedEquipmentCustomerId, equipment.id)?.id || `tmp-${state.selectedEquipmentCustomerId}-${equipment.id}`,
      customerId: state.selectedEquipmentCustomerId,
      equipmentCatalogId: equipment.id,
    };
    state.customerEquipmentDefaults = state.customerEquipmentDefaults
      .filter((item) => !(item.customerId === localDefault.customerId && item.equipmentCatalogId === localDefault.equipmentCatalogId));
    state.customerEquipmentDefaults.unshift(localDefault);
    return;
  }
  state.equipmentCatalog = state.equipmentCatalog.map((item) => item.id === equipment.id ? { ...item, ...equipment } : item);
}

async function saveSelectedCustomer() {
  try {
    const customer = readCustomerForm();
    if (!customer) return;
    const isNew = customer.id.startsWith("tmp-");
    const payload = await apiFetch(isNew ? "/api/customers" : `/api/customers/${customer.id}`, {
      method: isNew ? "POST" : "PUT",
      body: JSON.stringify(customer),
    });
    const saved = mapCustomerFromApi(payload.customer);
    state.customers = state.customers.filter((item) => item.id !== customer.id);
    state.customers.unshift(saved);
    state.selectedCustomerDefaultId = saved.id;
    state.selectedEquipmentCustomerId = saved.id;
    if (isNew) {
      await createDefaultEquipmentForCustomer(saved.id);
    }
    state.activeSettingsPanel = "equipment";
    populateCustomerSelect();
    renderSettings();
    showMessage("הלקוח נשמר. עכשיו בחר ציוד ושמור לו תבנית.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function createDefaultEquipmentForCustomer(customerId) {
  const rows = defaultCustomerEquipmentRows();
  if (!customerId || !rows.length) return null;

  const equipment = defaultCustomerEquipmentTemplate({
    id: "",
    customerId,
    rows,
  });
  const catalogPayload = await apiFetch("/api/equipment-catalog", {
    method: "POST",
    body: JSON.stringify(equipment),
  });
  const savedCatalogItem = mapEquipmentFromApi(catalogPayload.equipment);
  state.equipmentCatalog = state.equipmentCatalog.filter((item) => item.id !== savedCatalogItem.id);
  state.equipmentCatalog.unshift(savedCatalogItem);

  const defaultPayload = await apiFetch("/api/customer-equipment-defaults", {
    method: "POST",
    body: JSON.stringify({
      customerId,
      equipmentCatalogId: savedCatalogItem.id,
      safeLoad: savedCatalogItem.safeLoad,
      selfWeight: savedCatalogItem.selfWeight,
      rows: savedCatalogItem.rows,
    }),
  });
  const savedDefault = mapCustomerEquipmentDefaultFromApi(defaultPayload.default);
  state.customerEquipmentDefaults = state.customerEquipmentDefaults
    .filter((item) => !(item.customerId === savedDefault.customerId && item.equipmentCatalogId === savedDefault.equipmentCatalogId));
  state.customerEquipmentDefaults.unshift(savedDefault);
  state.selectedEquipmentDefaultId = savedCatalogItem.id;
  return savedCatalogItem;
}

async function saveSelectedEquipmentDefault() {
  try {
    const equipment = readEquipmentDefaultForm();
    if (!equipment) return;
    const isNew = equipment.id.startsWith("tmp-");

    if (isNew) {
      const payload = await apiFetch("/api/equipment-catalog", {
        method: "POST",
        body: JSON.stringify(equipment),
      });
      const savedCatalogItem = mapEquipmentFromApi(payload.equipment);
      state.equipmentCatalog = state.equipmentCatalog.filter((item) => item.id !== equipment.id);
      state.equipmentCatalog.unshift(savedCatalogItem);
      state.selectedEquipmentDefaultId = savedCatalogItem.id;

      if (state.selectedEquipmentCustomerId) {
        const defaultPayload = await apiFetch("/api/customer-equipment-defaults", {
          method: "POST",
          body: JSON.stringify({
            ...equipment,
            customerId: state.selectedEquipmentCustomerId,
            equipmentCatalogId: savedCatalogItem.id,
          }),
        });
        const savedDefault = mapCustomerEquipmentDefaultFromApi(defaultPayload.default);
        state.customerEquipmentDefaults = state.customerEquipmentDefaults
          .filter((item) => !(item.customerId === savedDefault.customerId && item.equipmentCatalogId === savedDefault.equipmentCatalogId));
        state.customerEquipmentDefaults.unshift(savedDefault);
      }

      populateEquipmentTypes();
      renderSettings();
      showMessage(state.selectedEquipmentCustomerId ? "הציוד והתבנית ללקוח נשמרו בהצלחה" : "הציוד נשמר בקטלוג בהצלחה", "success");
      return;
    }

    if (state.selectedEquipmentCustomerId && !equipment.id.startsWith("tmp-")) {
      const catalogPayload = await apiFetch(`/api/equipment-catalog/${equipment.id}`, {
        method: "PUT",
        body: JSON.stringify(equipment),
      });
      const savedCatalog = mapEquipmentFromApi(catalogPayload.equipment);
      state.equipmentCatalog = state.equipmentCatalog.filter((item) => item.id !== savedCatalog.id);
      state.equipmentCatalog.unshift(savedCatalog);

      const payload = await apiFetch("/api/customer-equipment-defaults", {
        method: "POST",
        body: JSON.stringify({
          ...equipment,
          customerId: state.selectedEquipmentCustomerId,
          equipmentCatalogId: equipment.id,
        }),
      });
      const saved = mapCustomerEquipmentDefaultFromApi(payload.default);
      state.customerEquipmentDefaults = state.customerEquipmentDefaults
        .filter((item) => !(item.customerId === saved.customerId && item.equipmentCatalogId === saved.equipmentCatalogId));
      state.customerEquipmentDefaults.unshift(saved);
      renderSettings();
      showMessage("תבנית הציוד ללקוח נשמרה בהצלחה", "success");
      return;
    }

    const payload = await apiFetch(`/api/equipment-catalog/${equipment.id}`, {
      method: "PUT",
      body: JSON.stringify(equipment),
    });
    const saved = mapEquipmentFromApi(payload.equipment);
    state.equipmentCatalog = state.equipmentCatalog.filter((item) => item.id !== equipment.id);
    state.equipmentCatalog.unshift(saved);
    state.selectedEquipmentDefaultId = saved.id;
    populateEquipmentTypes();
    renderSettings();
    showMessage("הציוד נשמר בהצלחה", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function renderEquipmentDefaults() {
  renderManageSelects();

  const customerEquipment = equipmentForCustomer();
  if (!customerEquipment.length) {
    equipmentDefaultsList.innerHTML = '<div class="empty-state">אין ציוד שמור בקטלוג. לחץ הוסף ציוד כדי ליצור ציוד חדש.</div>';
    return;
  }

  const catalogItem = customerEquipment.find((entry) => entry.id === state.selectedEquipmentDefaultId);
  if (!catalogItem) {
    equipmentDefaultsList.innerHTML = '<div class="empty-state">בחר ציוד לעריכה.</div>';
    return;
  }
  const customer = state.customers.find((entry) => entry.id === state.selectedEquipmentCustomerId);
  const customerDefault = findCustomerEquipmentDefault(state.selectedEquipmentCustomerId, catalogItem.id);
  const item = applyCustomerEquipmentDefault(catalogItem, customerDefault);

  equipmentDefaultsList.innerHTML = `
    <article class="default-card" data-equipment-default-id="${item.id}">
      <header>
        <h4>${escapeHtml(item.type || "ציוד ללא שם")} ${customer ? `- תבנית ${escapeHtml(customer.customerName)}` : ""}</h4>
        ${customer ? "" : `<button class="remove" type="button" data-remove-equipment-default="${item.id}" aria-label="מחק ציוד">X</button>`}
      </header>
      <div class="input-grid">
        <label>שם / סוג ציוד
          <input data-equipment-default-field="type" value="${escapeHtml(item.type)}" />
        </label>
        <label>עומס עבודה בטוח
          <input data-equipment-default-field="safeLoad" value="${escapeHtml(item.safeLoad)}" />
        </label>
        <label>עומס מבחן
          <input data-equipment-default-field="selfWeight" value="${escapeHtml(item.selfWeight)}" />
        </label>
      </div>
      ${renderEquipmentRowsEditor(item.rows || normalizeEquipmentRows([], item), "default-row")}
      <button class="secondary small" type="button" data-add-default-equipment-row="${item.id}">+ הוסף שורת ציוד</button>
    </article>
  `;
}

function addSuspensionMethod() {
  const id = `tmp-${crypto.randomUUID()}`;
  state.suspensionMethods.unshift({
    id,
    code: "",
    name: "",
    descriptionTemplate: "",
    params: [],
    sortOrder: state.suspensionMethods.length + 1,
    isDefaultEquipmentRow: false,
    defaultMakerModel: "",
    defaultSerial: "",
  });
  state.selectedSuspensionMethodId = id;
  state.activeSettingsPanel = "suspension";
  renderSettings();
}

function renderSuspensionMethods() {
  if (!suspensionMethodsList) return;
  renderManageSelects();
  if (!state.suspensionMethods.length) {
    suspensionMethodsList.innerHTML = '<div class="empty-state">אין תיאורי ציוד שמורים. לחץ הוסף תיאור כדי ליצור אחד.</div>';
    return;
  }

  const method = state.suspensionMethods.find((item) => item.id === state.selectedSuspensionMethodId);
  if (!method) {
    suspensionMethodsList.innerHTML = '<div class="empty-state">בחר תיאור ציוד לעריכה.</div>';
    return;
  }

  suspensionMethodsList.innerHTML = `
    <article class="default-card" data-suspension-method-id="${method.id}">
      <header>
        <h4>${escapeHtml(method.name || "תיאור ציוד ללא שם")}</h4>
        <button class="remove" type="button" data-remove-suspension-method="${method.id}" aria-label="מחק תיאור ציוד">X</button>
      </header>
      <div class="input-grid">
        <label>שם תיאור
          <input data-suspension-method-field="name" value="${escapeHtml(method.name)}" />
        </label>
        <label>קוד פנימי
          <input data-suspension-method-field="code" value="${escapeHtml(method.code)}" />
        </label>
        <label>סדר תצוגה
          <input data-suspension-method-field="sortOrder" type="number" value="${escapeHtml(method.sortOrder)}" />
        </label>
        <label class="checkbox-label">
          <input data-suspension-method-field="isDefaultEquipmentRow" type="checkbox" ${method.isDefaultEquipmentRow ? "checked" : ""} />
          הוסף אוטומטית לציוד חדש
        </label>
        <label>יצרן ודגם ברירת מחדל
          <input data-suspension-method-field="defaultMakerModel" value="${escapeHtml(method.defaultMakerModel || "")}" />
        </label>
        <label>מס"ד / מס' רישוי ברירת מחדל
          <input data-suspension-method-field="defaultSerial" value="${escapeHtml(method.defaultSerial || "")}" />
        </label>
        <label class="wide-label">מלל תיאור
          <textarea class="auto-size-textarea" data-suspension-method-field="descriptionTemplate" rows="5">${escapeHtml(method.descriptionTemplate)}</textarea>
        </label>
        <label class="wide-label">פרמטרים בפורמט JSON
          <textarea class="auto-size-textarea json-textarea" dir="ltr" spellcheck="false" data-suspension-method-field="paramsText" rows="5">${escapeHtml(JSON.stringify(method.params || [], null, 2))}</textarea>
        </label>
      </div>
    </article>
  `;
  resizeAutoTextareas(suspensionMethodsList);
}

function resizeAutoTextareas(scope = document) {
  scope.querySelectorAll(".auto-size-textarea").forEach((textarea) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  });
}

function readSuspensionMethodForm() {
  const card = suspensionMethodsList?.querySelector("[data-suspension-method-id]");
  if (!card) return null;
  const result = { id: card.dataset.suspensionMethodId };
  card.querySelectorAll("[data-suspension-method-field]").forEach((input) => {
    const field = input.dataset.suspensionMethodField;
    if (field === "paramsText") {
      try {
        const parsed = JSON.parse(input.value || "[]");
        result.params = Array.isArray(parsed) ? parsed : [];
      } catch {
        result.params = [];
      }
    } else if (field === "sortOrder") {
      result.sortOrder = Number(input.value) || 0;
    } else if (field === "isDefaultEquipmentRow") {
      result.isDefaultEquipmentRow = input.checked;
    } else {
      result[field] = input.value.trim();
    }
  });
  return result;
}

async function saveSelectedSuspensionMethod() {
  try {
    const method = readSuspensionMethodForm();
    if (!method) return;
    const isNew = method.id.startsWith("tmp-");
    const payload = await apiFetch(isNew ? "/api/suspension-methods" : `/api/suspension-methods/${method.id}`, {
      method: isNew ? "POST" : "PUT",
      body: JSON.stringify(method),
    });
    const saved = mapSuspensionMethodFromApi(payload.method);
    state.suspensionMethods = state.suspensionMethods.filter((item) => item.id !== method.id && item.id !== saved.id);
    state.suspensionMethods.unshift(saved);
    state.selectedSuspensionMethodId = saved.id;
    renderSettings();
    showMessage("תיאור הציוד נשמר ב-DB בהצלחה", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function deleteSelectedCustomer() {
  const customerId = state.selectedCustomerDefaultId;
  if (!customerId) return;
  if (!confirmDelete("האם למחוק את הלקוח מה-DB?")) return;
  try {
    if (customerId.startsWith("tmp-")) {
      state.customers = state.customers.filter((item) => item.id !== customerId);
    } else {
      await apiFetch(`/api/customers/${customerId}`, { method: "DELETE" });
      state.customers = state.customers.filter((item) => item.id !== customerId);
    }
    state.selectedCustomerDefaultId = state.customers[0]?.id || "";
    if (state.selectedEquipmentCustomerId === customerId) {
      state.selectedEquipmentCustomerId = state.selectedCustomerDefaultId;
    }
    populateCustomerSelect();
    renderSettings();
    showMessage("הלקוח נמחק מה-DB", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function deleteSelectedEquipmentDefault() {
  const equipmentId = state.selectedEquipmentDefaultId;
  if (!equipmentId) return;
  if (!confirmDelete("האם למחוק את הציוד מה-DB?")) return;
  try {
    if (equipmentId.startsWith("tmp-")) {
      state.equipmentCatalog = state.equipmentCatalog.filter((item) => item.id !== equipmentId);
    } else {
      await apiFetch(`/api/equipment-catalog/${equipmentId}`, { method: "DELETE" });
      state.equipmentCatalog = state.equipmentCatalog.filter((item) => item.id !== equipmentId);
    }
    state.customerEquipmentDefaults = state.customerEquipmentDefaults.filter((item) => item.equipmentCatalogId !== equipmentId);
    state.selectedEquipmentDefaultId = equipmentForCustomer()[0]?.id || "";
    populateEquipmentTypes();
    renderSettings();
    showMessage("הציוד נמחק מה-DB", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function deleteSelectedSuspensionMethod() {
  const methodId = state.selectedSuspensionMethodId;
  if (!methodId) return;
  if (!confirmDelete("האם למחוק את תיאור הציוד מה-DB?")) return;
  try {
    if (methodId.startsWith("tmp-")) {
      state.suspensionMethods = state.suspensionMethods.filter((item) => item.id !== methodId);
    } else {
      await apiFetch(`/api/suspension-methods/${methodId}`, { method: "DELETE" });
      state.suspensionMethods = state.suspensionMethods.filter((item) => item.id !== methodId);
    }
    state.selectedSuspensionMethodId = state.suspensionMethods[0]?.id || "";
    renderSettings();
    showMessage("תיאור הציוד נמחק מה-DB", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function copyCustomerEquipmentToSelectedCustomer() {
  const targetCustomerId = state.selectedEquipmentCustomerId;
  const sourceCustomerId = copyEquipmentSourceCustomerSelect?.value || "";
  const sourceEquipmentId = copyEquipmentSourceEquipmentSelect?.value || "";
  if (!targetCustomerId || !sourceCustomerId || !sourceEquipmentId) {
    showMessage("בחר לקוח יעד, לקוח מקור וציוד להעתקה", "error");
    return;
  }
  if (targetCustomerId === sourceCustomerId) {
    showMessage("לקוח המקור ולקוח היעד זהים", "error");
    return;
  }

  const sourceEquipment = equipmentForReportCustomer(sourceCustomerId)
    .find((item) => (item.defaultId || item.id) === sourceEquipmentId);
  if (!sourceEquipment) {
    showMessage("לא נמצא ציוד להעתקה עבור לקוח המקור", "error");
    return;
  }

  try {
    const catalogPayload = await apiFetch("/api/equipment-catalog", {
      method: "POST",
      body: JSON.stringify({
        ...sourceEquipment,
        id: "",
        customerId: targetCustomerId,
        rows: normalizeEquipmentRows(sourceEquipment.rows || [], sourceEquipment),
      }),
    });
    const savedCatalogItem = mapEquipmentFromApi(catalogPayload.equipment);
    state.equipmentCatalog.unshift(savedCatalogItem);
    const equipmentCatalogId = savedCatalogItem.id;
    const payload = await apiFetch("/api/customer-equipment-defaults", {
      method: "POST",
      body: JSON.stringify({
        customerId: targetCustomerId,
        equipmentCatalogId,
        suspensionMethod: sourceEquipment.suspensionMethod || "",
        suspensionParams: sourceEquipment.suspensionParams || {},
        scaffoldNumber: sourceEquipment.scaffoldNumber || "",
        motorNumbers: sourceEquipment.motorNumbers || [],
        safeLoad: sourceEquipment.safeLoad || "",
        selfWeight: sourceEquipment.selfWeight || "",
        rows: normalizeEquipmentRows(sourceEquipment.rows || [], sourceEquipment),
      }),
    });
    const saved = mapCustomerEquipmentDefaultFromApi(payload.default);
    state.customerEquipmentDefaults = state.customerEquipmentDefaults
      .filter((item) => !(item.customerId === saved.customerId && item.equipmentCatalogId === saved.equipmentCatalogId));
    state.customerEquipmentDefaults.unshift(saved);
    state.selectedEquipmentDefaultId = equipmentCatalogId;
    populateEquipmentTypes();
    renderSettings();
    showMessage("הציוד הועתק ללקוח הנוכחי ונשמר ב-DB", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function statusClass(status) {
  if (status.includes("לא תקין") || status.includes("תיקון")) return "bad";
  if (status.includes("כפוף") || status.includes("הער")) return "warn";
  return "";
}

function reportSummary(report) {
  const equipmentText = report.equipment.map((item) => item.type).filter(Boolean).join(", ");
  return [
    `תסקיר ${report.reportNumber || "ללא מספר"}`,
    report.customerName ? `לקוח: ${report.customerName}` : "",
    report.inspectionDate ? `תאריך בדיקה: ${formatIsraeliDate(report.inspectionDate)}` : "",
    equipmentText ? `ציוד: ${equipmentText}` : "",
    `סטטוס: ${report.finalStatus || "טיוטה"}`,
  ].filter(Boolean).join("\n");
}

function renderPreviewEquipmentRows(report) {
  if (!report.equipment.length) {
    return '<tr><td colspan="5">לא נוסף ציוד לתסקיר.</td></tr>';
  }

  return report.equipment
    .map((item) => {
      const rows = normalizeEquipmentRows(item.rows, item);
      const safeLoad = item.safeLoad || firstRowValue(item.rows, "safeLoad") || "-";
      const testLoad = item.selfWeight || firstRowValue(item.rows, "testLoad") || "-";

      return rows.map((row, index) => `
        <tr>
          <td class="equipment-notes-cell">${escapeHtml(row.description || "-").replaceAll("\n", "<br>")}</td>
          <td class="yellow-cell">${escapeHtml(row.makerModel || "-").replaceAll("\n", "<br>")}</td>
          <td>${escapeHtml(row.serial || "-").replaceAll("\n", "<br>")}</td>
          ${index === 0 ? `<td rowspan="${rows.length}" class="load-rowspan-cell"><div class="load-rowspan-content">${escapeHtml(safeLoad)}</div></td>` : ""}
          ${index === 0 ? `<td rowspan="${rows.length}" class="load-rowspan-cell"><div class="load-rowspan-content">${escapeHtml(testLoad)}</div></td>` : ""}
        </tr>
      `).join("");
    })
    .join("");
}

function renderPreview(report = getReportData()) {
  const preview = byId("reportPreview");
  const legacyEquipmentRows = report.equipment.length
    ? report.equipment.map((item, index) => `
        <tr>
          <td class="equipment-notes-cell">
            <b>${index + 1}. ${escapeHtml(item.description || "הערות לציוד שנבדק")}</b>
            <span>הערות לציוד שנבדק ולמצב הציוד במועד הבדיקה.</span>
          </td>
          <td class="yellow-cell">${escapeHtml(item.manufacturer || "-")}</td>
          <td class="yellow-cell">${escapeHtml(item.model || "-")}</td>
          <td>${escapeHtml(item.serial || "-")}</td>
          <td>${escapeHtml(item.safeLoad || "-")}</td>
          <td>${escapeHtml(item.selfWeight || "-")}</td>
        </tr>
      `).join("")
    : '<tr><td colspan="6">לא נוסף ציוד לתסקיר.</td></tr>';

  const equipmentRows = renderPreviewEquipmentRows(report);

  preview.innerHTML = `
    <header class="report-header">
      <div class="report-logo-box">
        <img src="logo.png" alt="חד-אור הנדסה" />
      </div>
      <div class="report-title-box">
        <h1>${escapeHtml(report.reportTitle || "תסקיר בדיקה")}</h1>
        <div class="report-title-grid">
          <div class="report-law-note">
            <span class="law-main">פקודת הבטיחות בעבודה (נוסח חדש) תש"ל -1970 סעיפים: 75,76,81,86</span>
            <span class="law-sub">יש לשמור תסקיר זה לבדיקת מפקח עבודה</span>
          </div>
          <div>תאריך בדיקה: <b>${escapeHtml(formatIsraeliDate(report.inspectionDate))}</b></div>
          <div>תוקף התסקיר: <b>${escapeHtml(formatIsraeliDate(report.validUntil))}</b></div>
        </div>
      </div>
      <div class="report-meta-box">
        <div>מספר תסקיר<br><b>${escapeHtml(report.reportNumber || "-")}</b></div>
        <div>מספר תסקיר קודם<br><b>${escapeHtml(report.previousReportNumber || "-")}</b></div>
      </div>
    </header>

    <div class="report-band">פרטי לקוח ובודק</div>
    <table class="report-table">
      <tr>
        <th>הלקוח</th>
        <td>${escapeHtml(report.customerName || "-")}</td>
        <th>איש קשר</th>
        <td>${escapeHtml(report.contactName || "-")}</td>
      </tr>
      <tr>
        <th>טלפון</th>
        <td>${escapeHtml(report.contactPhone || "-")}</td>
        <th>אימייל</th>
        <td>${escapeHtml(report.contactEmail || "-")}</td>
      </tr>
      <tr>
        <th>מקום הבדיקה</th>
        <td colspan="3">${escapeHtml(report.siteAddress || "-")}</td>
      </tr>
      <tr>
        <th>שם הבודק</th>
        <td>${escapeHtml(report.inspectorName || "-")}</td>
        <th>מספר רישיון</th>
        <td>${escapeHtml(report.inspectorLicense || "31580")}</td>
      </tr>
    </table>

    <div class="report-band">פרטי ציוד</div>
    <table class="report-table equipment-report-table">
      <thead>
        <tr>
          <th>הערות לציוד שנבדק</th>
          <th>יצרן ודגם</th>
          <th>מס"ד / מס' פריט</th>
          <th>עומס עבודה בטוח</th>
          <th>עומס מבחן</th>
        </tr>
      </thead>
      <tbody>${equipmentRows}</tbody>
    </table>

    <table class="report-table">
      <tr>
        <th>סיכום</th>
        <td><span class="status-pill ${statusClass(report.finalStatus)}">${escapeHtml(report.finalStatus || "טיוטה")}</span></td>
      </tr>
      <tr>
        <th>ליקויים והערות</th>
        <td>${escapeHtml(report.findings || "אין")}</td>
      </tr>
      <tr>
        <th>הערות כלליות</th>
        <td>${escapeHtml(report.generalNotes || "אין")}</td>
      </tr>
    </table>

    <footer class="report-footer">
      <div class="fixed-notes">
        <b>הערות:</b>
        <ol class="fixed-notes-list">
          <li>התיקון התסקיר להתקנה זו בלבד, לאחר העתקה יש להזמין בודק לבדיקה נוספת.</li>
          <li>השימוש בפיגום יבוצע ע"י עובדים המוסמכים בהתאם לתקנות עבודה בגובה התשס"ז - 2007, אשר קיבלו הדרכה להפעלת הפיגום.</li>
          <li>ליקויים שלא צוין תאריך יש לתקן תוך 45 ימים, ללא הליקויים במועד שצוין התסקיר אינו בתוקף.</li>
          <li>אין להשתמש בפיגום ברוחות מעל 35 קמ"ש, אין להשתמש בפיגום במקביל לפיגומים הקרובים יותר מ-1 מ' לקצוות הפיגום.</li>
          <li>מועד הבדיקה הבאה הנקוב אינו תקף במידה וחל קלקול במתקן או שבוצע בו שינוי, במקרה זה יש לזמן בודק לבדיקה חוזרת, טרם החזרתו לשימוש.</li>
          <li>הכלי כשיר לשימוש לאחר תיקון הליקויים, בהתאם להנחיות ואישור קונסטרוקטור.</li>
        </ol>
      </div>
      <p class="inspector-declaration">
        אני דרור חזן שהוסמכתי ע"י המפע"ר לערוך בדיקות וניסויים לפי סעיפים 75, 76, 81 ו-86 לפקודת הבטיחות בעבודה (נוסח חדש) תש"ל-1970,
        מצהיר כי בדקתי את הציוד המתואר בתסקיר זה והבדיקות והמסקנות הרשומות בתסקיר הן נכונות, למיטב ידיעותיי, להבטחת פעולה בטוחה שלו.
      </p>
      <div class="fixed-contact-row">
        <span><b>כתובתי:</b> אורי אלמוג 9 חולון</span>
        <span><b>טל':</b> 050-3808037</span>
        <span><b>דוא"ל:</b> drorhzn@hador-eng.com</span>
        <span><b>תאריך עריכת המסמך:</b> ${escapeHtml(formatIsraeliDate(report.documentDate || report.inspectionDate))}</span>
        <span class="signature-cell"><b>חתימה:</b><img src="inspector_signature.PNG" alt="חתימת דרור חזן" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" /><em>________________</em></span>
      </div>
    </footer>
  `;
}

function renderArchive() {
  const query = byId("archiveSearch").value.trim().toLowerCase();
  const reports = state.reports.filter((report) => archiveSearchText(report).includes(query));

  if (!reports.length) {
    archiveList.innerHTML = '<div class="empty-state">לא נמצאו תסקירים בארכיון.</div>';
    return;
  }

  archiveList.innerHTML = reports.map((report) => `
    <article class="archive-item">
      <div>
        <h3>${escapeHtml(report.reportNumber || "תסקיר ללא מספר")} - ${escapeHtml(report.customerName || "ללא לקוח")}</h3>
        <p>${escapeHtml(formatIsraeliDate(report.inspectionDate))} | ${escapeHtml(report.finalStatus || "טיוטה")} | ${escapeHtml((report.equipment || []).map((item) => item.type).join(", ") || "ללא ציוד")}</p>
      </div>
      <div class="archive-actions">
        <button class="secondary small" type="button" data-load-report="${report.id}">צפה</button>
        <button class="remove" type="button" data-delete-report="${report.id}" aria-label="מחק">X</button>
      </div>
    </article>
  `).join("");
}

function archiveSearchText(report) {
  return [
    report.reportNumber,
    report.previousReportNumber,
    ...(report.equipment || []).flatMap((item) => [
      item.scaffoldNumber,
      ...(item.motorNumbers || []),
      ...(item.rows || []).map((row) => row.serial),
    ]),
  ].flat().filter(Boolean).join(" ").toLowerCase();
}

async function downloadReportForExport(report = getReportData()) {
  renderPreview(report);
  await waitForPreviewAssets();
  const previousTitle = document.title;
  document.title = `תסקיר ${report.reportNumber || ""} ${report.customerName || ""}`.trim() || "תסקיר";
  try {
    await printReportInSinglePageFrame();
  } finally {
    document.title = previousTitle;
  }
}

async function waitForPreviewAssets() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const preview = byId("reportPreview");
  const images = [...(preview?.querySelectorAll("img") || [])];
  await Promise.all(images.map((image) => {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    if (typeof image.decode === "function") {
      return image.decode().catch(() => {});
    }
    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  }));
}

async function printReportInSinglePageFrame() {
  const preview = byId("reportPreview");
  if (!preview) return;

  const frame = document.createElement("iframe");
  frame.title = "print-report";
  frame.style.position = "fixed";
  frame.style.inset = "0";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const stylesHref = new URL("styles.css", window.location.href).href;
  const baseHref = new URL("./", window.location.href).href;
  const clonedReport = preview.cloneNode(true);

  doc.open();
  doc.write(`<!doctype html>
    <html lang="he" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <base href="${baseHref}" />
        <link rel="stylesheet" href="${stylesHref}" />
        <style>
          @page { size: A4 portrait; margin: 0; }
          html, body {
            width: 210mm;
            height: 297mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-sheet {
            position: relative;
            width: 210mm;
            height: 297mm;
            overflow: hidden;
            background: #fff;
          }
          .print-content {
            position: absolute;
            top: 0;
            right: 0;
            transform-origin: top right;
          }
          .print-content .report-paper {
            width: 210mm !important;
            max-width: none !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
          }
        </style>
      </head>
      <body>
        <div class="print-sheet"><div class="print-content"></div></div>
      </body>
    </html>`);
  doc.close();

  const content = doc.querySelector(".print-content");
  content.appendChild(clonedReport);
  await waitForFrameAssets(frame);

  const sheet = doc.querySelector(".print-sheet");
  const report = doc.querySelector(".report-paper");
  const sheetRect = sheet.getBoundingClientRect();
  const reportRect = report.getBoundingClientRect();
  const scale = Math.min(
    1,
    (sheetRect.width / Math.max(reportRect.width, 1)) * 0.995,
    (sheetRect.height / Math.max(report.scrollHeight, 1)) * 0.995
  );
  content.style.transform = `scale(${scale})`;

  await new Promise((resolve) => setTimeout(resolve, 100));
  frame.contentWindow.focus();
  frame.contentWindow.print();
  const removeFrame = () => frame.remove();
  frame.contentWindow.addEventListener("afterprint", removeFrame, { once: true });
  setTimeout(removeFrame, 15000);
}

async function waitForFrameAssets(frame) {
  const doc = frame.contentDocument;
  await new Promise((resolve) => {
    if (doc.readyState === "complete") resolve();
    else frame.addEventListener("load", resolve, { once: true });
  });
  const images = [...doc.querySelectorAll("img")];
  await Promise.all(images.map((image) => {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    if (typeof image.decode === "function") return image.decode().catch(() => {});
    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  }));
  await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(() => frame.contentWindow.requestAnimationFrame(resolve)));
}
function updateStats() {
  byId("statReports").textContent = state.reports.length;
  byId("statEquipment").textContent = collectEquipment().length;
  byId("statStatus").textContent = formValue("finalStatus") || "טיוטה";
}

function confirmDelete(message) {
  return window.confirm(message);
}

screenButtons.forEach((button) => button.addEventListener("click", () => showScreen(button.dataset.screen)));
byId("addEquipmentBtn").addEventListener("click", addEquipment);
byId("applyCustomerBtn").addEventListener("click", applyCustomerDefaults);
customerSelect.addEventListener("change", applyCustomerDefaults);
byId("saveReportBtn").addEventListener("click", saveReport);
byId("newReportBtn").addEventListener("click", resetDraft);
prevEditorStepBtn.addEventListener("click", goToPreviousEditorStep);
nextEditorStepBtn.addEventListener("click", goToNextEditorStep);
editorStepButtons.forEach((button) => {
  button.addEventListener("click", () => showEditorStep(button.dataset.editorStepButton));
});
byId("addEquipmentDefaultBtn").addEventListener("click", addEquipmentDefault);
byId("addCustomerDefaultBtn").addEventListener("click", addCustomerDefault);
byId("addSuspensionMethodBtn")?.addEventListener("click", addSuspensionMethod);
byId("deleteCustomerDefaultBtn")?.addEventListener("click", deleteSelectedCustomer);
byId("deleteEquipmentDefaultBtn")?.addEventListener("click", deleteSelectedEquipmentDefault);
byId("deleteSuspensionMethodBtn")?.addEventListener("click", deleteSelectedSuspensionMethod);
byId("openCopyEquipmentBtn")?.addEventListener("click", () => {
  copyEquipmentPanel?.classList.toggle("is-hidden");
});
byId("copyCustomerEquipmentBtn")?.addEventListener("click", copyCustomerEquipmentToSelectedCustomer);
byId("saveEquipmentDefaultBtn").addEventListener("click", saveSelectedEquipmentDefault);
byId("saveCustomerDefaultBtn").addEventListener("click", saveSelectedCustomer);
byId("saveSuspensionMethodBtn")?.addEventListener("click", saveSelectedSuspensionMethod);
manageCustomerSelect.addEventListener("change", () => {
  state.selectedCustomerDefaultId = manageCustomerSelect.value;
  renderCustomerDefaults();
});
manageEquipmentSelect.addEventListener("change", () => {
  state.selectedEquipmentDefaultId = manageEquipmentSelect.value;
  renderEquipmentDefaults();
});
  equipmentCustomerSelect?.addEventListener("change", () => {
  state.selectedEquipmentCustomerId = equipmentCustomerSelect.value;
  state.selectedEquipmentDefaultId = equipmentForCustomer()[0]?.defaultId || equipmentForCustomer()[0]?.id || "";
  renderSettings();
});
copyEquipmentSourceCustomerSelect?.addEventListener("change", renderCopyEquipmentOptions);
manageSuspensionSelect?.addEventListener("change", () => {
  state.selectedSuspensionMethodId = manageSuspensionSelect.value;
  renderSuspensionMethods();
});
byId("printBtn").addEventListener("click", () => {
  downloadReportForExport();
});
byId("archiveSearch").addEventListener("input", renderArchive);
byId("clearArchiveSearch").addEventListener("click", () => {
  byId("archiveSearch").value = "";
  renderArchive();
});

equipmentList.addEventListener("input", () => {
  state.equipment = collectEquipment();
  updateStats();
});

equipmentList.addEventListener("change", (event) => {
  if (
    ["suspensionMethod", "motorNumbersText"].includes(event.target.dataset.field)
    || ["kind", "descriptionChoice"].includes(event.target.dataset.rowField)
    || event.target.dataset.paramField
    || event.target.dataset.platformParamField
    || event.target.dataset.rowParamField
  ) {
    state.equipment = collectEquipment().map((item) => {
      const changedCard = event.target.closest(".equipment-card");
      return changedCard?.dataset.id === item.id ? { ...item, rows: item.rows.map(buildConfiguredRow) } : item;
    });
    renderEquipment();
  }
  updateStats();
});

equipmentDefaultsList.addEventListener("change", (event) => {
  if (
    ["suspensionMethod", "motorNumbersText"].includes(event.target.dataset.equipmentDefaultField)
    || ["kind", "descriptionChoice"].includes(event.target.dataset.defaultRowField)
    || event.target.dataset.paramField
    || event.target.dataset.platformParamField
    || event.target.dataset.rowParamField
  ) {
    const equipment = readEquipmentDefaultForm();
    if (equipment) {
      updateEquipmentEditorState({ ...equipment, rows: equipment.rows.map(buildConfiguredRow) });
      renderEquipmentDefaults();
    }
  }
});

document.addEventListener("input", (event) => {
  if (event.target.classList?.contains("auto-size-textarea")) {
    resizeAutoTextareas(event.target.closest(".default-card") || document);
  }
  if (event.target.closest("#reportForm")) {
    updateStats();
  }
});

document.addEventListener("click", async (event) => {
  const settingsTab = event.target.dataset.settingsTab;
  const equipmentId = event.target.dataset.removeEquipment;
  const loadId = event.target.dataset.loadReport;
  const deleteId = event.target.dataset.deleteReport;
  const equipmentDefaultId = event.target.dataset.removeEquipmentDefault;
  const customerDefaultId = event.target.dataset.removeCustomerDefault;
  const suspensionMethodId = event.target.dataset.removeSuspensionMethod;
  const addDescriptionBlock = event.target.dataset.addDescriptionBlock !== undefined;
  const addDefaultDescriptionBlock = event.target.dataset.addDefaultDescriptionBlock !== undefined;
  const addEquipmentRowId = event.target.dataset.addEquipmentRow;
  const addDefaultEquipmentRowId = event.target.dataset.addDefaultEquipmentRow;
  const removeEquipmentRowId = event.target.dataset.removeEquipmentRow;
  const moveEquipmentRowId = event.target.dataset.moveEquipmentRow;
  const moveDirection = event.target.dataset.direction;

  if (settingsTab) {
    state.activeSettingsPanel = settingsTab;
    renderSettings();
  }

  if (equipmentId) {
    if (!confirmDelete("האם למחוק את הציוד מהתסקיר הנוכחי?")) return;
    state.equipment = collectEquipment().filter((item) => item.id !== equipmentId);
    renderEquipment();
    updateStats();
  }

  if (addEquipmentRowId) {
    state.equipment = collectEquipment().map((item) => item.id === addEquipmentRowId
      ? { ...item, rows: [...(item.rows || []), emptyEquipmentRow()] }
      : item);
    renderEquipment();
  }

  if (addDefaultEquipmentRowId) {
    const equipment = readEquipmentDefaultForm();
    if (equipment) {
      updateEquipmentEditorState({ ...equipment, rows: [...(equipment.rows || []), emptyEquipmentRow()] });
      renderEquipmentDefaults();
    }
  }

  if (removeEquipmentRowId) {
    if (!confirmDelete("האם למחוק את שורת הציוד הזו?")) return;
    const card = event.target.closest(".equipment-card");
    if (card) {
      state.equipment = collectEquipment().map((item) => item.id === card.dataset.id
        ? { ...item, rows: item.rows.filter((row) => row.id !== removeEquipmentRowId) }
        : item);
      renderEquipment();
    } else {
      const equipment = readEquipmentDefaultForm();
      if (equipment) {
        updateEquipmentEditorState({ ...equipment, rows: equipment.rows.filter((row) => row.id !== removeEquipmentRowId) });
        renderEquipmentDefaults();
      }
    }
  }

  if (moveEquipmentRowId) {
    const card = event.target.closest(".equipment-card");
    const moveRow = (rows) => {
      const nextRows = [...rows];
      const index = nextRows.findIndex((row) => row.id === moveEquipmentRowId);
      if (index === -1) return nextRows;
      const targetIndex = moveDirection === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= nextRows.length) return nextRows;
      [nextRows[index], nextRows[targetIndex]] = [nextRows[targetIndex], nextRows[index]];
      return nextRows;
    };

    if (card) {
      state.equipment = collectEquipment().map((item) => item.id === card.dataset.id
        ? { ...item, rows: moveRow(item.rows || []) }
        : item);
      renderEquipment();
    } else {
      const equipment = readEquipmentDefaultForm();
      if (equipment) {
        updateEquipmentEditorState({ ...equipment, rows: moveRow(equipment.rows || []) });
        renderEquipmentDefaults();
      }
    }
  }

  if (addDescriptionBlock || addDefaultDescriptionBlock) {
    const card = event.target.closest(".equipment-card, .default-card");
    const textarea = card?.querySelector('[data-field="description"], [data-equipment-default-field="description"]');
    if (textarea) {
      textarea.value = `${textarea.value.trim()}\n\nתיאור ציוד נוסף:\n`.trimStart();
      textarea.focus();
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  if (loadId) {
    const report = state.reports.find((item) => item.id === loadId);
    if (report) loadReport(report);
  }

  if (deleteId) {
    if (!confirmDelete("האם למחוק את התסקיר לצמיתות מהמערכת?")) return;
    try {
      await apiFetch(`/api/reports/${deleteId}`, { method: "DELETE" });
      state.reports = state.reports.filter((item) => item.id !== deleteId);
      renderArchive();
      updateStats();
      showMessage("התסקיר נמחק מהארכיון", "success");
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  if (equipmentDefaultId) {
    if (!confirmDelete("האם למחוק את הציוד מהמערכת? פעולה זו תמחק אותו מה-DB.")) return;
    if (equipmentDefaultId.startsWith("tmp-")) {
      state.equipmentCatalog = state.equipmentCatalog.filter((item) => item.id !== equipmentDefaultId);
    } else {
      await apiFetch(`/api/equipment-catalog/${equipmentDefaultId}`, { method: "DELETE" });
      state.equipmentCatalog = state.equipmentCatalog.filter((item) => item.id !== equipmentDefaultId);
    }
    state.selectedEquipmentDefaultId = equipmentForCustomer()[0]?.id || "";
    populateEquipmentTypes();
    renderSettings();
    showMessage("הציוד נמחק מהמערכת", "success");
  }

  if (customerDefaultId) {
    if (!confirmDelete("האם למחוק את הלקוח מהמערכת? פעולה זו תמחק אותו מה-DB.")) return;
    if (customerDefaultId.startsWith("tmp-")) {
      state.customers = state.customers.filter((item) => item.id !== customerDefaultId);
    } else {
      await apiFetch(`/api/customers/${customerDefaultId}`, { method: "DELETE" });
      state.customers = state.customers.filter((item) => item.id !== customerDefaultId);
    }
    state.selectedCustomerDefaultId = state.customers[0]?.id || "";
    if (state.selectedEquipmentCustomerId === customerDefaultId) {
      state.selectedEquipmentCustomerId = state.selectedCustomerDefaultId;
    }
    populateCustomerSelect();
    renderSettings();
    showMessage("הלקוח נמחק מהמערכת", "success");
  }

  if (suspensionMethodId) {
    if (!confirmDelete("האם למחוק את תיאור הציוד מה-DB?")) return;
    if (suspensionMethodId.startsWith("tmp-")) {
      state.suspensionMethods = state.suspensionMethods.filter((item) => item.id !== suspensionMethodId);
    } else {
      await apiFetch(`/api/suspension-methods/${suspensionMethodId}`, { method: "DELETE" });
      state.suspensionMethods = state.suspensionMethods.filter((item) => item.id !== suspensionMethodId);
    }
    state.selectedSuspensionMethodId = state.suspensionMethods[0]?.id || "";
    renderSettings();
    showMessage("תיאור הציוד נמחק מה-DB", "success");
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    showAuthMessage("מתחבר...");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: loginEmail.value.trim(),
        password: loginPassword.value,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "התחברות נכשלה");

    state.session = payload.session;
    state.currentUser = payload.user;
    showAuthMessage("");
    showApp();
    await loadInitialData();
  } catch (error) {
    showAuthMessage(error.message, "error");
  }
});

byId("logoutBtn").addEventListener("click", async () => {
  try {
    if (state.session?.access_token) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${state.session.access_token}` },
      });
    }
  } catch {
    // Logout should still clear local UI state.
  }
  state.session = null;
  state.currentUser = null;
  state.customers = [];
  state.equipmentCatalog = [];
  state.customerEquipmentDefaults = [];
  state.reports = [];
  showLogin();
});

initAuth();
