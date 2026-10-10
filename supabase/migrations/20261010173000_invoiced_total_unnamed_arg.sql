-- invoiced_total with an unnamed argument, so supabase-js types treat it as a computed field (select=invoiced_total).

drop function public.invoiced_total(public.quotations);

create function public.invoiced_total(public.quotations) returns numeric
language sql stable set search_path = '' as $$
  select coalesce(sum(grand_total), 0) from public.invoices where quotation_id = $1.id and status = 'issued';
$$;

revoke execute on function public.invoiced_total from public, anon;
grant execute on function public.invoiced_total to authenticated;
