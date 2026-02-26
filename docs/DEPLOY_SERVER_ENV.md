# Server: Fix database connection (DATABASE_URL)

If you see in PM2 logs:

```text
Authentication failed against database server at `localhost`, the provided database credentials for `...` are not valid.
```

the app is using the **wrong** database URL (e.g. your local dev one). Fix it on the **server**.

## Steps on the server

1. **SSH into the server** and go to the app directory:
   ```bash
   cd /var/www/team-monitor
   ```

2. **Create or edit `.env`** in that directory (same folder as `package.json`):
   ```bash
   nano .env
   ```

3. **Set the production database URL.** Example (replace with your real host, user, password, and database name):
   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@YOUR_DB_HOST:5432/DATABASE_NAME?schema=public"
   ```
   - Do **not** use `localhost` unless PostgreSQL is really on the same machine.
   - Do **not** use your Mac username/password; use the **production** DB user and password.
   - If the DB is on a cloud service (e.g. DigitalOcean, Supabase), use the host and credentials they gave you.

4. **Save the file** (in nano: Ctrl+O, Enter, Ctrl+X).

5. **Restart the app** so it picks up the new env:
   ```bash
   pm2 restart team-monitor
   ```

6. **Check logs** to confirm no more auth errors:
   ```bash
   pm2 logs team-monitor --lines 30
   ```

## If you don’t have a production database yet

- Create a PostgreSQL database (e.g. on DigitalOcean Managed Database, Supabase, or a VPS).
- Get the connection string (host, port, user, password, database name).
- Put it in `.env` as `DATABASE_URL` on the server and run migrations:
  ```bash
  cd /var/www/team-monitor
  npx prisma migrate deploy
  npm run db:seed
  pm2 restart team-monitor
  ```
