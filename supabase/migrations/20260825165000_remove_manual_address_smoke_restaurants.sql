delete from public.restaurants as restaurant
where restaurant.name like '수동주소검증-%'
  and restaurant.created_by is null
  and not exists (
    select 1
    from public.reviews as review
    where review.restaurant_id = restaurant.id
  );
