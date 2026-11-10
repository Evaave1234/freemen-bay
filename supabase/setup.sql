-- Freemans Bay Beginner Badminton — database setup
-- Paste ALL of this into Supabase → SQL Editor → New query → Run.

-- 0) Only ONE account is the organizer: account number 123456 (logs in as 123456@example.com).
--    Even if someone else manages to log in, the database refuses them.
create or replace function public.is_organizer()
returns boolean language sql stable set search_path = public as $$
  select coalesce(lower(auth.jwt() ->> 'email'), '') = '123456@example.com';
$$;
revoke all on function public.is_organizer() from public;
grant execute on function public.is_organizer() to authenticated;

-- 1) Session details (only the logged-in organizer can change them)
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id, data) values (1, '{
  "end": "2026-12-12",
  "weekly": {
    "tue": {"time": "8:45pm – 10:15pm", "price": "$5 per person", "courts": "2 court", "note": ""},
    "fri": {"time": "7:30pm – 10:30pm", "price": "$10 per person", "courts": "7:30-8:30 1 court and 8:30-10:30 2 court", "note": ""}
  },
  "dates": {}
}'::jsonb) on conflict (id) do nothing;

alter table public.settings enable row level security;
drop policy if exists "anyone can read settings" on public.settings;
create policy "anyone can read settings" on public.settings for select using (true);
drop policy if exists "organizer updates settings" on public.settings;
create policy "organizer updates settings" on public.settings for update to authenticated using (public.is_organizer()) with check (public.is_organizer());
revoke all on public.settings from anon, authenticated;
grant select on public.settings to anon, authenticated;
grant update on public.settings to authenticated;

-- 2) Sign-ups. Visitors only add via add_signup and remove their own via remove_my_signup.
--    Only the logged-in organizer can tick "paid" or remove anyone.
create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  session text not null check (session ~ '^\d{4}-\d{2}-\d{2}$'),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  kid boolean not null default false,
  paid boolean not null default false,
  owner_token uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists signups_session_idx on public.signups (session);

alter table public.signups enable row level security;
drop policy if exists "organizer reads signups" on public.signups;
create policy "organizer reads signups" on public.signups for select to authenticated using (public.is_organizer());
drop policy if exists "organizer updates signups" on public.signups;
create policy "organizer updates signups" on public.signups for update to authenticated using (public.is_organizer()) with check (public.is_organizer());
drop policy if exists "organizer deletes signups" on public.signups;
create policy "organizer deletes signups" on public.signups for delete to authenticated using (public.is_organizer());
revoke all on public.signups from anon, authenticated;
grant select, delete on public.signups to authenticated;
grant update (paid) on public.signups to authenticated;

-- Public list of upcoming sign-ups (never exposes the private owner_token)
create or replace function public.list_signups()
returns table (id uuid, session text, name text, kid boolean, paid boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, session, name, kid, paid, created_at
  from public.signups
  where session >= to_char((now() at time zone 'Pacific/Auckland')::date, 'YYYY-MM-DD')
  order by created_at;
$$;

-- Add a name: only Tue/Fri, only this week or next week (Auckland time),
-- not after the last day in settings, and max 12 per session.
create or replace function public.add_signup(p_session text, p_name text, p_kid boolean, p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_count int; v_date date;
  v_today date := (now() at time zone 'Pacific/Auckland')::date;
  v_last date;
  v_end date;
begin
  begin v_date := p_session::date; exception when others then raise exception 'CLOSED'; end;
  if p_session !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'CLOSED'; end if;
  v_last := (date_trunc('week', v_today)::date + 13);  -- Sunday of next week
  select coalesce((data->>'end')::date, v_last) into v_end from public.settings where id = 1;
  if extract(isodow from v_date) not in (2, 5)
     or v_date < v_today or v_date > v_last or v_date > coalesce(v_end, v_last) then
    raise exception 'CLOSED';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then raise exception 'bad name'; end if;
  if p_token is null then raise exception 'bad token'; end if;
  perform pg_advisory_xact_lock(hashtext('signup_' || p_session));
  select count(*) into v_count from public.signups where session = p_session;
  if v_count >= 12 then raise exception 'FULL'; end if;
  insert into public.signups (session, name, kid, owner_token)
    values (p_session, btrim(p_name), coalesce(p_kid, false), p_token)
    returning id into v_id;
  return v_id;
end $$;

-- Remove your own name (works from the same phone/browser that added it)
create or replace function public.remove_my_signup(p_id uuid, p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from public.signups where id = p_id and owner_token = p_token;
  return found;
end $$;

revoke all on function public.list_signups() from public;
revoke all on function public.add_signup(text, text, boolean, uuid) from public;
revoke all on function public.remove_my_signup(uuid, uuid) from public;
grant execute on function public.list_signups() to anon, authenticated;
grant execute on function public.add_signup(text, text, boolean, uuid) to anon, authenticated;
grant execute on function public.remove_my_signup(uuid, uuid) to anon, authenticated;
