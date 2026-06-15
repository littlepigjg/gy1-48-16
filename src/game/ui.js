import { ORE_PRICES, ORE_NAMES, UPGRADE_DEFS, TILE_SIZE, SURFACE_Y, DEPTH_BONUS_MULTIPLIER } from './constants.js';

export class UIManager {
  constructor(game) {
    this.game = game;
    this.warningTimeout = null;
    this.setupShopButtons();
    this.setupTeleportButton();
    this.setupBeaconButtons();
  }

  setupTeleportButton() {
    document.getElementById('teleportBtn').addEventListener('click', () => {
      this.game.tryTeleport();
    });
  }

  setupBeaconButtons() {
    document.getElementById('placeBeaconBtn').addEventListener('click', () => {
      this.game.tryPlaceBeacon();
    });

    document.getElementById('beaconMenuBtn').addEventListener('click', () => {
      this.openBeaconMenu();
    });

    document.getElementById('closeBeaconMenuBtn').addEventListener('click', () => {
      this.closeBeaconMenu();
    });
  }

  setupShopButtons() {
    document.getElementById('sellAllBtn').addEventListener('click', () => {
      const maxDepth = this.game.player.maxDepth;
      const depthBonus = 1 + maxDepth * DEPTH_BONUS_MULTIPLIER;
      const result = this.game.player.sellOres(ORE_PRICES, depthBonus);
      if (result.total > 0) {
        let msg = `售出矿石获得 $${result.total}`;
        if (result.bonus > 0) {
          msg += ` (含深度加成 +$${result.bonus})`;
        }
        this.showWarning(msg, 2000, 'text-green-300');
      }
      this.updateShop();
    });

    document.getElementById('refuelBtn').addEventListener('click', () => {
      if (this.game.player.gold >= 50) {
        this.game.player.gold -= 50;
        this.game.player.fuel = this.game.player.maxFuel;
        this.updateShop();
      }
    });

    document.getElementById('refillOxygenBtn').addEventListener('click', () => {
      if (this.game.player.gold >= 30) {
        this.game.player.gold -= 30;
        this.game.player.oxygen = this.game.player.maxOxygen;
        this.updateShop();
      }
    });

    document.getElementById('coolBtn').addEventListener('click', () => {
      if (this.game.player.gold >= 20) {
        this.game.player.gold -= 20;
        this.game.player.heat = 20;
        this.updateShop();
      }
    });

    document.getElementById('repairBtn').addEventListener('click', () => {
      if (this.game.player.gold >= 40) {
        this.game.player.gold -= 40;
        this.game.player.health = this.game.player.maxHealth;
        this.updateShop();
      }
    });

    document.getElementById('closeShopBtn').addEventListener('click', () => {
      this.closeShop();
    });
  }

  updateHUD() {
    const p = this.game.player;
    const depth = Math.max(0, p.tileY - SURFACE_Y);

    this.setBar('fuel', p.fuel, p.maxFuel);
    this.setBar('oxygen', p.oxygen, p.maxOxygen);
    this.setBar('heat', p.heat, p.maxHeat);
    this.setBar('cargo', p.cargoUsed, p.maxCargo);
    this.setBar('health', p.health, p.maxHealth);

    document.getElementById('goldText').textContent = Math.floor(p.gold);
    document.getElementById('depthText').textContent = depth;

    const depthBonus = Math.floor(depth * DEPTH_BONUS_MULTIPLIER * 100);
    const bonusEl = document.getElementById('depthBonus');
    if (depthBonus > 0) {
      bonusEl.classList.remove('hidden');
      document.getElementById('depthBonusText').textContent = `+${depthBonus}%`;
    } else {
      bonusEl.classList.add('hidden');
    }

    document.getElementById('oreGold').textContent = p.cargo.gold;
    document.getElementById('oreIron').textContent = p.cargo.iron;
    document.getElementById('oreDiamond').textContent = p.cargo.diamond;
    document.getElementById('oreCoal').textContent = p.cargo.coal;
    document.getElementById('oreEmerald').textContent = p.cargo.emerald;
    document.getElementById('oreRuby').textContent = p.cargo.ruby;

    this.updateTeleportUI();
    this.updateBeaconUI();
    this.checkWarnings();
  }

