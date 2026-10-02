# ADR 0005: How forms handle errors

Status: accepted (founder, 2026-10-02: buttons should not grey out silently; a message on click is clearer)

## Decision
1. **Primary buttons stay enabled.** The only time a submit button is disabled is while its own request is running, and then its label says what is happening ("Saving…"). A button is never disabled just because the form is incomplete.
2. **Clicking with problems shows them.** Nothing is sent. Each problem appears under its field (`FieldError`, with `aria-invalid` and `aria-describedby` on the input), and a summary (`FormSummary` in `app/src/components/form-feedback.tsx`) says how many things need fixing, lists them with the field's name, scrolls into view and takes focus. Each entry is a link that moves focus to its field.
3. **Errors appear only after interaction.** No red on first render. Field messages appear after a failed submit (and, where it helps, after leaving a field that was touched).
4. **Messages say how to fix the problem,** in plain words: "Choose a customer so we know who the quote is for", never "Invalid input". Money, quantity and percentage parsers return these messages.
5. **A "still needed" hint is allowed** next to a primary action when a form needs several things (for example the quote builder: "Still needed: a customer, at least one item"). It informs; it never replaces rule 2 and never disables the button.
6. **Typed data is never lost.** A failed save keeps everything on screen. Server-side validation errors map back to fields and appear in the same places. A network or server failure says so and offers a retry ("Couldn't save. Your changes are still here.").
7. **Disabled is allowed only when an action is impossible and the reason is shown beside it** (for example "Send" is replaced by a status when the quote is already accepted).
8. **Destructive actions** say what will happen, and prefer an undo over a confirmation where undo is possible.
9. **Accessibility:** summaries and field errors are announced (`role="alert"`), focus moves deliberately, and every new screen gets a case in `e2e/accessibility.spec.ts` in its error state.

## Why
A greyed-out button hides *why* it is greyed out, which on a phone leaves a person guessing. Showing the problem where it is, and taking them to it, is faster and works for screen readers.

## Applied so far
The Business profile form. The money parsers return plain-language messages. Remaining forms (sign-in, onboarding) have a single field and already show its error; they adopt the summary if they grow. The quote builder, customers and every later form follow this from the start.

## Where it is tested
`e2e/business-profile.spec.ts`: the button is enabled, the summary appears and takes focus with the right count, each field shows its message, typed data stays, a summary link focuses its field, and fixing everything clears the summary. `e2e/accessibility.spec.ts` checks the error state with axe in light and dark.
