import crypto from "crypto";
import { env } from "../config/env.js";

const getKey = (secret) => crypto.createHash("sha256").update(secret).digest();

const encryptWithKey = (plainText, key) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
};

const decryptWithKey = (payload, key) => {
  const [ivHex, tagHex, encryptedHex] = payload.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
};

export const encryptText = (plainText) => encryptWithKey(
  plainText,
  getKey(env.brokerTokenEncryptionKey),
);

export const decryptText = (payload) => decryptWithKey(
  payload,
  getKey(env.brokerTokenEncryptionKey),
);

export const encryptAuthSecret = (plainText) => encryptWithKey(
  plainText,
  getKey(env.authSecretEncryptionKey),
);

export const decryptAuthSecret = (payload) => decryptWithKey(
  payload,
  getKey(env.authSecretEncryptionKey),
);
