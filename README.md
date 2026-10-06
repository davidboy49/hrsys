# PeopleDesk

HR system: employees, attendance sync from ZKTeco devices (mock for now), masterdata, settings.
Next.js 16 (App Router), shadcn/ui, Tailwind, lucide-react, PostgreSQL with Prisma.

## Run locally (no Docker)

```bash
npm install
npm run db:local        # terminal 1: starts a local PostgreSQL on port 5433 (keep it running)
npm run db:migrate      # terminal 2: creates the tables
npm run db:seed         # masterdata, 40 sample employees, 2 mock devices, admin user
npm run dev             # http://localhost:3000
```

Sign in with `admin@company.com` / `ChangeMe123!` and change the password under Settings > My account.

## Deploy to Vercel with Neon (database + photo bucket)

1. **Database.** In Vercel: *Storage* > *Create Database* > **Neon**, connect it to the project.
   That adds `DATABASE_URL` (and `DATABASE_URL_UNPOOLED`, used for migrations).
2. **Photo bucket.** Photos go to a private Neon Object Storage bucket named `uploads` (declared in `neon.ts`).
   From this folder run `neon link --project-id <id> --branch production -y` then `neon deploy`.
   It writes `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` into `.env.local`.
   Copy those four into *Vercel > Settings > Environment Variables*.
   (Without them the app still works; only photo upload shows an error.)
3. **Secret.** Add `AUTH_SECRET` (output of `openssl rand -base64 32`).
4. **Deploy.** The `vercel-build` script runs `prisma migrate deploy` before `next build`, creating the tables.
5. **First admin.** From your computer, once:
   ```powershell
   $env:DATABASE_URL="<DATABASE_URL from Vercel>"
   $env:SEED_SAMPLE="0"; $env:SEED_ADMIN_EMAIL="you@company.com"; $env:SEED_ADMIN_PASSWORD="a-strong-password"
   npm run db:seed
   ```
   `SEED_SAMPLE=0` skips the 40 demo employees.

Photos are private: the app serves them through `/api/photo`, which requires sign-in.

## Roles

| Role | Can do |
| --- | --- |
| Admin | Everything, including users, devices, settings, audit log |
| HR | Employees (with rate), import/export, masterdata, attendance sync |
| Manager | Read-only employees (no rate) and attendance |

## Attendance and ZKTeco

- Devices live under Attendance. **Mock** mode generates realistic punches for employees that have a ZKTeco PIN.
- **Push (ADMS)** is implemented: point the device server address at `https://<your-site>/iclock/cdata`
  (optionally `?token=...` with `ADMS_TOKEN` set) and give the device record the same serial number.
  Because Vercel is on the public internet, devices on a private LAN can reach it outbound, which is why push is the
  recommended production mode.
- **Pull (TCP 4370)** is a stub in `src/lib/devices/zk.ts`; Vercel cannot reach a private LAN, so it needs a local agent.
- Punches become daily records (first in, last out, late, missing check-out) using each employee's shift.

## Notes

- Import is all-or-nothing: every row is validated first, nothing is saved if any row fails. Limit 4 MB.
- Time zone is fixed to Asia/Phnom_Penh (`src/lib/format.ts`).
- Next.js 16 uses `src/proxy.ts` (formerly middleware) to require sign-in.

## QR attendance (no hardware needed)

1. Add a location in Masterdata (optionally its latitude, longitude and allowed distance for a "must be near the office" check).
2. Create a login for each employee in Settings > Users and roles, linking it to the employee (role Employee).
3. Open Attendance > QR attendance on a tablet or screen at the entrance. The QR rotates every 15 seconds.
4. Employees scan it with their phone camera, sign in once, and tap Confirm. The punch appears in Attendance > Punches like any device punch.
