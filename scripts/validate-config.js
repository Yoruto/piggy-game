import { loadFixture } from '../src/config/loadFixture.js';
const cfg = await loadFixture();
console.log(`Fixture config validated: ${Object.keys(cfg.affinity).length} types, ${cfg.rules.statStageMultipliers.length} stat multipliers; NOT v1.3 production numbers.`);
