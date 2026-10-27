-- Ways to pay, slice 2: a QR code picture (docs/plans/payment-methods.md; founder, 2026-10-26: "a QR is an uploaded
-- picture first").
--
-- SECURITY-SENSITIVE: a QR code sends money, so it is as sensitive as an account number. A way to pay is still changed
-- only by owners (migration 20261122100000_payment_methods.sql); this adds the picture it points at. Needs human review
-- before it is applied to any hosted project.
--
-- * images.kind gains 'payment-qr' (the picture is kept whole, never cropped, at a size a scanner reads).
-- * payment_methods.image_id points at a picture of the SAME business (a composite foreign key, as the product photo and
--   the logo do). Pictures are never deleted by people; if one ever goes (a deleted account), the way keeps its words
--   and loses only the pointer.

alter table public.images drop constraint images_kind_check;
alter table public.images
  add constraint images_kind_check check (kind in ('product', 'logo', 'background', 'payment-qr'));

alter table public.payment_methods add column image_id uuid;
alter table public.payment_methods
  add constraint payment_methods_image_same_org
  foreign key (organisation_id, image_id) references public.images (organisation_id, id)
  on delete set null (image_id);
grant insert (image_id), update (image_id) on public.payment_methods to authenticated;
