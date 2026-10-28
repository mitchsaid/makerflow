# UX review, 2026-10-28: a new maker, coming from spreadsheets, sending a first quote

The founder asked: "create the persona of a new maker signing up to the app, coming from using spreadsheets, with a goal of sending a quote. Note what they find confusing, unintuitive, difficult, high friction."

## The persona
**Naledi Mokoena**, 34, runs **Naledi's Bakes** from her home kitchen in Soweto. About 15 orders a month, from WhatsApp and Instagram messages. Not VAT registered. She keeps a **Google Sheet** with two tabs: *Price list* (item, size, price, what it costs her) and *Orders* (date, customer, what, total, paid?). She quotes by typing the price into a WhatsApp message and writing the sum on the sheet, and she has lost orders by being slow to reply.

**Goal, in her words:** "Thandi wants 2 boxes of vanilla cupcakes and a two-tier birthday cake. I want to send her a proper quote on WhatsApp, today, from my phone."

**What she expects:** her prices are already typed somewhere, so she expects to bring them across, or at worst type them once. She does not know the words *quote number*, *terms*, *intro*, *sign-off*, *one-off item*, *draft* or *marked as sent*. She does not need a job, an invoice or stock yet.

## How this was done
A scripted walk through the real app on a phone viewport (Pixel 7, 412 x 839) against the local stack, taking the path a first-time user would take from what each screen offers: landing, sign-in, onboarding (she ticks *Food and baking*), Home, New quote, a customer, two items, save, preview, Email, Mark as sent, Home. 23 screens, text and pictures kept. **19 taps and about 14 typed fields** to a sent quote, with no products set up (one-off items). The script is scratch work and is not kept.

**Limits.** One persona and a desktop Chromium pretending to be a phone: how the emailed link opens in a phone's mail app, the phone's own share sheet, how a downloaded PDF is found and attached in WhatsApp, and how the preview reads on a real screen are inferred from the code, not observed. They are marked *(inferred)*.

## What worked
- Home has one clear first step: **Make your first quote**, with *New quote*.
- A customer needs only a name; the phone is optional. The picker adds them in place.
- The document comes out looking finished from the defaults: a greeting, a sign-off in her business name, totals, nothing she has to design.
- The preview is the real document, and nothing is sent until she says so.
- After sending, Home counts the quote as *waiting for an answer*.

## Findings (most damaging first)
Severity is for this persona on a first quote: **High** stops or slows her a lot, **Medium** costs her a moment or a doubt, **Low** is polish.

### P1. There is no way to bring her price list in (High)
The item sheet's last card says **Import from Shopify or a CSV: Coming soon. "Bring in a product list you already have."** That is exactly what a spreadsheet user wants, and it is a dead end. Her real options are one-off items (typed again on every quote, see P2) or making each item a product through a three-tab form (Details, Production, Inputs). For 30 items on her sheet that is an hour before her first quote.
**Proposed:** the simplest import that fits her: **paste from a spreadsheet** (a box where she pastes two columns, name and price, and sees the rows to check), before any file upload or Shopify. Until it exists, the placeholder should not read as a promise she is waiting on (see P6).

### P2. A one-off item is forgotten the moment the quote is saved (High)
She types *Vanilla cupcakes, box of 12, R180* as a one-off item. Nothing offers to keep it. The sheet calls it "just for this quote". Her next quote starts from zero, which is what her spreadsheet already does for her. The way to keep an item (*Add new product*) is a different, longer route that the one-off route never mentions.
**Proposed:** on the one-off item a plain tick, **Keep in my products**, that makes a product with that name and price (the full form stays available for steps and costs later). Or a prompt on the draft: "Keep these two items for next time?"

