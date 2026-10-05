-- Account photos are private; users can only read/write their own UUID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gf-profile-avatars', 'gf-profile-avatars', false, 524288, array['image/jpeg'])
on conflict (id) do nothing;

create policy "gf_avatar_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'gf-profile-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "gf_avatar_select_own" on storage.objects for select to authenticated
using (bucket_id = 'gf-profile-avatars' and owner_id = (select auth.uid()::text) and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "gf_avatar_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'gf-profile-avatars' and owner_id = (select auth.uid()::text) and (storage.foldername(name))[1] = (select auth.uid()::text));
-- New object per change: no UPDATE/upsert permission is needed.
