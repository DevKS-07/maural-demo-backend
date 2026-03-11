// Set required env vars so config/env.js doesn't call process.exit(1) during tests
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://test.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
process.env.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || "test-clerk-secret";
process.env.NODE_ENV = process.env.NODE_ENV || "test";
