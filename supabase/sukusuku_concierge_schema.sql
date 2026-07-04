-- 縺吶￥縺吶￥繧ｳ繝ｳ繧ｷ繧ｧ繝ｫ繧ｸ繝･ schema v0.1
-- Apply after reviewing the target Supabase project.

create extension if not exists "pgcrypto";

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('parent', 'viewer')),
  relation text not null check (relation in ('papa', 'mama', 'grandparent', 'sibling', 'relative', 'other')),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  birth_date date not null,
  gender text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  likes text,
  dislikes text,
  strengths text,
  concerns text,
  development_notes text,
  parent_goals text,
  family_policy text,
  lifestyle_notes text,
  updated_at timestamptz not null default now(),
  unique (child_id)
);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  consultation_type text not null,
  duration_type text not null,
  categories text[] not null default '{}',
  advisor_tone text not null,
  user_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  title text not null,
  suggestion_type text not null check (suggestion_type in ('quick', 'creative', 'deep')),
  aim text,
  materials text,
  steps jsonb not null default '[]'::jsonb,
  phrases jsonb not null default '[]'::jsonb,
  skills text[] not null default '{}',
  fallback text,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  suggestion_id uuid references public.suggestions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  did_try boolean not null default true,
  reaction text not null check (reaction in ('good', 'okay', 'bad', 'skipped')),
  child_reaction_note text,
  parent_note text,
  want_repeat boolean not null default false,
  logged_at timestamptz not null default now()
);

create table if not exists public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  week_start date not null,
  plan_json jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (child_id, week_start)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  email text not null,
  role text not null check (role in ('parent', 'viewer')),
  relation text not null check (relation in ('papa', 'mama', 'grandparent', 'sibling', 'relative', 'other')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  model text not null,
  feature text not null,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric,
  created_at timestamptz not null default now()
);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;
alter table public.child_profiles enable row level security;
alter table public.consultations enable row level security;
alter table public.suggestions enable row level security;
alter table public.activity_logs enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.invitations enable row level security;
alter table public.ai_usage_logs enable row level security;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_family_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = target_family_id
      and fm.user_id = (select auth.uid())
      and fm.status = 'active'
  );
$$;

create or replace function private.is_family_parent(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = target_family_id
      and fm.user_id = (select auth.uid())
      and fm.role = 'parent'
      and fm.status = 'active'
  );
$$;

revoke all on function private.is_family_member(uuid) from public;
revoke all on function private.is_family_parent(uuid) from public;
grant execute on function private.is_family_member(uuid) to authenticated;
grant execute on function private.is_family_parent(uuid) to authenticated;

create policy "families_select_member" on public.families
  for select to authenticated
  using (private.is_family_member(id));

create policy "families_insert_authenticated" on public.families
  for insert to authenticated
  with check ((select auth.uid()) = created_by);

create policy "families_update_parent" on public.families
  for update to authenticated
  using (private.is_family_parent(id))
  with check (private.is_family_parent(id));

create policy "family_members_select_member" on public.family_members
  for select to authenticated
  using (private.is_family_member(family_id));

create policy "family_members_insert_parent" on public.family_members
  for insert to authenticated
  with check (
    private.is_family_parent(family_id)
    or (
      user_id = (select auth.uid())
      and role = 'parent'
      and exists (
        select 1 from public.families f
        where f.id = family_members.family_id
          and f.created_by = (select auth.uid())
      )
    )
  );

create policy "family_members_update_parent" on public.family_members
  for update to authenticated
  using (private.is_family_parent(family_id))
  with check (private.is_family_parent(family_id));

create policy "children_select_member" on public.children
  for select to authenticated
  using (private.is_family_member(family_id));

create policy "children_write_parent" on public.children
  for all to authenticated
  using (private.is_family_parent(family_id))
  with check (private.is_family_parent(family_id));

create policy "child_profiles_select_member" on public.child_profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.children c
      where c.id = child_profiles.child_id
        and private.is_family_member(c.family_id)
    )
  );

create policy "child_profiles_write_parent" on public.child_profiles
  for all to authenticated
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

create policy "consultations_select_member" on public.consultations
  for select to authenticated
  using (private.is_family_member(family_id));

create policy "consultations_write_parent" on public.consultations
  for all to authenticated
  using (private.is_family_parent(family_id))
  with check (private.is_family_parent(family_id));

create policy "suggestions_select_by_consultation_member" on public.suggestions
  for select to authenticated
  using (
    exists (
      select 1 from public.consultations c
      where c.id = suggestions.consultation_id
        and private.is_family_member(c.family_id)
    )
  );

create policy "suggestions_write_by_consultation_parent" on public.suggestions
  for all to authenticated
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

create policy "activity_logs_select_member" on public.activity_logs
  for select to authenticated
  using (private.is_family_member(family_id));

create policy "activity_logs_write_parent" on public.activity_logs
  for all to authenticated
  using (private.is_family_parent(family_id))
  with check (private.is_family_parent(family_id));

create policy "weekly_plans_select_member" on public.weekly_plans
  for select to authenticated
  using (private.is_family_member(family_id));

create policy "weekly_plans_write_parent" on public.weekly_plans
  for all to authenticated
  using (private.is_family_parent(family_id))
  with check (private.is_family_parent(family_id));

create policy "invitations_select_parent" on public.invitations
  for select to authenticated
  using (private.is_family_parent(family_id));

create policy "invitations_write_parent" on public.invitations
  for all to authenticated
  using (private.is_family_parent(family_id))
  with check (private.is_family_parent(family_id));

create policy "ai_usage_logs_select_parent" on public.ai_usage_logs
  for select to authenticated
  using (family_id is null or private.is_family_parent(family_id));

create policy "ai_usage_logs_insert_authenticated" on public.ai_usage_logs
  for insert to authenticated
  with check (user_id = (select auth.uid()));
