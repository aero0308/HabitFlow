import crypto from "crypto";

/**
 * AES-256-GCM encryption for BYOK (Bring Your Own Key) API keys.
 * Uses AI_KEY_ENCRYPTION_SECRET from env (32-byte hex string).
 * Each encrypt call uses a random IV — so the same plaintext produces
 * different ciphertexts every time.
 *
 * Output format: base64(iv [12 bytes] + authTag [16 bytes] + ciphertext)
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard IV length
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "AI_KEY_ENCRYPTION_SECRET is not set. Generate one with: openssl rand -hex 32",
    );
  }
  // The secret is a 64-char hex string (32 bytes). Derive the key with SHA-256
  // so even if the user provides a shorter string it's always 32 bytes.
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptKey(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptKey(encrypted: string): string {
  const key = getKey();
  const buf = Buffer.from(encrypted, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Returns a masked version of the key for display in Settings.
 * e.g. "sk-...•••1234" — shows the first 3 and last 4 chars.
 */
export function maskKey(plain: string): string {
  if (plain.length <= 8) {
    return "••••••••";
  }
  const prefix = plain.slice(0, 3);
  const suffix = plain.slice(-4);
  return `${prefix}...•••${suffix}`;
}
