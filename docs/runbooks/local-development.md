# Working on your own computer (fast loop)

Goal: see every change in your browser the moment it's made, and only push when you're happy.

**Recommended tool: the Claude desktop app (the "Code" tab).** It's a normal app with chat, a diff view for reviewing changes, a built-in browser pane that shows your running app, and a terminal pane. You never need to type commands yourself. A code editor (VS Code) is optional and only useful if you want to read or edit code by hand.

## Who does what
| | You | Claude (Code tab, on your computer) |
|---|---|---|
| Install Docker Desktop and the Claude desktop app | yes | no |
| Get the code onto your computer | yes (once) | no |
| Sign in with your personal Claude account | yes (once) | no |
| Install Node and pnpm, install dependencies, start the local database, write settings, run checks | **no** | **yes**, via `./scripts/setup-local.sh` (it asks your permission) |
| Start the app, edit code, run tests, commit and push | **no** | **yes** |
| Look at the result, review changes, merge pull requests | yes | no |

## One-time setup (about 30 minutes, mostly downloads)

**0. Merge the open pull request first.** It contains the setup script and the preview settings.

**1. Install Docker Desktop.** Download it from docker.com/products/docker-desktop (Apple chip or Intel, to match your Mac), drag it to Applications, open it once and let it finish starting. It can stay in the background.

**2. Get the code.** Install GitHub Desktop (desktop.github.com), sign in, choose "Clone a repository", pick `mitchsaid/makerflow`. Remember the folder it uses.

**3. Install the Claude desktop app** (claude.ai/download, or the link in the Claude Code docs) and open it.
- To work on MakerFlow, **sign out of your work account and sign in with your personal one**. Check the account name in the app's settings is your personal one.
- When you want your work account back, sign out and sign in again. Nothing in this project changes how your work account is set up.
- Switching accounts applies to the whole app (including its Chat tab), so finish anything in progress for work first.

**4. Open MakerFlow.** In the **Code** tab choose **Local**, click **Select folder**, and pick the `makerflow` folder from step 2. Then send:

> Set up this project for local development. Run ./scripts/setup-local.sh and fix anything that stops it.

It installs what is missing (asking your permission), downloads the database images (the first time is large), starts everything and runs the checks. When it says "All set", you're done.

## Every day
1. Open the Claude app, **Code** tab, pick the `makerflow` session.
2. Tell it what you want to build or change.
3. When it edits the app, the **Browser pane** shows your running app (the server starts from `.claude/launch.json`, which runs `pnpm local`). You can click around in it. Or open **http://localhost:3000** in your normal browser.
4. Sign-in emails never leave your computer. Read them at **http://127.0.0.1:54324**.
5. For a phone-sized look, use your browser's device mode (Chrome: DevTools, then the phone icon).
6. Review changes in the diff view. Comment on a line and Claude revises.
7. Happy? Say: "Run the checks and push my work." It runs `pnpm check`, commits and pushes the branch. Vercel makes a preview in about a minute.
8. Open the pull request on GitHub. The full test suite runs once (about 4 minutes). Merge when it's green.
9. If the database changed, run **Actions, Deploy database to dev** after merging.

When you finish for the day, quit Docker Desktop (or ask Claude to run `pnpm stack:stop`).

## Sharing Docker with another project (for example work)
You don't need a second Docker. MakerFlow runs happily on whichever Docker you already have (Docker Desktop, OrbStack, Colima and similar). The setup only needs `docker info` to work.
- **Space:** you already have the Docker app itself, so MakerFlow adds only its images (about 2 GB).
- **Containers:** ours are all named `supabase_*_app`, so they are easy to tell apart from your work containers.
- **Ports on your computer:** 54321 (API), 54322 (database), 54324 (mailbox) and 3000 (the app). If your work project uses any of these, stop one of the two before starting the other.
- **Memory:** the stack uses roughly 250 MB, small next to a typical work stack.
- **Cleaning up:** don't run `docker system prune -a` on a shared Docker: it also removes your work project's unused images. Stop only MakerFlow with `pnpm stack:stop`, and wipe only MakerFlow's local data with `pnpm db:reset`. Neither touches other containers.

## What this setup does and doesn't touch on your computer
- **Does not touch your Claude accounts or settings.** Nothing here reads or changes your Claude login, your work setup, `~/.claude`, or your shell profile.
- **`.claude/launch.json`** lives inside the MakerFlow folder only. It holds no account details. It just tells the desktop app how to start this app's dev server (`pnpm local`, port 3000), and it is only used when a session is opened on the MakerFlow folder.
- **`CLAUDE.md` files** are project instructions that only load when Claude works in this folder.
- **`./scripts/setup-local.sh`** installs project dependencies inside the repo, downloads a test browser (Playwright's cache folder), and pulls Docker images. If Node or pnpm are missing it tells you what to install, and it runs `corepack enable` (a standard Node step) if pnpm isn't found.
- **To remove everything:** quit Docker Desktop, delete the `makerflow` folder, and delete the Docker images if you want the space back.

## Other ways to work (only if you change your mind)
A terminal or an editor such as VS Code also works with Claude Code. Both would need their own sign-in handling, so with your preference to keep work untouched, the desktop app plus signing in and out is the simplest. Ask me if you want the details.

## Quick reference (Claude runs these; you can too, from the `app` folder)
| Command | What it does |
|---|---|
| `pnpm local` | starts the local database and the app at localhost:3000 |
| `pnpm check` | lint, types, unit tests (~30 seconds) |
| `pnpm test:e2e -g "part of a test name"` | one browser journey |
| `pnpm test:e2e` | all browser tests (~40 seconds) |
| `pnpm db:test` | database security tests |
| `pnpm db:reset` | wipes the **local** database and rebuilds it (clean slate) |
| `pnpm stack:stop` | stops the local database |

## If something goes wrong
- "Docker isn't running": open Docker Desktop and wait until it says it is running.
- Something else is using port 3000 or 54321-54324: stop it, or run `pnpm stack:stop` and try again.
- A sign-in link says expired: links work once; request a new one and use the newest email in the local mailbox.
- The Code tab says you're signed in as your work account: sign out and back in with your personal account.
- Your personal login is refused on this computer: your employer may restrict which accounts can sign in on a work-managed computer. Tell me and we'll find another way (for example, keep using cloud sessions).
