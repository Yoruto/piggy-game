/** A public, copy-only projection; enemy resistance values are NEVER exposed. */
export function mapBattleSnapshot(snapshot) {
  if (!snapshot) return null;
  const model = structuredClone(snapshot);
  for (const side of ['player', 'enemy']) {
    // Only information discovered BY THE PLAYER can enter the player's public ViewModel.
    for (const pig of model.teams[side]) {
      pig.discoveredResistances = side === 'enemy'
        ? { ...(snapshot.knownResistances.player?.[pig.id] ?? {}) } : {};
      // Private AI knowledge is not a part of the player's visible ViewModel.
    }
  }
  delete model.knownResistances;
  return model;
}
export function mapBattleEvents(events) {
  return events.map(e => structuredClone(e));
}
