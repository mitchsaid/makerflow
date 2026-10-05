-- Quote policies: a saved library of reusable policies per business (changes, cancellation,
-- expected variations, client responsibilities, liability and aftercare), and each quote's own
-- copy of the ones it includes.
--
-- * public.policies is the LIBRARY. Every member can read it (they tick policies on quotes);
--   only owners and admins can write it (it is business wording, like the Business profile).
--   Policies are archived, never deleted.
-- * quotes.policies is the quote's own COPY: a list of {policy_id, kind, title, body}. A copy so
--   a quote keeps its text when the library changes, and so a sent quote is frozen by the
--   quote's own rules (only drafts can be edited). save_quote_draft carries it inside p_quote.
--
-- SECURITY-SENSITIVE: a new table with row-level security and role-based write policies, a new
-- column on a table with column grants, and a replaced function that signed-in users can call
-- (save_quote_draft, still security invoker).

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  kind text not null
    check (kind in ('changes', 'cancellation', 'variations', 'client_responsibilities', 'liability_aftercare')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 2000),
  -- Ticked on every new quote.
  include_by_default boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint policies_org_id_unique unique (organisation_id, id)
);

create index policies_org_kind_idx on public.policies (organisation_id, kind, sort_order);

create trigger policies_set_updated_at
  before update on public.policies
  for each row execute function public.set_updated_at();

-- No delete, and the business can never be changed after creation.
revoke all on public.policies from anon, authenticated;
grant select on public.policies to authenticated;
grant insert (organisation_id, kind, title, body, include_by_default, sort_order)
  on public.policies to authenticated;
grant update (kind, title, body, include_by_default, sort_order, archived_at)
  on public.policies to authenticated;

alter table public.policies enable row level security;

create policy policies_select_members
  on public.policies for select to authenticated
  using (public.is_org_member(organisation_id));

create policy policies_insert_admins
  on public.policies for insert to authenticated
  with check (public.has_org_role(organisation_id, array['owner', 'admin']));

create policy policies_update_admins
  on public.policies for update to authenticated
  using (public.has_org_role(organisation_id, array['owner', 'admin']))
  with check (public.has_org_role(organisation_id, array['owner', 'admin']));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.policies
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- The quote's own copy
-- ---------------------------------------------------------------------------

alter table public.quotes
  add column policies jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(policies) = 'array'
      and jsonb_array_length(policies) <= 12
      and octet_length(policies::text) <= 40000
    );

grant insert (policies) on public.quotes to authenticated;
grant update (policies) on public.quotes to authenticated;

-- ---------------------------------------------------------------------------
-- save_quote_draft: as before, also carrying p_quote -> 'policies' (a missing key means none).
-- ---------------------------------------------------------------------------

create or replace function public.save_quote_draft(
  p_org uuid,
  p_quote_id uuid,
  p_quote jsonb,
  p_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  qid uuid;
begin
  if p_lines is not null and jsonb_typeof(p_lines) <> 'array' then
    raise exception 'lines must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) > 100 then
    raise exception 'a quote can have at most 100 lines' using errcode = '54000';
  end if;

  if p_quote_id is null then
    insert into public.quotes (
      organisation_id, customer_id, issue_date, valid_until, needed_by,
      quote_discount_kind, quote_discount_value, notes, country_code, currency_code,
      net_cents, vat_cents, gross_cents,
      title, description, sign_off, terms, payment_instructions, policies
    ) values (
      p_org,
      nullif(p_quote ->> 'customer_id', '')::uuid,
      (p_quote ->> 'issue_date')::date,
      (p_quote ->> 'valid_until')::date,
      nullif(p_quote ->> 'needed_by', '')::date,
      coalesce(p_quote ->> 'quote_discount_kind', 'none'),
      coalesce((p_quote ->> 'quote_discount_value')::bigint, 0),
      nullif(p_quote ->> 'notes', ''),
      p_quote ->> 'country_code',
      p_quote ->> 'currency_code',
      coalesce((p_quote ->> 'net_cents')::bigint, 0),
      coalesce((p_quote ->> 'vat_cents')::bigint, 0),
      coalesce((p_quote ->> 'gross_cents')::bigint, 0),
      nullif(p_quote ->> 'title', ''),
      nullif(p_quote ->> 'description', ''),
      nullif(p_quote ->> 'sign_off', ''),
      nullif(p_quote ->> 'terms', ''),
      nullif(p_quote ->> 'payment_instructions', ''),
      coalesce(p_quote -> 'policies', '[]'::jsonb)
    )
    returning id into qid;
  else
    update public.quotes set
      customer_id = nullif(p_quote ->> 'customer_id', '')::uuid,
      issue_date = (p_quote ->> 'issue_date')::date,
      valid_until = (p_quote ->> 'valid_until')::date,
      needed_by = nullif(p_quote ->> 'needed_by', '')::date,
      quote_discount_kind = coalesce(p_quote ->> 'quote_discount_kind', 'none'),
      quote_discount_value = coalesce((p_quote ->> 'quote_discount_value')::bigint, 0),
      notes = nullif(p_quote ->> 'notes', ''),
      net_cents = coalesce((p_quote ->> 'net_cents')::bigint, 0),
      vat_cents = coalesce((p_quote ->> 'vat_cents')::bigint, 0),
      gross_cents = coalesce((p_quote ->> 'gross_cents')::bigint, 0),
      title = nullif(p_quote ->> 'title', ''),
      description = nullif(p_quote ->> 'description', ''),
      sign_off = nullif(p_quote ->> 'sign_off', ''),
      terms = nullif(p_quote ->> 'terms', ''),
      payment_instructions = nullif(p_quote ->> 'payment_instructions', ''),
      policies = coalesce(p_quote -> 'policies', '[]'::jsonb)
     where id = p_quote_id and organisation_id = p_org and status = 'draft'
    returning id into qid;

    if qid is null then
      raise exception 'draft quote not found' using errcode = 'P0002';
    end if;

    delete from public.quote_lines where quote_id = qid and organisation_id = p_org;
  end if;

  insert into public.quote_lines (
    organisation_id, quote_id, sort_order, kind, product_id, name, description,
    quantity_milli, unit_price_cents, discount_kind, discount_value, vat_status, unit
  )
  select
    p_org, qid, l.sort_order, l.kind, l.product_id, l.name, nullif(l.description, ''),
    l.quantity_milli, l.unit_price_cents,
    coalesce(l.discount_kind, 'none'), coalesce(l.discount_value, 0),
    coalesce(l.vat_status, 'standard'), nullif(l.unit, '')
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as l(
    sort_order integer, kind text, product_id uuid, name text, description text,
    quantity_milli bigint, unit_price_cents bigint,
    discount_kind text, discount_value bigint, vat_status text, unit text
  );

  return qid;
end;
$$;

revoke execute on function public.save_quote_draft(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_quote_draft(uuid, uuid, jsonb, jsonb) to authenticated;
