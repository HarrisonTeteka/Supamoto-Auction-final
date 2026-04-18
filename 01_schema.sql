-- ============================================================
-- SupaMoto Auction — Supabase Schema
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABLES
-- ------------------------------------------------------------

-- Profiles: one row per auth user. Holds the "name" and role.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text unique not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- Categories
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);

-- Items (auction + shop, distinguished by `type`)
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text not null check (type in ('auction', 'shop')),
  category text,
  start_price numeric(12,2),

  -- auction-specific
  current_bid numeric(12,2) not null default 0,
  top_bidder_id uuid references profiles(id) on delete set null,
  top_bidder_name text,
  status text not null default 'open' check (status in ('open', 'closed')),

  -- shop-specific
  price numeric(12,2),
  stock integer,

  -- images (Storage paths, not base64)
  image_url text,
  image_url_2 text,

  is_faulty boolean not null default false,
  fault_description text,

  created_at timestamptz not null default now()
);

create index if not exists items_created_at_idx on items (created_at desc);
create index if not exists items_category_idx on items (category);

-- Bids: separate table instead of array inside item
create table if not exists bids (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  bidder_id uuid not null references profiles(id) on delete cascade,
  bidder_name text not null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists bids_item_idx on bids (item_id, created_at desc);

-- Purchases: one row per shop reservation
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  buyer_name text not null,
  created_at timestamptz not null default now(),
  unique (item_id, buyer_id)  -- hard-prevents double reservation
);

-- Notifications (outbid alerts etc.)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  to_user_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  item_id uuid references items(id) on delete cascade,
  item_name text,
  new_bid numeric(12,2),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_unread_idx
  on notifications (to_user_id, read) where read = false;

-- Settings: simple key-value store
create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed the auction_schedule row so updates don't need UPSERT logic
insert into settings (key, value)
values ('auction_schedule', '{"auction_start": null, "auction_end": null, "login_bg": null}'::jsonb)
on conflict (key) do nothing;


-- ------------------------------------------------------------
-- 2. HELPERS
-- ------------------------------------------------------------

-- Are we admin? Used in RLS policies.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from profiles where id = auth.uid()),
    false
  );
$$;

-- Auto-create a profile row when a new auth user signs up.
-- The `name` comes from raw_user_meta_data.name (set at signup).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    'user'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ------------------------------------------------------------
-- 3. BUSINESS LOGIC FUNCTIONS (the old runTransaction code)
-- ------------------------------------------------------------

-- Place a bid. Replaces the Firestore runTransaction block.
create or replace function place_bid(p_item_id uuid, p_amount numeric)
returns items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_item items%rowtype;
  v_min_bid numeric;
  v_auction_end timestamptz;
  v_is_admin boolean := is_admin();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Gate on auction window for non-admins
  select (value->>'auction_end')::timestamptz into v_auction_end
  from settings where key = 'auction_schedule';

  if not v_is_admin and v_auction_end is not null and now() >= v_auction_end then
    raise exception 'The auction has closed. Bidding is locked.';
  end if;

  select name into v_user_name from profiles where id = v_user_id;
  if v_user_name is null then
    raise exception 'Profile not found';
  end if;

  -- Lock the item row for the duration of this transaction
  select * into v_item from items where id = p_item_id for update;
  if not found then
    raise exception 'Item no longer exists.';
  end if;

  if v_item.status = 'closed' then
    raise exception 'This auction has already closed.';
  end if;

  v_min_bid := case
    when v_item.current_bid = 0 then v_item.start_price
    else v_item.current_bid + 1
  end;

  if p_amount < v_min_bid then
    raise exception 'Bid must be at least K%', v_min_bid;
  end if;

  if v_item.top_bidder_id = v_user_id and v_item.current_bid = p_amount then
    raise exception 'You are already the top bidder!';
  end if;

  -- Notify previous top bidder (if different person)
  if v_item.top_bidder_id is not null and v_item.top_bidder_id <> v_user_id then
    insert into notifications (to_user_id, message, item_id, item_name, new_bid)
    values (
      v_item.top_bidder_id,
      format('You''ve been outbid on "%s"! New bid: K%s. Bid higher to stay in the lead.',
             v_item.name, to_char(p_amount, 'FM999,999,990.00')),
      v_item.id,
      v_item.name,
      p_amount
    );
  end if;

  update items
     set current_bid = p_amount,
         top_bidder_id = v_user_id,
         top_bidder_name = v_user_name
   where id = p_item_id
   returning * into v_item;

  insert into bids (item_id, bidder_id, bidder_name, amount)
  values (p_item_id, v_user_id, v_user_name, p_amount);

  return v_item;
