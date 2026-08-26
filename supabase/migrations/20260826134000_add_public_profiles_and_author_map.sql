create function public.get_user_review_stats(p_user_id uuid)
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
      where photo_review.user_id = p_user_id
    ) as photo_count,
    avg(review.rating)::double precision as average_rating
  from public.reviews as review
  where review.user_id = p_user_id;
$$;

revoke all on function public.get_user_review_stats(uuid)
from public, anon;

grant execute on function public.get_user_review_stats(uuid)
to authenticated;

comment on function public.get_user_review_stats(uuid)
is 'Returns public review statistics for one profile to authenticated users.';

create function public.list_user_reviews(
  p_user_id uuid,
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
  where review.user_id = p_user_id
  order by review.created_at desc, review.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_user_reviews(uuid, integer, integer)
from public, anon;

grant execute on function public.list_user_reviews(uuid, integer, integer)
to authenticated;

comment on function public.list_user_reviews(uuid, integer, integer)
is 'Lists one profile review history with restaurant and photo data.';

create function public.list_user_restaurant_ids(p_user_id uuid)
returns table (restaurant_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct review.restaurant_id
  from public.reviews as review
  where review.user_id = p_user_id
  order by review.restaurant_id;
$$;

revoke all on function public.list_user_restaurant_ids(uuid)
from public, anon;

grant execute on function public.list_user_restaurant_ids(uuid)
to authenticated;

comment on function public.list_user_restaurant_ids(uuid)
is 'Lists restaurant ids reviewed by one profile for map filtering.';
