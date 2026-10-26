// Seeds (or resets) the FuelSafe demo account used for judging.
// Run after the database schema is pushed:  node scripts/seed-demo.mjs
import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const DEMO = {
  id: "demo-fuelsafe",
  name: "Demo Driver",
  email: "demo@fuelsafe.app",
  password: "FuelSafe2026!",
  car: {
    make: "Toyota",
    model: "Corolla Quest 1.8",
    year: 2022,
    fuelType: "petrol_95",
    tankCapacityLitres: 50,
    tankCapacityVerified: true,
    fuelPercent: 40,
    consumptionLPer100Km: 7.4,
    region: "inland",
    locationLabel: "Johannesburg, Gauteng",
  },
};

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env or your environment.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
});

try {
  await pool.query(
    `insert into users (id, name, email, password_hash)
     values ($1, $2, $3, $4)
     on conflict (email) do update set password_hash = excluded.password_hash, name = excluded.name
     returning id`,
    [DEMO.id, DEMO.name, DEMO.email, hashPassword(DEMO.password)],
  );

  const { rows } = await pool.query(`select id from users where email = $1`, [DEMO.email]);
  const userId = rows[0].id;
  const c = DEMO.car;

  await pool.query(
    `insert into vehicle_profiles
       (id, make, model, year, fuel_type, tank_capacity_litres, tank_capacity_verified,
        fuel_percent, consumption_l_per_100km, region, location_label, setup_complete, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true, now())
     on conflict (id) do update set
       make = excluded.make, model = excluded.model, year = excluded.year,
       fuel_type = excluded.fuel_type, tank_capacity_litres = excluded.tank_capacity_litres,
       tank_capacity_verified = excluded.tank_capacity_verified, fuel_percent = excluded.fuel_percent,
       consumption_l_per_100km = excluded.consumption_l_per_100km, region = excluded.region,
       location_label = excluded.location_label, setup_complete = true, updated_at = now()`,
    [userId, c.make, c.model, c.year, c.fuelType, c.tankCapacityLitres, c.tankCapacityVerified,
     c.fuelPercent, c.consumptionLPer100Km, c.region, c.locationLabel],
  );

  console.log("Demo account ready:");
  console.log("  Email:   ", DEMO.email);
  console.log("  Password:", DEMO.password);
  console.log("  Car:     ", `${c.year} ${c.make} ${c.model}, ${c.tankCapacityLitres}L, ${c.fuelPercent}%`);
} catch (error) {
  console.error("Seed failed:", error.message);
  process.exit(1);
} finally {
  await pool.end();
}
