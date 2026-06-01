import { createAuthClient, createDbClient } from "../supabase.js";

const MAX_JWT_CLOCK_SKEW_WAIT_MS = 15000;
const JWT_CLOCK_SKEW_BUFFER_MS = 1500;

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      return res.status(401).json({ error: "Missing access token" });
    }

    await waitForIssuedToken(token);

    const supabase = createAuthClient();
    let { data, error } = await supabase.auth.getUser(token);

    if (isJwtClockSkewError(error)) {
      await waitForIssuedToken(token);
      ({ data, error } = await supabase.auth.getUser(token));
    }

    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    req.accessToken = token;
    req.user = data.user;
    req.db = createDbClient(token);
    return next();
  } catch (error) {
    return next(error);
  }
}

async function waitForIssuedToken(token) {
  const payload = decodeJwtPayload(token);
  const issuedAtSeconds = Number(payload?.iat);
  if (!Number.isFinite(issuedAtSeconds)) return;

  const waitMs = (issuedAtSeconds * 1000) - Date.now() + JWT_CLOCK_SKEW_BUFFER_MS;
  if (waitMs <= 0) return;

  await delay(Math.min(waitMs, MAX_JWT_CLOCK_SKEW_WAIT_MS));
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function isJwtClockSkewError(error) {
  const message = String(error?.message || error?.error_description || error || "");
  return /jwt/i.test(message) && /(future|issued|iat|nbf)/i.test(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
