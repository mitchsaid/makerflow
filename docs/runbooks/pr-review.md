# Reviewing a pull request (for the review sub-agent, and for whoever briefs it)

Every slice gets a pull request so CI and a review agent run (docs/project-context.md, "Working with the founder"). Brief the review agent with the paths of what changed and this list, and ask for only real, verified findings, ranked, with file and line, the failing scenario and a suggested fix. It does not edit files, commit or post.

## Always ask

1. **Duplication.** Does this repeat an interaction or component the app already has? Search for the noun (item, customer, address, date, photo, product) and compare. A copy of an existing screen or sheet is a finding, even if it works. The fix is to reuse it with a mode (see "Interactions reused" in `docs/plans/README.md`).
2. **Security and tenancy.** Row-level security, the `session_required` policy on every new table, who can call each database function (service role only for state changes), same-business foreign keys, anything the browser sends that the server believes (derive it on the server instead), error codes that are not the ones the app handles.
3. **Money and rules.** Integer minor units, quantities in thousandths, totals on the server, country rules from the locale pack, issued documents immutable.
4. **Forms and screens.** `docs/adr/0005-form-errors.md` (enabled primary buttons, summary and field errors, nothing typed is lost, focus), `AddButton` / `AddLink`, 44 px targets, 16 px input text, one query per page, loading skeleton, a case in `e2e/accessibility.spec.ts`.
5. **Regressions.** When shared code gets a new mode, every other caller behaves exactly as before.
6. **Tests.** The failing cases a reviewer can name that no test covers.

## What it will not catch

Whether the feature is the right one. That is the plan's job: `docs/plans/README.md`.
