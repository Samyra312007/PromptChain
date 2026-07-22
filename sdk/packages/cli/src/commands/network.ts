import { P2PNode, NodeConfig, NodeStatus } from '@promptchain/network';

let runningNode: P2PNode | null = null;

export async function nodeStartCommand(
  options: {
    port?: string;
    host?: string;
    maxPeers?: string;
    bootstrap?: string;
    rpcUrl?: string;
    daemon?: boolean;
  },
): Promise<void> {
  if (runningNode) {
    console.log('Node is already running. Stop it first with: promptchain node stop');
    return;
  }

  const config: Partial<NodeConfig> = {
    port: options.port ? parseInt(options.port) : 9000,
    host: options.host || '0.0.0.0',
    maxPeers: options.maxPeers ? parseInt(options.maxPeers) : 50,
    onChainRegistryRpc: options.rpcUrl,
    offlineQueueEnabled: true,
    bandwidthAccounting: true,
    dhtEnabled: true,
    gossipEnabled: true,
  };

  if (options.bootstrap) {
    config.bootstrapPeers = options.bootstrap.split(',').map((s) => s.trim());
  }

  const node = new P2PNode(config);
  await node.start();
  runningNode = node;

  const status = node.getStatus();
  console.log('P2P node started:');
  console.log('  Peer ID:     ', status.peerId);
  console.log('  Multiaddrs:  ', status.multiaddrs.join(', '));
  console.log('  Port:        ', config.port);
  console.log('  Max Peers:   ', config.maxPeers);
  console.log('  DHT Enabled: ', config.dhtEnabled);
  console.log('  Gossip:      ', config.gossipEnabled);
  console.log('');

  if (options.daemon) {
    console.log('Running in daemon mode. Press Ctrl+C to stop.');
    process.on('SIGINT', async () => {
      await nodeStopCommand();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await nodeStopCommand();
      process.exit(0);
    });
  }
}

export async function nodeStopCommand(): Promise<void> {
  if (!runningNode) {
    console.log('No node running.');
    return;
  }

  await runningNode.stop();
  runningNode = null;
  console.log('P2P node stopped.');
}

export async function nodeStatusCommand(): Promise<void> {
  if (!runningNode) {
    console.log('Node is not running.');
    return;
  }

  const status = runningNode.getStatus();
  console.log('Node Status:');
  console.log('  Started:         ', status.started ? 'Yes' : 'No');
  console.log('  Peer ID:         ', status.peerId);
  console.log('  Connected Peers: ', status.connectedPeers);
  console.log('  Known Peers:     ', status.knownPeers);
  console.log('  DHT Entries:     ', status.dhtEntries);
  console.log('  Bandwidth In:    ', formatBytes(status.bandwidthIn));
  console.log('  Bandwidth Out:   ', formatBytes(status.bandwidthOut));
  console.log('  Queue Length:    ', status.queueLength);
  console.log('  Uptime:          ', formatDuration(status.uptime));
  console.log('  Multiaddrs:      ', status.multiaddrs.join(', '));
}

export async function nodePeersCommand(): Promise<void> {
  if (!runningNode) {
    console.log('Node is not running.');
    return;
  }

  const connectedPeers = runningNode.getConnectedPeers();
  const knownPeers = runningNode.getKnownPeers();

  console.log(`Connected Peers (${connectedPeers.size}):`);
  if (connectedPeers.size === 0) {
    console.log('  (none)');
  } else {
    for (const [id, info] of connectedPeers) {
      console.log(`  ${id}`);
      console.log(`    Multiaddrs: ${info.multiaddrs.join(', ') || 'unknown'}`);
      console.log(`    Agent: ${info.agentVersion || 'unknown'}`);
      if (info.connectedAt) {
        console.log(`    Connected: ${formatDuration(Date.now() - info.connectedAt)} ago`);
      }
    }
  }

  console.log(`\nKnown Peers (${knownPeers.size}):`);
  if (knownPeers.size === 0) {
    console.log('  (none)');
  } else {
    for (const [id, info] of knownPeers) {
      const connected = connectedPeers.has(id) ? ' (connected)' : '';
      console.log(`  ${id}${connected}`);
    }
  }
}

export async function nodePublishCommand(
  topic: string,
  data: string,
): Promise<void> {
  if (!runningNode) {
    console.log('Node is not running. Start it first with: promptchain node start');
    return;
  }

  await runningNode.publish(topic, data);
  console.log(`Published message on topic "${topic}"`);
}

export async function nodeStoreCommand(
  key: string,
  value: string,
): Promise<void> {
  if (!runningNode) {
    console.log('Node is not running. Start it first with: promptchain node start');
    return;
  }

  await runningNode.storeDHT(key, value);
  console.log(`Stored key "${key}" in DHT`);
}

export async function nodeFindCommand(
  key: string,
): Promise<void> {
  if (!runningNode) {
    console.log('Node is not running. Start it first with: promptchain node start');
    return;
  }

  const entry = await runningNode.findDHT(key);
  if (entry) {
    console.log(`Found DHT entry for "${key}":`);
    console.log('  Value:    ', entry.value);
    console.log('  Publisher:', entry.publisher);
    console.log('  Timestamp:', new Date(entry.timestamp).toISOString());
  } else {
    console.log(`No DHT entry found for "${key}"`);
  }
}

export async function nodeConnectCommand(
  addr: string,
): Promise<void> {
  if (!runningNode) {
    console.log('Node is not running. Start it first with: promptchain node start');
    return;
  }

  const connected = await runningNode.dial(addr);
  if (connected) {
    console.log(`Connected to ${addr}`);
  } else {
    console.log(`Failed to connect to ${addr}`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}
