import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { P2PNode } from '../node';
import { PeerDiscovery } from '../peer-discovery';
import { BandwidthTracker } from '../bandwidth';
import { OfflineQueue } from '../offline-queue';
import { NodeConfig, PeerInfo } from '../types';

describe('P2PNode', () => {
  let node: P2PNode;

  afterEach(async () => {
    if (node) await node.stop();
  });

  it('should start and stop', async () => {
    node = new P2PNode({ port: 0, host: '127.0.0.1' });
    await node.start();
    const status = node.getStatus();
    expect(status.started).toBe(true);
    expect(status.peerId).toBeTruthy();
    expect(status.peerId.startsWith('12D3KooW')).toBe(true);
    await node.stop();
    expect(node.getStatus().started).toBe(false);
  });

  it('should generate unique peer IDs', () => {
    const node1 = new P2PNode();
    const node2 = new P2PNode();
    expect(node1.getPeerId()).not.toBe(node2.getPeerId());
  });

  it('should connect two nodes', async () => {
    const nodeA = new P2PNode({ port: 0, host: '127.0.0.1' });
    await nodeA.start();
    const addrs = nodeA.getMultiaddrs();
    expect(addrs.length).toBeGreaterThan(0);

    const nodeB = new P2PNode({ port: 0, host: '127.0.0.1' });
    await nodeB.start();

    const connected = await nodeB.dial(addrs[0]);
    expect(connected).toBe(true);

    await nodeA.stop();
    await nodeB.stop();
  });

  it('should gossip messages between connected peers', async () => {
    const nodeA = new P2PNode({ port: 0, host: '127.0.0.1' });
    await nodeA.start();

    const nodeB = new P2PNode({ port: 0, host: '127.0.0.1' });
    await nodeB.start();

    await nodeB.dial(nodeA.getMultiaddrs()[0]);

    const received: Array<{ topic: string; data: string }> = [];
    nodeB.on((event) => {
      if (event.type === 'message') {
        received.push({ topic: event.topic, data: event.data });
      }
    });

    await nodeA.publish('test-topic', 'hello from A');

    await new Promise((r) => setTimeout(r, 200));

    expect(received.length).toBeGreaterThan(0);
    expect(received[0].topic).toBe('test-topic');
    expect(received[0].data).toBe('hello from A');

    await nodeA.stop();
    await nodeB.stop();
  });

  it('should store and retrieve DHT values', async () => {
    const nodeA = new P2PNode({ port: 0, host: '127.0.0.1' });
    await nodeA.start();

    await nodeA.storeDHT('test-key', 'test-value');
    const found = await nodeA.findDHT('test-key');
    expect(found).toBeDefined();
    expect(found!.value).toBe('test-value');

    const missing = await nodeA.findDHT('nonexistent');
    expect(missing).toBeUndefined();

    await nodeA.stop();
  });

  it('should provide status information', async () => {
    node = new P2PNode({ port: 0, host: '127.0.0.1' });
    await node.start();

    const status = node.getStatus();
    expect(typeof status.peerId).toBe('string');
    expect(typeof status.connectedPeers).toBe('number');
    expect(typeof status.uptime).toBe('number');
    expect(Array.isArray(status.multiaddrs)).toBe(true);

    await node.stop();
  });

  it('should emit events', async () => {
    node = new P2PNode({ port: 0, host: '127.0.0.1' });
    const events: string[] = [];
    node.on((event) => events.push(event.type));

    await node.start();
    await node.storeDHT('k', 'v');

    expect(events).toContain('dht:value_stored');

    await node.stop();
  });
});

describe('PeerDiscovery', () => {
  it('should discover bootstrap peers', async () => {
    const discovery = new PeerDiscovery({
      bootstrapPeers: ['/ip4/1.2.3.4/tcp/9000', '/ip4/5.6.7.8/tcp/9001'],
    });

    const knownPeers = new Map<string, PeerInfo>();
    const found = await discovery.discover(knownPeers, 0);

    expect(found.length).toBeGreaterThanOrEqual(2);
    expect(found.some((p) => p.multiaddrs.includes('/ip4/1.2.3.4/tcp/9000'))).toBe(true);
    expect(found.some((p) => p.multiaddrs.includes('/ip4/5.6.7.8/tcp/9001'))).toBe(true);
  });

  it('should generate gossip peers when needed', async () => {
    const discovery = new PeerDiscovery({ maxPeers: 10 });
    const knownPeers = new Map<string, PeerInfo>();
    knownPeers.set('existing', { id: 'existing', multiaddrs: [], lastSeen: Date.now() });

    const found = await discovery.discover(knownPeers, 0);
    const gossipPeers = found.filter((p) => p.id.startsWith('gossip_'));
    expect(gossipPeers.length).toBeGreaterThanOrEqual(2);
  });

  it('should not exceed maxPeers', async () => {
    const discovery = new PeerDiscovery({
      bootstrapPeers: Array.from({ length: 20 }, (_, i) => `/ip4/10.0.0.${i}/tcp/9000`),
      maxPeers: 5,
    });

    const knownPeers = new Map<string, PeerInfo>();
    const found = await discovery.discover(knownPeers, 0);

    expect(found.length).toBeLessThanOrEqual(5);
  });
});

