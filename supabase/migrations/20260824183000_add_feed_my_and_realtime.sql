drop function if exists public.list_restaurants_with_review_stats();

create function public.list_restaurants_with_review_stats()
returns table (
  id uuid,
  name text,
  category text,
  address text,
  road_address text,
  latitude double precision,
  longitude double precision,
  naver_link text,
  source text,
  source_key text,
  created_by uuid,
  created_at timestamptz,
  average_rating double precision,
  review_count integer,
  cover_photo_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    restaurant.id,
    restaurant.name,
    restaurant.category,
    restaurant.address,
    restaurant.road_address,
    restaurant.latitude,
    restaurant.longitude,
    restaurant.naver_link,
    restaurant.source,
    restaurant.source_key,
    restaurant.created_by,
    restaurant.created_at,
    avg(review.rating)::double precision as average_rating,
    count(review.id)::integer as review_count,
    cover_photo.storage_path as cover_photo_path
  from public.restaurants as restaurant
  left join public.reviews as review
    on review.restaurant_id = restaurant.id
  left join lateral (
    select photo.storage_path
    from public.reviews as recent_review
    join public.review_photos as photo
      on photo.review_id = recent_review.id
    where recent_review.restaurant_id = restaurant.id
    order by recent_review.created_at desc, photo.sort_order asc
    limit 1
  ) as cover_photo on true
  group by restaurant.id, cover_photo.storage_path
  order by restaurant.created_at asc;
$$;

revoke all on function public.list_restaurants_with_review_stats()
from public, anon;

grant execute on function public.list_restaurants_with_review_stats()
to authenticated;

comment on function public.list_restaurants_with_review_stats()
is 'Lists shared restaurants with review aggregates and one preview photo path.';

create function public.get_restaurant_with_review_stats(p_restaurant_id uuid)
returns table (
  id uuid,
  name text,
  category text,
  address text,
  road_address text,
  latitude double precision,
  longitude double precision,
  naver_link text,
  source text,
  source_key text,
  created_by uuid,
  created_at timestamptz,
  average_rating double precision,
  review_count integer,
  cover_photo_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select listed.*
  from public.list_restaurants_with_review_stats() as listed
  where listed.id = p_restaurant_id;
$$;

revoke all on function public.get_restaurant_with_review_stats(uuid)
from public, anon;

grant execute on function public.get_restaurant_with_review_stats(uuid)
to authenticated;

comment on function public.get_restaurant_with_review_stats(uuid)
is 'Returns one shared restaurant with current review aggregates and preview photo.';

create function public.list_recent_reviews(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  restaurant_id uuid,
  restaurant_name text,
  restaurant_category text,
  restaurant_address text,
  restaurant_road_address text,
  user_id uuid,
  author_nickname text,
  rating double precision,
  content text,
  visited_at date,
  created_at timestamptz,
  updated_at timestamptz,
  photos jsonb,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    review.id,
    restaurant.id as restaurant_id,
    restaurant.name as restaurant_name,
    restaurant.category as restaurant_category,
    restaurant.address as restaurant_address,
    restaurant.road_address as restaurant_road_address,
    review.user_id,
    profile.nickname as author_nickname,
    review.rating::double precision,
    review.content,
    review.visited_at,
    review.created_at,
    review.updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', photo.id,
            'review_id', photo.review_id,
            'storage_path', photo.storage_path,
            'sort_order', photo.sort_order
          )
          order by photo.sort_order asc
        )
        from public.review_photos as photo
        where photo.review_id = review.id
      ),
      '[]'::jsonb
    ) as photos,
    count(*) over() as total_count
  from public.reviews as review
  join public.profiles as profile
    on profile.id = review.user_id
  join public.restaurants as restaurant
    on restaurant.id = review.restaurant_id
  order by review.created_at desc, review.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_recent_reviews(integer, integer)
from public, anon;

grant execute on function public.list_recent_reviews(integer, integer)
to authenticated;

comment on function public.list_recent_reviews(integer, integer)
is 'Lists the authenticated community recent review feed without N+1 queries.';

create function public.list_my_reviews(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  restaurant_id uuid,
  restaurant_name text,
  restaurant_category text,
  restaurant_address text,
  restaurant_road_address text,
  user_id uuid,
  author_nickname text,
  rating double precision,
  content text,
  visited_at date,
  created_at timestamptz,
  updated_at timestamptz,
  photos jsonb,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    review.id,
    restaurant.id as restaurant_id,
    restaurant.name as restaurant_name,
    restaurant.category as restaurant_category,
    restaurant.address as restaurant_address,
    restaurant.road_address as restaurant_road_address,
    review.user_id,
    profile.nickname as author_nickname,
    review.rating::double precision,
    review.content,
    review.visited_at,
    review.created_at,
    review.updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', photo.id,
            'review_id', photo.review_id,
            'storage_path', photo.storage_path,
            'sort_order', photo.sort_order
          )
          order by photo.sort_order asc
        )
        from public.review_photos as photo
        where photo.review_id = review.id
      ),
      '[]'::jsonb
    ) as photos,
    count(*) over() as total_count
  from public.reviews as review
  join public.profiles as profile
    on profile.id = review.user_id
  join public.restaurants as restaurant
    on restaurant.id = review.restaurant_id
  where review.user_id = (select auth.uid())
  order by review.created_at desc, review.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_my_reviews(integer, integer)
from public, anon;

grant execute on function public.list_my_reviews(integer, integer)
to authenticated;

comment on function public.list_my_reviews(integer, integer)
is 'Lists the current user review history with restaurant and photo data.';

create function public.get_my_review_stats()
returns table (
  visited_restaurant_count integer,
  review_count integer,
  photo_count integer,
  average_rating double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(distinct review.restaurant_id)::integer as visited_restaurant_count,
    count(review.id)::integer as review_count,
    (
      select count(photo.id)::integer
      from public.review_photos as photo
      join public.reviews as photo_review
        on photo_review.id = photo.review_id
      where photo_review.user_id = (select auth.uid())
    ) as photo_count,
    avg(review.rating)::double precision as average_rating
  from public.reviews as review
  where review.user_id = (select auth.uid());
$$;

revoke all on function public.get_my_review_stats()
from public, anon;

grant execute on function public.get_my_review_stats()
to authenticated;

comment on function public.get_my_review_stats()
is 'Returns exact restaurant, review, photo, and rating statistics for the current user.';

do $$
declare
  realtime_table text;
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  foreach realtime_table in array array[
    'restaurants',
    'reviews',
    'review_photos',
    'profiles'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        realtime_table
      );
    end if;
  end loop;
end;
$$;
