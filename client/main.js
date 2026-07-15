import { initDiscordSdk, getUser } from './modules/sdk.js';
import { ForgeMinigame } from './modules/minigame.js';
import { ORES, RECIPES, QUALITY_MULTIPLIERS, ACHIEVEMENTS, createInitialData } from './modules/gameData.js';

// ゲームのローカル状態
let state = null;
let activeTab = 'farm';
let currentUser = null;
let autoSaveTimer = null;
let secondsTimer = null;

// アクティブなミニゲーム
let activeMinigame = null;
// 植え付け中のスロット一時保存用
let plantingSlotId = null;

// UIバインディング
const elements = {
  // ステータス
  gold: document.getElementById('status-gold'),
  level: document.getElementById('status-level'),
  xpFill: document.getElementById('status-xp-fill'),
  fatigueVal: document.getElementById('status-fatigue-val'),
  fatigueFill: document.getElementById('status-fatigue-fill'),
  motivationVal: document.getElementById('status-motivation-val'),
  motivationFill: document.getElementById('status-motivation-fill'),
  happiness: document.getElementById('status-happiness'),
  trust: document.getElementById('status-trust'),
  uncleBalloon: document.getElementById('uncle-balloon'),
  
  // コンテナ
  farmGrid: document.getElementById('farm-grid'),
  forgeMaterials: document.getElementById('forge-materials'),
  recipeGrid: document.getElementById('recipe-grid'),
  weaponList: document.getElementById('weapon-list'),
  noWeaponsMsg: document.getElementById('no-weapons-msg'),
  shopUpgrades: document.getElementById('shop-upgrades'),
  shopConsumables: document.getElementById('shop-consumables'),
  achievementList: document.getElementById('achievement-list'),
  
  // ボタン・タブ
  navButtons: document.querySelectorAll('.nav-btn'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  sellAllBtn: document.getElementById('sell-all-btn'),
  manualSaveBtn: document.getElementById('manual-save-btn'),
  manualLoadBtn: document.getElementById('manual-load-btn'),
  resetDataBtn: document.getElementById('reset-data-btn'),
  
  // モーダル
  forgeModal: document.getElementById('forge-modal'),
  forgeCancelBtn: document.getElementById('forge-cancel-btn'),
  offlineModal: document.getElementById('offline-modal'),
  offlineConfirmBtn: document.getElementById('offline-confirm-btn'),
  offlineTimeStr: document.getElementById('offline-time-str'),
  offlineReportList: document.getElementById('offline-report-list'),
  plantModal: document.getElementById('plant-modal'),
  plantCloseBtn: document.getElementById('plant-close-btn'),
  seedSelectionList: document.getElementById('seed-selection-list'),
  
  // デバッグ
  debugTime1h: document.getElementById('debug-time-1h'),
  debugTime6h: document.getElementById('debug-time-6h'),
  debugTime24h: document.getElementById('debug-time-24h'),
  debugAddGold: document.getElementById('debug-add-gold'),
  debugRecoverFatigue: document.getElementById('debug-recover-fatigue'),
  debugGiveMaterials: document.getElementById('debug-give-materials')
};

// おじさんの定常セリフ集
const NORMAL_BALLOONS = [
  "今日も元気に聖剣を作るぞ！🔨",
  "鉄鉱石を育てるのも鍛冶屋の仕事よ。",
  "体がなまってきたな…一仕事するか！",
  "商店のハンマーを新しくすると狙いやすくなるぞ。",
  "疲れたら商店の回復薬を飲むか、放置して休めよ。",
  "やる気がないと、鍛えるときに手元が狂うぞ。",
  "聖剣を売ると一気に儲かるんだがなぁ…。",
  "街の人と信頼を築くと、高く買ってくれるぞ。"
];

// 初期起動処理
window.addEventListener('DOMContentLoaded', async () => {
  // SDKの初期化
  const sdkInfo = await initDiscordSdk();
  currentUser = sdkInfo.user;
  
  console.log('User detected:', currentUser);
  
  // セーブデータの読み込み
  await loadGameData();
  
  // 画面の更新
  updateUI();
  setupEventListeners();
  
  // タイマーのセット
  startTimers();
});

/**
 * サーバーからゲームデータを読み込みます。
 */
async function loadGameData() {
  try {
    const response = await fetch(`/api/load?userId=${encodeURIComponent(currentUser.id)}`);
    const result = await response.json();
    
    if (result.success && !result.isNew && result.data) {
      // 既存データの読み込みとマージ
      const initial = createInitialData();
      state = {
        player: {
          ...initial.player,
          ...result.data.player,
          tools: { ...initial.player.tools, ...(result.data.player?.tools) },
          stats: { ...initial.player.stats, ...(result.data.player?.stats) }
        },
        farm: {
          ...initial.farm,
          ...result.data.farm,
          slots: result.data.farm?.slots || initial.farm.slots
        },
        inventory: {
          ...initial.inventory,
          ...result.data.inventory,
          materials: { ...initial.inventory.materials, ...(result.data.inventory?.materials) },
          weapons: result.data.inventory?.weapons || initial.inventory.weapons
        },
        shop: {
          ...initial.shop,
          ...result.data.shop,
          seeds: { ...initial.shop.seeds, ...(result.data.shop?.seeds) }
        },
        achievement: {
          ...initial.achievement,
          ...result.data.achievement,
          completed: { ...initial.achievement.completed, ...(result.data.achievement?.completed) }
        }
      };
      
      // 放置処理（オフラインプログレス）の実行
      applyOfflineProgress();
    } else {
      // 新規ユーザー
      console.log('No save data found. Initializing new game data...');
      state = createInitialData();
      await saveGameData(false); // 初期セーブ
    }
  } catch (error) {
    console.error('Failed to load save data from server:', error);
    // オフライン/通信エラー用フォールバック
    state = createInitialData();
  }
}

/**
 * サーバーにゲームデータを保存します。
 */
async function saveGameData(showBanner = false) {
  if (!state) return;
  state.player.lastSavedAt = new Date().toISOString();
  
  try {
    const response = await fetch('/api/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUser.id,
        data: state
      })
    });
    
    const result = await response.json();
    if (result.success) {
      if (showBanner) {
        showBalloon("セーブ完了したぞ！データは安全だ。");
      }
    } else {
      console.error('Failed to save on server:', result.error);
    }
  } catch (error) {
    console.error('Network error during save:', error);
  }
}

