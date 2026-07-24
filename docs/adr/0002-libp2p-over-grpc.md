# ADR-0002: Use libp2p for P2P Networking Instead of gRPC

| Field | Value |
|-------|-------|
| Status | `Accepted` |
| Author | PromptChain Core |
| Created | 2026-01-20 |
| Last Updated | 2026-01-20 |

## Context

PromptChain nodes need to discover each other, gossip prompt metadata, and sync prompt content without a central server. The network layer must:
- Work behind NATs and firewalls
- Support offline-first operation
- Scale to thousands of nodes without a central rendezvous
- Be embeddable in a CLI tool (no infrastructure dependencies)

## Decision

Use [libp2p](https://libp2p.io/) with TCP transport, Noise encryption, mplex/yamux multiplexing, and Kademlia DHT for peer discovery.

## Rationale

1. **NAT traversal** — libp2p has built-in ICE/STUN/TURN support via `circuit-relay`. gRPC requires a cloud load balancer or manual port forwarding.

2. **DHT discovery** — libp2p's Kademlia DHT lets nodes find each other without a central bootstrap server (beyond initial bootstrapping from the on-chain curator registry). gRPC requires a service mesh or DNS-based load balancing.

3. **Offline-first** — libp2p's `go-offline-first` pattern allows publishing to a local message queue that syncs when connectivity returns. gRPC is fundamentally request-response with connection affinity.

4. **Stream multiplexing** — libp2p multiplexes many streams over one TCP connection. gRPC/HTTP/2 multiplexes requests over one connection but is designed for client-server, not peer-to-peer.

5. **Resource-constrained environments** — libp2p implementations exist in Rust, Go, JS, and Python. The JS implementation (`@libp2p/*`) runs in Node.js with minimal overhead. gRPC requires HTTP/2 which adds memory overhead.

## Alternatives Considered

- **gRPC:** Rejected because it requires a server-side load balancer and doesn't support NAT traversal. gRPC is excellent for datacenter microservices; it's terrible for P2P protocols.

- **WebSocket + custom protocol:** Rejected because implementing DHT, NAT traversal, stream multiplexing, and encryption from scratch is a multi-month project. libp2p provides all of these as interchangeable modules.

- **IPFS libp2p directly:** IPFS uses libp2p but wraps it with IPFS-specific protocols (bitswap, IPNS). We want the transport layer only, not the IPFS data model.

## Consequences

- **Positive:** P2P discovery without infrastructure, NAT traversal built-in, offline message queues, bandwidth accounting via libp2p's connection manager
- **Negative:** libp2p has a steep learning curve. The `@libp2p/*` JS ecosystem has rapid API churn (major breaking changes between v0.x and v1.x).
- **Trade-off:** We use a subset of libp2p features (TCP, Noise, mplex, Kademlia, circuit-relay) to minimize API surface and upgrade risk.