### P3. "Send" is backwards for someone who sends on WhatsApp (High)
The preview offers **Edit, Download, Email, Mark as sent**.
- *Email* opens a sheet that says "Emailing from MakerFlow is not ready yet" with two *coming soon* cards. The useful line, "download the PDF, send it from your own email or WhatsApp, then choose Mark as sent", is last.
- *Mark as sent* says "Mark it as sent once your customer has it. That locks this version." But she cannot send it from here: the phone's **Share PDF** (the share sheet that reaches WhatsApp) exists only on the quote page *after* it is marked as sent *(inferred for the phone; the code shows it is not on the preview)*. Before that she has *Download*, then finds the file on her phone, then attaches it in WhatsApp.
- So the order she must follow is *mark as sent, then share*, the opposite of what the words say, and marking locks the quote before it has gone anywhere.
**Proposed:** **Share** on the preview (the phone's share sheet) as the main action where the browser can share, and after the share closes a quiet "Did you send it? **Mark as sent**" (or marks it with an Undo). Keep Download. Lead the Email sheet with what to do now, not what is coming.

### P4. The first quote form is a long list of decisions she does not need (High)
It is 12 sections and about 3.6 phone screens tall, in this order: *Quote number and dates* (with a **Change** button for the number and a *needed-by* date), *Customer*, *Intro*, *Items*, *Delivery or collection*, *Discount*, *Deposit*, *Terms and conditions*, *How to pay*, *Notes*, *Sign-off*, and a *coming soon* card. The first screen she sees is the number and two date fields, and her **customer** is half hidden under the pinned bar. What she must do (the customer, the items) is second and fourth. Everything else is optional, but all of it is open and asks her something ("Sign with: The business name (Naledi's Bakes), The owner's name, Another name, No name").
**Proposed (for a first quote, then everyone):** Customer and Items first and open; Dates as one line she can change ("Valid 14 days"); everything else (intro, delivery, discount, deposit, terms, how to pay, notes, sign-off) folded behind one **Add more details**, opening to the same sections. This also answers the earlier proposal to put items before wording (`ux-review-2026-10-25.md`, N3).

### P5. The preview is crowded before it is useful (Medium)
On a phone the page opens with the **Add your logo** card (three buttons: *Add your logo*, *Not now*, *Don't ask me again*) above the document, so the document starts in the middle of the first screen. The pinned bar is two rows of buttons and covers the bottom fifth of the screen. The document is a whole A4 page shrunk to the screen, so its text is small *(inferred: whether it can be enlarged was not tried)*. She came to check the prices and the name.
**Proposed:** the logo prompt becomes one line under the document (or after sending); one row in the bar (*Share* and *Edit*, with the rest behind a ⋯); the document first.

### P6. Dead ends in the path to a first quote (Medium)
Four places say *coming soon* on the way: the landing page's **Try the demo (coming soon)** button; the item sheet's **Import** card (P1); the **Email** sheet (P3); and **Customer agrees to the terms: Coming soon** at the foot of the quote form. Each is deliberate (thin slices keep the full feature visible, `product-brief.md`, principle 9). The cost for her is that the import card, the one she wanted, reads as "this app can't do what I need", and the Email tap is spent finding that out.
**Proposed:** keep them, but quieter: a line of text at the end of a screen rather than a card with a badge in the middle of a choice, never a button-shaped control that does nothing, and never above the thing that works.

### P7. Signing in leaves the app (Medium) *(inferred)*
There is no password and no Google button (Google is off until it is configured). She enters an email, sees "Check your email … works once and expires soon", opens her mail app, taps the link, and lands in whichever browser the mail app uses, which may not be the one she will use next time. Coming back later means another email each time.
**Proposed:** Google sign-in before launch (it is built and untested against a real project, `CLAUDE.md`); on the "Check your email" screen, a button that opens the mail app; keep people signed in for a long time on a phone.

### P8. Words that mean something only to the app's author (Medium)
- **One-off item (just for this quote)**: she thinks of it as "an item".
- **Unit (optional)** next to **Quantity**: she types the unit into the name instead ("box of 12"), because a unit is not something she thinks about.
- **What it costs you (optional) / Private / (never shown to your customer)**: fine for the maker who counts costs, noise for her today, and it is open on every item.
- **Intro**, **Sign-off**, **Sign with**, **Terms and conditions: Your rules for the order … No terms yet. Write one and use it on every quote.**: she did not know these were things.
- **Valid until**, **needed-by**, **Draft**, **Mark as sent**, **locks this version**, **revise**: a quote is a message to her, not a versioned document.
**Proposed:** a pass on these words with her vocabulary (*Add an item*, *Valid for 14 days*, *Message at the top*, *Message at the bottom*), and fold the cost box into *Add more details* on the item as well.

### P9. Nothing tells her the quote has no way to pay on it (Low)
*How to pay* is empty ("No ways to pay yet. Add them once for every quote."), and neither the preview nor the *Mark as sent* sheet says that the document shows no bank details. A baker who takes a deposit would want them on it. By contrast the missing phone or email is flagged, but only in the last sheet (P10).
**Proposed:** one line on the preview, "No way to pay is on this quote. Add one", beside the contact line.

### P10. The "no phone or email on your quote" warning arrives at the last step (Low)
"Your quote shows no phone number or email for customers to reach you. Add one in your Business profile." appears only in the *Mark as sent* sheet. The preview she has just checked has no contact details, so the discovery comes after she has approved it. (PR 144 gives that link a way back to the preview.)
**Proposed:** show it on the preview, with the logo line (P5).

### P11. A list-shaped skeleton shows before the new quote form (Low)
Opening *New quote* first shows three grey cards (the Quotes list's loading state), then the form. It looks like she tapped the wrong thing for a moment.
**Proposed:** a loading state shaped like the form, or none.

### P12. After sending, three next steps compete (Low, already known)
The sent quote shows "Already a yes? Record it and start the job" with a filled **Turn into a job**, then "Has your customer answered?" with *They accepted / They declined / Withdraw*, then *Download PDF* and *Revise this quote*. This is `ux-review-2026-10-25.md` N1 and N2; it is more visible to someone with no job to make yet. The thing she may want next, sharing the PDF again, is last.

## What to do first (my suggestion)
1. **P3 (share first, then mark)** and **P4 (a short first quote)**: these two decide whether she sends the quote in the minutes she has. Both are changes to existing screens, no new data.
2. **P2 (keep a one-off item)** and then **P1 (paste a price list)**: together they are her spreadsheet. P2 is small; P1 is a slice with its own plan (paste, check the rows, make products).
3. **P5, P9, P10 (a calmer preview)** as one pass, with **P11**.
4. **P6, P8 (dead ends and words)** as a copy pass; **P7** with the Google sign-in work.

Nothing here is built; each would get its own plan and slice.
