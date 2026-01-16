-- ============================================
-- SECURITY HARDENING FOR vesail_trades TABLE
-- Based on SupaRalph security patterns
-- ============================================

-- 1. Enable Row Level Security (RLS)
-- This prevents anonymous users from accessing the table directly
ALTER TABLE vesail_trades ENABLE ROW LEVEL SECURITY;

-- 2. Force RLS for table owners (prevents bypass via SECURITY DEFINER)
ALTER TABLE vesail_trades FORCE ROW LEVEL SECURITY;

-- 3. Revoke ALL privileges from anonymous role
-- The anon key should NOT have any access to this table
REVOKE ALL ON vesail_trades FROM anon;

-- 4. Revoke by default from authenticated users too
-- (we only want service_role to access this table)
REVOKE ALL ON vesail_trades FROM authenticated;

-- 5. Create policy: Only service_role can SELECT
-- This means only server-side code (with service key) can read trades
CREATE POLICY "Service role can read all trades"
ON vesail_trades
FOR SELECT
TO service_role
USING (true);

-- 6. Create policy: Only service_role can INSERT
CREATE POLICY "Service role can insert trades"
ON vesail_trades
FOR INSERT
TO service_role
WITH CHECK (true);

-- 7. Create policy: Only service_role can UPDATE
CREATE POLICY "Service role can update trades"
ON vesail_trades
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- 8. Create policy: Only service_role can DELETE (if needed)
CREATE POLICY "Service role can delete trades"
ON vesail_trades
FOR DELETE
TO service_role
USING (true);

-- ============================================
-- VERIFICATION QUERIES
-- Run these to verify security is configured
-- ============================================

-- Check RLS is enabled
SELECT tablename, rowsecurity, forcerowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'vesail_trades';
-- Expected: rowsecurity = true, forcerowsecurity = true

-- Check policies exist
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'vesail_trades';
-- Expected: 4 policies for service_role only

-- Check privileges
SELECT grantee, privilege_type 
FROM information_schema.table_privileges 
WHERE table_name = 'vesail_trades' AND table_schema = 'public';
-- Expected: No grants to anon or authenticated
