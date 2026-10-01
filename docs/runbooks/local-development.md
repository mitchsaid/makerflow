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

**3. Install the Claude desktop app** (claude.ai/download, or the link in the Claude Code docs), open it and **sign in with your personal Claude account**. Check the account name shown in the app's settings is your personal one, not your work one.
If you also use Claude for work, the desktop app signs in to one account at a time. Keep work in the terminal (`claude`) and MakerFlow in the desktop app, or sign out and in when you switch.

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

## Prefer a terminal or VS Code instead?
- **Terminal:** give MakerFlow its own login so a work login stays untouched. Run once: `echo "alias claude-mf='CLAUDE_CONFIG_DIR=~/.claude-makerflow claude'" >> ~/.zshrc && source ~/.zshrc`. Then `cd` into the repo and run `claude-mf`; the first time, log in with your personal account and check `/status`.
- **VS Code (or Cursor):** install the Claude Code extension. It shares settings and conversation history with the terminal version. To use a separate account, set `CLAUDE_CONFIG_DIR` in the extension's `environmentVariables` setting. This is more fiddly than the desktop app, so only choose it if you want to read and edit the code yourself.

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
