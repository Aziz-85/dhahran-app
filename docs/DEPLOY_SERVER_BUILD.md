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

If you see **`Cannot find module '.../node_modules/next/dist/bin/next'`**, either `node_modules` is incomplete or PM2 is using a direct path. Do:

1. **Reinstall dependencies:** `npm install` (or `npm ci` if you use lockfile).
2. **Use updated ecosystem:** the project’s `ecosystem.config.cjs` runs `npm run start` so it no longer depends on next’s internal path. After `git pull`, run `pm2 delete team-monitor` then `pm2 start ecosystem.config.cjs` so the new config is used.
3. Then **build and restart:** `npm run build` and `pm2 restart team-monitor`.

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
