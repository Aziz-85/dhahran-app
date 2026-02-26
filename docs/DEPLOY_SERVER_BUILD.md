# Server: Fix "Could not find a production build in the '.next' directory"

If PM2 logs show:

```text
Error: Could not find a production build in the '.next' directory. Try building your app with 'next build' before starting the production server.
```

the app is running `next start` but the production build was never created (or the `.next` folder was removed).

## Fix: build on the server, then restart

Run these on the server as the deploy user (e.g. `deploy`):

```bash
cd /var/www/team-monitor
npm run build
pm2 restart team-monitor
```

- `npm run build` creates the `.next` folder (can take 1–2 minutes).
- Then `pm2 restart team-monitor` starts the app using that build.

## Recommended deploy flow after each `git pull`

1. **Pull**
   ```bash
   cd /var/www/team-monitor
   git pull
   ```

2. **Install dependencies** (if `package.json` or lockfile changed)
   ```bash
   npm install
   ```

3. **Build**
   ```bash
   npm run build
   ```

4. **Migrations** (if there are new Prisma migrations)
   ```bash
   npx prisma migrate deploy
   ```

5. **Restart**
   ```bash
   pm2 restart team-monitor
   ```

If you use a deploy script, include `npm run build` before `pm2 restart`.
