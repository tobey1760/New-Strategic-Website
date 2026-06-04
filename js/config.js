/* ──────────────────────────────────────────────────────────────
   Supabase connection config for the public website.

   The anon / publishable key is SAFE to ship in browser code — it is
   designed to be public. Access is gated server-side by Row Level
   Security (RLS). Make sure the "public read live posts" policy is
   applied in Supabase (see README / setup notes) so anon visitors can
   read ONLY live posts (status IN ('approved','catalog')).

   NEVER put the service_role / secret key in this file.
   ────────────────────────────────────────────────────────────── */
window.SUPABASE_CONFIG = {
  url: 'https://mgigkbqedmiekkbxzlzm.supabase.co',
  anonKey: 'sb_publishable_gl5YwPOFUoG8uVCIiqwh3w_Pe7IuF3j',
  table: 'blogs',
};
