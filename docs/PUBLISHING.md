# Publish a public GitHub repository

The public repository is [TKC-pixel/roomtone-practice-room](https://github.com/TKC-pixel/roomtone-practice-room). It includes public-safe `.env` and `.env.example` defaults. Dependencies, room data, private keys, logs and environment override files are excluded.

To obtain a Git checkout for future updates, run `git clone https://github.com/TKC-pixel/roomtone-practice-room.git` in a new working directory. Then work inside that clone. The initial source was published through GitHub's web interface; the original local project folder is not itself a Git checkout. The creation commands below are for publishing a separate copy under a new repository name, not for recreating the existing repository.

## Install GitHub CLI once

Open PowerShell:

```powershell
winget install --id GitHub.cli --exact
```

Close and reopen PowerShell after installation so `gh` is on PATH.

## Sign in and publish

```powershell
cd 'C:\Users\TrinityC\Documents\Codex\2026-11-13\ca\outputs\roomtone'
gh auth login --hostname github.com --git-protocol https --web
git init -b main
git add .
git status --short
git commit -m "Release Roomtone 1.2.0"
gh repo create roomtone-practice-room --public --source=. --remote=origin --push
gh repo view --web
```

Complete the browser login before continuing. Review `git status`: `.env` and `.env.example` should be included; `data/` and `node_modules/` should not. The included environment file has no credentials. Keep future real passwords and TURN credentials in your hosting environment.

The create command uses your signed-in GitHub account and prints the repository URL. If that name already exists, choose a new repository name in the create command; do not overwrite a repository without checking its contents. If Git requests an author name/email, configure them locally with `git config user.name "Your name"` and `git config user.email "Your GitHub commit email"`, then repeat the commit and create commands.

Publishing source does not deploy the rehearsal server. GitHub Pages cannot run this Node/WebSocket service. Follow [SETUP.md](SETUP.md) for hosting, HTTPS and TURN.

## Later updates

Open PowerShell inside your Git clone (not the original source folder). Authenticate using `gh auth login` if needed.

```powershell
npm run check
npm test
git add .
git diff --cached --stat
git commit -m "Describe your changes"
git push
```

Official references: [GitHub CLI installation](https://github.com/cli/cli#installation), [sign-in](https://cli.github.com/manual/gh_auth_login), and [repository creation](https://cli.github.com/manual/gh_repo_create).
