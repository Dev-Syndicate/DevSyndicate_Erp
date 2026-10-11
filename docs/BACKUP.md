# Backups

Every night at 02:00 IST, a GitHub Actions job ([.github/workflows/backup.yml](../.github/workflows/backup.yml)) backs up DevSyndicate ERP to Google Drive:

- **What:** the whole database (roles, schema, data) and every uploaded file (logo, signature, payment proofs, expense receipts).
- **Where:** one file, `DevSyndicate Backups/devsyndicate-erp-backup.tar.gz.gpg`, replaced each night (like WhatsApp's backup).
- **History:** when the file is replaced, Google Drive keeps the older versions for 30 days. Right-click the file → **File information → Manage versions** to download an older night.
- **Security:** the file is encrypted (AES-256) with the backup passphrase before it leaves GitHub. Without the passphrase the backup cannot be opened, and with it, anyone can. Keep it offline as well as in GitHub.
- **Failures:** GitHub emails the repository owner when the job fails.

## One-time setup

You need: the Supabase dashboard, the GitHub repo settings, and a Windows terminal.

### 1. Four GitHub secrets

GitHub → repository → **Settings → Secrets and variables → Actions → New repository secret**, or `gh secret set NAME` in a terminal.

| Secret | Where to get it |
|---|---|
| `SUPABASE_DB_URL` | Supabase dashboard → **Connect** → **Session pooler** connection string (works from GitHub's servers, which have no IPv6). Replace `[YOUR-PASSWORD]` with the database password. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → **Project Settings → API Keys** → the secret key (`sb_secret_…`) or the legacy `service_role` key. |
| `BACKUP_PASSPHRASE` | Make up a long passphrase (e.g. 5–6 random words). **Also write it down somewhere safe offline.** |
| `RCLONE_CONF` | From step 2. |

### 2. Connect Google Drive (rclone)

1. Install rclone: `winget install Rclone.Rclone` (then open a new terminal).
2. Run `rclone config` and answer:
   - `n` (new remote), name: **`gdrive`**
   - Storage: **`drive`** (Google Drive)
   - client_id / client_secret: press Enter (leave blank)
   - scope: **`drive.file`** (rclone only sees the files it creates, not the rest of your Drive)
   - Press Enter for the rest; "Use web browser to automatically authenticate": **`y`**, then sign in with the Google account that should hold the backups.
   - Shared Drive: `n`; confirm with `y`; quit with `q`.
3. Run `rclone config file` to see where the config is, open that file, and copy **all** of its contents into the `RCLONE_CONF` secret.

### 3. Run the first backup

GitHub → **Actions → Nightly backup → Run workflow** (or `gh workflow run backup.yml`). When it is green, `DevSyndicate Backups` appears in your Google Drive.

## Restore

Do this once as a drill before relying on the app (PRD §34), into a **new, empty** Supabase project so the live data is untouched.

1. **Download** the backup file from Google Drive (or an older version via Manage versions).
2. **Decrypt and unpack** (Git Bash has `gpg` and `tar`):
   ```bash
   gpg -d devsyndicate-erp-backup.tar.gz.gpg | tar -xz
   ```
   This creates a `backup/` folder: `roles.sql`, `schema.sql`, `data.sql`, `storage/`, `created_at.txt`.
3. **Restore the database** into the target project (its Session pooler connection string), with `psql` from PostgreSQL 17:
   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file backup/roles.sql --file backup/schema.sql \
     --command 'SET session_replication_role = replica' \
     --file backup/data.sql --dbname "<target connection string>"
   ```
4. **Restore the files:**
   ```bash
   SUPABASE_URL=https://<target-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<target secret key> node scripts/restore-storage.mjs
   ```
5. **Check:** point `.env.local` at the target project, sign in, and compare a few invoices, payments and the dashboard totals with the live app.

The restore follows Supabase's guide: [Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
