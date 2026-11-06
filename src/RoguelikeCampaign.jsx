import React, { useEffect, useRef, useState } from "react";

const WIDTH = 7;
const HEIGHT = 5;
const DIRECTIONS = [
  { key: "ArrowUp", label: "Up", delta: -WIDTH, icon: "↑" },
  { key: "ArrowRight", label: "Right", delta: 1, icon: "→" },
  { key: "ArrowDown", label: "Down", delta: WIDTH, icon: "↓" },
  { key: "ArrowLeft", label: "Left", delta: -1, icon: "←" },
];
const CLASSES = {
  warrior: {
    name: "Vanguard",
    role: "Frontline · control · endurance",
    symbol: "⚔",
    stats: { hp: 18, attack: 4, defense: 1 },
    skill: { name: "Shield Break", description: "Heavy hit; stun a surviving target.", cooldown: 2 },
    subclasses: [
      { name: "Bulwark", skills: ["Earthshatter", "Iron Resolve", "Guardian's Call"] },
      { name: "Berserker", skills: ["Blood Rush", "Execution", "War Cry"] },
    ],
  },
  mage: {
    name: "Arcanist",
    role: "Elemental · ranged · status effects",
    symbol: "✧",
    stats: { hp: 12, attack: 5, defense: 0 },
    skill: { name: "Frost Lance", description: "Strike any enemy on the map and freeze it.", cooldown: 2 },
    subclasses: [
      { name: "Ember Sage", skills: ["Meteor", "Cinder Wall", "Phoenix Heart"] },
      { name: "Cryomancer", skills: ["Glacial Prison", "Shatter", "Winter Veil"] },
    ],
  },
  rogue: {
    name: "Shadow",
    role: "Mobility · poison · critical strikes",
    symbol: "◈",
    stats: { hp: 14, attack: 4, defense: 0 },
    skill: { name: "Venomous Lunge", description: "Dash-hit a nearby foe and inflict poison.", cooldown: 2 },
    subclasses: [
      { name: "Nightblade", skills: ["Umbral Mark", "Death Blossom", "Fade"] },
      { name: "Trickster", skills: ["Flash Mine", "Decoy", "Grand Heist"] },
    ],
  },
};
const BOSS_TYPES = [
  { name: "The Iron Maw", title: "Colossal bruiser", symbol: "B", hp: 28, damage: 4, skill: "Crushing blow", effect: "stun" },
  { name: "The Broodcaller", title: "Summoner · long-range AOE", symbol: "S", hp: 24, damage: 3, skill: "Broodstorm", effect: "scald" },
  { name: "The Chain Warden", title: "Armored crowd-controller", symbol: "W", hp: 34, damage: 3, skill: "Binding chains", effect: "paralyze" },
];
const ENEMY_TYPES = [
  { name: "Cinderling", symbol: "c", hp: 4, damage: 2, effect: "burn" },
  { name: "Mirefang", symbol: "m", hp: 5, damage: 2, effect: "poison" },
  { name: "Frost husk", symbol: "f", hp: 6, damage: 2, effect: "freeze" },
  { name: "Ashbound", symbol: "a", hp: 7, damage: 3, effect: "scald" },
  { name: "Storm wisp", symbol: "w", hp: 6, damage: 3, effect: "paralyze" },
  { name: "Graveguard", symbol: "g", hp: 8, damage: 3, effect: "stun" },
];
const RARITIES = ["Common", "Uncommon", "Rare", "Legendary", "Mythic", "Unique"];
const EQUIPMENT_SLOTS = ["Weapon", "Chestplate", "Helmet", "Leggings", "Shoes", "Accessory I", "Accessory II"];
const EFFECT_LABELS = {
  burn: "Burn", stun: "Stun", poison: "Poison", freeze: "Freeze", scald: "Scald", paralyze: "Paralyze",
};
const START = 31;
const SAVE_KEY = "the-last-run-campaign-v2";
const SAVE_VERSION = 2;
function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function pathExists(start, target, walls) {
  const pending = [start];
  const visited = new Set(pending);
  while (pending.length) {
    const current = pending.shift();
    if (current === target) return true;
    for (const next of neighbors(current)) {
      if (!walls.has(next) && !visited.has(next)) {
        visited.add(next);
        pending.push(next);
      }
    }
  }
  return false;
}

function generateMap(run, stage, enemies) {
  const random = seededRandom(run * 1009 + stage * 7919);
  const occupied = new Set([START, 3, ...enemies.map((enemy) => enemy.position)]);
  const candidates = [1, 5, 8, 10, 12, 17, 18, 20, 22, 24, 26, 28, 30, 32]
    .filter((position) => !occupied.has(position));
  const walls = new Set();
  for (let attempt = 0; attempt < candidates.length * 2; attempt += 1) {
    const position = candidates[Math.floor(random() * candidates.length)];
    if (walls.has(position)) continue;
    const proposed = new Set([...walls, position]);
    if (![3, ...enemies.map((enemy) => enemy.position)].every((target) => pathExists(START, target, proposed))) continue;
    walls.add(position);
    if (walls.size >= 3 + Math.floor(random() * 3)) break;
  }
  const openPositions = Array.from({ length: WIDTH * HEIGHT }, (_, position) => position)
    .filter((position) => !walls.has(position) && !occupied.has(position));
  const hazards = [];
  const hazardTypes = ["burn", "poison", "freeze", "scald"];
  for (let index = 0; index < 2 && openPositions.length; index += 1) {
    const chosen = Math.floor(random() * openPositions.length);
    const [position] = openPositions.splice(chosen, 1);
    hazards.push({ position, type: hazardTypes[Math.floor(random() * hazardTypes.length)] });
  }
  return { walls: [...walls], hazards };
}

function newCampaign(run) {
  return {
    run, classId: null, subclass: null, subclassSkill: 0, unlockedSubclassSkills: [],
    stage: 1, player: START, hp: 0, maxHp: 0, baseAttack: 0, baseDefense: 0,
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, null])),
    pet: null, books: 0, enemies: [], kills: 0, totalKills: 0, turns: 0, runBuffs: [],
    cooldown: 0, petCooldown: 0, playerStatus: [], walls: [], hazards: [], relic: 3,
    inventory: [], status: "select-class", pendingReward: null, logs: ["Choose a class to begin your run."],
  };
}

