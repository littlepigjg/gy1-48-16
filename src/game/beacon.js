import { TILE_SIZE, SURFACE_Y, BEACON_MAX_SLOTS_BASE, BEACON_COST_DISCOUNT, BEACON_ENEMY_DETECT_RADIUS, BEACON_COLORS } from './constants.js';

export class BeaconSystem {
  constructor() {
    this.beacons = [];
    this.maxBeacons = BEACON_MAX_SLOTS_BASE;
    this.targetBeacon = null;
    this.isBeaconTeleport = false;
  }

  setMaxBeacons(level) {
    this.maxBeacons = BEACON_MAX_SLOTS_BASE + level;
  }

  calculateBeaconCost(currentDepth, beaconDepth) {
    const depthDiff = Math.abs(currentDepth - beaconDepth);
    const baseCost = Math.ceil(depthDiff / 100) * 20;
    const cost = Math.max(30, baseCost);
    return Math.ceil(cost * BEACON_COST_DISCOUNT);
  }

  canTeleportToBeacon(player, beaconIndex) {
    if (!this.beacons[beaconIndex]) return { can: false, reason: '信标不存在' };

    const currentDepth = Math.max(0, player.tileY - SURFACE_Y);
    const cost = this.calculateBeaconCost(currentDepth, this.beacons[beaconIndex].depth);

    if (player.gold < cost) return { can: false, reason: `金币不足（需要$${cost}）` };

    return { can: true, cost, beacon: this.beacons[beaconIndex] };
  }

  canPlaceBeacon(player) {
    if (this.beacons.length >= this.maxBeacons) {
      return { can: false, reason: '信标槽位已满' };
    }
    if (player.beacons <= 0) {
      return { can: false, reason: '没有信标物品' };
    }
    const depth = player.tileY - SURFACE_Y;
    if (depth < 5) {
      return { can: false, reason: '太靠近地面' };
    }
    return { can: true };
  }

  placeBeacon(player, name = null) {
    const check = this.canPlaceBeacon(player);
    if (!check.can) return check;

    const index = this.beacons.length;
    const beacon = {
      id: Date.now(),
      name: name || `信标 ${index + 1}`,
      tileX: player.tileX,
      tileY: player.tileY,
      x: player.x,
      y: player.y,
      depth: player.tileY - SURFACE_Y,
      color: BEACON_COLORS[index % BEACON_COLORS.length],
      createdAt: Date.now()
    };

    this.beacons.push(beacon);
    player.beacons--;
    return { success: true, beacon, index };
  }

  removeBeacon(index, player) {
    if (index < 0 || index >= this.beacons.length) return false;
    this.beacons.splice(index, 1);
    player.beacons++;
    return true;
  }

  renameBeacon(index, newName) {
    if (index < 0 || index >= this.beacons.length) return false;
    this.beacons[index].name = newName || `信标 ${index + 1}`;
    return true;
  }

  getBeaconEnemyCount(beaconIndex, enemies) {
    const beacon = this.beacons[beaconIndex];
    if (!beacon || !enemies) return 0;

    let count = 0;
    const radius = BEACON_ENEMY_DETECT_RADIUS * TILE_SIZE;

    for (const enemy of enemies) {
      const dx = enemy.x - beacon.x;
      const dy = enemy.y - beacon.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) count++;
    }
    return count;
  }

  hasEnemiesNearBeacon(beaconIndex, enemies) {
    return this.getBeaconEnemyCount(beaconIndex, enemies) > 0;
  }

  getBeaconCount() {
    return this.beacons.length;
  }

  getMaxBeacons() {
    return this.maxBeacons;
  }
}