/**
 * 放置時間（オフライン経過）に応じた進行処理を適用します。
 */
function applyOfflineProgress() {
  const lastSaved = new Date(state.player.lastSavedAt).getTime();
  const now = Date.now();
  const diffMs = now - lastSaved;
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 30) return; // 30秒未満は無視
  
  const reports = [];
  
  // 1. 疲労の回復：1分（60秒）につき1回復
  const fatigueRecovered = Math.floor(diffSec / 60);
  if (fatigueRecovered > 0 && state.player.fatigue > 0) {
    const oldFatigue = state.player.fatigue;
    state.player.fatigue = Math.max(0, state.player.fatigue - fatigueRecovered);
    const actualRecover = oldFatigue - state.player.fatigue;
    reports.push(`🛌 放置休憩により、疲労が <strong>${actualRecover}</strong> 回復した。`);
  }
  
  // 2. 畑の鉱石成長
  let harvestedCount = 0;
  state.farm.slots.forEach(slot => {
    if (slot.oreId && slot.progress < 1) {
      const ore = ORES[slot.oreId];
      const growTimeNeeded = ore.growTime * (slot.hasFertilizer ? 0.5 : 1);
      const elapsedSec = (now - new Date(slot.plantedAt).getTime()) / 1000;
      
      const newProgress = Math.min(1.0, elapsedSec / growTimeNeeded);
      slot.progress = newProgress;
      
      if (newProgress >= 1.0) {
        harvestedCount++;
      }
    }
  });
  
  if (harvestedCount > 0) {
    reports.push(`🌱 放置中に <strong>${harvestedCount}個</strong> の鉱石が完全に成長した！`);
  }
  
  // 3. モチベーション/やる気の自然変化（放置中は1分につき0.1減少、ただし最低50）
  const motivationLoss = Math.floor(diffSec / 60) * 0.1;
  if (motivationLoss > 0) {
    state.player.motivation = Math.max(50, Math.round(state.player.motivation - motivationLoss));
  }
  
  // 実績チェック
  checkAchievements();
  
  // 放置レポートモーダルの表示
  if (reports.length > 0) {
    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    
    elements.offlineTimeStr.textContent = `${hours}時間 ${minutes}分 ${secs}秒`;
    elements.offlineReportList.innerHTML = reports.map(r => `<li>${r}</li>`).join('');
    elements.offlineModal.classList.add('active');
  }
}

/**
 * 1秒ごとの定期タイマー処理
 */
function startTimers() {
  // 自動セーブ (30秒ごと)
  autoSaveTimer = setInterval(() => {
    saveGameData(false);
  }, 30000);
  
  // 1秒ごとのリアルタイム計算 (栽培の進捗や自然回復)
  let tickCount = 0;
  secondsTimer = setInterval(() => {
    tickCount++;
    const now = Date.now();
    
    // 畑のリアルタイム計算
    let needsUIUpdate = false;
    state.farm.slots.forEach(slot => {
      if (slot.oreId && slot.progress < 1) {
        const ore = ORES[slot.oreId];
        const growTimeNeeded = ore.growTime * (slot.hasFertilizer ? 0.5 : 1);
        const elapsedSec = (now - new Date(slot.plantedAt).getTime()) / 1000;
        
        slot.progress = Math.min(1.0, elapsedSec / growTimeNeeded);
        needsUIUpdate = true;
      }
    });
    
    // 疲労の自然回復（60秒につき1）
    if (tickCount >= 60) {
      tickCount = 0;
      if (state.player.fatigue > 0) {
        state.player.fatigue = Math.max(0, state.player.fatigue - 1);
        needsUIUpdate = true;
      }
      // 定期セリフの切り替え
      showBalloon(NORMAL_BALLOONS[Math.floor(Math.random() * NORMAL_BALLOONS.length)]);
    }
    
    if (needsUIUpdate) {
      // 畑タブまたはステータス表示のみを更新して負荷を抑える
      updateStatusDisplay();
      if (activeTab === 'farm') {
        renderFarm();
      }
    }
  }, 1000);
}

/**
 * バルーンセリフの表示
 */
function showBalloon(text) {
  elements.uncleBalloon.textContent = text;
}

/**
 * 画面UI全体を再レンダリングします。
 */
function updateUI() {
  if (!state) return;
  
  updateStatusDisplay();
  
  // アクティブなタブに応じたレンダリング
  if (activeTab === 'farm') renderFarm();
  else if (activeTab === 'forge') renderForge();
  else if (activeTab === 'sell') renderSell();
  else if (activeTab === 'shop') renderShop();
  else if (activeTab === 'achievement') renderAchievements();
}

