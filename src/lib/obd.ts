"use client";

/**
 * Reads the fuel level from a car through a Bluetooth Low Energy OBD-II
 * adapter (ELM327 command set) using the Web Bluetooth API.
 *
 * Standard OBD-II PID 0x2F ("Fuel Tank Level Input") returns one byte A where
 * fuel % = A × 100 / 255. Not every car reports it, so "NO DATA" and an
 * unsupported PID are handled as normal outcomes, not crashes.
 */

// ---- Minimal Web Bluetooth typings (not in TypeScript's DOM lib) ----------
type BtUuid = number | string;
type BtCharacteristic = EventTarget & {
  properties: { write: boolean; writeWithoutResponse: boolean; notify: boolean; indicate: boolean };
  value?: DataView | null;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BtCharacteristic>;
};
type BtService = { getCharacteristic(uuid: BtUuid): Promise<BtCharacteristic> };
type BtServer = {
  connected: boolean;
  connect(): Promise<BtServer>;
  disconnect(): void;
  getPrimaryService(uuid: BtUuid): Promise<BtService>;
};
type BtDevice = EventTarget & { name?: string; gatt?: BtServer };
type BtRequestOptions = {
  acceptAllDevices?: boolean;
  filters?: Array<{ services?: BtUuid[]; namePrefix?: string }>;
  optionalServices?: BtUuid[];
};
type WebBluetooth = {
  getAvailability?(): Promise<boolean>;
  requestDevice(options: BtRequestOptions): Promise<BtDevice>;
};

// Serial-over-BLE layouts used by common ELM327 adapters.
const PROFILES: { label: string; service: BtUuid; notify: BtUuid; write: BtUuid }[] = [
  { label: "FFF0", service: 0xfff0, notify: 0xfff1, write: 0xfff2 },
  { label: "FFE0 (HM-10)", service: 0xffe0, notify: 0xffe1, write: 0xffe1 },
  { label: "Vgate 18F0", service: 0x18f0, notify: 0x2af0, write: 0x2af1 },
  {
    label: "Nordic UART",
    service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
    notify: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
    write: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
  },
];
const NAME_HINTS = ["OBD", "ELM", "V-LINK", "VLINK", "Vgate", "IOS-Vlink", "Android-Vlink", "Veepeak", "OBDLink", "iCar", "KONNWEI", "Viecar"];

export type BluetoothSupport =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "frame" | "insecure"; message: string };

export function checkBluetoothSupport(): BluetoothSupport {
  if (typeof window === "undefined") return { ok: false, reason: "unsupported", message: "Bluetooth is only available in the browser." };
  if (!window.isSecureContext) {
    return { ok: false, reason: "insecure", message: "Bluetooth needs a secure (https) connection." };
  }
  const bluetooth = (navigator as Navigator & { bluetooth?: WebBluetooth }).bluetooth;
  if (!bluetooth) {
    return {
      ok: false,
      reason: "unsupported",
      message:
        "This browser can't use Bluetooth. Use Chrome or Edge on Android, Windows, macOS or ChromeOS. iPhone browsers (Safari and Chrome on iOS) don't support Web Bluetooth yet.",
    };
  }
  return { ok: true };
}

export function isInsideFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

// ---- Transport ---------------------------------------------------------------
export type ObdTransport = {
  name: string;
  send(command: string, timeoutMs?: number): Promise<string>;
  close(): void;
};

export class ObdError extends Error {
  constructor(
    message: string,
    public code: "cancelled" | "frame" | "unsupported" | "no_profile" | "timeout" | "disconnected" | "no_data" | "not_supported" | "adapter",
  ) {
    super(message);
  }
}

/** Opens the browser's Bluetooth picker and connects to the chosen adapter. */
export async function connectBluetoothAdapter(showAllDevices = false): Promise<ObdTransport> {
  const support = checkBluetoothSupport();
  if (!support.ok) throw new ObdError(support.message, "unsupported");
  const bluetooth = (navigator as Navigator & { bluetooth: WebBluetooth }).bluetooth;

  const optionalServices = PROFILES.map((profile) => profile.service);
  let device: BtDevice;
  try {
    device = await bluetooth.requestDevice(
      showAllDevices
        ? { acceptAllDevices: true, optionalServices }
        : {
            filters: [
              ...PROFILES.map((profile) => ({ services: [profile.service] })),
              ...NAME_HINTS.map((namePrefix) => ({ namePrefix })),
            ],
            optionalServices,
          },
    );
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    const message = error instanceof Error ? error.message : "";
    if (name === "NotFoundError") throw new ObdError("No adapter was chosen.", "cancelled");
    if (name === "SecurityError" || /permissions policy|disallowed/i.test(message)) {
      throw new ObdError("Bluetooth is blocked inside this embedded preview. Open FuelSafe in its own tab to connect.", "frame");
    }
    throw new ObdError(message || "Couldn't open the Bluetooth picker.", "adapter");
  }

  return openTransport(device);
}

