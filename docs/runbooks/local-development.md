# Working on your own computer (fast loop)

Goal: see every change in your browser the moment it's made, and only push when you're happy.

## Who does what
| | You | Claude Code (running on your computer) |
|---|---|---|
| Install Docker Desktop | yes (needs your password, a download) | no |
| Get the code onto your computer | yes (once) | no |
| Create a separate Claude Code login for MakerFlow | yes (once, 2 commands) | no |
| Install Node and pnpm, install dependencies, start the local database, write settings, run checks | **no** | **yes**, via `./scripts/setup-local.sh` (asks your permission for each step) |
| Start the app, edit code, run tests, commit and push | **no** | **yes** |
| Look at the result in your browser | yes | no |
| Open and merge pull requests | yes | no |

## One-time setup (about 30 minutes, mostly downloads)

**0. Merge the open pull request first.** It contains the setup script. After that, `main` on GitHub has everything.

**1. Install Docker Desktop.** Download it from docker.com/products/docker-desktop (pick the Apple chip or Intel version to match your Mac), drag it to Applications, open it once and let it finish starting. It can stay in the background. (OrbStack is a lighter alternative.)

**2. Get the code.** Easiest: install GitHub Desktop (desktop.github.com), sign in with your GitHub account, choose "Clone a repository", pick `mitchsaid/makerflow`. Remember the folder it uses.

**3. Give MakerFlow its own Claude Code login**, so your work login stays untouched. In Terminal (the Mac app called Terminal):
```bash
echo "alias claude-mf='CLAUDE_CONFIG_DIR=~/.claude-makerflow claude'" >> ~/.zshrc
source ~/.zshrc
```
`claude` keeps working as it does today (your work account). `claude-mf` is a second, separate Claude Code with its own login, settings and history.

**4. Open MakerFlow in it.** In Terminal:
```bash
cd path/to/makerflow      # the folder from step 2
claude-mf
```
The first time, log in with your **personal** Claude account, the same one you use on claude.ai. Inside Claude Code, type `/status` and check the email shown is the personal one. Then type:

> Set up this project for local development. Run ./scripts/setup-local.sh and fix anything that stops it.

Claude Code installs what is missing (it will ask your permission), downloads the database images (the first time is large), starts everything and runs the checks. When it says "All set", you're done.

## Every day
1. In Terminal: `cd path/to/makerflow`, then `claude-mf`.
2. Tell it what you want to build or change.
3. Ask it to start the app (or run `cd app && pnpm local` yourself). Open **http://localhost:3000**. Changes appear as soon as they're saved.
4. Sign-in emails never leave your computer. Read them at **http://127.0.0.1:54324**.
5. For a phone-sized look, use your browser's device mode (Chrome: open DevTools, then the phone icon).
6. Happy? Say: "Run the checks and push my work." It runs `pnpm check`, commits and pushes the branch. Vercel makes a preview in about a minute.
7. Open the pull request on GitHub. The full test suite runs once (about 4 minutes). Merge when it's green.
8. If the database changed, run **Actions, Deploy database to dev** after merging.

When you finish for the day: `cd app && pnpm stack:stop` (or just quit Docker Desktop).

## Quick reference (Claude Code runs these; you can too)
| Command (from the `app` folder) | What it does |
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
- Claude Code says you're logged in as your work account: you started `claude` instead of `claude-mf`.
- `claude-mf` won't accept your personal login: your employer may restrict which accounts can log in on a work-managed computer. Tell me and we'll find another way (for example, keep using cloud sessions).