end;
$$;


-- Buy a shop item. Replaces the buyItem runTransaction block.
create or replace function buy_item(p_item_id uuid)
returns items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_item items%rowtype;
  v_already_bought int;
  v_auction_end timestamptz;
  v_is_admin boolean := is_admin();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select (value->>'auction_end')::timestamptz into v_auction_end
  from settings where key = 'auction_schedule';

  if not v_is_admin and v_auction_end is not null and now() >= v_auction_end then
    raise exception 'The auction has closed.';
  end if;

  select name into v_user_name from profiles where id = v_user_id;

  select * into v_item from items where id = p_item_id for update;
  if not found then raise exception 'Item no longer exists.'; end if;

  if v_item.type <> 'shop' then raise exception 'Not a shop item.'; end if;
  if v_item.stock is null or v_item.stock <= 0 then
    raise exception 'Out of stock.';
  end if;

  select count(*) into v_already_bought
  from purchases where item_id = p_item_id and buyer_id = v_user_id;
  if v_already_bought > 0 then
    raise exception 'You have already reserved this item.';
  end if;

  update items set stock = stock - 1
   where id = p_item_id
   returning * into v_item;

  insert into purchases (item_id, buyer_id, buyer_name)
  values (p_item_id, v_user_id, v_user_name);

  return v_item;
end;
$$;


-- ------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY
-- ------------------------------------------------------------

alter table profiles      enable row level security;
alter table categories    enable row level security;
alter table items         enable row level security;
alter table bids          enable row level security;
alter table purchases     enable row level security;
alter table notifications enable row level security;
alter table settings      enable row level security;

-- Profiles: everyone authed can read (so we can show bidder names),
-- users can update only their own row, admins full write.
create policy "profiles read all authed" on profiles
  for select to authenticated using (true);
create policy "profiles self update" on profiles
  for update to authenticated using (auth.uid() = id);
create policy "profiles admin all" on profiles
  for all to authenticated using (is_admin()) with check (is_admin());

-- Categories: all read, admin write
create policy "categories read all" on categories
  for select to authenticated using (true);
create policy "categories admin write" on categories
  for all to authenticated using (is_admin()) with check (is_admin());

-- Items: all read, admin write (bids/purchases go through RPC, not direct write)
create policy "items read all" on items
  for select to authenticated using (true);
create policy "items admin write" on items
  for all to authenticated using (is_admin()) with check (is_admin());

-- Bids: read all, insert only via RPC (we block direct inserts by not granting insert)
create policy "bids read all" on bids
  for select to authenticated using (true);
-- No insert/update/delete policy — only SECURITY DEFINER function can write.

-- Purchases: user can read their own, admin reads all
create policy "purchases own read" on purchases
  for select to authenticated using (buyer_id = auth.uid() or is_admin());
-- No direct insert — only buy_item() function.

-- Notifications: user reads own, can mark own as read
create policy "notifications own read" on notifications
  for select to authenticated using (to_user_id = auth.uid());
create policy "notifications own update" on notifications
  for update to authenticated using (to_user_id = auth.uid());

-- Settings: all read, admin write
create policy "settings read all" on settings
  for select to authenticated using (true);
create policy "settings admin write" on settings
  for all to authenticated using (is_admin()) with check (is_admin());


-- ------------------------------------------------------------
-- 5. REALTIME
-- ------------------------------------------------------------
-- Enable realtime on the tables we subscribe to
alter publication supabase_realtime add table items;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table categories;
alter publication supabase_realtime add table settings;


-- ------------------------------------------------------------
-- 6. STORAGE BUCKETS
-- ------------------------------------------------------------
-- Run this AFTER the rest, in SQL Editor.
-- These statements create public buckets; switch to private if you want signed URLs.

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('app-assets', 'app-assets', true)   -- login background etc.
on conflict (id) do nothing;

-- Storage policies: anyone authed can read, admin can write.
create policy "item images read" on storage.objects
  for select to authenticated
  using (bucket_id in ('item-images', 'app-assets'));

create policy "item images admin write" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('item-images', 'app-assets') and is_admin());

create policy "item images admin update" on storage.objects
  for update to authenticated
  using (bucket_id in ('item-images', 'app-assets') and is_admin());

create policy "item images admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('item-images', 'app-assets') and is_admin());