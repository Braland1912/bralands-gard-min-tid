
create or replace function public.get_team_workers()
returns table(id uuid, user_id uuid, name text, can_see_team boolean)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.user_id, w.name, w.can_see_team
  from public.workers w
  where
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or exists (
      select 1 from public.workers me
      where me.user_id = auth.uid() and me.can_see_team = true
    );
$$;

grant execute on function public.get_team_workers() to authenticated;
