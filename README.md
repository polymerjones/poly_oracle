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

## Native iOS Voice (Recommended)
Poly Oracle now supports a hybrid speech layer:
- iOS native TTS first (if Capacitor TextToSpeech plugin is installed)
- browser speech fallback otherwise

Install native iOS speech plugin:
```bash
npm install @capacitor-community/text-to-speech
npx cap sync ios
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

## Contact API Env Vars
For `/api/contact` email forwarding (Resend), configure:

```bash
RESEND_API_KEY=...
CONTACT_TO=Paul.t.fisher03@gmail.com
CONTACT_FROM=Poly Oracle <noreply@yourdomain.com>
```

If env vars are missing, the client falls back to opening the user mail app.
