-- すくすくコンシェルジュ policy/index tuning v0.2

create index if not exists idx_families_created_by on public.families(created_by);
create index if not exists idx_family_members_user_id on public.family_members(user_id);
create index if not exists idx_children_family_id on public.children(family_id);
create index if not exists idx_consultations_family_id on public.consultations(family_id);
create index if not exists idx_consultations_child_id on public.consultations(child_id);
create index if not exists idx_consultations_user_id on public.consultations(user_id);
create index if not exists idx_suggestions_consultation_id on public.suggestions(consultation_id);
create index if not exists idx_activity_logs_family_id on public.activity_logs(family_id);
create index if not exists idx_activity_logs_child_id on public.activity_logs(child_id);
create index if not exists idx_activity_logs_suggestion_id on public.activity_logs(suggestion_id);
create index if not exists idx_activity_logs_user_id on public.activity_logs(user_id);
create index if not exists idx_weekly_plans_family_id on public.weekly_plans(family_id);
create index if not exists idx_weekly_plans_created_by on public.weekly_plans(created_by);
create index if not exists idx_invitations_family_id on public.invitations(family_id);
create index if not exists invitations_token_status_idx on public.invitations(token, status, expires_at);
create index if not exists invitations_email_status_idx on public.invitations(lower(email), status, expires_at);
create index if not exists idx_ai_usage_logs_family_id on public.ai_usage_logs(family_id);
create index if not exists idx_ai_usage_logs_user_id on public.ai_usage_logs(user_id);

drop policy if exists "family_members_insert_invited_self" on public.family_members;
create policy "family_members_insert_invited_self" on public.family_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.invitations i
      where i.family_id = family_members.family_id
        and lower(i.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
        and i.role = family_members.role
        and i.relation = family_members.relation
        and i.status in ('pending', 'accepted')
        and i.expires_at > now()
    )
  );

drop policy if exists "children_write_parent" on public.children;
create policy "children_insert_parent" on public.children
  for insert to authenticated
  with check (private.is_family_parent(family_id));
create policy "children_update_parent" on public.children
  for update to authenticated
  using (private.is_family_parent(family_id))
  with check (private.is_family_parent(family_id));
create policy "children_delete_parent" on public.children
  for delete to authenticated
  using (private.is_family_parent(family_id));

drop policy if exists "child_profiles_write_parent" on public.child_profiles;
create policy "child_profiles_insert_parent" on public.child_profiles
  for insert to authenticated
  with check (
    exists (
      select 1 from public.children c
      where c.id = child_profiles.child_id
        and private.is_family_parent(c.family_id)
    )
  );
create policy "child_profiles_update_parent" on public.child_profiles
  for update to authenticated
  using (
    exists (
      select 1 from public.children c
      where c.id = child_profiles.child_id
        and private.is_family_parent(c.family_id)
    )
  )
  with check (
    exists (
      select 1 from public.children c
      where c.id = child_profiles.child_id
        and private.is_family_parent(c.family_id)
    )
  );
create policy "child_profiles_delete_parent" on public.child_profiles
  for delete to authenticated
  using (
    exists (
      select 1 from public.children c
      where c.id = child_profiles.child_id
        and private.is_family_parent(c.family_id)
    )
  );

drop policy if exists "consultations_write_parent" on public.consultations;
create policy "consultations_insert_parent" on public.consultations
  for insert to authenticated
  with check (private.is_family_parent(family_id));
create policy "consultations_update_parent" on public.consultations
  for update to authenticated
  using (private.is_family_parent(family_id))
  with check (private.is_family_parent(family_id));
create policy "consultations_delete_parent" on public.consultations
  for delete to authenticated
  using (private.is_family_parent(family_id));

drop policy if exists "suggestions_write_by_consultation_parent" on public.suggestions;
create policy "suggestions_insert_by_consultation_parent" on public.suggestions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.consultations c
      where c.id = suggestions.consultation_id
        and private.is_family_parent(c.family_id)
    )
  );
create policy "suggestions_update_by_consultation_parent" on public.suggestions
  for update to authenticated
  using (
    exists (
      select 1 from public.consultations c
      where c.id = suggestions.consultation_id
        and private.is_family_parent(c.family_id)
    )
  )
  with check (
    exists (
      select 1 from public.consultations c
      where c.id = suggestions.consultation_id
        and private.is_family_parent(c.family_id)
    )
  );
create policy "suggestions_delete_by_consultation_parent" on public.suggestions
  for delete to authenticated
  using (
    exists (
      select 1 from public.consultations c
      where c.id = suggestions.consultation_id
        and private.is_family_parent(c.family_id)
    )
  );

drop policy if exists "activity_logs_write_parent" on public.activity_logs;
create policy "activity_logs_insert_parent" on public.activity_logs
  for insert to authenticated
  with check (private.is_family_parent(family_id));
create policy "activity_logs_update_parent" on public.activity_logs
  for update to authenticated
  using (private.is_family_parent(family_id))
  with check (private.is_family_parent(family_id));
create policy "activity_logs_delete_parent" on public.activity_logs
  for delete to authenticated
  using (private.is_family_parent(family_id));

drop policy if exists "weekly_plans_write_parent" on public.weekly_plans;
create policy "weekly_plans_insert_parent" on public.weekly_plans
  for insert to authenticated
  with check (private.is_family_parent(family_id));
create policy "weekly_plans_update_parent" on public.weekly_plans
  for update to authenticated
  using (private.is_family_parent(family_id))
  with check (private.is_family_parent(family_id));
create policy "weekly_plans_delete_parent" on public.weekly_plans
  for delete to authenticated
  using (private.is_family_parent(family_id));

drop policy if exists "invitations_write_parent" on public.invitations;
drop policy if exists "invitations_select_invitee" on public.invitations;
drop policy if exists "invitations_update_invitee" on public.invitations;
create policy "invitations_insert_parent" on public.invitations
  for insert to authenticated
  with check (private.is_family_parent(family_id));
create policy "invitations_select_invitee" on public.invitations
  for select to authenticated
  using (
    status = 'pending'
    and expires_at > now()
    and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
create policy "invitations_update_parent" on public.invitations
  for update to authenticated
  using (private.is_family_parent(family_id))
  with check (private.is_family_parent(family_id));
create policy "invitations_update_invitee" on public.invitations
  for update to authenticated
  using (
    status = 'pending'
    and expires_at > now()
    and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
  with check (
    status = 'accepted'
    and accepted_by = (select auth.uid())
    and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
create policy "invitations_delete_parent" on public.invitations
  for delete to authenticated
  using (private.is_family_parent(family_id));