describe('BandwidthTracker', () => {
  it('should track bytes in and out', () => {
    const tracker = new BandwidthTracker({ enabled: true });

    tracker.recordBytesIn(100);
    tracker.recordBytesOut(200);

    expect(tracker.getTotalIn()).toBe(100);
    expect(tracker.getTotalOut()).toBe(200);
  });

  it('should track per-peer stats', () => {
    const tracker = new BandwidthTracker({ enabled: true });

    tracker.recordBytesIn(50, 'peerA');
    tracker.recordBytesIn(30, 'peerB');
    tracker.recordBytesOut(100, 'peerA');

    const statsA = tracker.getPeerStats('peerA');
    expect(statsA).toBeDefined();
    expect(statsA!.bytesIn).toBe(50);
    expect(statsA!.bytesOut).toBe(100);

    const statsB = tracker.getPeerStats('peerB');
    expect(statsB!.bytesIn).toBe(30);
  });

  it('should detect leechers', () => {
    const tracker = new BandwidthTracker({ enabled: true });

    tracker.recordBytesIn(1000, 'leecher');
    tracker.recordBytesOut(10, 'leecher');

    tracker.recordBytesIn(100, 'seeder');
    tracker.recordBytesOut(500, 'seeder');

    expect(tracker.isLeeching('leecher', 0.5)).toBe(true);
    expect(tracker.isLeeching('seeder', 0.5)).toBe(false);
  });

  it('should return bandwidth stats', () => {
    const tracker = new BandwidthTracker({ enabled: true });

    tracker.recordBytesIn(1000);
    tracker.recordBytesOut(2000);

    const stats = tracker.getBandwidthStats();
    expect(stats.totalBytesIn).toBe(1000);
    expect(stats.totalBytesOut).toBe(2000);
    expect(typeof stats.rateInBps).toBe('number');
    expect(typeof stats.lastUpdated).toBe('number');
  });
});

describe('OfflineQueue', () => {
  let queue: OfflineQueue;

  beforeEach(() => {
    queue = new OfflineQueue({ enabled: true, maxRetries: 3 });
  });

  it('should enqueue and drain entries', () => {
    const id = queue.enqueue({ type: 'publish', payload: '{"test":true}' });
    expect(id).toBeTruthy();
    expect(queue.length()).toBe(1);

    let drained = 0;
    const count = queue.drain(() => { drained++; });
    expect(count).toBe(1);
    expect(queue.length()).toBe(0);
  });

  it('should not exceed max retries', () => {
    queue.enqueue({ type: 'publish', payload: '{}' });
    expect(queue.length()).toBe(1);

    queue.drain(() => { throw new Error('fail'); });
    expect(queue.length()).toBe(1);

    queue.drain(() => { throw new Error('fail'); });
    queue.drain(() => { throw new Error('fail'); });
    queue.drain(() => { throw new Error('fail'); });
    expect(queue.length()).toBe(0);
  });

  it('should filter by type', () => {
    queue.enqueue({ type: 'publish', payload: 'a' });
    queue.enqueue({ type: 'rate', payload: 'b' });
    queue.enqueue({ type: 'publish', payload: 'c' });

    const publishes = queue.getEntriesByType('publish');
    expect(publishes.length).toBe(2);
  });

  it('should check pending status', () => {
    expect(queue.hasPending()).toBe(false);
    expect(queue.getPendingCount()).toBe(0);

    queue.enqueue({ type: 'custom', payload: 'x' });
    expect(queue.hasPending()).toBe(true);
    expect(queue.getPendingCount()).toBe(1);
  });

  it('should clear all entries', () => {
    queue.enqueue({ type: 'publish', payload: 'a' });
    queue.enqueue({ type: 'rate', payload: 'b' });
    expect(queue.length()).toBe(2);

    queue.clear();
    expect(queue.length()).toBe(0);
  });

  it('should remove specific entry', () => {
    const id1 = queue.enqueue({ type: 'publish', payload: 'a' });
    queue.enqueue({ type: 'rate', payload: 'b' });

    const removed = queue.remove(id1);
    expect(removed).toBe(true);
    expect(queue.length()).toBe(1);
  });
});
