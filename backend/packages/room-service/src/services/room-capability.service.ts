import {
  AsymmetricCapabilityService,
  CAPABILITY_AUDIENCE,
  ParticipantRoomRole,
  RoomTier,
  VerifiedPrincipal,
} from '@minimeet/shared';

let cachedPrivateKey: string | undefined;
let cachedService: AsymmetricCapabilityService | undefined;

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n');
}

function getCapabilityService(): AsymmetricCapabilityService {
  const configuredPrivateKey = process.env.CAPABILITY_PRIVATE_KEY;
  if (!configuredPrivateKey) {
    throw new Error('CAPABILITY_PRIVATE_KEY is required to issue Cloudflare room capabilities');
  }

  if (!cachedService || cachedPrivateKey !== configuredPrivateKey) {
    cachedPrivateKey = configuredPrivateKey;
    cachedService = new AsymmetricCapabilityService({
      privateKeyPem: normalizePem(configuredPrivateKey),
      audience: process.env.CAPABILITY_AUDIENCE || CAPABILITY_AUDIENCE,
    });
  }

  return cachedService;
}

export function normalizeRoomTier(value: unknown): RoomTier {
  return value === 'pro' || value === 'enterprise' ? value : 'free';
}

export function issueRoomCapability(
  principal: VerifiedPrincipal,
  roomId: string,
  role: ParticipantRoomRole,
  tier: RoomTier
): string {
  return getCapabilityService().issueRoomCapabilityFromPrincipal(
    principal,
    roomId,
    role,
    undefined,
    undefined,
    tier
  );
}