/**
 * ステータス表示部のみ更新
 */
function updateStatusDisplay() {
  elements.gold.textContent = state.player.gold.toLocaleString();
  elements.level.textContent = state.player.level;
  
  // XPバー (Lv100が上限として次のレベルまでの必要XPを計算: level * 100)
  const nextLevelXp = state.player.level * 100;
  const xpPercent = Math.min(100, (state.player.xp / nextLevelXp) * 100);
  elements.xpFill.style.width = `${xpPercent}%`;
  
  // 疲労
  elements.fatigueVal.textContent = state.player.fatigue;
  elements.fatigueFill.style.width = `${state.player.fatigue}%`;
  
  // やる気
  elements.motivationVal.textContent = state.player.motivation;
  elements.motivationFill.style.width = `${state.player.motivation}%`;
  
  // その他
  elements.happiness.textContent = state.player.happiness;
  elements.trust.textContent = state.player.trust;
}

/**
 * 畑タブの描画
 */
function renderFarm() {
  elements.farmGrid.innerHTML = '';
  
  state.farm.slots.forEach(slot => {
    const slotEl = document.createElement('div');
    slotEl.className = 'farm-slot';
    
    if (!slot.oreId) {
      // 空きスロット
      slotEl.innerHTML = `
        <div class="slot-header">
          <span class="slot-title">スロット #${slot.id + 1}</span>
          <span class="slot-status">空き地</span>
        </div>
        <div class="slot-body">
          <div class="crop-icon-large">🟫</div>
          <div class="crop-details">
            <span class="crop-name">何も植えられていません</span>
            <span class="crop-time">-</span>
          </div>
        </div>
        <div class="slot-actions">
          <button class="pixel-btn accent-btn single-btn plant-btn" data-id="${slot.id}">種を植える</button>
        </div>
      `;
    } else {
      // 植え付け中
      const ore = ORES[slot.oreId];
      const isReady = slot.progress >= 1.0;
      
      const growTimeNeeded = ore.growTime * (slot.hasFertilizer ? 0.5 : 1);
      const elapsedSec = (Date.now() - new Date(slot.plantedAt).getTime()) / 1000;
      const remainingSec = Math.max(0, Math.ceil(growTimeNeeded - elapsedSec));
      
      let timeText = '収穫可能！';
      if (!isReady) {
        const min = Math.floor(remainingSec / 60);
        const sec = Math.floor(remainingSec % 60);
        timeText = `残り ${min}分 ${sec}秒 (${Math.floor(slot.progress * 100)}%)`;
      }
      
      slotEl.innerHTML = `
        <div class="slot-header">
          <span class="slot-title">スロット #${slot.id + 1}</span>
          <span class="slot-status">${isReady ? '🟡 収穫期' : '⏳ 成長中'}</span>
        </div>
        <div class="slot-body">
          <div class="crop-icon-large">${isReady ? ore.icon : '🌱'}</div>
          <div class="crop-details">
            <span class="crop-name">${ore.name}</span>
            <span class="crop-time">${timeText}</span>
            ${slot.hasFertilizer ? '<span class="fertilized-badge">🧪 肥料使用中 (-50%時間)</span>' : ''}
          </div>
        </div>
        <div class="slot-actions">
          <button class="pixel-btn" id="fertilize-btn-${slot.id}" ${isReady || slot.hasFertilizer || state.inventory.materials.fertilizer <= 0 ? 'disabled' : ''}>🧪 肥料をやる (${state.inventory.materials.fertilizer || 0})</button>
          <button class="pixel-btn accent-btn harvest-btn" data-id="${slot.id}" ${!isReady ? 'disabled' : ''}>🧺 収穫する</button>
        </div>
      `;
      
      // 肥料ボタンのイベント
      const fBtn = slotEl.querySelector(`#fertilize-btn-${slot.id}`);
      if (fBtn) {
        fBtn.addEventListener('click', () => useFertilizer(slot.id));
      }
    }
    
    elements.farmGrid.appendChild(slotEl);
  });
  
  // 種植えボタンのイベント割り当て
  elements.farmGrid.querySelectorAll('.plant-btn').forEach(btn => {
    btn.addEventListener('click', () => openPlantModal(parseInt(btn.dataset.id)));
  });
  
  // 収穫ボタンのイベント割り当て
  elements.farmGrid.querySelectorAll('.harvest-btn').forEach(btn => {
    btn.addEventListener('click', () => harvestOre(parseInt(btn.dataset.id)));
  });
}

/**
 * 鍛冶場タブの描画
 */
