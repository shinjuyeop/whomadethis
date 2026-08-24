alter table public.reviews
drop constraint reviews_rating_half_step;

alter table public.reviews
add constraint reviews_rating_tenth_step
check (rating * 10 = trunc(rating * 10));

comment on constraint reviews_rating_tenth_step on public.reviews
is 'Ratings are stored in 0.1 point increments between 0.5 and 5.0.';