function readSavedCampaign() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { game: newCampaign(1), error: "" };
    const parsed = JSON.parse(raw);
    if (parsed.version !== SAVE_VERSION || !parsed.game || !Number.isInteger(parsed.game.run)
      || !Number.isInteger(parsed.game.stage) || !Array.isArray(parsed.game.enemies)) {
      throw new Error("Saved run data has an unsupported format.");
    }
    return { game: parsed.game, error: "" };
  } catch (error) {
    return { game: newCampaign(1), error: `Could not load the saved run: ${error.message}` };
  }
}

function neighbors(position) {
  const row = Math.floor(position / WIDTH);
  const column = position % WIDTH;
  return [
    row > 0 ? position - WIDTH : null,
    column < WIDTH - 1 ? position + 1 : null,
    row < HEIGHT - 1 ? position + WIDTH : null,
    column > 0 ? position - 1 : null,
  ].filter((value) => value !== null);
}

function addLog(game, message) {
  return { ...game, logs: [...game.logs, message].slice(-7) };
}

function gearStats(game) {
  const equipment = Object.values(game.equipment).reduce((total, item) => ({
    attack: total.attack + (item?.attack ?? 0),
    maxHp: total.maxHp + (item?.hp ?? 0),
    defense: total.defense + (item?.defense ?? 0) + (item?.special === "Fortified" ? 1 : 0),
  }), {
    attack: game.baseAttack + (game.pet?.attack ?? 0),
    maxHp: game.maxHp + (game.pet?.hp ?? 0),
    defense: game.baseDefense + (game.pet?.defense ?? 0),
  });
  return (game.runBuffs ?? []).reduce((total, buff) => ({
    ...total,
    attack: total.attack + (buff.attack ?? 0),
    defense: total.defense + (buff.defense ?? 0),
  }), equipment);
}

function rollRarity(seed) {
  const weights = [48, 28, 15, 6, 2, 1];
  let roll = seed % 100;
  for (let index = 0; index < weights.length; index += 1) {
    roll -= weights[index];
    if (roll < 0) return RARITIES[index];
  }
  return RARITIES[0];
}

function createItem(game, seed) {
  const slot = EQUIPMENT_SLOTS[seed % EQUIPMENT_SLOTS.length];
  const rarity = rollRarity((seed * 37 + game.stage * 19) % 100);
  const rank = RARITIES.indexOf(rarity);
  const power = Math.max(1, Math.floor(game.stage / 2)) + rank;
  const isWeapon = slot === "Weapon";
  const isAccessory = slot.startsWith("Accessory");
  const special = ["Leech", "Fortified", "Ember", "Frost", "Venom", "Lucky"][seed % 6];
  return {
    id: `${game.run}-${game.stage}-${seed}-${slot}`,
    name: `${["Ashen", "Runed", "Hollow", "Stormforged", "Abyssal", "Eternal"][rank]} ${slot}`,
    slot, rarity,
    attack: isWeapon || isAccessory ? power : 0,
    hp: !isWeapon && !isAccessory ? power * 2 : 0,
    defense: !isWeapon && !isAccessory ? Math.max(0, Math.floor((power + 1) / 3)) : 0,
    special: rank >= 2 ? special : null,
  };
}

function createPet(stage) {
  const rarity = stage >= 21 ? "Unique" : stage >= 16 ? "Mythic" : stage >= 11 ? "Legendary" : stage >= 6 ? "Rare" : stage >= 4 ? "Uncommon" : "Common";
  const index = RARITIES.indexOf(rarity);
  const names = ["Mossling", "Ember fox", "Moon owl", "Void drake", "Star chimera", "World serpent"];
  return {
    name: names[index], rarity, attack: index + 1, hp: (index + 1) * 2,
    defense: Math.floor(index / 2), skill: ["Gather", "Kindle", "Second sight", "Rend", "Rebirth", "Worldbreak"][index],
  };
}

function startClass(game, classId) {
  const chosen = CLASSES[classId];
  const started = {
    ...game, classId, hp: chosen.stats.hp, maxHp: chosen.stats.hp,
    baseAttack: chosen.stats.attack, baseDefense: chosen.stats.defense,
    status: "playing", enemies: spawnEnemies(1),
  };
  const map = generateMap(started.run, 1, started.enemies);
  return addLog({ ...started, ...map }, `${chosen.name} enters the dungeon. Your run begins.`);
}

function spawnEnemies(stage, run = 1) {
  const bossFloor = stage % 5 === 0;
  const count = Math.min(2 + Math.floor((stage - 1) / 2), 4);
  const random = seededRandom(run * 1237 + stage * 6553);
  const positions = [9, 13, 19, 25];
  for (let index = positions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [positions[index], positions[swapIndex]] = [positions[swapIndex], positions[index]];
  }
  const enemies = Array.from({ length: count }, (_, index) => {
    const kind = ENEMY_TYPES[Math.floor(random() * ENEMY_TYPES.length)];
    const scale = 1 + (stage - 1) * 0.22;
    return {
      id: `r${run}-s${stage}-e${index}`, ...kind,
      hp: Math.ceil(kind.hp * scale), maxHp: Math.ceil(kind.hp * scale),
      damage: Math.ceil(kind.damage * (1 + (stage - 1) * 0.13)),
      position: positions[index], boss: false, effects: [],
    };
  });
  if (bossFloor) {
    const boss = BOSS_TYPES[((stage / 5) - 1) % BOSS_TYPES.length];
    const scale = 1 + (stage - 1) * 0.3;
    enemies.push({
      id: `r${run}-s${stage}-boss`, ...boss, hp: Math.ceil(boss.hp * scale),
      maxHp: Math.ceil(boss.hp * scale), damage: Math.ceil(boss.damage * (1 + (stage - 1) * 0.12)),
      position: 16, boss: true, effects: [], summons: 0, skillCooldown: 1,
    });
  }
  return enemies;
}

function activeEffects(entity) {
  return (entity?.effects ?? []).map((effect) => `${EFFECT_LABELS[effect.type]} ${effect.turns}`).join(" · ");
}

function applyEffect(entity, type, turns = 2) {
  const effects = [...(entity.effects ?? []).filter((effect) => effect.type !== type), { type, turns }];
  return { ...entity, effects };
}

