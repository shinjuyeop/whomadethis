create function public.create_visit_review(
  p_name text,
  p_category text,
  p_address text,
  p_road_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_naver_link text,
  p_rating numeric,
  p_content text,
  p_visited_at date
)
returns table (
  restaurant_id uuid,
  review_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_review public.reviews%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_visited_at is null then
    raise exception 'Visited date is required' using errcode = '22023';
  end if;

  select resolved_restaurant.*
  into v_restaurant
  from public.find_or_create_restaurant(
    p_name,
    p_category,
    p_address,
    p_road_address,
    p_latitude,
    p_longitude,
    p_naver_link
  ) as resolved_restaurant;

  if v_restaurant.id is null then
    raise exception 'Restaurant could not be resolved';
  end if;

  insert into public.reviews (
    restaurant_id,
    user_id,
    rating,
    content,
    visited_at
  )
  values (
    v_restaurant.id,
    (select auth.uid()),
    p_rating,
    nullif(btrim(coalesce(p_content, '')), ''),
    p_visited_at
  )
  returning * into v_review;

  restaurant_id := v_restaurant.id;
  review_id := v_review.id;
  return next;
end;
$$;

revoke all on function public.create_visit_review(
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  numeric,
  text,
  date
) from public, anon;

grant execute on function public.create_visit_review(
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  numeric,
  text,
  date
) to authenticated;

comment on function public.create_visit_review(
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  numeric,
  text,
  date
) is 'Resolves a NAVER restaurant and creates its visit review in one transaction.';

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
  review_count integer
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
    count(review.id)::integer as review_count
  from public.restaurants as restaurant
  left join public.reviews as review
    on review.restaurant_id = restaurant.id
  group by restaurant.id
  order by restaurant.created_at asc;
$$;

revoke all on function public.list_restaurants_with_review_stats()
from public, anon;

grant execute on function public.list_restaurants_with_review_stats()
to authenticated;

comment on function public.list_restaurants_with_review_stats()
is 'Lists shared restaurants with review aggregates without per-marker queries.';

create function public.list_restaurant_reviews(p_restaurant_id uuid)
returns table (
  id uuid,
  restaurant_id uuid,
  user_id uuid,
  author_nickname text,
  rating double precision,
  content text,
  visited_at date,
  created_at timestamptz,
  updated_at timestamptz,
  photos jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    review.id,
    review.restaurant_id,
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
    ) as photos
  from public.reviews as review
  join public.profiles as profile
    on profile.id = review.user_id
  where review.restaurant_id = p_restaurant_id
  order by review.visited_at desc, review.created_at desc;
$$;

revoke all on function public.list_restaurant_reviews(uuid)
from public, anon;

grant execute on function public.list_restaurant_reviews(uuid)
to authenticated;

comment on function public.list_restaurant_reviews(uuid)
is 'Lists restaurant reviews with author nicknames and ordered photo metadata.';

alter table public.review_photos
add constraint review_photos_sort_order_max
check (sort_order < 5);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'review-images',
  'review-images',
  false,
  8388608,
  array['image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users can read review images"
on storage.objects for select
to authenticated
using (bucket_id = 'review-images');

create policy "Review authors can upload review images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'review-images'
  and owner_id = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.extension(name) = 'webp'
  and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
  and exists (
    select 1
    from public.reviews as review
    where review.id::text = (storage.foldername(name))[2]
      and review.user_id = (select auth.uid())
  )
);

create policy "Review authors can delete review images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'review-images'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.reviews as review
    where review.id::text = (storage.foldername(name))[2]
      and review.user_id = (select auth.uid())
  )
);
