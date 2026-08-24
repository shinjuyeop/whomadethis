create extension if not exists pgcrypto with schema extensions;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.normalize_restaurant_source_key(
  restaurant_name text,
  restaurant_address text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(
    regexp_replace(btrim(restaurant_name), '[[:space:]]+', '', 'g')
    || '|'
    || regexp_replace(btrim(restaurant_address), '[[:space:]]+', '', 'g')
  );
$$;

create function public.set_restaurant_source_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.source_key = public.normalize_restaurant_source_key(
    new.name,
    coalesce(new.road_address, new.address, '')
  );
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_length check (char_length(nickname) between 2 and 40),
  constraint profiles_nickname_trimmed check (nickname = btrim(nickname)),
  constraint profiles_avatar_url_length check (
    avatar_url is null or char_length(avatar_url) <= 2048
  )
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  address text,
  road_address text,
  latitude double precision not null,
  longitude double precision not null,
  naver_link text,
  source text not null default 'naver',
  source_key text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurants_name_not_blank check (btrim(name) <> ''),
  constraint restaurants_name_length check (char_length(name) <= 200),
  constraint restaurants_address_present check (
    nullif(btrim(coalesce(road_address, '')), '') is not null
    or nullif(btrim(coalesce(address, '')), '') is not null
  ),
  constraint restaurants_latitude_range check (latitude between -90 and 90),
  constraint restaurants_longitude_range check (longitude between -180 and 180),
  constraint restaurants_source_not_blank check (btrim(source) <> ''),
  constraint restaurants_source_length check (char_length(source) <= 50),
  constraint restaurants_naver_link_length check (
    naver_link is null or char_length(naver_link) <= 2048
  ),
  constraint restaurants_source_key_unique unique (source, source_key)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  rating numeric(2, 1) not null,
  content text,
  visited_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_range check (rating between 0.5 and 5.0),
  constraint reviews_rating_half_step check (rating * 2 = trunc(rating * 2)),
  constraint reviews_content_length check (
    content is null or char_length(content) <= 5000
  )
);

create table public.review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint review_photos_storage_path_not_blank check (btrim(storage_path) <> ''),
  constraint review_photos_storage_path_length check (
    char_length(storage_path) <= 1024
  ),
  constraint review_photos_sort_order_nonnegative check (sort_order >= 0),
  constraint review_photos_path_unique unique (review_id, storage_path),
  constraint review_photos_sort_order_unique unique (review_id, sort_order)
);

create index reviews_restaurant_recent_idx
  on public.reviews (restaurant_id, visited_at desc, created_at desc);
create index reviews_user_recent_idx
  on public.reviews (user_id, created_at desc);
create index reviews_created_at_idx
  on public.reviews (created_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger restaurants_set_source_key
before insert or update of name, road_address, address on public.restaurants
for each row execute function public.set_restaurant_source_key();

create trigger restaurants_set_updated_at
before update on public.restaurants
for each row execute function public.set_updated_at();

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.reviews enable row level security;
alter table public.review_photos enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.restaurants from anon;
revoke all on table public.reviews from anon;
revoke all on table public.review_photos from anon;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert on table public.restaurants to authenticated;
grant select, insert, update, delete on table public.reviews to authenticated;
grant select, insert, delete on table public.review_photos to authenticated;

create policy "Authenticated users can read profiles"
on public.profiles for select
to authenticated
using (true);

create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Authenticated users can read restaurants"
on public.restaurants for select
to authenticated
using (true);

create policy "Authenticated users can create restaurants"
on public.restaurants for insert
to authenticated
with check ((select auth.uid()) = created_by);

create policy "Authenticated users can read reviews"
on public.reviews for select
to authenticated
using (true);

create policy "Users can create their own reviews"
on public.reviews for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own reviews"
on public.reviews for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own reviews"
on public.reviews for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can read review photos"
on public.review_photos for select
to authenticated
using (true);

create policy "Review authors can create review photos"
on public.review_photos for insert
to authenticated
with check (
  exists (
    select 1
    from public.reviews
    where reviews.id = review_photos.review_id
      and reviews.user_id = (select auth.uid())
  )
);

create policy "Review authors can delete review photos"
on public.review_photos for delete
to authenticated
using (
  exists (
    select 1
    from public.reviews
    where reviews.id = review_photos.review_id
      and reviews.user_id = (select auth.uid())
  )
);

comment on column public.restaurants.source_key is
  'Normalized name + road/lot address, generated by trigger for simple duplicate prevention.';
comment on table public.review_photos is
  'Metadata for private Storage objects; image binaries are not stored in Postgres.';
