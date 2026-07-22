insert into storage.buckets (id, name, public)
values ('car-photos', 'car-photos', false)
on conflict (id) do nothing;

-- Path convention: {dealer_id}/{car_id}/{filename}. storage.foldername(name)
-- splits the path into segments — [1] is the dealer_id, which we check
-- against is_dealer_staff exactly the same way every other table does.
create policy "staff read own dealer car photos storage"
on storage.objects for select
using (
  bucket_id = 'car-photos'
  and (is_dealer_staff((storage.foldername(name))[1]::uuid) or is_admin())
);

create policy "staff upload own dealer car photos storage"
on storage.objects for insert
with check (
  bucket_id = 'car-photos'
  and (is_dealer_staff((storage.foldername(name))[1]::uuid) or is_admin())
);

create policy "staff delete own dealer car photos storage"
on storage.objects for delete
using (
  bucket_id = 'car-photos'
  and (is_dealer_staff((storage.foldername(name))[1]::uuid) or is_admin())
);