function registerKill(game, enemy) {
  let updated = { ...game, kills: game.kills + 1, totalKills: game.totalKills + 1 };
  updated = addLog(updated, `${enemy.name} defeated.`);
  if (enemy.boss) updated = addLog(updated, "Boss defeated! The path to the next floor is open.");
  if ((updated.totalKills % 3 === 0 || enemy.boss) && !updated.pendingReward) {
    updated.pendingReward = {
      kind: enemy.boss ? "boss" : "gear",
      item: createItem(updated, updated.totalKills + updated.stage),
    };
  } else if (updated.totalKills % 2 === 0) {
    updated.books += 1;
    updated = addLog(updated, "A skill book drops. Books unlock subclass techniques.");
  }
  return updated;
}

function equipItem(game, item) {
  const previous = game.equipment[item.slot];
  const inventory = game.inventory.filter((candidate) => candidate.id !== item.id);
  if (previous && inventory.length < 12) inventory.push(previous);
  const equipment = { ...game.equipment, [item.slot]: item };
  const maxHp = Object.values(equipment).reduce((total, equipped) => total + (equipped?.hp ?? 0), game.maxHp);
  return {
    ...game, equipment, inventory,
    hp: Math.min(maxHp + (game.pet?.hp ?? 0), game.hp),
  };
}

function equipPet(game, pet) {
  const hp = Math.min(gearStats({ ...game, pet }).maxHp, game.hp);
  return { ...game, pet, hp };
}

function damageEnemy(game, enemy, amount, effect = null) {
  let updated = { ...game };
  const target = updated.enemies.find((item) => item.id === enemy.id);
  if (!target) return updated;
  const hasLuckyGear = Object.values(updated.equipment).some((item) => item?.special === "Lucky");
  const luckyBonus = hasLuckyGear && (updated.turns + updated.stage) % 5 === 0 ? 2 : 0;
  const finalAmount = amount + luckyBonus;
  const hp = target.hp - finalAmount;
  updated = addLog(updated, `You deal ${finalAmount} damage to ${target.name}${luckyBonus ? " (lucky strike)" : ""}.`);
  if (hp <= 0) {
    updated.enemies = updated.enemies.filter((item) => item.id !== target.id);
    updated = registerKill(updated, target);
  } else {
    const itemEffects = Object.values(updated.equipment).map((item) => item?.special).filter(Boolean);
    const appliedEffect = effect ?? (itemEffects.includes("Ember") ? "burn"
      : itemEffects.includes("Frost") ? "freeze"
        : itemEffects.includes("Venom") ? "poison" : null);
    const next = appliedEffect ? applyEffect({ ...target, hp }, appliedEffect) : { ...target, hp };
    updated.enemies = updated.enemies.map((item) => item.id === target.id ? next : item);
  }
  if (Object.values(updated.equipment).some((item) => item?.special === "Leech")) {
    updated.hp = Math.min(gearStats(updated).maxHp, updated.hp + 1);
    updated = addLog(updated, "Leech gear restores 1 health.");
  }
  return updated;
}

function playerAction(game, enemyId = null, useSkill = false) {
  if (game.status !== "playing" || game.pendingReward) return game;
  const disablingEffect = game.playerStatus.find((effect) => ["freeze", "stun", "paralyze"].includes(effect.type));
  if (disablingEffect) {
    const remainingStatus = game.playerStatus.map((effect) => effect === disablingEffect
      ? { ...effect, turns: effect.turns - 1 } : effect).filter((effect) => effect.turns > 0);
    return enemyTurn(addLog({ ...game, playerStatus: remainingStatus, turns: game.turns + 1 }, `${EFFECT_LABELS[disablingEffect.type]} prevents your action.`));
  }
  const stats = gearStats(game);
  const enemy = enemyId
    ? game.enemies.find((item) => item.id === enemyId)
    : game.enemies.find((item) => neighbors(game.player).includes(item.position));
  if (!enemy) return addLog(game, "No target is in reach.");
  if (useSkill && game.cooldown > 0) return addLog(game, `Skill recovers for ${game.cooldown} more turn(s).`);
  if (!useSkill && !neighbors(game.player).includes(enemy.position) && game.classId !== "mage") {
    return addLog(game, "That enemy is too far away.");
  }
  const skill = useSkill ? CLASSES[game.classId].skill : null;
  let power = stats.attack * (useSkill ? 2 : 1);
  let updated = damageEnemy(game, enemy, power, skill && game.classId === "mage" ? "freeze" : null);
  if (updated.enemies.some((item) => item.id === enemy.id) && skill) {
    if (game.classId === "warrior") {
      updated.enemies = updated.enemies.map((item) => item.id === enemy.id ? applyEffect(item, "stun", 1) : item);
      updated = addLog(updated, `${enemy.name} is stunned.`);
    } else if (game.classId === "rogue") {
      updated.enemies = updated.enemies.map((item) => item.id === enemy.id ? applyEffect(item, "poison", 3) : item);
      updated = addLog(updated, `${enemy.name} is poisoned.`);
    }
  }
  updated = { ...updated, cooldown: skill ? 2 : Math.max(0, updated.cooldown - 1), petCooldown: Math.max(0, (updated.petCooldown ?? 0) - 1), turns: updated.turns + 1 };
  return updated.enemies.length === 0 ? updated : enemyTurn(updated);
}

function playerMove(game, delta) {
  if (game.status !== "playing" || game.pendingReward) return game;
  const disablingEffect = game.playerStatus.find((effect) => ["freeze", "stun", "paralyze"].includes(effect.type));
  if (disablingEffect) {
    const remainingStatus = game.playerStatus.map((effect) => effect === disablingEffect
      ? { ...effect, turns: effect.turns - 1 } : effect).filter((effect) => effect.turns > 0);
    return enemyTurn(addLog({ ...game, playerStatus: remainingStatus, turns: game.turns + 1 }, `${EFFECT_LABELS[disablingEffect.type]} prevents movement.`));
  }
  const row = Math.floor(game.player / WIDTH);
  const column = game.player % WIDTH;
  const next = game.player + delta;
  const nextRow = Math.floor(next / WIDTH);
  const nextColumn = next % WIDTH;
  if (next < 0 || next >= WIDTH * HEIGHT || (Math.abs(delta) === 1 && row !== nextRow)) return game;
  if (game.walls.includes(next)) return addLog(game, "A collapsed wall blocks the way.");
  if (game.enemies.some((enemy) => enemy.position === next)) return playerAction(game, game.enemies.find((enemy) => enemy.position === next).id);
  let updated = { ...game, player: next, turns: game.turns + 1, cooldown: Math.max(0, game.cooldown - 1), petCooldown: Math.max(0, (game.petCooldown ?? 0) - 1) };
  const hazard = game.hazards.find((item) => item.position === next);
  if (hazard) {
    const damage = hazard.type === "scald" ? 1 : 2;
    updated.hp = Math.max(1, updated.hp - damage);
    updated = addLog(updated, `The ${EFFECT_LABELS[hazard.type].toLowerCase()} hazard deals ${damage} damage.`);
    updated.playerStatus = [...updated.playerStatus.filter((effect) => effect.type !== hazard.type), { type: hazard.type, turns: 2 }];
  } else updated = addLog(updated, "You advance through the floor.");
  if (next === game.relic && game.enemies.length === 0) {
    return addLog({ ...updated, status: "floor-clear" }, `Floor ${game.stage} exit reached.`);
  }
  return enemyTurn(updated);
}