function renderForge() {
  // 1. 所持素材一覧の描画
  elements.forgeMaterials.innerHTML = '';
  Object.keys(state.inventory.materials).forEach(oreId => {
    if (oreId === 'fertilizer' || oreId === 'potion' || oreId === 'charm') return; // 消耗品は除外
    const ore = ORES[oreId];
    if (!ore) return;
    const chip = document.createElement('div');
    chip.className = 'material-chip';
    chip.innerHTML = `${ore.icon} ${ore.name}: <span class="material-count">${state.inventory.materials[oreId] || 0}</span>`;
    elements.forgeMaterials.appendChild(chip);
  });
  
  // 2. レシピ一覧の描画
  elements.recipeGrid.innerHTML = '';
  RECIPES.forEach(recipe => {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    
    // 素材が足りているかチェック
    let canCraft = true;
    let materialHtml = '';
    
    Object.keys(recipe.materials).forEach(matId => {
      const required = recipe.materials[matId];
      const owned = state.inventory.materials[matId] || 0;
      const ore = ORES[matId];
      const isShort = owned < required;
      if (isShort) canCraft = false;
      
      materialHtml += `<span class="material-req ${isShort ? 'shortage' : ''}">${ore.icon}${ore.name} x${required}(所持:${owned})</span>`;
    });
    
    // レベル制限チェック
    const isLevelLocked = state.player.level < recipe.minLevel;
    if (isLevelLocked) canCraft = false;
    
    card.innerHTML = `
      <div class="recipe-header">
        <span class="recipe-icon">${recipe.icon}</span>
        <div class="recipe-info">
          <span class="recipe-name">${recipe.name}</span>
          <span class="recipe-value">想定価値: ${recipe.basePrice}G</span>
        </div>
      </div>
      <div class="recipe-materials">
        ${materialHtml}
      </div>
      <button class="pixel-btn accent-btn forge-craft-btn" data-id="${recipe.id}" ${!canCraft || state.player.fatigue >= 100 ? 'disabled' : ''}>
        ${isLevelLocked ? `🔒 レベル ${recipe.minLevel} で解放` : '🔨 鍛造する'}
      </button>
    `;
    
    // ボタンクリックイベント
    card.querySelector('.forge-craft-btn').addEventListener('click', () => startForging(recipe));
    
    elements.recipeGrid.appendChild(card);
  });
}

/**
 * 売却所タブの描画
 */
