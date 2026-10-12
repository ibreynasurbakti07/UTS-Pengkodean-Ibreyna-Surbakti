create sequence if not exists public.cash_voucher_number_seq;

create table if not exists public.cash_out_vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  voucher_no text not null unique,
  voucher_date date not null default current_date,
  payee text not null,
  category text not null,
  description text not null,
  amount numeric(15, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('Transfer bank', 'Tunai', 'Kartu debit')),
  reference_no text,
  account_name text not null,
  status text not null default 'POSTED' check (status in ('POSTED', 'VOID')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_cash_out_voucher_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.voucher_no is null or new.voucher_no = '' then
    new.voucher_no := 'KK-' || to_char(new.voucher_date, 'YYYYMM') || '-' ||
      lpad(nextval('public.cash_voucher_number_seq')::text, 6, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cash_out_vouchers_set_defaults on public.cash_out_vouchers;
create trigger cash_out_vouchers_set_defaults
before insert or update on public.cash_out_vouchers
for each row execute function public.set_cash_out_voucher_defaults();

alter table public.cash_out_vouchers enable row level security;

drop policy if exists "Users can view their own cash vouchers" on public.cash_out_vouchers;
create policy "Users can view their own cash vouchers"
on public.cash_out_vouchers for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own cash vouchers" on public.cash_out_vouchers;
create policy "Users can create their own cash vouchers"
on public.cash_out_vouchers for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own cash vouchers" on public.cash_out_vouchers;
create policy "Users can update their own cash vouchers"
on public.cash_out_vouchers for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own cash vouchers" on public.cash_out_vouchers;
create policy "Users can delete their own cash vouchers"
on public.cash_out_vouchers for delete to authenticated
using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.cash_out_vouchers to authenticated;
grant usage, select on sequence public.cash_voucher_number_seq to authenticated;