  updateTeleportUI() {
    const tele = this.game.teleport;
    const p = this.game.player;
    const depth = Math.max(0, p.tileY - SURFACE_Y);
    const cost = tele.calculateCost(depth);

    const btn = document.getElementById('teleportBtn');
    const costEl = document.getElementById('teleportCost');
    const progressWrap = document.getElementById('teleportProgressWrap');
    const progressBar = document.getElementById('teleportProgressBar');
    const cooldownEl = document.getElementById('teleportCooldown');
    const cooldownText = document.getElementById('teleportCooldownText');

    costEl.textContent = `$${cost}`;

    if (depth < 2) {
      btn.style.opacity = '0.4';
      btn.style.cursor = 'not-allowed';
      costEl.textContent = '已在地面';
    } else {
      btn.style.opacity = p.gold >= cost ? '1' : '0.6';
      btn.style.cursor = 'pointer';
    }

    if (tele.isTeleporting()) {
      progressWrap.classList.remove('hidden');
      progressBar.style.width = tele.getProgressPercent() + '%';
      btn.classList.add('hidden');
      cooldownEl.classList.add('hidden');
    } else {
      progressWrap.classList.add('hidden');
      btn.classList.remove('hidden');

      const cooldown = tele.getCooldownPercent();
      if (cooldown > 0) {
        cooldownEl.classList.remove('hidden');
        cooldownText.textContent = Math.ceil((cooldown / 100) * 5) + 's';
        btn.style.opacity = '0.4';
      } else {
        cooldownEl.classList.add('hidden');
      }
    }
  }

  updateBeaconUI() {
    const p = this.game.player;
    const beacon = this.game.beacon;

    document.getElementById('beaconCount').textContent = `x${p.beacons}`;
    document.getElementById('beaconItemBig').textContent = p.beacons;

    const placeBtn = document.getElementById('placeBeaconBtn');
    const canPlace = beacon.canPlaceBeacon(p);
    if (canPlace.can) {
      placeBtn.style.opacity = '1';
      placeBtn.style.cursor = 'pointer';
    } else {
      placeBtn.style.opacity = '0.4';
      placeBtn.style.cursor = 'not-allowed';
    }
  }

  openBeaconMenu() {
    if (!this.game.running || this.game.paused) return;
    this.updateBeaconList();
    document.getElementById('beaconMenu').classList.remove('hidden');
    document.getElementById('beaconMenu').classList.add('flex');
    this.game.paused = true;
    return true;
  }

  closeBeaconMenu() {
    document.getElementById('beaconMenu').classList.add('hidden');
    document.getElementById('beaconMenu').classList.remove('flex');
    this.game.paused = false;
  }

  isBeaconMenuOpen() {
    return !document.getElementById('beaconMenu').classList.contains('hidden');
  }

