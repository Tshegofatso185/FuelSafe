import {
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const fuelTypeEnum = pgEnum("fuel_type", [
  "petrol_93",
  "petrol_95",
  "diesel_500ppm",
  "diesel_50ppm",
]);

export const pricingRegionEnum = pgEnum("pricing_region", ["inland", "coastal"]);

export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 220 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: varchar("token", { length: 128 }).primaryKey(),
  userId: varchar("user_id", { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One car profile per signed-in driver. The primary key is the user's id so a
// profile can be upserted atomically on save.
export const vehicleProfiles = pgTable("vehicle_profiles", {
  id: varchar("id", { length: 64 })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  make: varchar("make", { length: 80 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  year: integer("year").notNull(),
  fuelType: fuelTypeEnum("fuel_type").notNull(),
  tankCapacityLitres: doublePrecision("tank_capacity_litres").notNull(),
  tankCapacityVerified: boolean("tank_capacity_verified").notNull().default(false),
  fuelPercent: doublePrecision("fuel_percent").notNull(),
  consumptionLPer100Km: doublePrecision("consumption_l_per_100km").notNull(),
  region: pricingRegionEnum("region").notNull().default("inland"),
  locationLabel: varchar("location_label", { length: 120 }).notNull().default("Johannesburg, Gauteng"),
  setupComplete: boolean("setup_complete").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One-time password reset codes. Only a SHA-256 hash of the code is stored.
export const passwordResets = pgTable("password_resets", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const readingSourceEnum = pgEnum("reading_source", ["obd", "manual", "demo"]);

// Every fuel-level reading, so the dashboard can show where the current number
// came from (live from the car vs typed in) and how fresh it is.
export const fuelReadings = pgTable("fuel_readings", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: varchar("user_id", { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fuelPercent: doublePrecision("fuel_percent").notNull(),
  litres: doublePrecision("litres").notNull(),
  source: readingSourceEnum("source").notNull(),
  adapterName: varchar("adapter_name", { length: 80 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReadingSource = (typeof readingSourceEnum.enumValues)[number];
export type FuelType = (typeof fuelTypeEnum.enumValues)[number];
export type PricingRegion = (typeof pricingRegionEnum.enumValues)[number];
export type AppUser = { id: string; name: string; email: string };
