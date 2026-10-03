-- Allow the invoker RPC to resolve its private authorization helper.
-- All existing private routines remain revoked for authenticated.
grant usage on schema private to authenticated;
