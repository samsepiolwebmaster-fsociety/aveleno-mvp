-- Table profiles (lie user_id Supabase à stripe_account_id)
create table if not exists profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null unique,
  artist_name text,
  stripe_account_id text,
  stripe_connected boolean default false,
  created_at timestamp default now()
);

-- RLS profiles
alter table profiles enable row level security;
create policy "read own profile" on profiles for select using (auth.uid() = user_id);
create policy "insert own profile" on profiles for insert with check (auth.uid() = user_id);
create policy "update own profile" on profiles for update using (auth.uid() = user_id);

-- Table orders (achats)
create table if not exists orders (
  id uuid default gen_random_uuid() primary key,
  track_id uuid references tracks(id),
  license_type text not null,
  buyer_email text,
  stripe_session_id text unique,
  amount_cents integer,
  status text default 'pending',
  created_at timestamp default now()
);

-- RLS orders
alter table orders enable row level security;
create policy "public insert orders" on orders for insert with check (true);
create policy "read own orders" on orders for select using (true);

-- Auto-créer un profil à l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, artist_name)
  values (new.id, new.raw_user_meta_data->>'artist_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
