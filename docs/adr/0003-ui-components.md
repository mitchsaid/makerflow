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
