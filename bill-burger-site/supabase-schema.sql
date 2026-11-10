-- BILL BURGER — banco de dados e segurança Supabase
-- Execute no Supabase Dashboard > SQL Editor > New query.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_bill_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_bill_admin() from public;
grant execute on function public.is_bill_admin() to anon, authenticated;

create table if not exists public.store_settings (
  id integer primary key check (id = 1),
  whatsapp text not null default '5522998425652',
  instagram text not null default 'https://www.instagram.com/billburgue/',
  address text not null default 'Rua das Marrecas, 52, Caju, Silva Jardim, RJ',
  maps text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values (1)
on conflict (id) do nothing;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  description text not null default '',
  -- Texto permite preços simples ou múltiplos: "P: R$ 13 | M: R$ 18 | G: R$ 23".
  price text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  rating integer not null check (rating between 1 and 5),
  message text,
  created_at timestamptz not null default now(),
  constraint review_name_length check (customer_name is null or char_length(customer_name) <= 60),
  constraint review_message_length check (message is null or char_length(message) <= 500)
);

-- Migração segura para projetos que executaram o schema antigo (0 a 5 estrelas).
-- NOT VALID preserva avaliações antigas, mas bloqueia novas notas fora de 1 a 5.
alter table public.reviews drop constraint if exists reviews_rating_check;
alter table public.reviews drop constraint if exists reviews_rating_range;
alter table public.reviews
  add constraint reviews_rating_range check (rating between 1 and 5) not valid;

alter table public.admin_users enable row level security;
alter table public.store_settings enable row level security;
alter table public.menu_items enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings" on public.store_settings
for select to anon, authenticated using (true);

drop policy if exists "Admins manage store settings" on public.store_settings;
create policy "Admins manage store settings" on public.store_settings
for all to authenticated using (public.is_bill_admin()) with check (public.is_bill_admin());

drop policy if exists "Public can read menu" on public.menu_items;
create policy "Public can read menu" on public.menu_items
for select to anon, authenticated using (true);

drop policy if exists "Admins manage menu" on public.menu_items;
create policy "Admins manage menu" on public.menu_items
for all to authenticated using (public.is_bill_admin()) with check (public.is_bill_admin());

drop policy if exists "Public can read reviews" on public.reviews;
create policy "Public can read reviews" on public.reviews
for select to anon, authenticated using (true);

drop policy if exists "Visitors can submit reviews" on public.reviews;
create policy "Visitors can submit reviews" on public.reviews
for insert to anon, authenticated with check (
  rating between 1 and 5
  and (customer_name is null or char_length(customer_name) <= 60)
  and (message is null or char_length(message) <= 500)
);

drop policy if exists "Admins manage reviews" on public.reviews;
create policy "Admins manage reviews" on public.reviews
for all to authenticated using (public.is_bill_admin()) with check (public.is_bill_admin());

revoke all on public.admin_users from anon, authenticated;
grant select on public.store_settings, public.menu_items, public.reviews to anon, authenticated;
grant insert on public.reviews to anon, authenticated;
grant insert, update, delete on public.store_settings, public.menu_items to authenticated;
grant update, delete on public.reviews to authenticated;
