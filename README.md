# FuelSafe — Know before you go

A fuel range and refill-cost assistant for South African drivers. Enter your
fuel gauge reading (or connect a Bluetooth OBD-II adapter) and FuelSafe shows
litres left, how far you can drive, what a refill costs, and how far a set
amount of rand will take you. A voice co-pilot reads the key numbers aloud.

Built for the FNB App of the Year 2026 — Team AIM IT.

---

## Tech stack
- **Next.js (App Router) + React + TypeScript**
- **Tailwind CSS**
- **PostgreSQL** via **Drizzle ORM**
- **Web Speech API** (voice co-pilot) and **Web Bluetooth API** (OBD-II)
- DMRE/CEF fuel-price reference data

---

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env file and set your database URL:
   ```bash
   cp .env.example .env
   # edit .env and set DATABASE_URL
   ```
3. Create the database tables:
   ```bash
   npm run db:push
   ```
4. (Optional) create the demo account:
   ```bash
   npm run seed:demo
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

---

## Deploy to Vercel (free)

Web Bluetooth and the voice features need a real `https://` site, so deploy
before demoing on a phone.

### 1. Create a free PostgreSQL database
Use **Neon** (neon.tech) or **Supabase** (supabase.com). Copy the connection
string — it looks like:
```
postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

### 2. Push your code to GitHub
In VS Code, commit everything and push to a new GitHub repository.

### 3. Deploy on Vercel
1. Go to vercel.com, sign in with GitHub, and **Import** your repository.
2. Under **Environment Variables**, add:
   - `DATABASE_URL` = your Neon/Supabase connection string
3. Click **Deploy**. Vercel runs `npm run build` automatically.

### 4. Create the tables and demo account
From your computer, pointed at the hosted database:
```bash
# put the hosted DATABASE_URL in your .env first
npm run db:push
npm run seed:demo
```

### 5. Test
Open your new Vercel link **on your phone** in Chrome or Edge and sign in with
the demo account.

---

## Demo account (after seeding)
- **Email:** `demo@fuelsafe.app`
- **Password:** `FuelSafe2026!`
- **Car:** 2022 Toyota Corolla Quest, petrol 95, 50 L tank, ~40% fuel

> Change the password in `scripts/seed-demo.mjs` if you prefer, then re-run
> `npm run seed:demo`.

---

## Notes
- Fuel prices use a DMRE/CEF reference, not a live feed.
- Bluetooth works in Chrome/Edge on Android, Windows, macOS or ChromeOS.
  iPhone browsers don't support Web Bluetooth — use gauge entry there.
