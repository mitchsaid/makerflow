-- Document numbering: one sequence per business and document type (quote, invoice,
-- credit note), with an editable prefix and next number (to continue from another system).
--
-- Numbers are handed out by issue_document_number(), which locks the sequence row. The
-- increment happens in the SAME transaction as whatever uses the number, so if that
-- transaction fails the increment is rolled back too: no gaps from failures. Drafts never
-- take a number (quotes are numbered when first sent).
--
-- SECURITY-SENSITIVE: new table with row-level security and a security-definer function.
-- Needs human review before this is applied to any hosted project.
--
-- issue_document_number is INTERNAL: it is not callable by signed-in users. Later functions
-- (issuing a quote, an invoice) call it after doing their own role and session checks.
-- Editing the prefix and next number from Settings arrives with the issuing slice, as a
-- separate checked function.

create table public.document_sequences (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  doc_type text not null check (doc_type in ('quote', 'invoice', 'credit_note')),
  prefix text not null check (prefix ~ '^[A-Za-z0-9._/-]{0,12}$'),
  next_number integer not null default 1 check (next_number >= 1),
  min_digits smallint not null default 4 check (min_digits between 1 and 10),
  last_issued_number integer check (last_issued_number is null or last_issued_number >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organisation_id, doc_type)
);

create trigger document_sequences_set_updated_at
  before update on public.document_sequences
  for each row execute function public.set_updated_at();

revoke all on public.document_sequences from anon, authenticated;
grant select on public.document_sequences to authenticated;

alter table public.document_sequences enable row level security;

create policy document_sequences_select_members
  on public.document_sequences for select to authenticated
  using (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.document_sequences
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

create function public.issue_document_number(org_id uuid, kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  default_prefix text;
  seq public.document_sequences%rowtype;
  issued integer;
begin
  default_prefix := case kind
    when 'quote' then 'QT-'
    when 'invoice' then 'INV-'
    when 'credit_note' then 'CN-'
  end;
  if default_prefix is null then
    raise exception 'unknown document type %', kind using errcode = '22023';
  end if;

  -- First use creates the row with the defaults. Concurrent first uses are safe.
  insert into public.document_sequences (organisation_id, doc_type, prefix)
  values (org_id, kind, default_prefix)
  on conflict (organisation_id, doc_type) do nothing;

  -- The lock serialises everyone issuing this type of number for this business.
  select * into seq
    from public.document_sequences
   where organisation_id = org_id and doc_type = kind
     for update;

  issued := seq.next_number;

  update public.document_sequences
     set next_number = issued + 1,
         last_issued_number = issued
   where organisation_id = org_id and doc_type = kind;

  -- lpad() would CUT a number longer than the padding width (12345 -> 123), so only pad
  -- when the number is shorter than the minimum width.
  return seq.prefix || case
    when length(issued::text) >= seq.min_digits then issued::text
    else lpad(issued::text, seq.min_digits, '0')
  end;
end;
$$;

revoke execute on function public.issue_document_number(uuid, text) from public, anon, authenticated;
