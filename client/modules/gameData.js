// 鉱石（畑の作物）の定義
export const ORES = {
  iron_ore: { id: 'iron_ore', name: '鉄鉱石', growTime: 1800, minLevel: 1, seedCost: 10, icon: '🪨' },
  coal: { id: 'coal', name: '石炭', growTime: 2700, minLevel: 1, seedCost: 15, icon: '⬛' },
  silver_ore: { id: 'silver_ore', name: '銀鉱石', growTime: 7200, minLevel: 2, seedCost: 50, icon: '🪙' },
  gold_ore: { id: 'gold_ore', name: '金鉱石', growTime: 14400, minLevel: 3, seedCost: 100, icon: '🟡' },
  mithril: { id: 'mithril', name: 'ミスリル', growTime: 28800, minLevel: 4, seedCost: 300, icon: '💎' },
  orichalcum: { id: 'orichalcum', name: 'オリハルコン', growTime: 43200, minLevel: 5, seedCost: 500, icon: '🔥' },
  rainbow_coal: { id: 'rainbow_coal', name: '七色炭', growTime: 57600, minLevel: 5, seedCost: 700, icon: '🌈' },
  legendary_ore: { id: 'legendary_ore', name: '伝説の鉱石', growTime: 86400, minLevel: 6, seedCost: 1500, icon: '✨' }
};

// 作成可能な武器のレシピ定義
export const RECIPES = [
  {
    id: 'iron_sword',
    name: '鉄の剣',
    basePrice: 80,
    minLevel: 1,
    icon: '🗡️',
    materials: { iron_ore: 3, coal: 2 }
  },
  {
    id: 'copper_sword',
    name: '銅の剣',
    basePrice: 120,
    minLevel: 1,
    icon: '⚔️',
    materials: { iron_ore: 2, coal: 4 } // 仕様書再現のため鉄鉱石と石炭で代用
  },
  {
    id: 'silver_sword',
    name: '銀の剣',
    basePrice: 350,
    minLevel: 2,
    icon: '⚔️',
    materials: { silver_ore: 3, coal: 2 }
  },
  {
    id: 'fire_sword',
    name: '炎の剣',
    basePrice: 800,
    minLevel: 3,
    icon: '🔥',
    materials: { gold_ore: 2, coal: 6, iron_ore: 2 }
  },
  {
    id: 'ice_sword',
    name: '氷の剣',
    basePrice: 1000,
    minLevel: 3,
    icon: '❄️',
    materials: { gold_ore: 2, silver_ore: 3, coal: 3 }
  },
  {
    id: 'holy_sword',
    name: '聖剣',
    basePrice: 3500,
    minLevel: 4,
    icon: '🔱',
    materials: { mithril: 3, gold_ore: 2, rainbow_coal: 2 }
  },
  {
    id: 'demon_sword',
    name: '魔剣',
    basePrice: 6000,
    minLevel: 5,
    icon: '😈',
    materials: { orichalcum: 3, silver_ore: 4, coal: 5 }
  },
  {
    id: 'cursed_sword',
    name: '呪いの剣',
    basePrice: 12000,
    minLevel: 6,
    icon: '💀',
    materials: { legendary_ore: 1, orichalcum: 2, rainbow_coal: 3 }
  }
];

// 品質ごとの倍率
export const QUALITY_MULTIPLIERS = {
  1: { stars: '★☆☆☆☆', label: '劣悪', multiplier: 0.5 },
  2: { stars: '★★☆☆☆', label: '普通以下', multiplier: 0.8 },
  3: { stars: '★★★☆☆', label: '普通', multiplier: 1.0 },
  4: { stars: '★★★★☆', label: '良品', multiplier: 1.5 },
  5: { stars: '★★★★★', label: '最高品質', multiplier: 2.5 }
};

// 実績の定義
export const ACHIEVEMENTS = [
  { id: 'craft_10', title: 'ひよっこ鍛冶屋', desc: '武器を10本鍛えた', condition: (s) => s.totalCrafted >= 10 },
  { id: 'craft_100', title: '伝説の職人', desc: '武器を100本鍛えた', condition: (s) => s.totalCrafted >= 100 },
  { id: 'earn_10000', title: '大富豪おじさん', desc: '累計で10,000G稼いだ', condition: (s) => s.totalEarned >= 10000 },
  { id: 'holy_sword', title: '選ばれし勇者の友', desc: '初めて聖剣を完成させた', condition: (s) => s.craftedHolySword },
  { id: 'farm_lv10', title: '農家兼鍛冶屋', desc: '畑を10回拡張・レベルアップした', condition: (s) => s.farmLevel >= 10 }
];

/**
 * 初期ゲームデータを生成します。
 */
export function createInitialData() {
  return {
    player: {
      gold: 500,
      level: 1,
      xp: 0,
      fatigue: 0,      // 0〜100
      motivation: 80,  // 0〜100
      happiness: 50,   // 0〜100
      trust: 10,       // 0〜100
      tools: {
        hammer: 1,     // 1〜5
        furnace: 1,    // 1〜5
        bucket: 1      // 1〜5
      },
      stats: {
        totalCrafted: 0,
        totalEarned: 0,
        craftedHolySword: false,
        farmLevel: 1
      },
      lastSavedAt: new Date().toISOString()
    },
    farm: {
      slots: [
        { id: 0, oreId: null, plantedAt: null, hasFertilizer: false, progress: 0 },
        { id: 1, oreId: null, plantedAt: null, hasFertilizer: false, progress: 0 },
        { id: 2, oreId: null, plantedAt: null, hasFertilizer: false, progress: 0 },
        { id: 3, oreId: null, plantedAt: null, hasFertilizer: false, progress: 0 } // 初期は4スロット
      ]
    },
    inventory: {
      materials: {
        iron_ore: 5,
        coal: 5,
        silver_ore: 0,
        gold_ore: 0,
        mithril: 0,
        orichalcum: 0,
        rainbow_coal: 0,
        legendary_ore: 0
      },
      weapons: [] // { id, recipeId, quality (1-5), name, price }
    },
    shop: {
      seeds: {
        iron_ore: 99,
        coal: 99,
        silver_ore: 0, // 初期ロック、レベルアップで補充
        gold_ore: 0,
        mithril: 0,
        orichalcum: 0,
        rainbow_coal: 0,
        legendary_ore: 0
      },
      fertilizer: 10,
      potions: 5,
      charms: 5
    },
    achievement: {
      completed: {} // { achievementId: timestamp }
    }
  };
}