function tickEffects(entity, onDamage) {
  let updated = { ...entity };
  const remaining = [];
  for (const effect of updated.effects ?? []) {
    if (effect.type === "burn" || effect.type === "poison" || effect.type === "scald") {
      const damage = effect.type === "scald" ? 1 : 2;
      updated = onDamage(updated, damage, effect.type);
    }
    if (effect.turns > 1) remaining.push({ ...effect, turns: effect.turns - 1 });
  }
  updated.effects = remaining;
  return updated;
}

function usePetSkill(game) {
  if (!game.pet || game.petCooldown > 0 || game.status !== "playing" || game.pendingReward) return game;
  const rank = RARITIES.indexOf(game.pet.rarity);
  const stats = gearStats(game);
  let updated = { ...game, petCooldown: Math.max(3, 6 - rank), turns: game.turns + 1 };
  if (rank === 0) {
    const restored = Math.min(stats.maxHp, updated.hp + 3);
    updated = addLog({ ...updated, hp: restored }, `${game.pet.name} uses Gather and restores ${restored - game.hp} health.`);
  } else if (rank === 1) {
    const target = updated.enemies[0];
    if (!target) return game;
    updated = damageEnemy(updated, target, game.pet.attack + 2, "burn");
    updated = addLog(updated, `${game.pet.name} uses Kindle and ignites ${target.name}.`);
  } else if (rank === 2) {
    const removed = updated.playerStatus.length;
    updated.playerStatus = [];
    const restored = Math.min(stats.maxHp, updated.hp + 3);
    updated = addLog({ ...updated, hp: restored }, `${game.pet.name} uses Second Sight, clears ${removed} effect(s), and restores ${restored - game.hp} health.`);
  } else if (rank === 3) {
    const target = updated.enemies.find((enemy) => neighbors(game.player).includes(enemy.position)) ?? updated.enemies[0];
    if (!target) return game;
    updated = damageEnemy(updated, target, (game.pet.attack + stats.attack) * 2, "poison");
    updated = addLog(updated, `${game.pet.name} uses Rend and poisons ${target.name}.`);
  } else if (rank === 4) {
    updated.hp = Math.min(stats.maxHp, updated.hp + 7);
    updated.playerStatus = [];
    updated = addLog(updated, `${game.pet.name} triggers Rebirth: health restored and harmful effects cleansed.`);
  } else {
    const targets = [...updated.enemies];
    for (const target of targets) updated = damageEnemy(updated, target, game.pet.attack * 2, "scald");
    updated = addLog(updated, `${game.pet.name} uses Worldbreak against every enemy.`);
  }
  return updated.enemies.length === 0 || updated.pendingReward ? updated : enemyTurn(updated);
}

function triggerSubclassSkill(game, index) {
  const skillNames = CLASSES[game.classId].subclasses.find((item) => item.name === game.subclass).skills;
  const skillName = skillNames[index];
  if (!game.unlockedSubclassSkills.includes(index)) return game;
  if (game.cooldown > 0) return addLog(game, `Technique recovers for ${game.cooldown} more turn(s).`);
  const stats = gearStats(game);
  if (["Iron Resolve", "Phoenix Heart", "Winter Veil", "Fade"].includes(skillName)) {
    const restored = Math.min(stats.maxHp, game.hp + (skillName === "Phoenix Heart" ? 8 : 5 + Math.floor(game.stage / 2)));
    let updated = { ...game, hp: restored, cooldown: 3, turns: game.turns + 1 };
    if (skillName === "Winter Veil" || skillName === "Fade") updated.playerStatus = [];
    if (skillName === "Iron Resolve") updated.runBuffs = [...updated.runBuffs, { defense: 2, turns: 3 }];
    return enemyTurn(addLog(updated, `${skillName} ${skillName === "Fade" || skillName === "Winter Veil" ? "cleanses effects and " : ""}restores ${restored - game.hp} health${skillName === "Iron Resolve" ? " and fortifies defense" : ""}.`));
  }
  if (["Guardian's Call", "War Cry", "Decoy"].includes(skillName)) {
    const buff = skillName === "Guardian's Call" ? { defense: 2, turns: 3 }
      : skillName === "War Cry" ? { attack: 2, turns: 3 } : { evade: true, turns: 2 };
    return enemyTurn(addLog({ ...game, runBuffs: [...game.runBuffs, buff], cooldown: 3, turns: game.turns + 1 }, `${skillName} grants a ${buff.defense ? "defensive" : buff.attack ? "damage" : "evasion"} buff for ${buff.turns} turns.`));
  }
  const adjacent = game.enemies.filter((enemy) => neighbors(game.player).includes(enemy.position));
  const targets = ["Death Blossom", "Meteor", "Earthshatter", "Glacial Prison"].includes(skillName)
    ? game.enemies.filter((enemy) => neighbors(game.player).includes(enemy.position) || skillName === "Meteor")
    : [adjacent[0] ?? game.enemies[0]].filter(Boolean);
  if (!targets.length) return addLog(game, `${skillName} has no target.`);
  const effect = ["Earthshatter", "Flash Mine"].includes(skillName) ? "stun"
    : ["Meteor", "Cinder Wall"].includes(skillName) ? "burn"
      : ["Glacial Prison", "Shatter"].includes(skillName) ? "freeze" : "poison";
  let updated = { ...game };
  const multiplier = skillName === "Execution" || skillName === "Shatter" ? 3
    : skillName === "Meteor" || skillName === "Death Blossom" ? 1.5
      : skillName === "Blood Rush" ? 2.5 : 2;
  for (const target of targets) {
    const damage = skillName === "Execution" && target.hp <= target.maxHp / 2
      ? Math.ceil(stats.attack * 5) : Math.ceil(stats.attack * multiplier);
    updated = damageEnemy(updated, target, damage, effect);
  }
  updated = { ...updated, cooldown: 3, turns: updated.turns + 1 };
  updated = addLog(updated, `${skillName} releases its ${EFFECT_LABELS[effect]} effect.`);
  if (skillName === "Grand Heist") {
    updated.pendingReward = { kind: "gear", item: createItem(updated, updated.totalKills + updated.stage + index) };
  }
  return updated.enemies.length === 0 || updated.pendingReward ? updated : enemyTurn(updated);
}

