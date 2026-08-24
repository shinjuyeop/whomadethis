create function public.find_or_create_restaurant(
  p_name text,
  p_category text,
  p_address text,
  p_road_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_naver_link text
)
returns setof public.restaurants
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_source_key text;
begin
  if nullif(btrim(p_name), '') is null then
    raise exception 'Restaurant name is required' using errcode = '22023';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'Restaurant coordinates are required' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_road_address, p_address, '')), '') is null then
    raise exception 'Restaurant address is required' using errcode = '22023';
  end if;

  v_source_key := public.normalize_restaurant_source_key(
    p_name,
    coalesce(p_road_address, p_address, '')
  );

  select restaurant.*
  into v_restaurant
  from public.restaurants as restaurant
  where restaurant.source = 'naver'
    and restaurant.source_key = v_source_key;

  if found then
    return next v_restaurant;
    return;
  end if;

  insert into public.restaurants (
    name,
    category,
    address,
    road_address,
    latitude,
    longitude,
    naver_link,
    source,
    source_key,
    created_by
  )
  values (
    btrim(p_name),
    nullif(btrim(coalesce(p_category, '')), ''),
    nullif(btrim(coalesce(p_address, '')), ''),
    nullif(btrim(coalesce(p_road_address, '')), ''),
    p_latitude,
    p_longitude,
    nullif(btrim(coalesce(p_naver_link, '')), ''),
    'naver',
    v_source_key,
    (select auth.uid())
  )
  on conflict (source, source_key) do nothing
  returning * into v_restaurant;

  if v_restaurant.id is null then
    select restaurant.*
    into v_restaurant
    from public.restaurants as restaurant
    where restaurant.source = 'naver'
      and restaurant.source_key = v_source_key;
  end if;

  if v_restaurant.id is null then
    raise exception 'Restaurant could not be selected';
  end if;

  return next v_restaurant;
end;
$$;

revoke all on function public.find_or_create_restaurant(
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  text
) from public, anon;

grant execute on function public.find_or_create_restaurant(
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  text
) to authenticated;

comment on function public.find_or_create_restaurant(
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  text
) is 'Selects an existing NAVER restaurant by deterministic source key or creates it under the caller RLS context.';
