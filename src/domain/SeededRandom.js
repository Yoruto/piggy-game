/** Deterministic uint32 LCG; also implementable in C# with unchecked uint arithmetic. */
export class SeededRandom {
  constructor(seed = 1) { this.state = seed >>> 0; }
  next() { this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0; return this.state / 4294967296; }
  index(length) { if (!Number.isInteger(length) || length <= 0) throw new Error('Invalid random range'); return Math.floor(this.next() * length); }
}
