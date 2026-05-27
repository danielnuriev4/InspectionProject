import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export function createAuthClient() {
  return createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createDbClient(accessToken) {
  const key = config.supabaseServiceRoleKey || config.supabasePublishableKey;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

  return createClient(config.supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers,
    },
  });
}