function enemyTurn(initialGame) {
  let game = { ...initialGame };
  game.runBuffs = (game.runBuffs ?? []).map((buff) => ({ ...buff, turns: buff.turns - 1 })).filter((buff) => buff.turns > 0);
  const stats = gearStats(game);
  game.playerStatus = game.playerStatus.map((effect) => ({ ...effect }));
  for (const effect of game.playerStatus) {
    if (["burn", "poison", "scald"].includes(effect.type)) {
      const damage = effect.type === "scald" ? 1 : 2;
      game.hp = Math.max(0, game.hp - damage);
      game = addLog(game, `${EFFECT_LABELS[effect.type]} deals ${damage} damage to you.`);
    }
  }
  game.playerStatus = game.playerStatus.map((effect) => ({ ...effect, turns: effect.turns - 1 })).filter((effect) => effect.turns > 0);
  if (game.hp <= 0) return { ...game, status: "lost" };
  let movedPositions = [];
  const enemyIds = game.enemies.map((enemy) => enemy.id);
  for (const id of enemyIds) {
    let enemy = game.enemies.find((item) => item.id === id);
    if (!enemy) continue;
    enemy = tickEffects(enemy, (target, amount, type) => {
      const hp = target.hp - amount;
      game = addLog(game, `${target.name} takes ${amount} ${type} damage.`);
      return { ...target, hp };
    });
    if (enemy.hp <= 0) {
      game.enemies = game.enemies.filter((item) => item.id !== id);
      game = registerKill(game, enemy);
      continue;
    }
    game.enemies = game.enemies.map((item) => item.id === id ? enemy : item);
    const skip = enemy.effects.some((effect) => ["freeze", "stun", "paralyze"].includes(effect.type));
    if (skip) {
      game.enemies = game.enemies.map((item) => item.id === id ? enemy : item);
      game = addLog(game, `${enemy.name} is unable to act.`);
      continue;
    }
    const rowDistance = Math.abs(Math.floor(enemy.position / WIDTH) - Math.floor(game.player / WIDTH));
    const columnDistance = Math.abs((enemy.position % WIDTH) - (game.player % WIDTH));
    const distance = rowDistance + columnDistance;
    if (enemy.boss) {
      const cooldown = Math.max(0, (enemy.skillCooldown ?? 0) - 1);
      const bossInRange = enemy.name === "The Chain Warden" ? distance <= 3
        : enemy.name === "The Broodcaller" ? distance <= 4 : distance <= 2;
      if (cooldown === 0 && bossInRange) {
        const dealt = Math.max(1, enemy.damage + (enemy.name === "The Iron Maw" ? 2 : 0) - stats.defense);
        if (game.runBuffs.some((buff) => buff.evade)) {
          game.runBuffs = game.runBuffs.filter((buff) => !buff.evade);
          game = addLog(game, `You evade ${enemy.skill} with your decoy.`);
        } else {
          game.hp = Math.max(0, game.hp - dealt);
          game = addLog(game, `${enemy.skill} hits for ${dealt} damage.`);
          if (enemy.name === "The Iron Maw") {
            game.playerStatus.push({ type: "stun", turns: 1 });
            game = addLog(game, "The impact stuns you.");
          } else if (enemy.name === "The Broodcaller") {
            game.playerStatus.push({ type: "scald", turns: 2 });
            game = addLog(game, "Broodstorm scalds the whole arena.");
          } else {
            game.playerStatus.push({ type: "paralyze", turns: 2 });
            game = addLog(game, "Binding chains paralyze you.");
          }
        }
        if (enemy.name === "The Broodcaller" && enemy.summons < 2) {
          const free = [11, 15, 23, 27].find((position) => (
            !game.walls.includes(position) && !game.enemies.some((item) => item.position === position)
          ));
          if (free !== undefined) {
            const minionKind = ENEMY_TYPES[(game.stage + enemy.summons) % ENEMY_TYPES.length];
            game.enemies.push({
              id: `${enemy.id}-minion-${enemy.summons}`, ...minionKind,
              hp: 5 + game.stage, maxHp: 5 + game.stage, damage: 2 + Math.floor(game.stage / 5),
              position: free, boss: false, effects: [],
            });
            enemy.summons += 1;
            game = addLog(game, "The Broodcaller calls a minion into the arena.");
          }
        }
        enemy.skillCooldown = 3;
        game.enemies = game.enemies.map((item) => item.id === id ? enemy : item);
        if (game.hp <= 0) return { ...game, status: "lost" };
        continue;
      }
      enemy.skillCooldown = cooldown;
      game.enemies = game.enemies.map((item) => item.id === id ? enemy : item);
    }
    if (neighbors(game.player).includes(enemy.position)) {
      const dealt = Math.max(1, enemy.damage - stats.defense);
      if (game.runBuffs.some((buff) => buff.evade)) {
        game.runBuffs = game.runBuffs.filter((buff) => !buff.evade);
        game = addLog(game, `You evade ${enemy.name}'s attack.`);
        continue;
      }
      game.hp = Math.max(0, game.hp - dealt);
      game = addLog(game, `${enemy.name} hits you for ${dealt} damage.`);
      if (!enemy.boss && enemy.effect && !game.playerStatus.some((effect) => effect.type === enemy.effect)) {
        game.playerStatus.push({ type: enemy.effect, turns: 2 });
        game = addLog(game, `You are afflicted with ${EFFECT_LABELS[enemy.effect]}.`);
      }
      if (game.hp <= 0) return { ...game, status: "lost" };
    } else {
      const options = neighbors(enemy.position).filter((position) => (
        !game.walls.includes(position) && position !== game.player
        && !game.enemies.some((other) => other.id !== enemy.id && other.position === position)
        && !movedPositions.includes(position)
      ));
      options.sort((a, b) => Math.abs(Math.floor(a / WIDTH) - Math.floor(game.player / WIDTH))
        + Math.abs((a % WIDTH) - (game.player % WIDTH))
        - Math.abs(Math.floor(b / WIDTH) - Math.floor(game.player / WIDTH))
        - Math.abs((b % WIDTH) - (game.player % WIDTH)));
      const position = options[0] ?? enemy.position;
      movedPositions.push(position);
      game.enemies = game.enemies.map((item) => item.id === id ? { ...enemy, position } : item);
    }
  }
  return game;
}

