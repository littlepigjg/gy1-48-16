import { describe, it, expect, beforeEach } from 'vitest';
import { BeaconSystem } from '../src/game/beacon.js';
import { TILE_SIZE, SURFACE_Y, BEACON_MAX_SLOTS_BASE, BEACON_COST_DISCOUNT, BEACON_COLORS } from '../src/game/constants.js';

describe('BeaconSystem', () => {
  let beacon;
  let mockPlayer;

  beforeEach(() => {
    beacon = new BeaconSystem();
    mockPlayer = {
      gold: 1000,
      tileX: 50,
      tileY: SURFACE_Y + 100,
      x: 50 * TILE_SIZE + TILE_SIZE / 2,
      y: (SURFACE_Y + 100) * TILE_SIZE + TILE_SIZE / 2,
      beacons: 5
    };
  });

  describe('初始化', () => {
    it('初始化时没有信标', () => {
      expect(beacon.getBeaconCount()).toBe(0);
      expect(beacon.beacons.length).toBe(0);
    });

    it('初始最大槽位为 BEACON_MAX_SLOTS_BASE', () => {
      expect(beacon.getMaxBeacons()).toBe(BEACON_MAX_SLOTS_BASE);
    });

    it('未设置目标信标和信标传送状态', () => {
      expect(beacon.targetBeacon).toBeNull();
      expect(beacon.isBeaconTeleport).toBe(false);
    });
  });

  describe('setMaxBeacons', () => {
    it('升级后最大槽位增加', () => {
      beacon.setMaxBeacons(1);
      expect(beacon.getMaxBeacons()).toBe(BEACON_MAX_SLOTS_BASE + 1);

      beacon.setMaxBeacons(3);
      expect(beacon.getMaxBeacons()).toBe(BEACON_MAX_SLOTS_BASE + 3);
    });

    it('0级时保持基础值', () => {
      beacon.setMaxBeacons(0);
      expect(beacon.getMaxBeacons()).toBe(BEACON_MAX_SLOTS_BASE);
    });
  });

  describe('calculateBeaconCost', () => {
    it('距离很近时费用为最低费用的折扣价', () => {
      const cost = beacon.calculateBeaconCost(100, 100);
      expect(cost).toBe(Math.ceil(30 * BEACON_COST_DISCOUNT));
    });

    it('深度差越大费用越高', () => {
      const cost100 = beacon.calculateBeaconCost(0, 100);
      const cost200 = beacon.calculateBeaconCost(0, 200);
      const cost300 = beacon.calculateBeaconCost(0, 300);

      expect(cost200).toBeGreaterThanOrEqual(cost100);
      expect(cost300).toBeGreaterThanOrEqual(cost200);
    });

    it('比普通传送便宜（有折扣）', () => {
      const depth = 300;
      const normalCost = Math.max(30, Math.ceil(depth / 100) * 20);
      const beaconCost = beacon.calculateBeaconCost(0, depth);

      expect(beaconCost).toBeLessThan(normalCost);
      expect(beaconCost).toBe(Math.ceil(normalCost * BEACON_COST_DISCOUNT));
    });

    it('正反方向费用相同（绝对值）', () => {
      const cost1 = beacon.calculateBeaconCost(100, 300);
      const cost2 = beacon.calculateBeaconCost(300, 100);
      expect(cost1).toBe(cost2);
    });
  });

  describe('canPlaceBeacon', () => {
    it('有信标物品、有槽位、深度足够时可以放置', () => {
      const result = beacon.canPlaceBeacon(mockPlayer);
      expect(result.can).toBe(true);
    });

    it('信标槽位满时不能放置', () => {
      for (let i = 0; i < BEACON_MAX_SLOTS_BASE; i++) {
        beacon.beacons.push({
          name: `信标 ${i + 1}`,
          tileX: 50,
          tileY: SURFACE_Y + 100 + i * 10,
          x: 0,
          y: 0,
          depth: 100 + i * 10,
          color: BEACON_COLORS[i % BEACON_COLORS.length]
        });
      }

      const result = beacon.canPlaceBeacon(mockPlayer);
      expect(result.can).toBe(false);
      expect(result.reason).toContain('槽位已满');
    });

    it('没有信标物品时不能放置', () => {
      mockPlayer.beacons = 0;
      const result = beacon.canPlaceBeacon(mockPlayer);
      expect(result.can).toBe(false);
      expect(result.reason).toContain('没有信标物品');
    });

    it('太靠近地面时不能放置', () => {
      mockPlayer.tileY = SURFACE_Y + 3;
      const result = beacon.canPlaceBeacon(mockPlayer);
      expect(result.can).toBe(false);
      expect(result.reason).toContain('太靠近地面');
    });
  });

  describe('placeBeacon', () => {
    it('成功放置信标并减少玩家信标物品', () => {
      const startCount = mockPlayer.beacons;
      const result = beacon.placeBeacon(mockPlayer, '测试信标');

      expect(result.success).toBe(true);
      expect(result.beacon.name).toBe('测试信标');
      expect(result.index).toBe(0);
      expect(beacon.getBeaconCount()).toBe(1);
      expect(mockPlayer.beacons).toBe(startCount - 1);
    });

    it('未指定名称时使用默认名称', () => {
      const result = beacon.placeBeacon(mockPlayer);
      expect(result.success).toBe(true);
      expect(result.beacon.name).toBe('信标 1');
    });

    it('信标记录了正确的位置和深度', () => {
      const result = beacon.placeBeacon(mockPlayer, '深部信标');
      const b = result.beacon;

      expect(b.tileX).toBe(mockPlayer.tileX);
      expect(b.tileY).toBe(mockPlayer.tileY);
      expect(b.x).toBe(mockPlayer.x);
      expect(b.y).toBe(mockPlayer.y);
      expect(b.depth).toBe(mockPlayer.tileY - SURFACE_Y);
    });

    it('每个信标有不同的颜色', () => {
      const result1 = beacon.placeBeacon(mockPlayer, '信标1');
      const result2 = beacon.placeBeacon(mockPlayer, '信标2');

      expect(result1.beacon.color).toBe(BEACON_COLORS[0]);
      expect(result2.beacon.color).toBe(BEACON_COLORS[1]);
    });

    it('槽位满时放置失败', () => {
      for (let i = 0; i < BEACON_MAX_SLOTS_BASE; i++) {
        beacon.placeBeacon(mockPlayer, `信标 ${i + 1}`);
      }

      const result = beacon.placeBeacon(mockPlayer, '多余信标');
      expect(result.success).toBeUndefined();
      expect(result.can).toBe(false);
      expect(beacon.getBeaconCount()).toBe(BEACON_MAX_SLOTS_BASE);
    });

    it('没有物品时放置失败', () => {
      mockPlayer.beacons = 0;
      const result = beacon.placeBeacon(mockPlayer);
      expect(result.can).toBe(false);
      expect(result.reason).toContain('没有信标物品');
    });
  });

  describe('removeBeacon', () => {
    beforeEach(() => {
      beacon.placeBeacon(mockPlayer, '测试信标');
    });

    it('成功删除信标', () => {
      const result = beacon.removeBeacon(0, mockPlayer);
      expect(result).toBe(true);
      expect(beacon.getBeaconCount()).toBe(0);
    });

    it('删除信标后归还信标物品', () => {
      const startCount = mockPlayer.beacons;
      beacon.removeBeacon(0, mockPlayer);
      expect(mockPlayer.beacons).toBe(startCount + 1);
    });

    it('删除后再放置可用同一个槽位', () => {
      const origBeacons = mockPlayer.beacons;
      beacon.removeBeacon(0, mockPlayer);
      expect(mockPlayer.beacons).toBe(origBeacons + 1);

      const result = beacon.placeBeacon(mockPlayer, '新信标');
      expect(result.success).toBe(true);
      expect(result.index).toBe(0);
      expect(beacon.getBeaconCount()).toBe(1);
    });

    it('删除不存在的索引返回 false', () => {
      const result = beacon.removeBeacon(99, mockPlayer);
      expect(result).toBe(false);
      expect(beacon.getBeaconCount()).toBe(1);
    });

    it('删除负数索引返回 false', () => {
      const result = beacon.removeBeacon(-1, mockPlayer);
      expect(result).toBe(false);
    });
  });

  describe('renameBeacon', () => {
    beforeEach(() => {
      beacon.placeBeacon(mockPlayer, '旧名称');
    });

    it('成功重命名信标', () => {
      const result = beacon.renameBeacon(0, '新名称');
      expect(result).toBe(true);
      expect(beacon.beacons[0].name).toBe('新名称');
    });

    it('空名称时使用默认名称', () => {
      const result = beacon.renameBeacon(0, '');
      expect(result).toBe(true);
      expect(beacon.beacons[0].name).toBe('信标 1');
    });

    it('重命名不存在的索引返回 false', () => {
      const result = beacon.renameBeacon(99, 'test');
      expect(result).toBe(false);
    });
  });

  describe('canTeleportToBeacon', () => {
    beforeEach(() => {
      beacon.placeBeacon(mockPlayer, '测试信标');
    });

    it('金币充足时可以传送到信标', () => {
      mockPlayer.tileY = SURFACE_Y + 200;
      const result = beacon.canTeleportToBeacon(mockPlayer, 0);
      expect(result.can).toBe(true);
      expect(result.cost).toBeGreaterThan(0);
      expect(result.beacon).toBeDefined();
    });

    it('金币不足时不能传送', () => {
      mockPlayer.gold = 5;
      mockPlayer.tileY = SURFACE_Y + 200;
      const result = beacon.canTeleportToBeacon(mockPlayer, 0);
      expect(result.can).toBe(false);
      expect(result.reason).toContain('金币不足');
    });

    it('不存在的信标索引不能传送', () => {
      const result = beacon.canTeleportToBeacon(mockPlayer, 99);
      expect(result.can).toBe(false);
      expect(result.reason).toContain('不存在');
    });
  });

  describe('敌人检测', () => {
    beforeEach(() => {
      beacon.placeBeacon(mockPlayer, '测试信标');
    });

    it('没有敌人时返回 0', () => {
      const count = beacon.getBeaconEnemyCount(0, []);
      expect(count).toBe(0);
    });

    it('敌人在检测范围内时计数', () => {
      const enemies = [{ x: mockPlayer.x + 5, y: mockPlayer.y + 5 }];
      const count = beacon.getBeaconEnemyCount(0, enemies);
      expect(count).toBe(1);
    });

    it('敌人在检测范围外时不计数', () => {
      const farAway = 100 * TILE_SIZE;
      const enemies = [{ x: mockPlayer.x + farAway, y: mockPlayer.y + farAway }];
      const count = beacon.getBeaconEnemyCount(0, enemies);
      expect(count).toBe(0);
    });

    it('多个敌人时正确计数', () => {
      const enemies = [
        { x: mockPlayer.x + 10, y: mockPlayer.y + 10 },
        { x: mockPlayer.x - 10, y: mockPlayer.y - 10 },
        { x: mockPlayer.x + 200, y: mockPlayer.y + 200 },
        { x: mockPlayer.x + 1000, y: mockPlayer.y + 1000 }
      ];
      const count = beacon.getBeaconEnemyCount(0, enemies);
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('hasEnemiesNearBeacon 在有敌人时返回 true', () => {
      const enemies = [{ x: mockPlayer.x + 5, y: mockPlayer.y + 5 }];
      expect(beacon.hasEnemiesNearBeacon(0, enemies)).toBe(true);
    });

    it('hasEnemiesNearBeacon 在无敌人时返回 false', () => {
      expect(beacon.hasEnemiesNearBeacon(0, [])).toBe(false);
    });
  });

  describe('多信标场景', () => {
    beforeEach(() => {
      mockPlayer.beacons = 10;
      for (let i = 0; i < 3; i++) {
        mockPlayer.tileY = SURFACE_Y + 100 + i * 50;
        mockPlayer.y = mockPlayer.tileY * TILE_SIZE + TILE_SIZE / 2;
        beacon.placeBeacon(mockPlayer, `信标 ${i + 1}`);
      }
    });

    it('能正确获取信标数量', () => {
      expect(beacon.getBeaconCount()).toBe(3);
    });

    it('每个信标有正确的深度', () => {
      expect(beacon.beacons[0].depth).toBe(100);
      expect(beacon.beacons[1].depth).toBe(150);
      expect(beacon.beacons[2].depth).toBe(200);
    });

    it('删除中间的信标后后续索引正确移位', () => {
      const nameBefore = beacon.beacons[2].name;
      beacon.removeBeacon(1, mockPlayer);

      expect(beacon.getBeaconCount()).toBe(2);
      expect(beacon.beacons[1].name).toBe(nameBefore);
    });

    it('升级槽位后可以放更多信标', () => {
      expect(beacon.getBeaconCount()).toBe(3);
      
      const result = beacon.placeBeacon(mockPlayer, '第4个信标');
      expect(result.can).toBe(false);
      expect(result.reason).toContain('槽位已满');

      beacon.setMaxBeacons(1);
      expect(beacon.getMaxBeacons()).toBe(4);

      const result2 = beacon.placeBeacon(mockPlayer, '第4个信标');
      expect(result2.success).toBe(true);
      expect(beacon.getBeaconCount()).toBe(4);
    });
  });
});
