import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4174),
  supabaseUrl:
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://pwodjvlmotdmlizxxiut.supabase.co",
  supabasePublishableKey:
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_x0zofeHxBQI4MdeK8HDq6Q_9JWY62tg",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};
