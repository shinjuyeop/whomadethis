update storage.buckets
set allowed_mime_types = array[
  'image/webp',
  'image/jpeg',
  'image/png'
]::text[]
where id = 'review-images';

drop policy "Review authors can upload review images" on storage.objects;

create policy "Review authors can upload review images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'review-images'
  and owner_id = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.extension(name) in ('webp', 'jpg', 'png')
  and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png)$'
  and exists (
    select 1
    from public.reviews as review
    where review.id::text = (storage.foldername(name))[2]
      and review.user_id = (select auth.uid())
  )
);
