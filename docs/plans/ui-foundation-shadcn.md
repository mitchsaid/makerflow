# Plan: UI foundation with shadcn/ui (slice 1b, before customers and quotes)

Status: **proposed**, founder asked for it on 2026-10-01. Not started.

## Why
The app currently has hand-written Tailwind styles (`.card`, `.field`, `.btn-*` in `app/src/app/globals.css`) and no component library. That was never a decision, only the minimum for the first screens. Quotes, customers and invoices bring forms, pickers, dialogs, tables, toasts and date inputs. Those are costly to build accessibly by hand and easy to get subtly wrong on phones. The whole UI is about 660 lines today, so moving now is cheap; each new screen makes it dearer.

## Choice: shadcn/ui
- Components are **copied into our repo** (`app/src/components/ui/`) and styled with Tailwind, so we own and can restyle them. No runtime lock-in.
- Built on accessible primitives (focus handling, keyboard use, screen readers, dialogs and menus that behave).
- Works with our stack: Tailwind v4, React 19, Next.js.
- Themeable through CSS variables, which maps onto our existing warm palette and dark mode.

Not verified yet (step 1 checks these before anything is committed): that the current shadcn CLI supports Next.js 16.3 and Tailwind v4 as we have them, which primitive base library it defaults to (Radix or Base UI), and that the CLI can reach its component registry from this sandbox (network policy). If the CLI cannot be used here, components can be added by hand from the docs.

## Scope
In: set-up, theme mapping, the components the current screens need, moving every existing screen onto them, removing the old hand-written classes, rules so new screens use the library.
Out: new features, new screens, logo/branding, anything for customers or quotes.

## Steps
1. **Spike (scratch branch, throwaway).** Run the shadcn init against `app/`, note exactly what it changes (`components.json`, `lib/utils`, `globals.css`, new dependencies). Confirm `pnpm check`, `pnpm build` and `pnpm perf` still work. Report back before keeping any of it.
2. **Theme mapping.** Map our tokens (`--background`, `--surface`, `--foreground`, `--muted`, `--line`, `--accent`, `--danger`) to shadcn's variable names. Keep the warm neutral look, light and dark. Use `rounded-lg` as the default radius to match today's.
3. **Phone rules baked into the components.** Tap targets at least 44 px high, input text at least 16 px (smaller makes iPhones zoom the page), visible focus ring in the accent colour. Adjust shadcn's defaults where they are smaller.
4. **Add only what current screens use:** Button, Input, Label, Checkbox, Select (province), Card, Alert (errors, "Saved"), Skeleton (replace the hand-made loading blocks). Add Dialog or Sheet, Dropdown, Table, Tabs, Command (customer picker), Sonner (toasts) and a date picker later, when a screen needs them.
5. **Move screens one at a time**, each leaving the app working: sign-in, onboarding, Home (prompt card), Settings (business form), then the bottom nav (kept as our own component for the tab behaviour, but using the same tokens).
6. **Delete** `.card`, `.field`, `.btn-*` once nothing uses them.
7. **Record the decision:** `docs/adr/0003-ui-components.md`, plus a `CLAUDE.md` rule: new UI uses `components/ui`, no ad-hoc buttons or inputs; any new primitive is added through the shadcn CLI.

## Tests and checks
- All existing browser tests pass unchanged (they use roles and labels, not CSS classes). If one must change, that is a sign the screen's behaviour changed; stop and look.
- Add an accessibility check (axe) to the browser tests for the signed-out and signed-in pages.
- `pnpm perf` before and after: components must not slow tab-to-tab navigation. Watch the JavaScript sent to the phone; use client components only where interaction needs them.
- Manual check by the founder on a real phone, light and dark.

## Risks
- Extra JavaScript on slow phones: mitigated by adding components one at a time and watching `pnpm perf` and the build output.
- shadcn defaults are desktop-sized: handled in step 3.
- A CLI or framework mismatch with this Next.js version (it differs from older docs): found in the step 1 spike, not later.
- Restyling can change how screens look. Founder reviews screenshots before merge.

## Done when
Every screen uses the library, the old classes are gone, checks and all browser tests pass in CI, the ADR and rule are written, and the founder has looked at it on a phone.
