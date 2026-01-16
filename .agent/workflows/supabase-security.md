---
description: Run Supabase security scan using SupaRalph
---

# Supabase Security Scan

Quick local security checks for your Supabase project. No browser needed.

// turbo-all

## Quick Security Check (curl-based)

1. Test if anon can read vesail_trades (should fail):
   ```bash
   curl -s "https://lsxwplaqqjeopiawjcgj.supabase.co/rest/v1/vesail_trades?limit=1" -H "apikey: $SUPABASE_ANON_KEY"
   ```
   ✅ Should return error or empty. If returns data = VULNERABLE!

2. Apply security hardening (run in Supabase SQL Editor):
   ```bash
   cat /Users/akshaygupta/Documents/Dev/Full\ Sail\ Yield\ Calculator/supabase/migrations/002_security_hardening.sql
   ```

## Apply Security SQL

Copy and run this in **Supabase SQL Editor**:

```sql
ALTER TABLE vesail_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE vesail_trades FORCE ROW LEVEL SECURITY;
REVOKE ALL ON vesail_trades FROM anon;
REVOKE ALL ON vesail_trades FROM authenticated;
CREATE POLICY "Service role read" ON vesail_trades FOR SELECT TO service_role USING (true);
CREATE POLICY "Service role insert" ON vesail_trades FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role update" ON vesail_trades FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role delete" ON vesail_trades FOR DELETE TO service_role USING (true);
```

## Verify Security

Run in Supabase SQL Editor:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'vesail_trades';
```
✅ Should show `rowsecurity = true`