function nextStage(game) {
  const stage = game.stage + 1;
  const maxHp = gearStats(game).maxHp;
  const healed = Math.max(1, Math.ceil(maxHp * 0.25));
  const petFloor = [2, 4, 6, 11, 16, 21].includes(stage);
  const reward = petFloor
    ? { kind: "pet", pet: createPet(stage) }
    : stage % 2 === 0
      ? { kind: "gear", item: createItem({ ...game, stage }, game.totalKills + stage + 9) }
      : null;
  const enemies = spawnEnemies(stage, game.run);
  const map = generateMap(game.run, stage, enemies);
  return {
    ...game, stage, player: START, hp: Math.min(maxHp, game.hp + healed),
    cooldown: 0, petCooldown: 0, playerStatus: [], enemies, relic: 3, ...map,
    kills: 0, status: "playing", pendingReward: reward,
    logs: [...game.logs, `Floor ${stage} begins. Your gear and progress carry forward.`].slice(-7),
  };
}

function GameTile({ position, game }) {
  const enemy = game.enemies.find((item) => item.position === position);
  const isPlayer = game.player === position;
  const isWall = game.walls.includes(position);
  const hazard = game.hazards.find((item) => item.position === position);
  const isExit = position === game.relic;
  const classes = ["rogue-tile", isWall ? "is-wall" : "", isPlayer ? "is-player" : "",
    enemy ? enemy.boss ? "is-boss" : "is-enemy" : "", hazard ? `is-hazard hazard-${hazard.type}` : "",
    isExit ? "is-relic" : ""].filter(Boolean).join(" ");
  const content = isPlayer ? "✦" : enemy ? enemy.symbol : hazard ? "♨" : isExit ? game.enemies.length === 0 ? "◆" : "◇" : "";
  const label = isPlayer ? "You" : enemy
    ? `${enemy.boss ? "Boss " : ""}${enemy.name}, ${enemy.hp} health${activeEffects(enemy) ? `, ${activeEffects(enemy)}` : ""}`
    : isExit ? game.enemies.length === 0 ? "Unlocked floor exit" : "Sealed floor exit"
      : isWall ? "Stone obstacle" : hazard ? `${EFFECT_LABELS[hazard.type]} hazard` : "Dungeon floor";
  return <div className={classes} role="gridcell" aria-label={label}>
    {content}
    {enemy && <small>{enemy.hp}/{enemy.maxHp}</small>}
  </div>;
}

