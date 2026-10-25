import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  AsymmetricCapabilityService,
  createVerifiedPrincipal,
  generateEd25519KeyPair,
} from '@minimeet/shared';
import { RoomCoordinatorDO } from './room-coordinator.do.js';
import { InMemoryRoomStorage } from './storage.js';
import { MockWebSocket } from './mock-websocket.js';
import { SpendAlarmManager, SpendAlert } from './spend-alarm.js';

describe('S6-01: Per-Room Quotas, Tier Capacity & Commercial Spend Alarms', () => {
  let capabilityService: AsymmetricCapabilityService;
  let keyPair: ReturnType<typeof generateEd25519KeyPair>;
  let storage: InMemoryRoomStorage;

  beforeEach(() => {
    keyPair = generateEd25519KeyPair('test-quota-kid');
    capabilityService = new AsymmetricCapabilityService({
      privateKeyPem: keyPair.privateKeyPem,
      publicKeyPem: keyPair.publicKeyPem,
      keyId: keyPair.keyId,
    });
    storage = new InMemoryRoomStorage();
  });

  it('enforces Free Tier hard limit of 8 participants with ROOM_CAPACITY_EXCEEDED', async () => {
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);
    coordinator.setRoomTier('free');

    const roomId = 'room_free_01';

    // Admit 8 participants successfully
    for (let i = 1; i <= 8; i++) {
      const [clientWs, serverWs] = MockWebSocket.createPair();
      const principal = createVerifiedPrincipal({
        userId: `user_free_${i}`,
        organizationId: 'org_test',
        role: 'participant',
      });
      const token = capabilityService.issueRoomCapabilityFromPrincipal(
        principal,
        roomId,
        'participant',
        undefined,
        300,
        'free'
      );

      const context = await coordinator.handleAdmitSocket(serverWs, token, roomId);
      assert.equal(context.userId, `user_free_${i}`);
    }

    // 9th participant attempt must receive ROOM_CAPACITY_EXCEEDED
    const [clientWs9, serverWs9] = MockWebSocket.createPair();
    const principal9 = createVerifiedPrincipal({
      userId: 'user_free_9',
      organizationId: 'org_test',
      role: 'participant',
    });
    const token9 = capabilityService.issueRoomCapabilityFromPrincipal(
      principal9,
      roomId,
      'participant',
      undefined,
      300,
      'free'
    );

    await assert.rejects(
      async () => {
        await coordinator.handleAdmitSocket(serverWs9, token9, roomId);
      },
      /Room capacity limit of 8 reached for free tier/
    );

    // Verify error packet sent to client
    const lastMsg = clientWs9.receivedMessages[clientWs9.receivedMessages.length - 1];
    assert.ok(lastMsg);
    assert.equal(lastMsg.type, 'error');
    assert.equal(lastMsg.code, 'ROOM_CAPACITY_EXCEEDED');
  });

  it('permits reconnecting user to supersede existing connection when room is at capacity (no false block)', async () => {
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);
    coordinator.setRoomTier('free');

    const roomId = 'room_free_reconnect';

    // Admit 8 participants
    for (let i = 1; i <= 8; i++) {
      const [, serverWs] = MockWebSocket.createPair();
      const principal = createVerifiedPrincipal({
        userId: `user_${i}`,
        organizationId: 'org_test',
        role: 'participant',
      });
      const token = capabilityService.issueRoomCapabilityFromPrincipal(principal, roomId, 'participant');
      await coordinator.handleAdmitSocket(serverWs, token, roomId);
    }

    // Participant 1 reconnects (e.g. mobile Wi-Fi to cellular handover)
    const [, serverWsReconnect] = MockWebSocket.createPair();
    const principal1 = createVerifiedPrincipal({
      userId: 'user_1',
      organizationId: 'org_test',
      role: 'participant',
    });
    const reconnectToken = capabilityService.issueRoomCapabilityFromPrincipal(principal1, roomId, 'participant');

    // Should succeed because generational replacement supersedes existing slot
    const context = await coordinator.handleAdmitSocket(serverWsReconnect, reconnectToken, roomId);
    assert.equal(context.userId, 'user_1');
    assert.equal(context.generation, 2);
  });

  it('enforces Free Tier 40-minute duration limit with ROOM_DURATION_EXCEEDED', async () => {
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);
    coordinator.setRoomTier('free');

    const roomId = 'room_duration_test';

    // Simulate room created 45 minutes ago
    coordinator.setRoomCreatedAt(Date.now() - 45 * 60 * 1000);

    const [clientWs, serverWs] = MockWebSocket.createPair();
    const principal = createVerifiedPrincipal({
      userId: 'user_late',
      organizationId: 'org_test',
      role: 'participant',
    });
    const token = capabilityService.issueRoomCapabilityFromPrincipal(principal, roomId, 'participant', undefined, 300, 'free');

    await assert.rejects(
      async () => {
        await coordinator.handleAdmitSocket(serverWs, token, roomId);
      },
      /duration limit of 40 minutes exceeded/i
    );

    const lastMsg = clientWs.receivedMessages[clientWs.receivedMessages.length - 1];
    assert.ok(lastMsg);
    assert.equal(lastMsg.code, 'ROOM_DURATION_EXCEEDED');
  });

  it('supports Pro Tier with 50-participant limit and unlimited duration', async () => {
    const coordinator = new RoomCoordinatorDO({}, {}, storage);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);
    coordinator.setRoomTier('pro');

    const roomId = 'room_pro_01';

    // Simulate room created 3 hours ago (unlimited duration for Pro)
    coordinator.setRoomCreatedAt(Date.now() - 180 * 60 * 1000);

    // Admit participant beyond 40 minutes: must succeed
    const [, serverWs] = MockWebSocket.createPair();
    const principal = createVerifiedPrincipal({
      userId: 'user_pro_host',
      organizationId: 'org_pro',
      role: 'host',
    });
    const token = capabilityService.issueRoomCapabilityFromPrincipal(principal, roomId, 'host', undefined, 300, 'pro');

    const context = await coordinator.handleAdmitSocket(serverWs, token, roomId);
    assert.equal(context.userId, 'user_pro_host');
    assert.equal(coordinator.getRoomTier(), 'pro');
  });

  it('accurately models commercial SFU egress and triggers multi-stage spend alarms', () => {
    const alerts: SpendAlert[] = [];
    const spendAlarm = new SpendAlarmManager({
      egressPricePerGb: 0.05, // $0.05 / GB
      averageEgressGbPerParticipantMinute: 0.01515, // 2.02 Mbps = 0.01515 GB/min
      threshold1Dollars: 10_000,
      threshold2Dollars: 50_000,
      threshold3Dollars: 250_000,
      onAlert: (alert) => alerts.push(alert),
    });

    // 1. Initial state
    assert.equal(spendAlarm.calculateCurrentSpend(), 0);
    assert.equal(spendAlarm.canAdmit('free').allowed, true);

    // 2. Cross Threshold 1 ($10,000 / mo = 200,000 GB egress)
    // 200,000 GB / 0.01515 GB/min ≈ 13,201,320 participant-minutes
    spendAlarm.recordUsage(0, 200_000); // Record directly 200,000 GB
    assert.equal(spendAlarm.calculateCurrentSpend(), 10_000);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].thresholdLevel, 1);
    assert.equal(alerts[0].severity, 'info');

    // 3. Cross Threshold 2 ($50,000 / mo = 1,000,000 GB total egress)
    spendAlarm.recordUsage(0, 800_000);
    assert.equal(spendAlarm.calculateCurrentSpend(), 50_000);
    assert.equal(alerts.length, 2);
    assert.equal(alerts[1].thresholdLevel, 2);
    assert.equal(alerts[1].severity, 'warning');
    assert.ok(alerts[1].message.includes('Initiate commercial review'));

    // 4. Cross Threshold 3 ($250,000 / mo = 5,000,000 GB total egress)
    spendAlarm.recordUsage(0, 4_000_000);
    assert.equal(spendAlarm.calculateCurrentSpend(), 250_000);
    assert.equal(alerts.length, 3);
    assert.equal(alerts[2].thresholdLevel, 3);
    assert.equal(alerts[2].severity, 'critical');

    // 5. Emergency spend throttle active: Free and Pro rooms denied, Enterprise admitted
    const freeCheck = spendAlarm.canAdmit('free');
    assert.equal(freeCheck.allowed, false);
    assert.equal(freeCheck.code, 'BILLING_LIMIT_REACHED');

    const proCheck = spendAlarm.canAdmit('pro');
    assert.equal(proCheck.allowed, false);

    const enterpriseCheck = spendAlarm.canAdmit('enterprise');
    assert.equal(enterpriseCheck.allowed, true);

    // 6. Audited executive override unblocks admissions
    spendAlarm.setManualOverride(true, 'vp_eng_alice', 'Executive approval for high-traffic keynote event');
    const overrideFreeCheck = spendAlarm.canAdmit('free');
    assert.equal(overrideFreeCheck.allowed, true);

    const estimate = spendAlarm.getSpendEstimate();
    assert.equal(estimate.manualOverrideActive, true);
    assert.equal(estimate.manualOverrideAuditor, 'vp_eng_alice');
  });

  it('integrates SpendAlarmManager directly into RoomCoordinatorDO admission pipeline', async () => {
    const spendAlarm = new SpendAlarmManager({
      threshold3Dollars: 100, // Low threshold for test
    });
    // Push spend over threshold
    spendAlarm.recordUsage(0, 2_500); // 2,500 GB * $0.05 = $125

    const coordinator = new RoomCoordinatorDO({}, {}, storage, undefined, spendAlarm);
    coordinator.setPublicKeyJwk(keyPair.publicKeyJwk);

    const roomId = 'room_throttled_spend';
    const [clientWs, serverWs] = MockWebSocket.createPair();

    const principal = createVerifiedPrincipal({
      userId: 'user_throttled',
      organizationId: 'org_test',
      role: 'participant',
    });
    const token = capabilityService.issueRoomCapabilityFromPrincipal(principal, roomId, 'participant', undefined, 300, 'free');

    // Free user admission must be throttled with BILLING_LIMIT_REACHED
    await assert.rejects(
      async () => {
        await coordinator.handleAdmitSocket(serverWs, token, roomId);
      },
      /spend limit of \$100 exceeded/i
    );

    const lastMsg = clientWs.receivedMessages[clientWs.receivedMessages.length - 1];
    assert.ok(lastMsg);
    assert.equal(lastMsg.code, 'BILLING_LIMIT_REACHED');
  });
});