function renderSell() {
  elements.weaponList.innerHTML = '';
  const weapons = state.inventory.weapons || [];
  
  if (weapons.length === 0) {
    elements.noWeaponsMsg.style.display = 'block';
    elements.sellAllBtn.disabled = true;
    return;
  }
  
  elements.noWeaponsMsg.style.display = 'none';
  elements.sellAllBtn.disabled = false;
  
  weapons.forEach((wpn, idx) => {
    const recipe = RECIPES.find(r => r.id === wpn.recipeId);
    const qualInfo = QUALITY_MULTIPLIERS[wpn.quality];
    
    // 信頼度とクオリティ補正を加味した価格の計算
    // 信頼度1につき、売却額が 0.5% 上昇 (最大 +50%)
    const trustBonus = 1 + (state.player.trust * 0.005);
    const finalPrice = Math.round(recipe.basePrice * qualInfo.multiplier * trustBonus);
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${recipe.icon} ${recipe.name}</td>
      <td class="quality-badge quality-${wpn.quality}">${qualInfo.stars} (${qualInfo.label})</td>
      <td>${recipe.basePrice}G</td>
      <td class="gold-value">${finalPrice}G</td>
      <td><button class="pixel-btn sell-single-btn" data-idx="${idx}">売却</button></td>
    `;
    
    tr.querySelector('.sell-single-btn').addEventListener('click', () => sellWeapon(idx));
    
    elements.weaponList.appendChild(tr);
  });
}

/**
 * 商店タブの描画
 */
function renderShop() {
  // 設備アップグレード
  elements.shopUpgrades.innerHTML = '';
  const upgradeItems = [
    { id: 'hammer', name: '最高級ハンマー', desc: 'ミニゲームの判定幅を広げます。', maxLevel: 5 },
    { id: 'furnace', name: '超高性能炉', desc: '鍛冶に必要な疲労度を軽減します。', maxLevel: 5 },
    { id: 'bucket', name: '魔法の水桶', desc: 'アクション後の疲労蓄積を抑えます。', maxLevel: 5 }
  ];
  
  upgradeItems.forEach(item => {
    const currentLv = state.player.tools[item.id] || 1;
    const isMax = currentLv >= item.maxLevel;
    const cost = isMax ? 0 : currentLv * 500; // レベルアップ費用 (500G, 1000G, 1500G...)
    
    const card = document.createElement('div');
    card.className = 'shop-item-card';
    card.innerHTML = `
      <div class="item-info">
        <span class="item-name">${item.name} (現在 Lv.${currentLv})</span>
        <span class="item-desc">${item.desc}</span>
        ${isMax ? '<span class="item-desc text-success">★★ 最大強化済み ★★</span>' : `<span class="item-cost">価格: ${cost}G</span>`}
      </div>
      <button class="pixel-btn buy-upgrade-btn" data-id="${item.id}" ${isMax || state.player.gold < cost ? 'disabled' : ''}>
        ${isMax ? '最大' : '強化'}
      </button>
    `;
    
    if (!isMax) {
      card.querySelector('.buy-upgrade-btn').addEventListener('click', () => buyUpgrade(item.id, cost));
    }
    
    elements.shopUpgrades.appendChild(card);
  });
  
  // 消耗品・種の購入
  elements.shopConsumables.innerHTML = '';
  
  // 1. 種の購入 (プレイヤーレベルに応じて購入可能な種が変わる)
  Object.keys(ORES).forEach(oreId => {
    const ore = ORES[oreId];
    const isLocked = state.player.level < ore.minLevel;
    
    const card = document.createElement('div');
    card.className = 'shop-item-card';
    card.innerHTML = `
      <div class="item-info">
        <span class="item-name">${ore.icon} ${ore.name}の種</span>
        <span class="item-desc">${isLocked ? `🔒 レベル ${ore.minLevel} で解放` : `成長時間: ${Math.round(ore.growTime / 60)}分`}</span>
        ${isLocked ? '' : `<span class="item-cost">価格: ${ore.seedCost}G / 1袋</span>`}
      </div>
      <button class="pixel-btn buy-seed-btn" data-id="${oreId}" ${isLocked || state.player.gold < ore.seedCost ? 'disabled' : ''}>
        購入
      </button>
    `;
    
    if (!isLocked) {
      card.querySelector('.buy-seed-btn').addEventListener('click', () => buySeed(oreId, ore.seedCost));
    }
    
    elements.shopConsumables.appendChild(card);
  });
  
  // 2. お助けアイテム
  const consumables = [
    { id: 'fertilizer', name: '🧪 魔法の肥料', desc: '畑の成長時間を50%短縮します。', cost: 30 },
    { id: 'potion', name: '🥤 栄養ドリンク', desc: '疲労度を 50 回復します。', cost: 80 },
    { id: 'charm', name: '🧿 やる気のお守り', desc: 'やる気を 50 回復します。', cost: 60 }
  ];
  
  consumables.forEach(item => {
    const currentOwned = state.inventory.materials[item.id] || 0;
    const card = document.createElement('div');
    card.className = 'shop-item-card';
    card.innerHTML = `
      <div class="item-info">
        <span class="item-name">${item.name} (所持: ${currentOwned})</span>
        <span class="item-desc">${item.desc}</span>
        <span class="item-cost">価格: ${item.cost}G</span>
      </div>
      <button class="pixel-btn buy-item-btn" data-id="${item.id}" ${state.player.gold < item.cost ? 'disabled' : ''}>
        購入
      </button>
    `;
    
    card.querySelector('.buy-item-btn').addEventListener('click', () => buyConsumable(item.id, item.cost));
    elements.shopConsumables.appendChild(card);
  });
}

/**
 * 実績タブの描画
 */
function renderAchievements() {
  elements.achievementList.innerHTML = '';
  
  ACHIEVEMENTS.forEach(ach => {
    const completedAt = state.achievement.completed[ach.id];
    const card = document.createElement('div');
    card.className = `achievement-card ${completedAt ? 'completed' : ''}`;
    
    let dateStr = '';
    if (completedAt) {
      const d = new Date(completedAt);
      dateStr = `<span class="ach-date">🏆 解放日: ${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}</span>`;
    }
    
    card.innerHTML = `
      <div class="achievement-icon">🏆</div>
      <div class="ach-details">
        <span class="ach-title">${ach.title}</span>
        <span class="ach-desc">${ach.desc}</span>
        ${dateStr}
      </div>
    `;
    
    elements.achievementList.appendChild(card);
  });
}

/**
 * 実績達成条件の確認
 */
function checkAchievements() {
  if (!state) return;
  
  const stats = state.player.stats;
  let unlockedCount = 0;
  
  ACHIEVEMENTS.forEach(ach => {
    if (!state.achievement.completed[ach.id]) {
      const isCompleted = ach.condition(stats);
      if (isCompleted) {
        state.achievement.completed[ach.id] = new Date().toISOString();
        unlockedCount++;
        showBalloon(`🏆 実績「${ach.title}」を達成したぞ！やったな！`);
      }
    }
  });
  
  if (unlockedCount > 0) {
    saveGameData(false);
  }
}

/**
 * 各種イベントリスナーを登録
 */
function setupEventListeners() {
  // タブ切り替え
  elements.navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.navButtons.forEach(b => b.classList.remove('active'));
      elements.tabPanes.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      document.getElementById(`tab-${activeTab}`).classList.add('active');
      updateUI();
    });
  });
  
  // 一括売却
  elements.sellAllBtn.addEventListener('click', sellAllWeapons);
  
  // 手動セーブ・ロード・リセット
  elements.manualSaveBtn.addEventListener('click', () => saveGameData(true));
  elements.manualLoadBtn.addEventListener('click', async () => {
    await loadGameData();
    updateUI();
    showBalloon("ロードが完了したぞ。続きからだ！");
  });
  elements.resetDataBtn.addEventListener('click', () => {
    if (confirm("これまでの進捗をリセットしておじさんを初期状態に戻します。よろしいですか？")) {
      state = createInitialData();
      saveGameData(false);
      updateUI();
      showBalloon("データが初期化された。新しいスタートだ！");
    }
  });
  
  // モーダルクローズ
  elements.offlineConfirmBtn.addEventListener('click', () => {
    elements.offlineModal.classList.remove('active');
  });
  
  elements.plantCloseBtn.addEventListener('click', () => {
    elements.plantModal.classList.remove('active');
  });
  
  elements.forgeCancelBtn.addEventListener('click', () => {
    if (activeMinigame) {
      activeMinigame.destroy();
      activeMinigame = null;
    }
    elements.forgeModal.classList.remove('active');
    showBalloon("鍛冶を中断したぞ。素材は無事だ。");
  });
  
  // デバッグ機能のリスナー
  elements.debugTime1h.addEventListener('click', () => advanceTimeDebug(3600));
  elements.debugTime6h.addEventListener('click', () => advanceTimeDebug(21600));
  elements.debugTime24h.addEventListener('click', () => advanceTimeDebug(86400));
  
  elements.debugAddGold.addEventListener('click', () => {
    state.player.gold += 1000;
    updateUI();
    showBalloon("デバッグツールで 1000G 手に入れた！");
  });
  
  elements.debugRecoverFatigue.addEventListener('click', () => {
    state.player.fatigue = 0;
    updateUI();
    showBalloon("デバッグでおじさんの疲れが吹き飛んだ！");
  });
  
  elements.debugGiveMaterials.addEventListener('click', () => {
    Object.keys(state.inventory.materials).forEach(id => {
      state.inventory.materials[id] += 10;
    });
    updateUI();
    showBalloon("デバッグで全素材が+10個増えたぞ！");
  });
}

/**
 * 時間を進めるデバッグ機能のシミュレータ
 */
function advanceTimeDebug(seconds) {
  if (!state) return;
  
  // 畑を進める
  state.farm.slots.forEach(slot => {
    if (slot.oreId && slot.progress < 1) {
      const ore = ORES[slot.oreId];
      const growTimeNeeded = ore.growTime * (slot.hasFertilizer ? 0.5 : 1);
      // 植え付け時刻を過去にずらすことで、時間の経過をシミュレート
      const originalPlanted = new Date(slot.plantedAt).getTime();
      slot.plantedAt = new Date(originalPlanted - (seconds * 1000)).toISOString();
    }
  });
  
  // 疲労度を自然回復
  const fatigueRecover = Math.floor(seconds / 60);
  state.player.fatigue = Math.max(0, state.player.fatigue - fatigueRecover);
  
  // やる気を低下
  const motivationLoss = Math.floor(seconds / 60) * 0.1;
  state.player.motivation = Math.max(50, Math.round(state.player.motivation - motivationLoss));
  
  updateUI();
  showBalloon(`時間を ${Math.round(seconds/3600 * 10)/10}時間 進めてシミュレートしたぞ！`);
}

/**
 * 畑の種植えモーダルを開きます。
 */
function openPlantModal(slotId) {
  plantingSlotId = slotId;
  elements.seedSelectionList.innerHTML = '';
  
  let hasSeed = false;
  
  Object.keys(state.shop.seeds).forEach(oreId => {
    const quantity = state.shop.seeds[oreId] || 0;
    if (quantity <= 0) return; // 所持していない種は非表示
    
    hasSeed = true;
    const ore = ORES[oreId];
    const div = document.createElement('div');
    div.className = 'seed-item';
    div.innerHTML = `
      <div class="seed-info">
        <span>${ore.icon}</span>
        <strong>${ore.name}の種</strong>
        <span>(所持: ${quantity}袋)</span>
      </div>
      <button class="pixel-btn accent-btn select-seed-btn" data-id="${oreId}">植える</button>
    `;
    
    div.querySelector('.select-seed-btn').addEventListener('click', () => plantSeed(oreId));
    elements.seedSelectionList.appendChild(div);
  });
  
  if (!hasSeed) {
    elements.seedSelectionList.innerHTML = '<p class="empty-msg">植えられる種を持っていません。よろず商店で購入してください。</p>';
  }
  
  elements.plantModal.classList.add('active');
}

/**
 * 種を植えます。
 */
function plantSeed(oreId) {
  if (plantingSlotId === null || !state) return;
  
  // 種の消費
  if (state.shop.seeds[oreId] > 0) {
    state.shop.seeds[oreId]--;
    
    const slot = state.farm.slots.find(s => s.id === plantingSlotId);
    slot.oreId = oreId;
    slot.plantedAt = new Date().toISOString();
    slot.progress = 0.0;
    slot.hasFertilizer = false;
    
    elements.plantModal.classList.remove('active');
    saveGameData(false);
    updateUI();
    
    showBalloon(`${ORES[oreId].name}の種を植えたぞ。芽が出るのが楽しみだな！`);
  }
}

/**
 * 肥料を使用します。
 */
function useFertilizer(slotId) {
  if (!state || state.inventory.materials.fertilizer <= 0) return;
  
  const slot = state.farm.slots.find(s => s.id === slotId);
  if (slot && slot.oreId && !slot.hasFertilizer && slot.progress < 1) {
    state.inventory.materials.fertilizer--;
    slot.hasFertilizer = true;
    
    // 進行度を肥料込みで再計算するために、植え付け時間を再調整
    const elapsed = Date.now() - new Date(slot.plantedAt).getTime();
    // 肥料を当てると成長スピードが2倍になるため、見かけ上の経過時間を2倍にする
    slot.plantedAt = new Date(Date.now() - (elapsed * 2)).toISOString();
    
    saveGameData(false);
    updateUI();
    showBalloon("魔法の肥料をまいたぞ！成長時間が半分に短縮された。");
  }
}

/**
 * 鉱石を収穫します。
 */
function harvestOre(slotId) {
  if (!state) return;
  
  const slot = state.farm.slots.find(s => s.id === slotId);
  if (slot && slot.oreId && slot.progress >= 1.0) {
    const oreId = slot.oreId;
    const ore = ORES[oreId];
    
    // インベントリに追加
    state.inventory.materials[oreId] = (state.inventory.materials[oreId] || 0) + 1;
    
    // スロットのクリア
    slot.oreId = null;
    slot.plantedAt = null;
    slot.progress = 0.0;
    slot.hasFertilizer = false;
    
    // 疲労上昇 (お世話・収穫時の軽い労働疲労: +3)
    // 魔法の水桶による補正 (疲労蓄積軽減)
    const bucketLv = state.player.tools.bucket || 1;
    const fatigueCost = Math.max(1, 3 - Math.floor(bucketLv * 0.5));
    state.player.fatigue = Math.min(100, state.player.fatigue + fatigueCost);
    
    saveGameData(false);
    updateUI();
    
    showBalloon(`🪨 ${ore.name} を1個収穫したぞ！保管庫に送った。`);
    triggerRandomEvent(); // アクション完了時にランダムイベント抽選
  }
}

/**
 * 鍛造ミニゲームの開始
 */
function startForging(recipe) {
  if (!state || state.player.fatigue >= 100) {
    showBalloon("疲れてハンマーが握れねぇ…休むか、商店でドリンクを買ってくれ。");
    return;
  }
  
  // 素材消費
  Object.keys(recipe.materials).forEach(matId => {
    state.inventory.materials[matId] -= recipe.materials[matId];
  });
  
  // 疲労上昇（超高性能炉のレベルに応じて消費疲労が軽減される）
  const furnaceLv = state.player.tools.furnace || 1;
  const fatigueCost = Math.max(5, 18 - (furnaceLv * 2.5)); // レベルアップで15→12→10...と軽減される
  
  state.player.fatigue = Math.min(100, state.player.fatigue + fatigueCost);
  
  // モーダル表示
  elements.forgeModal.classList.add('active');
  
  // ミニゲーム起動
  const hammerLv = state.player.tools.hammer || 1;
  activeMinigame = new ForgeMinigame('forge-game-container', (result) => {
    // 完了時のコールバック
    onForgeComplete(recipe, result);
  });
  activeMinigame.init(state.player.motivation, hammerLv);
}

/**
 * 鍛冶完了処理
 */
function onForgeComplete(recipe, result) {
  elements.forgeModal.classList.remove('active');
  activeMinigame = null;
  
  // 武器をインベントリに追加
  const quality = result.quality;
  const qualityText = QUALITY_MULTIPLIERS[quality].stars;
  
  const newWeapon = {
    id: `wpn_${Date.now()}`,
    recipeId: recipe.id,
    quality: quality,
    name: recipe.name
  };
  
  state.inventory.weapons.push(newWeapon);
  
  // XP獲得とレベルアップ
  // 品質が高いほど経験値が多くもらえる
  const xpGained = recipe.minLevel * 20 * (quality === 5 ? 2.0 : quality === 3 ? 1.0 : 0.5);
  state.player.xp += Math.round(xpGained);
  
  // モチベーション自然変動（鍛冶成功で少し回復、失敗で少し減少）
  if (quality >= 3) {
    state.player.motivation = Math.min(100, state.player.motivation + 5);
  } else {
    state.player.motivation = Math.max(10, state.player.motivation - 10);
  }
  
  // 累計作成数の加算
  state.player.stats.totalCrafted++;
  if (recipe.id === 'holy_sword') {
    state.player.stats.craftedHolySword = true;
  }
  
  // レベルアップチェック
  let leveledUp = false;
  const nextLevelXp = state.player.level * 100;
  if (state.player.xp >= nextLevelXp) {
    state.player.xp -= nextLevelXp;
    state.player.level++;
    leveledUp = true;
  }
  
  saveGameData(false);
  updateUI();
  
  if (leveledUp) {
    showBalloon(`🎉 おじさんはレベルアップして Lv.${state.player.level} になったぞ！作れる武器の種も増えたな！`);
  } else {
    showBalloon(`🗡️ ${recipe.name} (${qualityText}) を鍛え上げたぞ！売却所で売却してくれ。`);
  }
  
  triggerRandomEvent(); // アクション完了時にランダムイベント抽選
}

/**
 * 武器の売却
 */
function sellWeapon(index) {
  if (!state) return;
  const weapons = state.inventory.weapons;
  if (index < 0 || index >= weapons.length) return;
  
  const wpn = weapons[index];
  const recipe = RECIPES.find(r => r.id === wpn.recipeId);
  const qualInfo = QUALITY_MULTIPLIERS[wpn.quality];
  
  const trustBonus = 1 + (state.player.trust * 0.005);
  const finalPrice = Math.round(recipe.basePrice * qualInfo.multiplier * trustBonus);
  
  // Goldの増加
  state.player.gold += finalPrice;
  state.player.stats.totalEarned += finalPrice;
  
  // 信頼度の微増 (1本売るごとに 0.5 増加)
  state.player.trust = Math.min(100, Math.round((state.player.trust + 0.5) * 10) / 10);
  
  // インベントリから削除
  weapons.splice(index, 1);
  
  saveGameData(false);
  updateUI();
  
  showBalloon(`💰 ${recipe.name} を売却して ${finalPrice}G 獲得したぞ！まいどあり！`);
  triggerRandomEvent();
}

/**
 * 全ての完成品を一括売却
 */
function sellAllWeapons() {
  if (!state || state.inventory.weapons.length === 0) return;
  
  let totalGained = 0;
  const count = state.inventory.weapons.length;
  
  state.inventory.weapons.forEach(wpn => {
    const recipe = RECIPES.find(r => r.id === wpn.recipeId);
    const qualInfo = QUALITY_MULTIPLIERS[wpn.quality];
    const trustBonus = 1 + (state.player.trust * 0.005);
    const finalPrice = Math.round(recipe.basePrice * qualInfo.multiplier * trustBonus);
    
    totalGained += finalPrice;
  });
  
  state.player.gold += totalGained;
  state.player.stats.totalEarned += totalGained;
  
  // 信頼度の上昇
  const trustInc = Math.round(count * 0.4 * 10) / 10;
  state.player.trust = Math.min(100, Math.round((state.player.trust + trustInc) * 10) / 10);
  
  // インベントリをクリア
  state.inventory.weapons = [];
  
  saveGameData(false);
  updateUI();
  
  showBalloon(`💰 武器を${count}本一括売却し、一挙に ${totalGained}G 獲得したぞ！おじさん大喜びだ！`);
  triggerRandomEvent();
}

/**
 * アップグレードの購入
 */
function buyUpgrade(toolId, cost) {
  if (!state || state.player.gold < cost) return;
  
  state.player.gold -= cost;
  state.player.tools[toolId]++;
  
  saveGameData(false);
  updateUI();
  showBalloon(`🛠️ 設備をアップグレードしたぞ！おじさんの仕事効率が上がった。`);
}

/**
 * 種の購入
 */
function buySeed(oreId, cost) {
  if (!state || state.player.gold < cost) return;
  
  state.player.gold -= cost;
  state.shop.seeds[oreId] = (state.shop.seeds[oreId] || 0) + 1;
  
  saveGameData(false);
  updateUI();
  showBalloon(`🌱 ${ORES[oreId].name}の種を1袋買ったぞ。畑に植えて育ててくれ。`);
}

/**
 * 消耗品アイテムの購入
 */
function buyConsumable(itemId, cost) {
  if (!state || state.player.gold < cost) return;
  
  state.player.gold -= cost;
  state.inventory.materials[itemId] = (state.inventory.materials[itemId] || 0) + 1;
  
  // もしその場ですぐ使いたいお助けアイテムであれば使用可能
  saveGameData(false);
  updateUI();
  
  let label = 'アイテム';
  if (itemId === 'fertilizer') label = '🧪 魔法の肥料';
  if (itemId === 'potion') label = '🥤 栄養ドリンク';
  if (itemId === 'charm') label = '🧿 やる気のお守り';
  
  showBalloon(`🛒 ${label} を購入したぞ！`);
  
  // 消耗品使用ハンドラの登録用即時アクション化
  if (itemId === 'potion' || itemId === 'charm') {
    // 商店で即使用ボタンを出す代わりに、購入直後に自動使用するか、またはインベントリで使えるようにする。
    // 今回は簡易化のため、購入したら自動的に即時適用する設計にする。
    useImmediateConsumable(itemId);
  }
}

/**
 * 購入した回復系アイテムをその場で即座に適用する
 */
function useImmediateConsumable(itemId) {
  if (itemId === 'potion') {
    state.inventory.materials.potion--;
    state.player.fatigue = Math.max(0, state.player.fatigue - 50);
    showBalloon("🥤 栄養ドリンクをその場でグイッと飲んだ！疲労が 50 回復したぞ！");
  } else if (itemId === 'charm') {
    state.inventory.materials.charm--;
    state.player.motivation = Math.min(100, state.player.motivation + 50);
    showBalloon("🧿 やる気のお守りを身につけた！おじさんのやる気が 50 湧き出してきたぞ！");
  }
  updateUI();
  saveGameData(false);
}

/**
 * 幸福度に基づいたランダムイベントの発生
 */
function triggerRandomEvent() {
  const roll = Math.random();
  if (roll > 0.35) return; // 35%の確率でイベント抽選
  
  const happiness = state.player.happiness;
  
  // 幸福度に応じて良いイベントと悪いイベントの比率を調整
  const goodEventChance = happiness / 100.0; // 幸福度50なら50%の確率で良いイベント
  
  if (Math.random() < goodEventChance) {
    // 良いイベント
    const goodEvents = [
      {
        name: "職人の訪問",
        run: () => {
          const goldBonus = state.player.level * 100;
          state.player.gold += goldBonus;
          showBalloon(`✨ 旅の職人が遊びに来て、技を褒めてくれた！祝儀として ${goldBonus}G もらったぞ！`);
        }
      },
      {
        name: "商人来店",
        run: () => {
          state.player.trust = Math.min(100, state.player.trust + 5);
          showBalloon("✨ 街のなじみの商人が来て、世間話に花が咲いた！信頼度が 5 上がったぞ！");
        }
      },
      {
        name: "おじさんの宝箱発見",
        run: () => {
          // ランダムに種かアイテムをゲット
          const rollItem = Math.random();
          if (rollItem < 0.4) {
            state.inventory.materials.fertilizer++;
            showBalloon("✨ 工房の裏を片付けていたら、魔法の肥料を見つけたぞ！");
          } else {
            state.player.gold += 300;
            showBalloon("✨ 昔のへそくりを発見した！300G 獲得したぞ！おじさんの秘密だ。");
          }
        }
      }
    ];
    
    const ev = goodEvents[Math.floor(Math.random() * goodEvents.length)];
    ev.run();
    // 幸福度上昇
    state.player.happiness = Math.min(100, state.player.happiness + 5);
  } else {
    // 悪いイベント
    const badEvents = [
      {
        name: "炉の不調",
        run: () => {
          const repairCost = Math.min(state.player.gold, 80);
          state.player.gold = Math.max(0, state.player.gold - repairCost);
          showBalloon(`💥 炉の火力が不安定になり、修理に ${repairCost}G かかってしまった…トホホ。`);
        }
      },
      {
        name: "急な寝違え",
        run: () => {
          state.player.fatigue = Math.min(100, state.player.fatigue + 15);
          showBalloon("💥 あいたたた！おじさんは急に腰を痛めてしまった。疲労が 15 増えた…！");
        }
      },
      {
        name: "やる気の減退",
        run: () => {
          state.player.motivation = Math.max(10, state.player.motivation - 15);
          showBalloon("💥 「今日も残業か…」おじさんは急に虚無感に襲われ、やる気が 15 下がった。");
        }
      }
    ];
    
    const ev = badEvents[Math.floor(Math.random() * badEvents.length)];
    ev.run();
    // 幸福度低下
    state.player.happiness = Math.max(10, state.player.happiness - 5);
  }
  
  updateUI();
  saveGameData(false);
}