function RoguelikeCampaign({ open, onClose }) {
  const dialogRef = useRef(null);
  const boardRef = useRef(null);
  const [initialSave] = useState(readSavedCampaign);
  const [game, setGame] = useState(() => initialSave.game);
  const [saveError, setSaveError] = useState(initialSave.error);

  useEffect(() => {
    if (initialSave.error && game.status === "select-class" && !game.classId) return;
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, game }));
      setSaveError("");
    } catch (error) {
      setSaveError(`Could not save this run: ${error.message}`);
    }
  }, [game, initialSave.error]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    const dialog = dialogRef.current;
    const closeDialog = () => onClose();
    dialog?.addEventListener("close", closeDialog);
    return () => dialog?.removeEventListener("close", closeDialog);
  }, [onClose]);
  useEffect(() => {
    if (open && game.status === "playing") boardRef.current?.focus();
  }, [open, game.status]);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      const direction = DIRECTIONS.find((item) => item.key === event.key);
      if (direction && game.status === "playing" && !game.pendingReward) {
        event.preventDefault();
        setGame((current) => playerMove(current, direction.delta));
      } else if ((event.key === " " || event.key.toLowerCase() === "f")
        && game.status === "playing" && !game.pendingReward) {
        if (event.key === " " && event.target instanceof HTMLElement && event.target.closest("button")) return;
        event.preventDefault();
        setGame((current) => playerAction(current));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, game.status, game.pendingReward]);

  const close = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    else onClose();
  };
  const stats = gearStats(game);
  const currentClass = CLASSES[game.classId];
  const bossFloor = game.stage % 5 === 0;
  const aliveBoss = game.enemies.some((enemy) => enemy.boss);
  const adjacentEnemy = game.enemies.find((enemy) => neighbors(game.player).includes(enemy.position));
  const completeFloor = () => {
    if (game.stage % 5 === 0 && !game.subclass) {
      setGame((current) => ({ ...current, status: "choose-subclass" }));
      return;
    }
    setGame((current) => nextStage(current));
  };
  const takeReward = (equip) => {
    setGame((current) => {
      const reward = current.pendingReward;
      if (equip && reward?.item && current.equipment[reward.item.slot] && current.inventory.length >= 12) {
        return addLog(current, "Inventory is full. Discard a stored item before replacing this slot.");
      }
      let updated = { ...current, pendingReward: null };
      if (reward?.kind === "gear" || reward?.kind === "boss") {
        if (equip) {
          updated = equipItem(updated, reward.item);
          updated = addLog(updated, `${reward.item.rarity} ${reward.item.name} equipped.`);
        } else if (updated.inventory.length < 12) {
          updated.inventory = [...updated.inventory, reward.item];
          updated = addLog(updated, `${reward.item.name} stored in your inventory.`);
        } else updated = addLog(updated, `${reward.item.name} left behind; inventory is full.`);
      } else if (reward?.kind === "pet") {
        if (equip || !updated.pet) {
          updated = equipPet(updated, reward.pet);
          updated = addLog(updated, `${reward.pet.rarity} pet ${reward.pet.name} joins your run.`);
        } else updated = addLog(updated, `${reward.pet.name} leaves to protect your current companion.`);
      }
      if (updated.status === "floor-clear") updated.status = "playing";
      return updated;
    });
  };
  const unlockSubclassSkill = (index) => {
    setGame((current) => {
      if (current.books < 1 || current.unlockedSubclassSkills.includes(index)) return current;
      return addLog({
        ...current, books: current.books - 1,
        unlockedSubclassSkills: [...current.unlockedSubclassSkills, index],
      }, `${CLASSES[current.classId].subclasses.find((item) => item.name === current.subclass).skills[index]} learned from a skill book.`);
    });
  };
  const activateSubclassSkill = (index) => setGame((current) => triggerSubclassSkill(current, index));
  const equipFromInventory = (item) => setGame((current) => equipItem(current, item));
  const beginRun = (classId) => setGame((current) => startClass(current, classId));
  const freshRun = () => setGame((current) => newCampaign(current.run + 1));
  const useSkill = () => {
    const target = currentClass?.name === "Arcanist"
      ? game.enemies[0]
      : adjacentEnemy;
    if (target) setGame((current) => playerAction(current, target.id, true));
  };
  const usePet = () => setGame((current) => usePetSkill(current));

  return <dialog ref={dialogRef} className="roguelike-dialog" onClick={(event) => {
    if (event.target === dialogRef.current) close();
  }} aria-labelledby="rogue-title">
    <div className="roguelike-shell campaign-shell">
      <header className="rogue-header">
        <div><p className="eyebrow">PERMADEATH · PERSISTENT CAMPAIGN</p><h2 id="rogue-title">The Last Run</h2>
          {!saveError && <small className="save-indicator">AUTOSAVED TO THIS BROWSER</small>}
        </div>
        <button className="icon-button" onClick={close} aria-label="Close roguelike">×</button>
      </header>
      {saveError && <p className="save-warning" role="alert">{saveError}</p>}

      {game.status === "select-class" ? <section className="class-select">
        <p className="eyebrow">RUN {String(game.run).padStart(2, "0")} · CHOOSE YOUR CLASS</p>
        <h3>Build a survivor, one floor at a time.</h3>
        <p>Every fifth floor ends in a boss. Your health, gear, pet, and learned skills carry forward. Death ends the run.</p>
        <div className="class-cards">{Object.entries(CLASSES).map(([id, item]) => <button key={id} className={`class-card ${id}`} onClick={() => beginRun(id)}>
          <span className="class-card-symbol">{item.symbol}</span><strong>{item.name}</strong><small>{item.role}</small>
          <b>{item.stats.hp} HP · {item.stats.attack} ATK</b><em>{item.skill.name}</em><small>{item.skill.description}</small>
        </button>)}</div>
      </section> : <>
        <div className="rogue-hud campaign-hud">
          <div><span>FLOOR</span><strong>{String(game.stage).padStart(2, "0")} {bossFloor ? "· BOSS" : ""}</strong></div>
          <div><span>CLASS</span><strong>{currentClass.name}{game.subclass ? ` · ${game.subclass}` : ""}</strong></div>
          <div><span>HEALTH</span><strong className="health-value">♥ {game.hp}/{stats.maxHp}</strong></div>
          <div><span>POWER</span><strong>⚔ {stats.attack} · 🛡 {stats.defense}</strong></div>
        </div>
        <div className="rogue-layout campaign-layout">
          <section className="rogue-playfield">
            <p className="rogue-instruction">
              {game.status === "lost" ? "Permadeath: this character's journey is over." :
                game.status === "choose-subclass" ? "Boss defeated. Choose a subclass and claim its first technique." :
                  game.status === "floor-clear" ? `Floor ${game.stage} cleared. Your character and equipment persist.` :
                    game.pendingReward ? "Loot found. Choose what to do with it." :
                      `${bossFloor ? "BOSS FLOOR · " : ""}Defeat all threats to open the floor exit. Arrow keys move; F attacks.`}
            </p>
            {game.status === "playing" && <div className="rogue-board" role="grid" aria-label="Dungeon floor map" tabIndex={0} ref={boardRef}>
              {Array.from({ length: WIDTH * HEIGHT }, (_, position) => <GameTile key={position} position={position} game={game} />)}
            </div>}

            {game.status === "select-class" && null}
                  {game.status === "choose-subclass" && <div className="subclass-picker">
                    {currentClass.subclasses.map((item) => <button key={item.name} onClick={() => setGame((current) => ({
                      ...nextStage({ ...current, subclass: item.name, status: "playing", unlockedSubclassSkills: [0] }),
                    }))}>
                <strong>{item.name}</strong><small>First technique unlocked: {item.skills[0]}</small>
                <small>Books unlock: {item.skills.slice(1).join(" · ")}</small>
              </button>)}
            </div>}
            {game.pendingReward && <div className="reward-card">
              {game.pendingReward.kind === "pet" ? <>
                    <span className={`rarity ${game.pendingReward.pet.rarity.toLowerCase()}`}>{game.pendingReward.pet.rarity} companion</span>
                <strong>{game.pendingReward.pet.name}</strong>
                <small>{game.pendingReward.pet.skill} · +{game.pendingReward.pet.attack} ATK · +{game.pendingReward.pet.hp} HP · +{game.pendingReward.pet.defense} DEF</small>
                <div><button className="button button-primary" onClick={() => takeReward(true)}>Welcome pet</button>
                  {game.pet && <button className="button button-quiet" onClick={() => takeReward(false)}>Keep {game.pet.name}</button>}
                </div>
              </> : <>
                <span className={`rarity ${game.pendingReward.item.rarity.toLowerCase()}`}>{game.pendingReward.item.rarity} drop</span>
                <strong>{game.pendingReward.item.name}</strong>
                <small>{game.pendingReward.item.slot} · +{game.pendingReward.item.attack} ATK · +{game.pendingReward.item.hp} HP · +{game.pendingReward.item.defense} DEF</small>
                {game.pendingReward.item.special && <small>Special: {game.pendingReward.item.special}</small>}
                <div><button className="button button-primary" onClick={() => takeReward(true)}>Equip loot</button>
                  <button className="button button-quiet" disabled={game.inventory.length >= 12} onClick={() => takeReward(false)}>Store ({game.inventory.length}/12)</button>
                  <button className="button button-quiet" onClick={() => setGame((current) => addLog({ ...current, pendingReward: null }, `${current.pendingReward.item.name} discarded.`))}>Discard</button></div>
              </>}
            </div>}
            {game.status === "playing" && !game.pendingReward && <div className="rogue-controls">
              <div className="direction-pad" aria-label="Movement controls">
                <span /><button onClick={() => setGame((current) => playerMove(current, DIRECTIONS[0].delta))} aria-label="Move up">↑</button><span />
                <button onClick={() => setGame((current) => playerMove(current, DIRECTIONS[3].delta))} aria-label="Move left">←</button>
                <button onClick={() => setGame((current) => playerMove(current, DIRECTIONS[2].delta))} aria-label="Move down">↓</button>
                <button onClick={() => setGame((current) => playerMove(current, DIRECTIONS[1].delta))} aria-label="Move right">→</button>
              </div>
              <div className="combat-actions">
                <button className="button button-primary attack-button" onClick={() => setGame((current) => playerAction(current))} disabled={!adjacentEnemy}>Attack</button>
                <button className="button skill-button" onClick={useSkill} disabled={!game.enemies.length || game.cooldown > 0}>
                  {currentClass.skill.name} {game.cooldown > 0 ? `(${game.cooldown})` : ""}
                </button>
                {game.pet && <button className="button pet-skill-button" onClick={usePet} disabled={game.petCooldown > 0 || !game.enemies.length && RARITIES.indexOf(game.pet.rarity) > 0}>
                  {game.pet.skill} {game.petCooldown > 0 ? `(${game.petCooldown})` : ""}
                </button>}
              </div>
            </div>}
            {game.status === "floor-clear" && <button className="button button-primary stage-button" onClick={completeFloor}>Descend to floor {game.stage + 1} ↓</button>}
            {game.status === "lost" && <button className="button button-primary stage-button" onClick={freshRun}>Begin a new run</button>}
            {game.subclass && <div className="book-shelf"><strong>Skill books: {game.books} · Subclass techniques</strong>
              {currentClass.subclasses.find((item) => item.name === game.subclass).skills.slice(1).map((skill, i) => {
                const index = i + 1;
                const unlocked = game.unlockedSubclassSkills.includes(index);
                return unlocked
                  ? <button className="subskill-button" key={skill} disabled={game.cooldown > 0} onClick={() => activateSubclassSkill(index)}>{skill}{game.cooldown > 0 ? ` · ${game.cooldown}` : ""}</button>
                  : <button key={skill} disabled={game.books < 1} onClick={() => unlockSubclassSkill(index)}>📖 Unlock {skill}</button>;
              })}
              {currentClass.subclasses.find((item) => item.name === game.subclass).skills.slice(0, 1).map((skill) => (
                <button className="subskill-button" key={skill} disabled={game.cooldown > 0} onClick={() => activateSubclassSkill(0)}>{skill}{game.cooldown > 0 ? ` · ${game.cooldown}` : ""}</button>
              ))}
            </div>}
          </section>

          <aside className="rogue-side campaign-side">
            <section className="objective-card">
              <p className="eyebrow">RUN BUILD</p><p>{currentClass.name}{game.subclass ? ` / ${game.subclass}` : " · subclass at floor 5"}</p>
              <small>Floor {game.stage} · {game.enemies.length} threat(s) · {game.books} skill book(s)</small>
              <div className="status-list">{game.playerStatus.map((effect) => <span key={effect.type}>{EFFECT_LABELS[effect.type]} {effect.turns}</span>)}</div>
            </section>
            <section className="enemy-list"><p className="eyebrow">{aliveBoss ? "BOSS & THREATS" : "THREATS"}</p>
              {game.enemies.length ? game.enemies.map((enemy) => <div className={`enemy-entry ${enemy.boss ? "boss-entry" : ""}`} key={enemy.id}>
                <span className="enemy-icon">{enemy.symbol}</span>
                <span>{enemy.name}<small>{enemy.boss ? enemy.title : `${EFFECT_LABELS[enemy.effect]} · ATK ${enemy.damage}`}{activeEffects(enemy) && ` · ${activeEffects(enemy)}`}</small></span>
                <strong>{enemy.hp} HP</strong>
              </div>) : <p className="no-threats">Floor clear. Exit unlocked.</p>}
            </section>
            <section className="equipment-card"><p className="eyebrow">EQUIPPED</p>
              {EQUIPMENT_SLOTS.map((slot) => <div key={slot}><span>{slot}</span><strong title={`${game.equipment[slot]?.name ?? ""}${game.equipment[slot]?.special ? ` · ${game.equipment[slot].special}` : ""}`}>{game.equipment[slot]?.name ?? "—"}{game.equipment[slot]?.special ? ` · ${game.equipment[slot].special}` : ""}</strong></div>)}
              <div><span>Pet</span><strong>{game.pet ? `${game.pet.rarity} ${game.pet.name}` : "No companion"}</strong></div>
              <small>{game.pet ? `${game.pet.skill}: ${game.pet.rarity} active ability · cooldown ${game.petCooldown}` : "Gear stats count immediately; rewards never reset between floors."}</small>
              <div className="inventory-heading"><span>Inventory</span><strong>{game.inventory.length}/12</strong></div>
              {game.inventory.length === 0 ? <small>No stored gear yet.</small> : game.inventory.map((item) => <div className="inventory-item" key={item.id}>
                <span className={`inventory-rarity ${item.rarity.toLowerCase()}`}>{item.rarity} · {item.slot}{item.special ? ` · ${item.special}` : ""}</span>
                <strong title={item.name}>{item.name} · +{item.attack} ATK · +{item.hp} HP · +{item.defense} DEF</strong>
                <button onClick={() => equipFromInventory(item)}>Equip</button>
                <button className="inventory-discard" aria-label={`Discard ${item.name}`} onClick={() => setGame((current) => ({
                  ...current, inventory: current.inventory.filter((stored) => stored.id !== item.id),
                }))}>×</button>
              </div>)}
            </section>
            <section className="run-log" aria-live="polite"><p className="eyebrow">RUN LOG</p>
              {game.logs.slice(-5).map((entry, index) => <p key={`${game.turns}-${index}`}>{entry}</p>)}
            </section>
          </aside>
        </div>
        <footer className="rogue-footer"><span>↑ ↓ ← → MOVE</span><span>F ATTACK</span><span>EVERY 5 FLOORS: BOSS</span>
          <button className="button button-quiet" onClick={close}>Back to portfolio</button>
        </footer>
      </>}
    </div>
  </dialog>;
}

export default RoguelikeCampaign;
