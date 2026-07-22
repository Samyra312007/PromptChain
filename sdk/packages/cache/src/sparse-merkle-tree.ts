import { createHash } from 'crypto';
import { CommitmentProof } from './types';

const DEFAULT_DEPTH = 8;
const EMPTY_HASH = createHash('sha256').update('').digest('hex');

function hashPair(left: string, right: string): string {
  return createHash('sha256').update(left + right).digest('hex');
}

export class SparseMerkleTree {
  private leaves: Map<number, string> = new Map();
  private keyIndex: Map<string, number> = new Map();
  private nodeCache: Map<string, string> = new Map();
  private depth: number;

  constructor(depth: number = DEFAULT_DEPTH) {
    this.depth = depth;
  }

  update(key: string, valueHash: string): void {
    const index = this.hashToIndex(key);
    this.leaves.set(index, valueHash);
    this.keyIndex.set(key, index);
    this.nodeCache.clear();
  }

  delete(key: string): void {
    const index = this.keyIndex.get(key);
    if (index !== undefined) {
      this.leaves.delete(index);
      this.keyIndex.delete(key);
      this.nodeCache.clear();
    }
  }

  getRoot(): string {
    return this.computeNode(0, this.depth);
  }

  getLeaf(key: string): { index: number; hash: string } | undefined {
    const index = this.keyIndex.get(key);
    if (index === undefined) return undefined;
    const hash = this.leaves.get(index);
    if (hash === undefined) return undefined;
    return { index, hash };
  }

  generateProof(key: string): CommitmentProof | undefined {
    const leaf = this.getLeaf(key);
    if (!leaf) return undefined;

    const path: Array<{ hash: string; isLeft: boolean }> = [];

    for (let level = 1; level <= this.depth; level++) {
      const leafIndex = leaf.index;
      const leafIdxAtLevel = leafIndex >> (level - 1);
      const siblingIdx = leafIdxAtLevel ^ 1;
      const siblingOffset = siblingIdx * (1 << (level - 1));
      const isLeft = (leafIdxAtLevel & 1) === 1;

      path.push({
        hash: this.computeNode(siblingOffset, level - 1),
        isLeft,
      });
    }

    return {
      root: this.getRoot(),
      leaf: leaf.hash,
      path,
    };
  }

  verifyProof(proof: CommitmentProof): boolean {
    let hash = proof.leaf;
    for (const step of proof.path) {
      hash = step.isLeft
        ? hashPair(step.hash, hash)
        : hashPair(hash, step.hash);
    }
    return hash === proof.root;
  }

  getChangedKeys(oldRoot: string, _newRoot: string): string[] {
    const changed: string[] = [];
    for (const [key, index] of this.keyIndex) {
      const leafHash = this.leaves.get(index) || EMPTY_HASH;
      this.leaves.delete(index);
      const oldTreeRoot = this.computeNode(0, this.depth);
      if (oldTreeRoot !== oldRoot) {
        changed.push(key);
      }
      this.leaves.set(index, leafHash);
    }
    // restore by clearing cache
    this.nodeCache.clear();
    return changed;
  }

  leafCount(): number {
    return this.leaves.size;
  }

  private hashToIndex(key: string): number {
    const hash = createHash('sha256').update(key).digest();
    return hash.readUInt32BE(0) % (1 << this.depth);
  }

  private computeNode(offset: number, height: number): string {
    if (height === 0) {
      return this.leaves.get(offset) ?? EMPTY_HASH;
    }

    const cacheKey = `${offset}:${height}`;
    const cached = this.nodeCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const stride = 1 << (height - 1);
    const left = this.computeNode(offset, height - 1);
    const right = this.computeNode(offset + stride, height - 1);
    const hash = hashPair(left, right);
    this.nodeCache.set(cacheKey, hash);
    return hash;
  }
}
