-- Trigger/internal functions are never called via the API. RLS helpers (has_permission, current_org_id, my_permissions) stay granted to authenticated.
revoke execute on function public.audit_row_change, public.guard_profile_update, public.guard_role_change, public.handle_new_user, public.set_updated_at, public.is_super_admin from public, anon, authenticated;
