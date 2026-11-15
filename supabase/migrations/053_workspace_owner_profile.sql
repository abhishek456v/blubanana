-- 053: Whose details are on an invoice, and the PAN to put on it.
--
-- ── What was wrong ───────────────────────────────────────────────────────────
--
-- An invoice names its supplier and says where to pay: the creator's name,
-- address, GSTIN, UPI id and bank account. The app filled those from the
-- signed-in user's own profile, which is the creator's only when the creator
-- is the one signed in. A manager opening one of the creator's invoices saw
-- (and printed to PDF) her own details as the supplier and the payee. Found on
-- 15 Nov 2026: an invoice as a manager read "GSTIN: GARBAGE ... UPI: not a
-- upi", the manager's own half-finished profile.
--
-- A profile is readable by its owner only, which is right: it holds bank
-- details. So the manager's app had no honest way to read the creator's, and
-- fell back to the one thing it could read.
--
-- ── The fix ──────────────────────────────────────────────────────────────────
--
-- One function hands back the profile of the owner of the workspace the caller
-- is working in, with each field released only to somebody entitled to it. It
-- is the one place that decides, so the screen, the PDF and the rate card all
-- get the same answer, and a hidden field is absent from the response rather
-- than present and hidden by the interface.
--
--   identity   name, niche, follower count, card theme and photo: any member.
--   invoicing  phone, address, GSTIN, PAN: the owner, or a member allowed
--              Invoices or Bank and billing details.
--   payment    UPI id, account number, IFSC: the owner, or a member allowed
--              Bank and billing details.
--
-- `payment_hidden` and `invoicing_hidden` say which were withheld, so a screen
-- can tell a manager "ask the creator" instead of printing an invoice with an
-- empty payee and no explanation.
--
-- ── PAN ──────────────────────────────────────────────────────────────────────
--
-- The Settings screen has promised "PAN, GSTIN and bank details for invoices"
-- since Phase 3, and PRODUCT.md §8.8 lists PAN among what an invoice pulls
-- from the profile. There was never a column to hold it.
--
-- Safe to re-run.

alter table profiles add column if not exists pan text;

-- Ten characters, five letters, four digits, a letter. Checked here as well as
-- in the app so a bad value cannot arrive from anywhere else. Null is allowed:
-- most creators have no reason to fill it in until they are invoicing.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_pan_format'
  ) then
    alter table profiles
      add constraint profiles_pan_format
      check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$') not valid;
  end if;
end $$;

create or replace function workspace_owner_profile()
returns table (
  id                  uuid,
  name                text,
  phone               text,
  follower_count      integer,
  niche               text,
  address             text,
  gstin               text,
  pan                 text,
  upi_id              text,
  bank_account_number text,
  ifsc_code           text,
  card_theme          text,
  card_photo_id       uuid,
  created_at          timestamptz,
  invoicing_hidden    boolean,
  payment_hidden      boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select m.workspace_id,
           (m.role = 'owner')                          as is_owner,
           coalesce(m.can_see_invoices, false)         as invoices,
           coalesce(m.can_see_banking, false)          as banking
      from memberships m
     where m.user_id = auth.uid()
       and m.status = 'active'
       and m.workspace_id = auth_active_workspace_id()
  ), owner_row as (
    select o.user_id
      from me
      join memberships o on o.workspace_id = me.workspace_id and o.role = 'owner'
     order by o.created_at
     limit 1
  )
  select p.id,
         p.name,
         case when me.is_owner or me.invoices or me.banking then p.phone   end,
         p.follower_count,
         p.niche,
         case when me.is_owner or me.invoices or me.banking then p.address end,
         case when me.is_owner or me.invoices or me.banking then p.gstin   end,
         case when me.is_owner or me.invoices or me.banking then p.pan     end,
         case when me.is_owner or me.banking then p.upi_id              end,
         case when me.is_owner or me.banking then p.bank_account_number end,
         case when me.is_owner or me.banking then p.ifsc_code           end,
         p.card_theme,
         p.card_photo_id,
         p.created_at,
         not (me.is_owner or me.invoices or me.banking),
         not (me.is_owner or me.banking)
    from owner_row
    join profiles p on p.id = owner_row.user_id
    cross join me
$$;

revoke all on function workspace_owner_profile() from public, anon;
grant execute on function workspace_owner_profile() to authenticated;
