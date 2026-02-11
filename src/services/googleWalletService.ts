/**
 * Google Wallet Service
 * Creates signed JWT for loyalty passes and returns the Add to Google Wallet save URL.
 * @see https://developers.google.com/wallet/retail/loyalty-cards/use-cases/jwt
 */

import jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';

const SAVE_URL_BASE = 'https://pay.google.com/gp/v/save';

export interface GoogleWalletCredentials {
  client_email: string;
  private_key: string;
}

export interface CustomerWalletInfo {
  customerId: string;
  name: string;
  memberCode: string | null;
  restaurantName: string;
  restaurantId: string | null;
  logoUrl?: string;
  heroImageUrl?: string;
}

function getCredentials(): GoogleWalletCredentials {
  const json = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json) as GoogleWalletCredentials;
      if (parsed.client_email && parsed.private_key) return parsed;
    } catch {
      throw new Error('Invalid GOOGLE_WALLET_SERVICE_ACCOUNT_JSON');
    }
  }
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    const resolved = path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath);
    const content = fs.readFileSync(resolved, 'utf8');
    const parsed = JSON.parse(content) as GoogleWalletCredentials;
    if (parsed.client_email && parsed.private_key) return parsed;
  }
  throw new Error(
    'Google Wallet credentials not configured. Set GOOGLE_WALLET_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.'
  );
}

function getIssuerId(): string {
  const id = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!id) throw new Error('GOOGLE_WALLET_ISSUER_ID is not set');
  return id.trim();
}

function getClassId(): string {
  return (process.env.GOOGLE_WALLET_CLASS_ID || 'loyalty_card_class').trim();
}

function getAllowedOrigins(): string[] {
  const raw = process.env.GOOGLE_WALLET_ORIGINS;
  if (!raw) return [];
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

/**
 * Build loyalty class (template). Idempotent for same class ID.
 */
function buildLoyaltyClass(info: CustomerWalletInfo): Record<string, unknown> {
  const issuerId = getIssuerId();
  const classId = getClassId();
  const programName = info.restaurantName || 'Loyalty Card';
  const logoUri = info.logoUrl || process.env.GOOGLE_WALLET_LOGO_URL || '';

  const loyaltyClass: Record<string, unknown> = {
    id: `${issuerId}.${classId}`,
    issuerName: process.env.GOOGLE_WALLET_ISSUER_NAME || programName,
    reviewStatus: 'UNDER_REVIEW',
    programName,
  };
  if (logoUri) {
    loyaltyClass.programLogo = {
      sourceUri: { uri: logoUri },
    };
  }
  return loyaltyClass;
}

/**
 * Build loyalty object (unique pass for this customer).
 */
function buildLoyaltyObject(info: CustomerWalletInfo): Record<string, unknown> {
  const issuerId = getIssuerId();
  const classId = getClassId();
  const objectId = `${issuerId}.${info.customerId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const memberId = info.memberCode || info.customerId;
  const qrValue = JSON.stringify({
    id: memberId,
    name: info.name,
    type: 'loyalty',
    timestamp: Date.now(),
  });

  const heroUri = info.heroImageUrl || process.env.GOOGLE_WALLET_HERO_IMAGE_URL || '';

  const loyaltyObject: Record<string, unknown> = {
    id: objectId,
    classId: `${issuerId}.${classId}`,
    state: 'ACTIVE',
    textModulesData: [
      { header: 'Member Name', body: info.name || '—', id: 'member_name' },
      { header: 'Member ID', body: memberId, id: 'member_id' },
    ],
    barcode: {
      type: 'QR_CODE',
      value: qrValue,
      alternateText: memberId,
    },
    accountName: info.name || 'Member',
    accountId: memberId,
    loyaltyPoints: {
      label: 'Points',
      balance: { string: '0' },
    },
  };
  if (heroUri) {
    loyaltyObject.heroImage = {
      sourceUri: { uri: heroUri },
    };
  }
  return loyaltyObject;
}

/**
 * Create a signed JWT and return the Add to Google Wallet save URL.
 */
export function createGoogleWalletSaveUrl(info: CustomerWalletInfo): string {
  const credentials = getCredentials();
  const issuerId = getIssuerId();
  const origins = getAllowedOrigins();

  const loyaltyClass = buildLoyaltyClass(info);
  const loyaltyObject = buildLoyaltyObject(info);

  const payload = {
    iss: credentials.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    payload: {
      loyaltyClasses: [loyaltyClass],
      loyaltyObjects: [loyaltyObject],
    },
    ...(origins.length > 0 ? { origins } : {}),
  };

  const signedJwt = jwt.sign(
    payload,
    credentials.private_key,
    { algorithm: 'RS256' }
  );

  return `${SAVE_URL_BASE}/${signedJwt}`;
}

/**
 * Check if Google Wallet is configured (credentials and issuer ID present).
 */
export function isGoogleWalletConfigured(): boolean {
  try {
    getCredentials();
    getIssuerId();
    return true;
  } catch {
    return false;
  }
}
