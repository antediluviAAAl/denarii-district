import { createClient } from "@supabase/supabase-js";

// Now we read from the environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Safety check to warn you if keys are missing
if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "Supabase credentials missing! Make sure you have a .env file locally or Environment Variables set on Vercel."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);