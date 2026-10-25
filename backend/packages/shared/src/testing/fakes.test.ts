import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FakeClock,
  FakeIdGenerator,
  FakeMailer,
  FakePaymentService,
  FakeObjectStorage,
  FakeQueue,
  FakeRoomBackend,
} from './index.js';

describe('Deterministic Testing Fakes Verification', () => {
  it('FakeClock advances and resets deterministically', () => {
    const clock = new FakeClock(1000);
    assert.equal(clock.nowMs(), 1000);
    clock.advance(500);
    assert.equal(clock.nowMs(), 1500);
    clock.reset();
    assert.equal(clock.nowMs(), 1000);
  });

  it('FakeIdGenerator generates sequential IDs', () => {
    const idGen = new FakeIdGenerator('test');
    assert.equal(idGen.next(), 'test_1');
    assert.equal(idGen.next(), 'test_2');
    idGen.reset();
    assert.equal(idGen.next(), 'test_1');
  });

  it('FakeMailer captures emails and supports failure simulation', async () => {
    const mailer = new FakeMailer();
    await mailer.send({ to: 'user@meetlite.dev', subject: 'Welcome' });
    assert.equal(mailer.getSent().length, 1);
    assert.equal(mailer.getLast()?.to, 'user@meetlite.dev');

    mailer.simulateFailure(true);
    await assert.rejects(() => mailer.send({ to: 'fail@meetlite.dev', subject: 'Test' }));
  });

  it('FakePaymentService tracks customers and subscriptions', async () => {
    const payment = new FakePaymentService();
    const customer = await payment.createCustomer('payer@meetlite.dev');
    const sub = await payment.createSubscription(customer.customerId, 'pro_plan');
    assert.equal(sub.status, 'active');
    await payment.cancelSubscription(sub.subscriptionId);
    assert.equal(payment.getSubscription(sub.subscriptionId)?.status, 'canceled');
  });

  it('FakeObjectStorage supports multipart upload and denies cross-tenant access', async () => {
    const storage = new FakeObjectStorage();
    const { uploadId } = await storage.createMultipartUpload('rec_1.mp4', 'video/mp4', 'tenant_a');

    await storage.uploadPart(uploadId, 1, Buffer.from('chunk1'));
    await storage.uploadPart(uploadId, 2, Buffer.from('chunk2'));

    const obj = await storage.completeMultipartUpload(uploadId, [
      { partNumber: 1 },
      { partNumber: 2 },
    ]);
    assert.equal(obj.data.toString(), 'chunk1chunk2');

    // Cross-tenant access denied without exposing object
    const denied = await storage.getObject('rec_1.mp4', 'tenant_b');
    assert.equal(denied, null);

    const allowed = await storage.getObject('rec_1.mp4', 'tenant_a');
    assert.equal(allowed?.size, 12);
  });

  it('FakeQueue enforces job idempotency and retry/dead-letter semantics', async () => {
    const queue = new FakeQueue<string>();
    const j1 = await queue.add('test-job', 'data-1', { jobId: 'idempotent-key-1' });
    const j2 = await queue.add('test-job', 'data-1-duplicate', { jobId: 'idempotent-key-1' });
    assert.equal(j1.id, j2.id); // Same job returned, not duplicated

    // Process job with failure to observe retry and dead letter
    await queue.processNext(async () => {
      throw new Error('Failure 1');
    });
    assert.equal(queue.getJob('idempotent-key-1')?.attempts, 1);
    assert.equal(queue.getJob('idempotent-key-1')?.status, 'waiting');
  });

  it('FakeRoomBackend coordinates admission, publications, and revisions', () => {
    const room = new FakeRoomBackend('room_abc', 2);
    const { membership: alice } = room.join('user_alice', 'member');
    assert.equal(alice.generation, 1);

    const pub = room.publish(alice.membershipId, 'video', true);
    assert.equal(pub.kind, 'video');

    const reconnected = room.reconnect(alice.membershipId);
    assert.equal(reconnected.generation, 2);

    room.join('user_bob', 'member');
    assert.throws(() => room.join('user_charlie', 'member'), /ROOM_CAPACITY_EXCEEDED/);

    room.leave(alice.membershipId);
    const snapshot = room.getSnapshot();
    assert.equal(snapshot.participants.length, 1);
    assert.equal(snapshot.publications.length, 0); // Alice's publications withdrawn on leave
  });
});
