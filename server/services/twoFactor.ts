import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { decryptSecret } from "../crypto.js";
import { findRecoveryCode, verifyTotp } from "../totp.js";

/**
 * Second-factor verification.
 *
 * Recovery codes are single-use. Two concurrent logins carrying the same code
 * could otherwise both pass the check before either removes it, so recovery
 * redemption takes a transaction-scoped advisory lock and re-reads the row.
 * TOTP verification is stateless and needs no lock.
 */

export function recoveryCodeHashes(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export async function verifySecondFactor(input: {
  merchantId: string;
  totp?: string;
  recoveryCode?: string;
}): Promise<boolean> {
  const merchant = await prisma.merchant.findUnique({
    where: { id: input.merchantId },
    select: { twoFactorEnabled: true, twoFactorSecret: true },
  });
  if (!merchant?.twoFactorEnabled) return false;
  const secret = decryptSecret(merchant.twoFactorSecret);
  if (!secret) return false;

  if (input.totp && verifyTotp(secret, input.totp)) return true;
  if (!input.recoveryCode) return false;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`2fa:${input.merchantId}`}, 0))`;
    const fresh = await tx.merchant.findUnique({
      where: { id: input.merchantId },
      select: { twoFactorEnabled: true, twoFactorRecoveryCodes: true },
    });
    if (!fresh?.twoFactorEnabled) return false;
    const hashes = recoveryCodeHashes(fresh.twoFactorRecoveryCodes);
    const index = findRecoveryCode(hashes, input.recoveryCode!);
    if (index < 0) return false;
    const remaining = hashes.filter((_, position) => position !== index);
    await tx.merchant.update({
      where: { id: input.merchantId },
      data: { twoFactorRecoveryCodes: remaining as Prisma.InputJsonValue },
    });
    return true;
  });
}
