# ADR 0003: UI components with shadcn/ui

Status: accepted (founder asked for it on 2026-10-01; plan in `docs/plans/ui-foundation-shadcn.md`)

## Decision
Use **shadcn/ui** (Tailwind v4, React 19, Next.js 16). Components are copied into `app/src/components/ui/` and are ours to edit. Add new ones with `pnpm dlx shadcn@latest add <name>`. New screens use these components; no hand-written buttons, inputs or cards.

## Choices made while setting it up
- **Base library: Base UI** (`@base-ui/react`), the shadcn CLI's default (`base-nova` preset). Radix is the other option. Not compared in depth; revisit only if a needed component is missing or poorly supported.
- **Theme:** our warm palette is mapped onto shadcn's variable names in `globals.css`. `primary` is our terracotta brand colour. Note shadcn's `accent` means a subtle hover surface, not the brand colour, so the old `text-accent` classes became `text-primary`. Dark mode follows the phone (`prefers-color-scheme`); the shadcn CLI's class-based dark mode was replaced.
- **Phone rules baked into the components:** buttons and inputs are 44 px high (48 px for `lg`), input and button text is 16 px (smaller makes iPhones zoom the page), the checkbox is 20 px with a larger tap area.
- **Province picker is a native `<select>`** (shadcn's `NativeSelect`), not the custom Select. Phones show their own picker, which is faster and more familiar, and it needs no extra JavaScript.
- **Card titles are real headings.** shadcn's `CardTitle` is a `div`; we changed it to `h2` (the browser tests caught the lost headings).
- Not added yet: dialogs, sheets, dropdowns, tables, tabs, command palette, toasts, date picker. Add when a screen needs them.

## New dependencies (supply chain)
`@base-ui/react`, `class-variance-authority`, `lucide-react` (icons), `tw-animate-css`, `shadcn` (provides `shadcn/tailwind.css`), and `cn` (class-name merging, v0.4, published by the shadcn maintainer under the shadcn-ui GitHub organisation; it replaces the older clsx plus tailwind-merge pair and is quite new). Dev-only: `@axe-core/playwright` (accessibility checks). Dependabot covers updates. If `cn` ever causes trouble, replace it with clsx plus tailwind-merge in `src/lib/utils.ts` and the component imports.

## Checks added
- `e2e/accessibility.spec.ts`: automated axe checks (contrast, labels, names, headings) on the landing page, sign-in (with an error), home with the prompt, settings, and settings with errors, in light and dark. Mutation-checked: a low-contrast colour makes it fail.
- The VAT checkbox is now found by role (`getByRole("checkbox")`) in the browser tests: the library keeps a hidden form input beside the visible control, and a plain label lookup matched both.

## Rule (also in CLAUDE.md)
New UI uses `components/ui`. Tap targets at least 44 px, input text at least 16 px, headings are real headings, and new screens pass the accessibility test.

## Addendum 2026-10-15: button levels and visible shapes
The founder found "Use my usual" looked like floating text. The cause was that the app had two levels of button, the one filled primary and `ghost` (no border, no fill), and every small action fell to `ghost`. Now:

| Level | Variant | Use |
|---|---|---|
| Main action of the screen | `default` (filled terracotta) | One per screen or sheet: "Continue to preview", "Save logo". |
| Small action inside a form or card | `soft` (tinted brand colour, thin brand border) | "Use my usual", "Save as my usual", "Change the wording", "Show all items". The brand colour tells you it is an action; the quieter fill keeps it below the main one. |
| Other secondary action, a dismissal | `outline` | "Cancel", "Not now", "Back", "Remove picture". |
| Taking something away | `danger` (outline, red text) | "Remove", "Delete" on a row. The confirming step ("Yes, delete") is `destructive`. |
| Icon-only | `ghost` with `size="icon"` | Close, remove-row icons. Needs an `aria-label`. |

A button with words on it is never `ghost`: `src/components/__tests__/button-styles.test.ts` fails if one is. Inline actions that go to another page are links; give them the same shape with `buttonVariants` if they are an action, not a sentence.

Also in this pass: section and card titles are larger and bolder (`text-lg font-semibold`) so a long form reads as sections, not one column of labels; cards have a light shadow to lift them off the cream page. Status chips (quote and job) already existed and were left alone. Colour tokens are unchanged. Anything further (illustrations, a second accent, motion) layers on through these components.

## Addendum 2026-10-16: helper text is short and sits under the title
Founder: "too lengthy… concise and to the point", and "helper text should generally be under the title, not under the field (errors go under, as they do)." So: a field's helper text is one short line (at most 80 characters when written as a `hint`; a unit test checks), placed directly under its label by `TextField`, `TextAreaField`, `SelectField` and `ImageField`. Problems still appear under the field. A checkbox's explanation sits under the checkbox. Longer explanations belong in the page's prose or a "coming soon" section, not under a title. Empty states are a title and one line.

## Sheets are dialogs on a computer screen (founder, 2026-10-19)
`components/ui/sheet.tsx`: under 768 px a sheet comes in from its edge (bottom for a short confirmation, right for a form), as on a phone. From 768 px up **every sheet opens as a dialog in the middle of the page** (at most 42 rem wide for a form, 32 rem for a short confirmation, at most 85% of the screen tall, scrolling inside, page dimmed behind): "all crucial work was happening on the edge of the screen". The `side` a screen asks for only matters on a phone; a screen does not choose its own desktop layout. `e2e/desktop-dialogs.spec.ts` checks both.
