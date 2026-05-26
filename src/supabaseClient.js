import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key);

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.warn(
    "Missing REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY. Did you restart npm after editing .env?"
  );
}