-- Team members can edit their own display name, and nothing else on their row
create policy members_update_self on public.members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.members from authenticated, anon;
grant update (full_name) on public.members to authenticated;
