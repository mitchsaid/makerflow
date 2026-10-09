-- One "Terms" (docs/plans/terms.md): the policies library and the free-text Terms box become one.
--
-- SECURITY-SENSITIVE / DATA: copies data and retires two columns. Needs human review before this is
-- applied to any hosted project. Nothing is deleted: the old columns stay, unused, as a backup.
--
-- * The library keeps its table (policies) and a quote its column (quotes.policies); only the
--   words on screen change. A term's title becomes optional; its wording can be up to 4000
--   characters (the Terms box allowed 4000). A quote can carry up to 20 terms.
-- * Each business's default terms text becomes an untitled library term, included on new quotes,
--   last in the list. Each quote's own terms text (drafts and sent rows: a sent row is the copy
--   a revision starts from) becomes an untitled term at the end of that quote's terms: a copy of
--   that library term when it is the same text, else a term just for that quote. Sent
--   versions (quote_versions snapshots) are frozen and keep what they showed.
-- * Then quotes.terms and business_profiles.default_terms are retired: kept as they are (a backup
--   of what was copied), no longer written by anyone (the grants go), and save_quote_draft no
--   longer carries terms. A later clean-up migration drops them once this has been checked.

alter table public.policies alter column title drop not null;
alter table public.policies drop constraint policies_title_check;
alter table public.policies add constraint policies_title_check check (title is null or char_length(title) between 1 and 80);
alter table public.policies drop constraint policies_body_check;
alter table public.policies add constraint policies_body_check check (char_length(body) between 1 and 4000);

alter table public.quotes drop constraint quotes_policies_check;
alter table public.quotes add constraint quotes_policies_check check (
  jsonb_typeof(policies) = 'array' and jsonb_array_length(policies) <= 20 and octet_length(policies::text) <= 100000
);

-- The moves.
insert into public.policies (organisation_id, title, body, include_by_default, sort_order)
select bp.organisation_id, null, bp.default_terms, true,
       coalesce((select max(p.sort_order) + 1 from public.policies p where p.organisation_id = bp.organisation_id), 0)
  from public.business_profiles bp
 where bp.default_terms is not null;

-- A quote's terms text is usually the business's default terms, copied when the quote was made: then
-- it becomes a copy of that new library term (so the library term shows ticked, not twice). Otherwise
-- it is a term just for that quote. Untitled library terms can only be the ones made just above.
-- Moving the text is not an edit by the maker: the quote keeps its "last changed" time (lists are
-- sorted by it, and sending checks it).
alter table public.quotes disable trigger quotes_set_updated_at;
update public.quotes q
   set policies = q.policies || jsonb_build_array(jsonb_build_object(
         'policy_id', (select p.id from public.policies p
                        where p.organisation_id = q.organisation_id and p.title is null and p.body = q.terms
                        limit 1),
         'title', null,
         'body', q.terms))
 where q.terms is not null;
alter table public.quotes enable trigger quotes_set_updated_at;

-- save_quote_draft without terms (an older app that still sends them has them ignored).
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
      title, description, sign_off, payment_instructions, policies, show_bank_details,
      deposit_kind, deposit_value, balance_due, balance_due_date, delivery_address, show_photos
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
      nullif(p_quote ->> 'payment_instructions', ''),
      coalesce(p_quote -> 'policies', '[]'::jsonb),
      coalesce((p_quote ->> 'show_bank_details')::boolean, true),
      coalesce(p_quote ->> 'deposit_kind', 'none'),
      coalesce((p_quote ->> 'deposit_value')::bigint, 0),
      coalesce(p_quote ->> 'balance_due', 'handover'),
      nullif(p_quote ->> 'balance_due_date', '')::date,
      nullif(btrim(p_quote ->> 'delivery_address'), ''),
      coalesce((p_quote ->> 'show_photos')::boolean, true)
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
      payment_instructions = nullif(p_quote ->> 'payment_instructions', ''),
      policies = coalesce(p_quote -> 'policies', '[]'::jsonb),
      show_bank_details = coalesce((p_quote ->> 'show_bank_details')::boolean, true),
      -- A payload without the deposit keys (an older app still open on a phone) keeps what the draft has.
      deposit_kind = coalesce(p_quote ->> 'deposit_kind', deposit_kind),
      deposit_value = coalesce((p_quote ->> 'deposit_value')::bigint, deposit_value),
      balance_due = coalesce(p_quote ->> 'balance_due', balance_due),
      balance_due_date = case when p_quote ? 'balance_due' then nullif(p_quote ->> 'balance_due_date', '')::date else balance_due_date end,
      -- Same for the delivery address: a payload without the key keeps what the draft has.
      delivery_address = case when p_quote ? 'delivery_address' then nullif(btrim(p_quote ->> 'delivery_address'), '') else delivery_address end,
      -- And the photos switch: a payload without it keeps the draft's.
      show_photos = coalesce((p_quote ->> 'show_photos')::boolean, show_photos)
     where id = p_quote_id and organisation_id = p_org and status = 'draft'
    returning id into qid;

    if qid is null then
      raise exception 'draft quote not found' using errcode = 'P0002';
    end if;

    delete from public.quote_lines where quote_id = qid and organisation_id = p_org;
  end if;

  insert into public.quote_lines (
    organisation_id, quote_id, sort_order, kind, product_id, name, description,
    quantity_milli, unit_price_cents, discount_kind, discount_value, vat_status, unit,
    variation_id, variation_label, variation_name, options
  )
  select
    p_org, qid, l.sort_order, l.kind, l.product_id, l.name, nullif(l.description, ''),
    l.quantity_milli, l.unit_price_cents,
    coalesce(l.discount_kind, 'none'), coalesce(l.discount_value, 0),
    coalesce(l.vat_status, 'standard'), nullif(l.unit, ''),
    l.variation_id, nullif(l.variation_label, ''), nullif(l.variation_name, ''),
    coalesce(l.options, '[]'::jsonb)
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as l(
    sort_order integer, kind text, product_id uuid, name text, description text,
    quantity_milli bigint, unit_price_cents bigint,
    discount_kind text, discount_value bigint, vat_status text, unit text,
    variation_id uuid, variation_label text, variation_name text, options jsonb
  );

  return qid;
end;
$$;

revoke execute on function public.save_quote_draft(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_quote_draft(uuid, uuid, jsonb, jsonb) to authenticated;

-- Retired, not dropped.
revoke insert (terms), update (terms) on public.quotes from authenticated;
revoke update (default_terms) on public.business_profiles from authenticated;
comment on column public.quotes.terms is
  'Retired by 20261023100000_terms: copied into policies as an untitled term. Unused; drop in a later clean-up.';
comment on column public.business_profiles.default_terms is
  'Retired by 20261023100000_terms: copied into the policies library as an untitled term. Unused; drop in a later clean-up.';
