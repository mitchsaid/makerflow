# Plan: first-quote setup (two questions)

Status: **built 2026-10-08.** Founder, after a discussion of a longer questionnaire: "Maybe just the questions on deposit and collection/delivery." The migration `20261018100000` needs human review (two new columns and a column grant on `business_profiles`).

## Why
The quote form can start closer to how the maker really works. Two answers do that and nothing else is asked: whether they usually ask for a deposit, and whether customers collect or they deliver. It follows `onboarding.md` ("just in time, no setup wizard") by appearing at the first **New quote**, not at sign-up, and by only ever setting defaults.

## What the maker sees
- The first time an **owner or admin** opens **New quote** (and the business has no quote yet), the page shows a short card **in place of the empty form**: "Two quick questions, so your quotes start the way you work."
  1. **Do you usually ask for a deposit?** No / Yes. Yes asks "How much?" as a percentage (50 to start), which becomes the deposit every new quote starts with.
  2. **How do customers get their order?** They collect / I deliver / It varies.
  Buttons: **Save and start my quote** (the main one) and **Skip for now**. The card says what the answers do and that they can be changed any time under Quotes and invoices.
- Then the usual form, started the way they said: the deposit section ticked with their percentage; Collection or Delivery already chosen (and the delivery address and fee fields showing, for delivery). "It varies" and skipping change nothing. Every quote can still change both.
- **Staff** (who can't change business settings) never see the card and get the plain form.
- **Changing the answers later:** under Quotes and invoices, the existing Deposit section, and a new "Delivery or collection" section ("New quotes start with: nothing chosen / collection / delivery").

## Data (migration `20261018100000_quote_setup.sql`)
- `business_profiles.usual_fulfilment` (`collection`, `delivery` or null) and `quote_setup_at` (null = not asked yet; set by answering or skipping). Owners and admins update both through the existing profile policy plus a column grant. The deposit answer uses the existing default-deposit columns.
- Businesses that already have a quote are marked as set up, so nobody with a history is asked.
- One update writes the deposit, the hand-over and the stamp together; the card is shown once per business, not once per person.

## Tests
Unit: parsing the answers. SQL: grant and check (staff cannot change, another business untouched, bad value refused), the backfill. Browser: the card on the first quote, answers carried into the form, skip, staff don't see it, changing the answers under Quotes and invoices. Accessibility: the card.

## Not built
Other questions (VAT is already in the Business profile; how customers are reached waits for email sending), pre-ticking policies, anything that hides a feature.
