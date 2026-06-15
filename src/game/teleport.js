import { TILE_SIZE, SURFACE_Y, WORLD_WIDTH, BEACON_MAX_SLOTS_BASE, BEACON_COST_DISCOUNT, BEACON_ENEMY_DETECT_RADIUS, BEACON_COLORS } from './constants.js';

export class TeleportSystem {
  constructor() {
    this.active = false;
    this.progress = 0;
    this.duration = 2.5;
    this.costPer100Depth = 20;
    this.minCost = 30;
    this.cooldown = 0;
    this.cooldownMax = 5;
    this.cooldownOnCancel = 1.5;
    this.gracePeriod = 0;
    this.gracePeriodMax = 0.5;

    this.beacons = [];
    this.maxBeacons = BEACON_MAX_SLOTS_BASE;
    this.targetBeacon = null;
    this.isBeaconTeleport = false;
  }

  setMaxBeacons(level) {
    this.maxBeacons = BEACON_MAX_SLOTS_BASE + level;
  }

  calculateCost(currentDepth) {
    const depthCost = Math.ceil(currentDepth / 100) * this.costPer100Depth;
    return Math.max(this.minCost, depthCost);
  }

  calculateBeaconCost(currentDepth, beaconDepth) {
    const depthDiff = Math.abs(currentDepth - beaconDepth);
    const baseCost = Math.ceil(depthDiff / 100) * this.costPer100Depth;
    const cost = Math.max(this.minCost, baseCost);
    return Math.ceil(cost * BEACON_COST_DISCOUNT);
  }

  canTeleport(player) {
    if (this.cooldown > 0) return { can: false, reason: '冷却中' };
    if (this.active) return { can: false, reason: '传送中' };
    
    const cost = this.calculateCost(Math.max(0, player.tileY - SURFACE_Y));
    if (player.gold < cost) return { can: false, reason: `金币不足（需要$${cost}）` };
    
    return { can: true, cost };
  }

  canTeleportToBeacon(player, beaconIndex) {
    if (this.cooldown > 0) return { can: false, reason: '冷却中' };
    if (this.active) return { can: false, reason: '传送中' };
    
    const beacon = this.beacons[beaconIndex];
    if (!beacon) return { can: false, reason: '信标不存在' };

    const currentDepth = Math.max(0, player.tileY - SURFACE_Y);
    const beaconDepth = beacon.depth;
    const cost = this.calculateBeaconCost(currentDepth, beaconDepth);
    
    if (player.gold < cost) return { can: false, reason: `金币不足（需要$${cost}）` };
    
    return { can: true, cost, beacon };
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

  removeBeacon(index) {
    if (index < 0 || index >= this.beacons.length) return false;
    this.beacons.splice(index, 1);
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

  start(player) {
    const check = this.canTeleport(player);
    if (!check.can) return check;

    this.active = true;
    this.progress = 0;
    this.gracePeriod = this.gracePeriodMax;
    this.isBeaconTeleport = false;
    this.targetBeacon = null;
    return { success: true, cost: check.cost };
  }

  startBeaconTeleport(player, beaconIndex) {
    const check = this.canTeleportToBeacon(player, beaconIndex);
    if (!check.can) return check;

    this.active = true;
    this.progress = 0;
    this.gracePeriod = this.gracePeriodMax;
    this.isBeaconTeleport = true;
    this.targetBeacon = check.beacon;
    return { success: true, cost: check.cost, beacon: check.beacon };
  }

  cancel(force = false) {
    if (this.active) {
      if (!force && this.gracePeriod > 0) {
        return false;
      }
      this.active = false;
      this.progress = 0;
      this.cooldown = this.cooldownOnCancel;
      this.targetBeacon = null;
      this.isBeaconTeleport = false;
      return true;
    }
    return false;
  }

  update(dt, player, world, particles, onComplete) {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
    }

    if (!this.active) return;

    if (this.gracePeriod > 0) {
      this.gracePeriod -= dt;
    }

    this.progress += dt / this.duration;

    let targetX, targetY;
    
    if (this.isBeaconTeleport && this.targetBeacon) {
      targetX = this.targetBeacon.tileX;
      targetY = this.targetBeacon.tileY;
    } else {
      targetX = Math.floor(WORLD_WIDTH / 2);
      targetY = SURFACE_Y - 1;
    }
    
    const startProgress = Math.min(1, this.progress * 3);
    const endProgress = Math.max(0, (this.progress - 0.7) / 0.3);

    if (this.progress < 1 && Math.random() < 0.3) {
      particles.spawn(
        player.x + (Math.random() - 0.5) * 40,
        player.y + (Math.random() - 0.5) * 40,
        this.getTeleportColor(),
        1,
        3 + Math.random() * 2,
        { gravity: -0.05, lifeMin: 10, lifeMax: 20 }
      );
    }

    if (this.progress >= 1) {
      let cost;
      if (this.isBeaconTeleport && this.targetBeacon) {
        const currentDepth = Math.max(0, player.tileY - SURFACE_Y);
        cost = this.calculateBeaconCost(currentDepth, this.targetBeacon.depth);
      } else {
        cost = this.calculateCost(Math.max(0, player.tileY - SURFACE_Y));
      }
      player.gold -= cost;
      
      player.x = targetX * TILE_SIZE + TILE_SIZE / 2;
      player.y = targetY * TILE_SIZE + TILE_SIZE / 2;
      player.tileX = targetX;
      player.tileY = targetY;
      
      this.active = false;
      this.progress = 0;
      this.cooldown = this.cooldownMax;

      const completedBeacon = this.targetBeacon;
      this.targetBeacon = null;
      this.isBeaconTeleport = false;

      for (let i = 0; i < 20; i++) {
        particles.spawn(
          player.x + (Math.random() - 0.5) * 60,
          player.y + (Math.random() - 0.5) * 60,
          this.getTeleportColor(),
          1,
          4 + Math.random() * 3,
          { gravity: -0.02, lifeMin: 20, lifeMax: 40 }
        );
      }

      if (onComplete) onComplete(cost, completedBeacon);
    }
  }

  getTeleportColor() {
    const colors = ['#9B59B6', '#8E44AD', '#3498DB', '#2980B9', '#1ABC9C'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getProgressPercent() {
    return Math.min(100, this.progress * 100);
  }

  isTeleporting() {
    return this.active;
  }

  getCooldownPercent() {
    return this.cooldown > 0 ? (this.cooldown / this.cooldownMax) * 100 : 0;
  }

  getBeaconCount() {
    return this.beacons.length;
  }

  getMaxBeacons() {
    return this.maxBeacons;
  }
}
