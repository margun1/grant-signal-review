import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const lifetimeSeconds = 24 * 60 * 60;

function signature(payload: string) {
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!secret) throw new Error("공유 가입 링크를 설정하지 못했습니다.");
  return createHmac("sha256", secret).update("enerinfra:staff-share:v1:").update(payload).digest();
}

export function createStaffShareToken(now = Date.now()) {
  const expires = Math.floor(now / 1000) + lifetimeSeconds;
  const payload = `${expires}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function isValidStaffShareToken(token: string, now = Date.now()) {
  if (!/^\d{10}\.[A-Za-z0-9_-]{32}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [expires = "", nonce = "", encodedSignature = ""] = token.split(".");
  if (Number(expires) <= Math.floor(now / 1000)) return false;
  return timingSafeEqual(Buffer.from(encodedSignature, "base64url"), signature(`${expires}.${nonce}`));
}
