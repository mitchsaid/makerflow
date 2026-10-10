# ADR 0008: How "add" actions look

Status: accepted (founder, 2026-10-10: "for add actions, why not use an icon button with a plus? Maybe this can be a UX standard")

## Decision
1. **Every action that adds something is an `AddButton` (or an `AddLink`, when it goes to another page)** from `app/src/components/add-button.tsx`: a plus icon, then a short label that says what is added ("Add item", "Add another choice", "Add a variation", "Add an extra").
2. **The label stays.** A bare plus was considered and rejected as the standard: a screen often has several add actions ("Add another choice" and "Add a variation" sit one under the other), and a lone plus does not say which. Screen readers need the words too, and a maker who has never seen the app learns nothing from an icon. The plus is decoration (`aria-hidden`); the button's name is its label.
3. **An icon-only plus is allowed only where there is truly no room** (a tight row on a phone), and then it carries the label for assistive technology (`aria-label`) and is still 44 px. None exists yet.
4. **Look:** outline by default; the filled (primary) look only when adding is the main thing on the screen (the "Add customer" button on an empty-ish list, "Add new product" in the item picker).
5. **Not add actions:** submit buttons that finish a form ("Add product", "Add customer", "Add to quote") are ordinary submit buttons with no plus: they save what is on the screen rather than start something new.
6. **Remove** actions stay as they are (a trash icon button or a text button); their names say what they remove.

## Where it is checked
`app/src/components/__tests__/add-actions.test.ts` reads the screens and fails if a plain `Button` (not a submit) or a button-styled `Link` has a label starting with "Add" or "Make a new". `e2e/accessibility.spec.ts` covers the screens with axe, which checks the buttons' names.
