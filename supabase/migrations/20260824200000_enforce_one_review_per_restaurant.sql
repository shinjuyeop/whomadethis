create temporary table review_canonical_map on commit drop as
select
  ranked.id as review_id,
  first_value(ranked.id) over (
    partition by ranked.restaurant_id, ranked.user_id
    order by ranked.updated_at desc, ranked.created_at desc, ranked.id desc
  ) as canonical_review_id,
  row_number() over (
    partition by ranked.restaurant_id, ranked.user_id
    order by ranked.updated_at desc, ranked.created_at desc, ranked.id desc
  ) as review_rank,
  ranked.updated_at,
  ranked.created_at
from public.reviews as ranked;

create temporary table review_photo_keep on commit drop as
select
  candidates.photo_id,
  candidates.canonical_review_id,
  (candidates.photo_rank - 1)::integer as next_sort_order
from (
  select
    photo.id as photo_id,
    mapping.canonical_review_id,
    row_number() over (
      partition by mapping.canonical_review_id
      order by
        case when mapping.review_id = mapping.canonical_review_id then 0 else 1 end,
        mapping.updated_at desc,
        mapping.created_at desc,
        photo.sort_order asc,
        photo.id asc
    ) as photo_rank
  from public.review_photos as photo
  join review_canonical_map as mapping
    on mapping.review_id = photo.review_id
) as candidates
where candidates.photo_rank <= 5;

delete from public.review_photos as photo
using review_canonical_map as mapping
where photo.review_id = mapping.review_id
  and mapping.review_rank > 1
  and not exists (
    select 1
    from review_photo_keep as kept
    where kept.photo_id = photo.id
  );

alter table public.review_photos
drop constraint review_photos_sort_order_unique;

update public.review_photos as photo
set
  review_id = kept.canonical_review_id,
  sort_order = kept.next_sort_order
from review_photo_keep as kept
where kept.photo_id = photo.id;

alter table public.review_photos
add constraint review_photos_sort_order_unique unique (review_id, sort_order);

delete from public.reviews as review
using review_canonical_map as mapping
where review.id = mapping.review_id
  and mapping.review_rank > 1;

alter table public.reviews
add constraint reviews_user_restaurant_unique unique (user_id, restaurant_id);

drop policy "Review authors can delete review images" on storage.objects;

create policy "Review authors can delete review images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.review_photos as photo
    join public.reviews as review
      on review.id = photo.review_id
    where photo.storage_path = name
      and review.user_id = (select auth.uid())
  )
);

create or replace function public.create_visit_review(
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
  on conflict (user_id, restaurant_id) do update
  set
    rating = excluded.rating,
    content = excluded.content,
    visited_at = excluded.visited_at
  returning * into v_review;

  restaurant_id := v_restaurant.id;
  review_id := v_review.id;
  return next;
end;
$$;

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
) is 'Resolves a NAVER restaurant and creates or updates the current user review in one transaction.';