async function openTransport(device: BtDevice): Promise<ObdTransport> {
  const server = await device.gatt?.connect();
  if (!server) throw new ObdError("Couldn't connect to the adapter.", "adapter");

  for (const profile of PROFILES) {
    try {
      const service = await server.getPrimaryService(profile.service);
      const notifyChar = await service.getCharacteristic(profile.notify);
      const writeChar = profile.write === profile.notify ? notifyChar : await service.getCharacteristic(profile.write);
      return createBleTransport(device, server, notifyChar, writeChar);
    } catch {
      // Try the next known layout.
    }
  }
  server.disconnect();
  throw new ObdError(
    "Connected, but this adapter doesn't use a layout we recognise. It may be a Bluetooth Classic (non-BLE) adapter.",
    "no_profile",
  );
}

/**
 * Silently reconnects to an adapter the driver has already allowed before,
 * with no picker. Returns null if none is available or the browser can't do it
 * (first-time connections must go through connectBluetoothAdapter on a tap).
 */
export async function reconnectKnownAdapter(): Promise<ObdTransport | null> {
  const support = checkBluetoothSupport();
  if (!support.ok || isInsideFrame()) return null;
  const bluetooth = (navigator as Navigator & { bluetooth: WebBluetooth & { getDevices?: () => Promise<BtDevice[]> } }).bluetooth;
  if (typeof bluetooth.getDevices !== "function") return null;

  try {
    const devices = await bluetooth.getDevices();
    for (const device of devices) {
      try {
        return await openTransport(device);
      } catch {
        // Adapter not in range / off; try the next remembered one.
      }
    }
  } catch {
    // getDevices can reject if permission policy blocks it.
  }
  return null;
}

async function createBleTransport(
  device: BtDevice,
  server: BtServer,
  notifyChar: BtCharacteristic,
  writeChar: BtCharacteristic,
): Promise<ObdTransport> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let waiter: ((text: string) => void) | null = null;
  let disconnected = false;

  device.addEventListener("gattserverdisconnected", () => {
    disconnected = true;
  });
  notifyChar.addEventListener("characteristicvaluechanged", (event) => {
    const value = (event.target as BtCharacteristic).value;
    if (!value) return;
    buffer += decoder.decode(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer);
    // The ELM327 prints ">" when it is ready for the next command.
    if (buffer.includes(">") && waiter) {
      const text = buffer;
      buffer = "";
      const resolve = waiter;
      waiter = null;
      resolve(text);
    }
  });
  await notifyChar.startNotifications();

  async function write(text: string) {
    const bytes = encoder.encode(text);
    for (let offset = 0; offset < bytes.length; offset += 20) {
      const chunk = bytes.slice(offset, offset + 20);
      if (writeChar.properties.writeWithoutResponse && writeChar.writeValueWithoutResponse) {
        await writeChar.writeValueWithoutResponse(chunk);
      } else {
        await writeChar.writeValue(chunk);
      }
    }
  }

  return {
    name: device.name || "Bluetooth OBD-II adapter",
    async send(command, timeoutMs = 4000) {
      if (disconnected || !server.connected) throw new ObdError("The adapter disconnected.", "disconnected");
      buffer = "";
      const response = new Promise<string>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          waiter = null;
          reject(new ObdError(`The adapter didn't answer "${command}" in time.`, "timeout"));
        }, timeoutMs);
        waiter = (text) => {
          window.clearTimeout(timer);
          resolve(text);
        };
      });
      await write(`${command}\r`);
      return response;
    },
    close() {
      try {
        if (server.connected) server.disconnect();
      } catch {
        // Already gone.
      }
    },
  };
}

/**
 * A pretend adapter that answers like a real ELM327, so the whole flow can be
 * tried without hardware. It reports `startPercent` with a little sensor noise.
 */
