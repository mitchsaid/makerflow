# ADR 0009: Back navigation and the page header

Status: accepted 2026-10-15 (founder feedback on the New quote screen).

## Context
Every page under another (a quote under Quotes, a customer under Customers) showed an underlined text link with the parent's name above its heading. The founder: "it feels much more like a website than a web app." MakerFlow is used as an installed phone app, where a back control sits in the page header and goes to the screen above.

## Decision
- One shared component, `PageHeader` (`app/src/components/page-header.tsx`): a back control (a chevron, 44 px) in line with the heading, with the page's heading and any help text beside it.
- The control **always goes to the page's parent**, never to browser history. After a deep link, a refresh, or a long detour, "back" still lands somewhere sensible, and it behaves the same in a browser tab and the installed app.
- The preview of a quote goes back to the quote it previews, not to the list.
- Its name for screen readers is "Back to {parent}" (`Back to Quotes`). The parent's name is not drawn: the heading says where you are.
- A page that already has a way out of its own (a new quote has an X to cancel) has no back control.
- A unit test fails if an underlined text link is used for this again.

## Consequences
The theme studio asks before leaving with unsaved changes, so it uses the same `BackLink` with an `onClick`, named "Back to the quote preview" or "Back to Themes".
