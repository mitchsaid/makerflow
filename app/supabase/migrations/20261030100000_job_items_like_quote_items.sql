-- A job's items are added the way a quote's are (founder, 2026-10-12): the same item sheet, so an item can be one of the
-- business's products or services with its chosen variation and choices, or a one-off. create_job now takes those.
--
-- SECURITY-SENSITIVE: replaces the service-role-only security-definer function create_job (same signature, so the
-- revoke and grant from 20261029100000 stay as they are). Needs human review before it is applied to a hosted project.
--
-- p_items: a JSON array of 1 to 50 items. Each item:
--   { kind: 'product' | 'service' | 'custom', name, description, quantityMilli, unit,
--     variationLabel, variationName   (both text, or both empty),
--     options: [ { group, kind: 'one' | 'any' | 'text', value, text, quantityMilli } ]   (up to 50),
--     photoImageId: a picture of this business (the composite foreign key refuses any other), or empty }
-- Everything is checked before anything is written, and only these fields are stored (rebuilt, not copied).
-- Errors: 22023 the customer is not found in this business, or something is not valid.

create or replace function public.create_job(
  p_org uuid,
  p_actor uuid,
  p_customer_id uuid,
  p_fulfilment text,
  p_delivery_address text,
  p_needed_by date,
  p_note text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.customers%rowtype;
  item jsonb;
  opt jsonb;
  opts jsonb;
  clean jsonb;
  i integer := 0;
  n integer;
  jid uuid;
  addr text := nullif(btrim(p_delivery_address), '');
  note_text text := nullif(btrim(p_note), '');
  vlabel text;
  vname text;
  photo uuid;
  bad constant text := 'an item is not valid';
begin
  if p_fulfilment not in ('none', 'collection', 'delivery') then
    raise exception 'unknown fulfilment' using errcode = '22023';
  end if;
  if addr is not null and (p_fulfilment <> 'delivery' or char_length(addr) > 1000) then
    raise exception 'an address belongs to a delivery, up to 1000 characters' using errcode = '22023';
  end if;
  if note_text is not null and char_length(note_text) > 2000 then
    raise exception 'the note is too long' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'a job needs 1 to 50 items' using errcode = '22023';
  end if;

  select * into c from public.customers where id = p_customer_id and organisation_id = p_org and archived_at is null;
  if not found then
    raise exception 'customer not found' using errcode = '22023';
  end if;

  -- Check every item before anything is written.
  for item in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object'
       or jsonb_typeof(item -> 'name') is distinct from 'string'
       or char_length(btrim(item ->> 'name')) not between 1 and 300
       or jsonb_typeof(item -> 'quantityMilli') is distinct from 'number'
       or (item ->> 'quantityMilli') !~ '^[0-9]{1,10}$'
       or jsonb_typeof(item -> 'kind') is distinct from 'string'
       or (item ->> 'kind') not in ('product', 'service', 'custom') then
      raise exception '%', bad using errcode = '22023';
    end if;
    -- (the cast only runs once the text is known to be digits)
    if (item ->> 'quantityMilli')::bigint not between 1 and 9999999999 then
      raise exception '%', bad using errcode = '22023';
    end if;
    if (item -> 'description' is not null and jsonb_typeof(item -> 'description') not in ('string', 'null'))
       or char_length(coalesce(item ->> 'description', '')) > 4000
       or (item -> 'unit' is not null and jsonb_typeof(item -> 'unit') not in ('string', 'null'))
       or char_length(coalesce(item ->> 'unit', '')) > 20 then
      raise exception '%', bad using errcode = '22023';
    end if;

    -- The variation: both words or neither.
    vlabel := nullif(btrim(item ->> 'variationLabel'), '');
    vname := nullif(btrim(item ->> 'variationName'), '');
    if (item -> 'variationLabel' is not null and jsonb_typeof(item -> 'variationLabel') not in ('string', 'null'))
       or (item -> 'variationName' is not null and jsonb_typeof(item -> 'variationName') not in ('string', 'null'))
       or (vlabel is null) <> (vname is null)
       or char_length(coalesce(vlabel, '')) > 200
       or char_length(coalesce(vname, '')) > 200 then
      raise exception '%', bad using errcode = '22023';
    end if;

    -- The picture: empty, or an id (whose owner the foreign key checks on insert).
    if item -> 'photoImageId' is not null and jsonb_typeof(item -> 'photoImageId') not in ('string', 'null') then
      raise exception '%', bad using errcode = '22023';
    end if;
    if nullif(item ->> 'photoImageId', '') is not null
       and (item ->> 'photoImageId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception '%', bad using errcode = '22023';
    end if;

    -- The choices.
    opts := coalesce(item -> 'options', '[]'::jsonb);
    if jsonb_typeof(opts) = 'null' then
      opts := '[]'::jsonb;
    end if;
    if jsonb_typeof(opts) <> 'array' or jsonb_array_length(opts) > 50 then
      raise exception '%', bad using errcode = '22023';
    end if;
    for opt in select * from jsonb_array_elements(opts) loop
      if jsonb_typeof(opt) <> 'object'
         or jsonb_typeof(opt -> 'group') is distinct from 'string'
         or char_length(btrim(opt ->> 'group')) not between 1 and 200
         or jsonb_typeof(opt -> 'kind') is distinct from 'string'
         or (opt ->> 'kind') not in ('one', 'any', 'text')
         or (opt -> 'value' is not null and jsonb_typeof(opt -> 'value') not in ('string', 'null'))
         or char_length(coalesce(opt ->> 'value', '')) > 200
         or (opt -> 'text' is not null and jsonb_typeof(opt -> 'text') not in ('string', 'null'))
         or char_length(coalesce(opt ->> 'text', '')) > 4000
         or (opt -> 'quantityMilli' is not null and jsonb_typeof(opt -> 'quantityMilli') not in ('number', 'null')) then
        raise exception '%', bad using errcode = '22023';
      end if;
      if jsonb_typeof(opt -> 'quantityMilli') = 'number'
         and ((opt ->> 'quantityMilli') !~ '^[0-9]{1,10}$' or (opt ->> 'quantityMilli')::bigint not between 1 and 9999999999) then
        raise exception '%', bad using errcode = '22023';
      end if;
    end loop;
  end loop;

  -- Numbers count up per business, in the same sequence as jobs made from quotes.
  perform pg_advisory_xact_lock(hashtextextended('jobs:' || p_org::text, 0));
  select coalesce(max(number), 0) + 1 into n from public.jobs where organisation_id = p_org;

  insert into public.jobs (
    organisation_id, number, quote_id, quote_version, status, fulfilment, delivery_address, needed_by,
    customer_name, customer_contact_person, customer_phone, customer_email, customer_id, note, created_by
  ) values (
    p_org, n, null, null, 'not_started', p_fulfilment, addr, p_needed_by,
    left(btrim(c.name), 200), nullif(left(btrim(c.contact_person), 200), ''), nullif(left(btrim(c.phone), 100), ''),
    nullif(left(btrim(c.email), 320), ''), c.id, note_text, p_actor
  ) returning id into jid;

  for item in select * from jsonb_array_elements(p_items) loop
    -- Only the known fields are kept, rebuilt rather than copied.
    clean := coalesce((
      select jsonb_agg(jsonb_build_object(
        'group', btrim(o ->> 'group'),
        'kind', o ->> 'kind',
        'value', nullif(btrim(o ->> 'value'), ''),
        'text', nullif(btrim(o ->> 'text'), ''),
        'quantityMilli', case when jsonb_typeof(o -> 'quantityMilli') = 'number' then (o ->> 'quantityMilli')::bigint end
      ) order by ord)
      from jsonb_array_elements(coalesce(nullif(item -> 'options', 'null'::jsonb), '[]'::jsonb)) with ordinality as t(o, ord)
    ), '[]'::jsonb);
    photo := nullif(item ->> 'photoImageId', '')::uuid;

    insert into public.job_items (
      organisation_id, job_id, sort_order, kind, name, description, quantity_milli, unit,
      variation_label, variation_name, options, photo_image_id
    ) values (
      p_org, jid, i, item ->> 'kind', btrim(item ->> 'name'), nullif(btrim(item ->> 'description'), ''),
      (item ->> 'quantityMilli')::bigint, nullif(btrim(item ->> 'unit'), ''),
      nullif(btrim(item ->> 'variationLabel'), ''), nullif(btrim(item ->> 'variationName'), ''), clean, photo
    );
    i := i + 1;
  end loop;

  insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, actor_id)
  values (p_org, jid, 'created', null, 'not_started', p_actor);

  return jid;
end;
$$;