export function createDemoTransport(startPercent: number): ObdTransport {
  const percent = Math.min(100, Math.max(0, startPercent + (Math.random() * 2 - 1)));
  const byte = Math.round((percent * 255) / 100);
  const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
  return {
    name: "Demo adapter (simulated)",
    async send(command) {
      await delay(command === "ATZ" ? 450 : 160);
      const cmd = command.toUpperCase();
      if (cmd === "ATZ") return "\r\rELM327 v1.5\r\r>";
      if (cmd.startsWith("AT")) return "OK\r\r>";
      if (cmd === "0100") return "SEARCHING...\r41 00 BE 3F A8 13\r\r>";
      if (cmd === "0120") return "41 20 80 07 E0 19\r\r>"; // bit for PID 0x2F set
      if (cmd === "012F") return `41 2F ${byte.toString(16).toUpperCase().padStart(2, "0")}\r\r>`;
      return "NO DATA\r\r>";
    },
    close() {},
  };
}

// ---- ELM327 dialogue ----------------------------------------------------------
function clean(raw: string): string {
  return raw.replace(/SEARCHING\.\.\./gi, "").replace(/[\s>]/g, "").toUpperCase();
}

function failureIn(text: string): string | null {
  const known = ["NODATA", "UNABLETOCONNECT", "CANERROR", "BUSERROR", "BUSINIT", "STOPPED", "ERROR"];
  const hit = known.find((marker) => text.includes(marker));
  if (hit) return hit;
  return text === "?" ? "?" : null;
}

/** Returns true / false if the car says whether PID 0x2F is supported, or null if unknown. */
function parseSupportsFuelLevel(raw: string): boolean | null {
  const text = clean(raw);
  const index = text.indexOf("4120");
  if (index === -1) return null;
  const hex = text.slice(index + 4, index + 12);
  if (!/^[0-9A-F]{8}$/.test(hex)) return null;
  const bits = Number.parseInt(hex, 16);
  // Bits run from PID 0x21 (most significant) to 0x40; 0x2F is bit index 14.
  return ((bits >>> (31 - (0x2f - 0x21))) & 1) === 1;
}

export function parseFuelLevel(raw: string): number | null {
  const text = clean(raw);
  const index = text.indexOf("412F");
  if (index === -1) return null;
  const hex = text.slice(index + 4, index + 6);
  if (!/^[0-9A-F]{2}$/.test(hex)) return null;
  return (Number.parseInt(hex, 16) * 100) / 255;
}

export type ObdStep = { label: string; state: "running" | "done" | "warn" | "error" };

/** Initialises the adapter and reads the fuel level. Calls `onStep` for progress. */
export async function readFuelLevel(transport: ObdTransport, onStep: (steps: ObdStep[]) => void): Promise<number> {
  const steps: ObdStep[] = [];
  const push = (label: string, state: ObdStep["state"] = "running") => {
    steps.push({ label, state });
    onStep([...steps]);
  };
  const finish = (state: ObdStep["state"]) => {
    if (steps.length) steps[steps.length - 1].state = state;
    onStep([...steps]);
  };

  push("Waking up the adapter");
  await transport.send("ATZ", 5000);
  for (const command of ["ATE0", "ATL0", "ATS0", "ATH0", "ATSP0"]) {
    await transport.send(command);
  }
  finish("done");

  push("Talking to your car's computer");
  const wake = await transport.send("0100", 10000);
  const wakeFailure = failureIn(clean(wake));
  if (wakeFailure && !clean(wake).includes("4100")) {
    finish("error");
    throw new ObdError(
      wakeFailure === "UNABLETOCONNECT"
        ? "The adapter couldn't reach your car. Turn the ignition on (engine can be off) and try again."
        : `Your car didn't respond (${wakeFailure}). Turn the ignition on and try again.`,
      "adapter",
    );
  }
  finish("done");

  push("Checking your car reports fuel level");
  const supported = parseSupportsFuelLevel(await transport.send("0120", 6000));
  if (supported === false) {
    finish("warn");
    throw new ObdError(
      "Your car doesn't share its fuel level over OBD-II (many do, some don't). Enter it from your dashboard gauge instead.",
      "not_supported",
    );
  }
  finish(supported === null ? "warn" : "done");

  push("Reading the fuel tank level");
  const raw = await transport.send("012F", 6000);
  const percent = parseFuelLevel(raw);
  if (percent === null) {
    finish("error");
    throw new ObdError(
      failureIn(clean(raw)) === "NODATA"
        ? "Your car answered “NO DATA” for fuel level, so it doesn't report it over OBD-II. Enter it manually instead."
        : "We couldn't understand the car's fuel reading. Try again, or enter it manually.",
      "no_data",
    );
  }
  finish("done");
  return percent;
}
