// ===== CONFIGURATION & CONSTANTS =====
const HEX_CHARS = '0123456789abcdef';
const ID_LENGTH = 8;

// ===== CORE BUSINESS LOGIC =====

/**
 * Generates strictly unique 8-character lowercase hexadecimal Elementor IDs ([a-f0-9]{8}).
 * Maintains an internal registry per conversion session to guarantee zero collisions.
 */
export class ElementorIdRegistry {
  private usedIds: Set<string> = new Set();
  private counter = 1;

  public reset(): void {
    this.usedIds.clear();
    this.counter = 1;
  }

  public generateId(seed?: string): string {
    let candidate = '';

    if (seed) {
      let hash = 2166136261;
      const input = `${seed}_${this.counter++}`;
      for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const unsigned = hash >>> 0;
      candidate = unsigned.toString(16).padStart(ID_LENGTH, '0').slice(0, ID_LENGTH).toLowerCase();
    }

    while (!candidate || candidate.length !== ID_LENGTH || !/^[a-f0-9]{8}$/.test(candidate) || this.usedIds.has(candidate)) {
      let randomHex = '';
      for (let i = 0; i < ID_LENGTH; i++) {
        const idx = Math.floor(Math.random() * HEX_CHARS.length);
        randomHex += HEX_CHARS[idx];
      }
      candidate = randomHex;
    }

    this.usedIds.add(candidate);
    return candidate;
  }

  public has(id: string): boolean {
    return this.usedIds.has(id);
  }

  public count(): number {
    return this.usedIds.size;
  }
}
