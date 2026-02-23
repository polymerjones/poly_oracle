# Poly Oracle

Poly Oracle is a Capacitor-wrapped iOS app with a modern web UI.

## v1.1 Focus
- Oracle Core interactive orb
- Intent-lock question flow
- Reveal mode carousel
- Answer pull card + flip/favorite/share
- Vault history + search + favorites
- Voice persona preview
- Whisper mode + Minimal mode
- Oracle answer packs

## Local Run (Web)
Open `index.html` in a browser.

## iOS Sync + Open
```bash
npm run cap:sync
npm run cap:open:ios
```

## Backup
A baseline snapshot is stored in `backups/`.

## GitHub Setup
```bash
git remote add origin <YOUR_GITHUB_REPO_URL>
git add .
git commit -m "v1.1: overhaul oracle UX + vault + packs"
git push -u origin v1.1-dev
```

## Vercel Deploy (Static)
1. Import this repo into Vercel.
2. Framework preset: `Other`.
3. Build command: leave empty.
4. Output directory: `.` (project root).
5. Deploy.

`vercel.json` is included for clean static hosting headers.