  updateBeaconList() {
    const beacon = this.game.beacon;
    const tele = this.game.teleport;
    const p = this.game.player;
    const enemies = this.game.enemies ? this.game.enemies.enemies : [];
    const currentDepth = Math.max(0, p.tileY - SURFACE_Y);

    document.getElementById('beaconItemCount').textContent = p.beacons;
    document.getElementById('beaconSlots').textContent = `${beacon.getBeaconCount()}/${beacon.getMaxBeacons()}`;

    const listEl = document.getElementById('beaconList');
    listEl.innerHTML = '';

    if (beacon.beacons.length === 0) {
      listEl.innerHTML = '<div class="text-gray-400 text-center py-8">还没有放置任何信标<br><span class="text-sm">在地下使用 B 键放置信标</span></div>';
      return;
    }

    for (let i = 0; i < beacon.beacons.length; i++) {
      const b = beacon.beacons[i];
      const enemyCount = beacon.getBeaconEnemyCount(i, enemies);
      const cost = beacon.calculateBeaconCost(currentDepth, b.depth);
      const hasEnemies = enemyCount > 0;
      const canTeleport = p.gold >= cost && !tele.isTeleporting() && tele.cooldown <= 0;

      const div = document.createElement('div');
      div.className = `bg-black/40 rounded-lg p-4 border-2 transition-all ${hasEnemies ? 'border-red-500/50' : 'border-cyan-700/50'}`;
      
      div.innerHTML = `
        <div class="flex justify-between items-start mb-2">
          <div class="flex items-center gap-2">
            <span class="text-2xl">📍</span>
            <div>
              <div class="font-bold text-lg" style="color: ${b.color}">${b.name}</div>
              <div class="text-gray-400 text-xs">深度: ${b.depth}m</div>
            </div>
          </div>
          ${hasEnemies ? `<div class="text-red-400 text-xs font-bold animate-pulse">⚠️ 附近有敌人 (${enemyCount})</div>` : '<div class="text-green-400 text-xs">✓ 安全</div>'}
        </div>
        <div class="flex gap-2 mt-3">
          <button class="flex-1 py-2 px-3 rounded text-sm font-bold transition-all ${
            canTeleport
              ? 'bg-cyan-700 hover:bg-cyan-600 text-white border border-cyan-500'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600'
          }" data-teleport="${i}" ${!canTeleport ? 'disabled' : ''}>
            传送 ($${cost})
          </button>
          <button class="py-2 px-3 rounded text-sm font-bold bg-yellow-700 hover:bg-yellow-600 text-white border border-yellow-500 transition-all" data-rename="${i}">
            重命名
          </button>
          <button class="py-2 px-3 rounded text-sm font-bold bg-red-700 hover:bg-red-600 text-white border border-red-500 transition-all" data-remove="${i}">
            回收
          </button>
        </div>
      `;

      listEl.appendChild(div);
    }

    listEl.querySelectorAll('button[data-teleport]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.teleport);
        this.game.tryBeaconTeleport(index);
        this.closeBeaconMenu();
      });
    });

    listEl.querySelectorAll('button[data-rename]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.rename);
        const b = beacon.beacons[index];
        const newName = prompt('输入新的信标名称:', b.name);
        if (newName !== null && newName.trim() !== '') {
          beacon.renameBeacon(index, newName.trim());
          this.updateBeaconList();
        }
      });
    });

    listEl.querySelectorAll('button[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.remove);
        const b = beacon.beacons[index];
        if (confirm(`回收信标「${b.name}」？信标物品将归还到背包`)) {
          beacon.removeBeacon(index, this.game.player);
          this.showWarning(`📍 信标「${b.name}」已回收，物品已归还`, 1500, 'text-cyan-300');
          this.updateBeaconList();
        }
      });
    });
  }

  setBar(name, value, max) {
    const bar = document.getElementById(name + 'Bar');
    const text = document.getElementById(name + 'Text');
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    bar.style.width = pct + '%';
    text.textContent = `${Math.floor(value)}/${Math.floor(max)}`;
  }

  checkWarnings() {
    const p = this.game.player;
    const warnings = [];

    if (p.fuel < p.maxFuel * 0.15) warnings.push('⚠️ 燃料不足！');
    if (p.oxygen < p.maxOxygen * 0.15) warnings.push('⚠️ 氧气不足！');
    if (p.heat > p.maxHeat * 0.8) warnings.push('⚠️ 温度过高！');
    if (p.health < p.maxHealth * 0.2) warnings.push('⚠️ 机身受损严重！');
    if (p.cargoUsed >= p.maxCargo) warnings.push('📦 货仓已满！');

    const msg = warnings.join('  ');
    if (msg && !this.warningTimeout) {
      this.showWarning(msg, 2000);
    }
  }

  showWarning(text, duration = 2000, colorClass = 'text-red-200') {
    const el = document.getElementById('warningMessage');
    const textEl = document.getElementById('warningText');
    textEl.textContent = text;
    textEl.className = `font-game text-lg ${colorClass}`;
    el.classList.remove('hidden');

    if (this.warningTimeout) clearTimeout(this.warningTimeout);
    this.warningTimeout = setTimeout(() => {
      el.classList.add('hidden');
      this.warningTimeout = null;
    }, duration);
  }

  openShop() {
    if (!this.game.player.isOnSurface()) {
      this.showWarning('需要返回地面才能打开商店！', 1500);
      return false;
    }
    this.updateShop();
    document.getElementById('shopMenu').classList.remove('hidden');
    document.getElementById('shopMenu').classList.add('flex');
    this.game.paused = true;
    return true;
  }

  closeShop() {
    document.getElementById('shopMenu').classList.add('hidden');
    document.getElementById('shopMenu').classList.remove('flex');
    this.game.paused = false;
  }

  isShopOpen() {
    return !document.getElementById('shopMenu').classList.contains('hidden');
  }

  updateShop() {
    const p = this.game.player;
    document.getElementById('shopGold').textContent = Math.floor(p.gold);

    const sellArea = document.getElementById('sellArea');
    sellArea.innerHTML = '';
    for (const [type, count] of Object.entries(p.cargo)) {
      if (count > 0) {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center text-gray-300';
        div.innerHTML = `
          <span>${this.getOreIcon(type)} ${ORE_NAMES[type]} x${count}</span>
          <span class="text-yellow-400">$${count * ORE_PRICES[type]}</span>
        `;
        sellArea.appendChild(div);
      }
    }
    if (sellArea.children.length === 0) {
      sellArea.innerHTML = '<div class="text-gray-500 text-center py-2">货仓为空</div>';
    }

    const upgradeArea = document.getElementById('upgradeArea');
    upgradeArea.innerHTML = '';
    for (const [key, def] of Object.entries(UPGRADE_DEFS)) {
      const level = p.upgrades[key];
      const cost = p.getUpgradeCost(key);
      const isMaxed = cost === null;
      const canAfford = !isMaxed && p.gold >= cost;

      const div = document.createElement('div');
      div.className = 'bg-black/30 rounded p-3 border border-yellow-900';
      div.innerHTML = `
        <div class="flex justify-between items-center mb-1">
          <span class="text-yellow-300 font-bold">${def.icon} ${def.name}</span>
          <span class="text-xs text-gray-400">Lv.${level}/${def.maxLevel}</span>
        </div>
        <div class="text-xs text-gray-400 mb-2">${def.description}</div>
        <button class="w-full py-1 px-2 rounded text-xs font-bold transition-all ${
          isMaxed ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
          canAfford ? 'bg-yellow-700 hover:bg-yellow-600 text-white border border-yellow-500' :
          'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
        }" ${isMaxed || !canAfford ? 'disabled' : `data-upgrade="${key}"`}>
          ${isMaxed ? '已满级' : `$${cost}`}
        </button>
      `;
      upgradeArea.appendChild(div);
    }

    upgradeArea.querySelectorAll('button[data-upgrade]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.upgrade;
        if (p.buyUpgrade(type)) {
          this.updateShop();
        }
      });
    });
  }

  getOreIcon(type) {
    const icons = {
      coal: '⬛',
      iron: '🔩',
      gold: '🪙',
      emerald: '💚',
      ruby: '❤️',
      diamond: '💎'
    };
    return icons[type] || '🪨';
  }

  showGameOver(stats) {
    const screen = document.getElementById('gameOverScreen');
    const statsEl = document.getElementById('gameOverStats');
    statsEl.innerHTML = `
      <div>💰 最终金币: ${Math.floor(stats.gold)}</div>
      <div>📍 最深深度: ${stats.maxDepth}m</div>
      <div>⚔️ 击杀敌人: ${stats.enemiesKilled || 0}</div>
      <div>🪨 挖掘方块: ${stats.blocksDug || 0}</div>
    `;
    screen.classList.remove('hidden');
    screen.classList.add('flex');
  }

  hideGameOver() {
    const screen = document.getElementById('gameOverScreen');
    screen.classList.add('hidden');
    screen.classList.remove('flex');
  }

  showHUD() {
    document.getElementById('hud').classList.remove('hidden');
  }

  hideHUD() {
    document.getElementById('hud').classList.add('hidden');
  }
}
