const { createClient } = require("@supabase/supabase-js");
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY,
} = require("../config/env");

// Singleton pattern — prevents multiple Supabase instances during hot-reload in dev
const globalForSupabase = globalThis;

const getSupabase = () => {
  if (!globalForSupabase.__supabase) {
    globalForSupabase.__supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
    );
  }
  return globalForSupabase.__supabase;
};

module.exports = { getSupabase };
