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
  on conflict on constraint reviews_user_restaurant_unique do update
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
