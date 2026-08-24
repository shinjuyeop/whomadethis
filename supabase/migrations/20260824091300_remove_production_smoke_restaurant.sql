delete from public.restaurants as restaurant
where restaurant.source = 'naver'
  and restaurant.source_key = '위락밥집|서울특별시광진구능동로16길50'
  and restaurant.created_by is null
  and restaurant.created_at = '2026-08-24T09:09:51.347581+00:00'::timestamptz
  and not exists (
    select 1
    from public.reviews as review
    where review.restaurant_id = restaurant.id
  );
