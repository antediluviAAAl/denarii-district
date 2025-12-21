import { createClient } from "@supabase/supabase-js";

// Ideally, put these in a .env file: REACT_APP_SUPABASE_URL, etc.
const supabaseUrl = "https://zdgswijfzycmriwbvhah.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkZ3N3aWpmenljbXJpd2J2aGFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjY3ODgsImV4cCI6MjA3OTUwMjc4OH0.RP5MEmPvT4xCM-nt-WQAgVY72l-FWLUCTHqsA2hXhG0";

export const supabase = createClient(supabaseUrl, supabaseKey);
