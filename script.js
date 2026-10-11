
'use strict';

const TYPES = {
  inf: {
    name: '歩兵',
    hp: 8,
    atk: 2,
    mov: 1,
    range: 1,
    cost: 2
  },
  arch: {
    name: '弓兵',
    hp: 7,
    atk: 3,
    mov: 1,
    range: 3,
    cost: 4
  },
  cav: {
    name: '騎兵',
    hp: 7,
    atk: 4,
    mov: 4,
    range: 1,
    cost: 6
  },
  shield: {
    name: '盾兵',
    hp: 14,
    atk: 1,
    mov: 1,
    range: 1,
    cost: 5
  },
  heavy: {
    name: '重装兵',
    hp: 13,
    atk: 5,
    mov: 1,
    range: 1,
    cost: 9
  },
  axe: {
    name: '斧兵',
    hp: 7,
    atk: 3,
    mov: 2,
    range: 1,
    cost: 4
  }
};

const $ = id => document.getElementById(id);
const cv = $('board');
const ctx = cv.getContext('2d');

let G = null;
let selected = null;
let preview = null;
let busy = false;

const CELL = 48;
const saveKey = 'mitei-game-v1';

const dirs = [];

for (let y = -1; y <= 1; y++) {
  for (let x = -1; x <= 1; x++) {
    if (x || y) dirs.push([x, y]);
  }
}

const idx = (x, y) => y * G.w + x;

const inside = (x, y) =>
  x >= 0 && y >= 0 && x < G.w && y < G.h;

const at = (x, y) => G.tiles[idx(x, y)];

const unitAt = (x, y) =>
  G.units.find(u => u.x === x && u.y === y);

const dist = (a, b) =>
  Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y)
  );

function setup() {
  const m = $('mapChoice').value;

  const dims =
    m === 'islands' ? [14, 14] :
    m === 'river' ? [14, 12] :
    [12, 12];

  let [w, h] = dims;
  let tiles = [];

  let seed = ({
    plains: 11,
    mountain: 29,
    river: 47,
    islands: 83
  })[m];

  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = rnd();
      let terrain = r < 0.16 ? 'forest' : 'plain';

      if (m === 'mountain' && r < 0.36) {
        terrain = 'mountain';
      } else if (m !== 'mountain' && r > 0.9) {
        terrain = 'mountain';
      }

      if (
        m === 'river' &&
        (x === Math.floor(w / 2) ||
         x === Math.floor(w / 2) - 1) &&
        y !== 2 &&
        y !== h - 3
      ) {
        terrain = 'river';
      }

      if (
        m === 'islands' &&
        (
          (x >= 5 && x <= 8 && y >= 4 && y <= 9) ||
          r < 0.13
        )
      ) {
        terrain = 'river';
      }

      tiles.push({
        terrain,
        owner: null,
        city: false,
        capital: false
      });
    }
  }

  G = {
    w,
    h,
    tiles,
    units: [],
    money: [10, 10],
    turn: 1,
    side: 0,
    first: $('first').value === 'player' ? 0 : 1,
    difficulty: $('difficulty').value,
    kills: [0, 0],
    produced: [],
    mode: m
  };

  let sites = [
    [1, 1],
    [w - 2, h - 2],
    [w - 3, 1],
    [2, h - 3],
    [Math.floor(w / 2) - 2, Math.floor(h / 2)],
    [Math.floor(w / 2) + 1, Math.floor(h / 2) - 1]
  ];

  sites.forEach(([x, y], i) => {
    let t = at(x, y);

    t.terrain = 'plain';
    t.city = true;
    t.capital = i < 2;

    t.owner =
      i === 0 ? 0 :
      i === 1 ? 1 :
      null;
  });

  for (let [x, y] of [
    [1, 1],
    [w - 2, h - 2]
  ]) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (
          inside(x + dx, y + dy) &&
          !at(x + dx, y + dy).city
        ) {
          at(x + dx, y + dy).terrain = 'plain';
        }
      }
    }
  }

  G.side = G.first;
  selected = null;

  showGame();

  if (G.side === 1) {
    aiTurn();
  } else {
    notify('青軍のターンです');
  }

  render();
}

function showGame() {
  $('setup').hidden = true;
  $('result').hidden = true;
  $('play').hidden = false;

  cv.width = G.w * CELL;
  cv.height = G.h * CELL;
}

function notify(s) {
  $('notice').textContent = s;
}

function color(owner) {
  return owner === 0 ? '#2563eb' :
         owner === 1 ? '#dc2626' :
         '#e5e7eb';
}

function drawSprite(u, px, py) {
  const c = color(u.owner);

  ctx.save();
  ctx.translate(px, py);
  ctx.imageSmoothingEnabled = false;

  const s = 2;

  const dot = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * s, y * s, w * s, h * s);
  };

  dot(3, 14, 10, 1, '#0005');

  if (u.type === 'cav') {
    dot(3, 8, 10, 5, '#76573e');
    dot(4, 12, 2, 3, '#513c30');
    dot(10, 12, 2, 3, '#513c30');
    dot(4, 5, 7, 4, '#76573e');
    dot(2, 7, 3, 4, '#a27b55');
    dot(6, 2, 5, 4, '#8f969c');
    dot(6, 6, 5, 2, '#d6a37c');
    dot(5, 8, 7, 2, c);
    dot(13, 2, 1, 11, '#c4cbd4');
  } else {
    dot(
      5, 2, 6, 4,
      u.type === 'arch' ? '#665342' : '#8e949b'
    );

    dot(5, 5, 6, 3, '#d6a37c');
    dot(6, 6, 1, 1, '#27272a');
    dot(9, 6, 1, 1, '#27272a');
    dot(3, 8, 10, 5, c);

    dot(
      5, 8, 6, 5,
      u.type === 'heavy' ? '#aeb7c0' :
      u.type === 'arch' ? '#776c56' :
      '#838b90'
    );

    dot(5, 13, 2, 2, '#514a43');
    dot(9, 13, 2, 2, '#514a43');

    if (u.type === 'shield') {
      dot(1, 8, 5, 6, '#aeb6c0');
      dot(2, 9, 3, 4, c);
    } else if (u.type === 'arch') {
      dot(12, 5, 1, 9, '#a77b45');
      dot(13, 5, 2, 1, '#a77b45');
      dot(13, 12, 2, 1, '#a77b45');
    } else if (u.type === 'axe') {
      dot(13, 4, 1, 10, '#785839');
      dot(11, 4, 4, 4, '#aeb7c0');
    } else {
      dot(
        13, 4,
        u.type === 'heavy' ? 2 : 1,
        10,
        '#b8c2cd'
      );

      dot(12, 4, 4, 2, '#b8c2cd');
    }
  }

  ctx.restore();
}

function render() {
  if (!G) return;

  ctx.clearRect(0, 0, cv.width, cv.height);

  const terrainColors = {
    plain: '#9eb88a',
    forest: '#54865b',
    mountain: '#898b91',
    river: '#4688b9',
    bridge: '#b6a078'
  };

  for (let y = 0; y < G.h; y++) {
    for (let x = 0; x < G.w; x++) {
      const t = at(x, y);
      const px = x * CELL;
      const py = y * CELL;

      ctx.fillStyle = terrainColors[t.terrain];
      ctx.fillRect(px, py, CELL, CELL);

      if (t.owner !== null) {
        ctx.fillStyle = color(t.owner) + '55';
        ctx.fillRect(px, py, CELL, CELL);
      }

      if (t.terrain === 'forest') {
        ctx.fillStyle = '#315f39';

        for (const [dx, dy] of [
          [12, 12],
          [29, 22],
          [16, 34]
        ]) {
          ctx.fillRect(px + dx, py + dy, 9, 9);
        }
      }

      if (t.terrain === 'mountain') {
        ctx.fillStyle = '#c6c8cc';
        ctx.beginPath();
        ctx.moveTo(px + 8, py + 36);
        ctx.lineTo(px + 24, py + 9);
        ctx.lineTo(px + 40, py + 36);
        ctx.fill();
      }

      if (t.terrain === 'bridge') {
        ctx.fillStyle = '#826b4c';
        ctx.fillRect(px + 5, py + 17, 38, 14);
      }

      if (t.city) {
        ctx.fillStyle = '#e2c48b';
        ctx.fillRect(px + 10, py + 18, 28, 23);

        ctx.fillStyle = '#805a43';
        ctx.fillRect(px + 7, py + 13, 34, 7);

        ctx.fillStyle = '#594432';
        ctx.fillRect(px + 21, py + 29, 7, 12);

        if (t.capital) {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(px + 21, py + 5, 7, 7);
        }
      }

      ctx.strokeStyle = '#00000033';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, CELL, CELL);
    }
  }

  if (selected) {
    const u = G.units.find(v => v.id === selected);

    if (u) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;

      ctx.strokeRect(
        u.x * CELL + 2,
        u.y * CELL + 2,
        CELL - 4,
        CELL - 4
      );
    }
  }

  for (const u of G.units) {
    const px = u.x * CELL;
    const py = u.y * CELL;

    ctx.save();

    if (u.owner === 0 && u.attacked) {
      ctx.globalAlpha = 0.55;
    }

    drawSprite(u, px + 8, py + 8);
    ctx.restore();

    const type = TYPES[u.type];
    const ratio = u.hp / type.hp;

    ctx.fillStyle = '#242424';
    ctx.fillRect(px + 5, py + 2, 38, 5);

    ctx.fillStyle =
      ratio > 0.5 ? '#4ade80' :
      ratio > 0.25 ? '#facc15' :
      '#ef4444';

    ctx.fillRect(px + 5, py + 2, 38 * ratio, 5);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;

    const hpText = u.hp + '/' + type.hp;

    ctx.strokeText(hpText, px + 24, py + 14);
    ctx.fillText(hpText, px + 24, py + 14);

    if (u.owner === 0 && u.attacked) {
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('✓', px + 39, py + 42);
    }
  }

  updateStats();
  updatePanel();
}

function updateStats() {
  if (!G) return;

  $('stats').textContent =
    'ターン ' + G.turn +
    ' ｜ 青 ★' + G.money[0] +
    ' ｜ 赤 ★' + G.money[1] +
    ' ｜ ' + (G.side === 0 ? '青軍' : '赤軍');
}

function selectedUnit() {
  if (!G || selected === null) return null;

  return G.units.find(u => u.id === selected) || null;
}

function terrainDefense(tile) {
  if (tile.terrain === 'forest') return 1;
  if (tile.terrain === 'mountain') return 2;
  return 0;
}

function passable(x, y) {
  if (!inside(x, y)) return false;

  return at(x, y).terrain !== 'river';
}

function findPath(unit, tx, ty) {
  if (!passable(tx, ty)) return null;

  const destination = unitAt(tx, ty);

  if (destination && destination.id !== unit.id) {
    return null;
  }

  const queue = [{
    x: unit.x,
    y: unit.y,
    path: []
  }];

  const seen = new Set([
    unit.x + ',' + unit.y
  ]);

  while (queue.length) {
    const current = queue.shift();

    if (current.x === tx && current.y === ty) {
      return current.path;
    }

    if (current.path.length >= TYPES[unit.type].mov) {
      continue;
    }

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = nx + ',' + ny;

      if (!passable(nx, ny) || seen.has(key)) {
        continue;
      }

      const occupant = unitAt(nx, ny);

      if (occupant && occupant.owner !== unit.owner) {
        continue;
      }

      seen.add(key);

      queue.push({
        x: nx,
        y: ny,
        path: current.path.concat([{
          x: nx,
          y: ny
        }])
      });
    }
  }

  return null;
}

function captureTile(unit) {
  const tile = at(unit.x, unit.y);

  if (tile.city) {
    tile.owner = unit.owner;
  } else {
    tile.owner = unit.owner;
  }
}

function moveUnit(unit, tx, ty) {
  if (unit.moved || unit.attacked) {
    return false;
  }

  const path = findPath(unit, tx, ty);

  if (!path || !path.length) {
    return false;
  }

  for (const step of path) {
    const occupant = unitAt(step.x, step.y);

    if (occupant && occupant.id !== unit.id) {
      if (step.x === tx && step.y === ty) {
        return false;
      }
    }

    unit.x = step.x;
    unit.y = step.y;

    const tile = at(step.x, step.y);

    if (!tile.city) {
      tile.owner = unit.owner;
    }
  }

  captureTile(unit);
  unit.moved = true;

  return true;
}

function canAttack(attacker, defender) {
  if (!attacker || !defender) return false;

  if (attacker.owner === defender.owner) {
    return false;
  }

  if (attacker.attacked) return false;

  return dist(attacker, defender) <=
    TYPES[attacker.type].range;
}

function dealDamage(attacker, defender) {
  const atk = TYPES[attacker.type].atk;
  const defense = terrainDefense(
    at(defender.x, defender.y)
  );

  const damage = Math.max(1, atk - defense);

  defender.hp -= damage;

  return damage;
}

function removeDead() {
  G.units = G.units.filter(u => {
    if (u.hp > 0) return true;

    G.kills[1 - u.owner]++;

    if (selected === u.id) {
      selected = null;
    }

    return false;
  });
}

function attackUnit(attacker, defender) {
  if (!canAttack(attacker, defender)) {
    return false;
  }

  const oldX = defender.x;
  const oldY = defender.y;

  const damage = dealDamage(attacker, defender);

  attacker.attacked = true;
  attacker.moved = true;

  notify(
    TYPES[attacker.type].name +
    'が' + damage + 'ダメージ！'
  );

  if (defender.hp > 0) {
    const counterRange = TYPES[defender.type].range;

    if (dist(attacker, defender) <= counterRange) {
      dealDamage(defender, attacker);
    }
  }

  const defeated = defender.hp <= 0;

  removeDead();

  if (
    defeated &&
    attacker.hp > 0 &&
    attacker.type !== 'arch' &&
    dist(attacker, {x: oldX, y: oldY}) === 1 &&
    !unitAt(oldX, oldY)
  ) {
    // 近接攻撃後の前進は次の部分で選択可能にする
    attacker.advance = {x: oldX, y: oldY};
  }

  checkVictory();
  return true;
}

function handleBoardTap(x, y) {
  if (!G || busy || G.side !== 0) return;
  if (!inside(x, y)) return;

  const target = unitAt(x, y);
  const current = selectedUnit();

  if (current && target && target.owner === 1) {
    if (attackUnit(current, target)) {
      render();
      return;
    }
  }

  if (target && target.owner === 0) {
    selected = target.id;
    render();
    return;
  }

  if (current && !target) {
    if (moveUnit(current, x, y)) {
      render();
      return;
    }
  }

  selected = null;
  render();
}

cv.addEventListener('click', event => {
  if (!G) return;

  const rect = cv.getBoundingClientRect();

  const x = Math.floor(
    (event.clientX - rect.left) *
    cv.width / rect.width / CELL
  );

  const y = Math.floor(
    (event.clientY - rect.top) *
    cv.height / rect.height / CELL
  );

  handleBoardTap(x, y);
});

let nextId = 1;

function createUnit(owner, type, x, y) {
  const info = TYPES[type];

  const unit = {
    id: nextId++,
    owner,
    type,
    x,
    y,
    hp: info.hp,
    moved: true,
    attacked: true
  };

  G.units.push(unit);
  return unit;
}

function produceUnit(owner, type, x, y) {
  if (!G || !inside(x, y)) return false;

  const tile = at(x, y);
  const info = TYPES[type];

  if (!tile.city || tile.owner !== owner) {
    return false;
  }

  if (unitAt(x, y)) return false;
  if (G.money[owner] < info.cost) return false;

  const key = x + ',' + y;

  if (G.produced.includes(key)) return false;

  G.money[owner] -= info.cost;
  G.produced.push(key);

  createUnit(owner, type, x, y);

  return true;
}

function updatePanel() {
  if (!G) return;

  const selection = $('selection');
  const actions = $('actions');

  actions.innerHTML = '';

  const u = selectedUnit();

  if (u) {
    const info = TYPES[u.type];

    selection.textContent =
      info.name +
      ' ｜ HP ' + u.hp + '/' + info.hp +
      ' ｜ 移動 ' + (u.moved ? '済' : '可') +
      ' ｜ 攻撃 ' + (u.attacked ? '済' : '可');

    if (u.owner === 0 && G.side === 0) {
      if (u.advance) {
        const button = document.createElement('button');

        button.textContent = '撃破地点へ前進';

        button.onclick = () => {
          const pos = u.advance;

          if (!unitAt(pos.x, pos.y)) {
            u.x = pos.x;
            u.y = pos.y;
            captureTile(u);
          }

          delete u.advance;
          render();
        };

        actions.appendChild(button);
      }

      const disband = document.createElement('button');

      disband.textContent = 'ユニットを解散';
      disband.className = 'secondary';

      disband.onclick = () => {
        G.units = G.units.filter(v => v.id !== u.id);
        selected = null;
        render();
      };

      actions.appendChild(disband);
    }

    return;
  }

  selection.textContent =
    'ユニットを選択するか、都市をタップしてください';
}

function showCityMenu(x, y) {
  if (!G || G.side !== 0) return;

  const tile = at(x, y);

  if (!tile.city || tile.owner !== 0) return;

  const selection = $('selection');
  const actions = $('actions');

  selection.textContent =
    tile.capital ? '首都：ユニット生産' :
                   '都市：ユニット生産';

  actions.innerHTML = '';

  for (const [key, info] of Object.entries(TYPES)) {
    const button = document.createElement('button');

    button.textContent =
      info.name + ' ★' + info.cost;

    button.disabled =
      G.money[0] < info.cost ||
      !!unitAt(x, y) ||
      G.produced.includes(x + ',' + y);

    button.onclick = () => {
      if (produceUnit(0, key, x, y)) {
        notify(info.name + 'を生産しました');
        render();
      }
    };

    actions.appendChild(button);
  }
}

// 都市タップ時の生産メニュー
const originalBoardTap = handleBoardTap;

handleBoardTap = function(x, y) {
  if (!G || busy || G.side !== 0) return;

  const tile = at(x, y);
  const occupant = unitAt(x, y);

  if (
    tile.city &&
    tile.owner === 0 &&
    !occupant &&
    !selectedUnit()
  ) {
    showCityMenu(x, y);
    return;
  }

  originalBoardTap(x, y);
};

function income(owner) {
  let amount = 0;
  let land = 0;

  for (const tile of G.tiles) {
    if (tile.owner !== owner) continue;

    land++;

    if (tile.city) {
      amount += tile.capital ? 3 : 2;
    }
  }

  amount += Math.floor(land / 5);

  return amount;
}

function beginTurn(owner) {
  if (!G) return;

  G.side = owner;
  G.produced = [];
  G.money[owner] += income(owner);

  for (const unit of G.units) {
    if (unit.owner !== owner) continue;

    unit.moved = false;
    unit.attacked = false;

    delete unit.advance;

    const tile = at(unit.x, unit.y);

    if (tile.city && tile.owner === owner) {
      const healing = tile.capital ? 4 : 3;
      const maxHp = TYPES[unit.type].hp;

      unit.hp = Math.min(maxHp, unit.hp + healing);
    }
  }

  selected = null;
  render();
}

function endTurn() {
  if (!G || busy || G.side !== 0) return;

  selected = null;
  beginTurn(1);
  saveGame();

  notify('赤軍が行動しています');

  aiTurn();
}

function aiTurn() {
  if (!G || G.side !== 1) return;

  busy = true;

  setTimeout(() => {
    if (!G) {
      busy = false;
      return;
    }

    const difficulty = G.difficulty;

    const cities = [];

    for (let y = 0; y < G.h; y++) {
      for (let x = 0; x < G.w; x++) {
        const tile = at(x, y);

        if (tile.city && tile.owner === 1) {
          cities.push({x, y});
        }
      }
    }

    // AIによるユニット生産
    for (const city of cities) {
      if (unitAt(city.x, city.y)) continue;

      let choices = Object.keys(TYPES).filter(
        type => TYPES[type].cost <= G.money[1]
      );

      if (!choices.length) continue;

      if (difficulty === 'hard') {
        choices.sort(
          (a, b) => TYPES[b].atk - TYPES[a].atk
        );
      } else if (difficulty === 'easy') {
        choices.sort(
          (a, b) => TYPES[a].cost - TYPES[b].cost
        );
      } else {
        choices.sort(
          (a, b) => TYPES[b].mov - TYPES[a].mov
        );
      }

      produceUnit(1, choices[0], city.x, city.y);
    }

    const aiUnits = G.units.filter(
      u => u.owner === 1 && !u.attacked
    );

    for (const unit of aiUnits) {
      if (!G) break;

      let enemies = G.units.filter(
        u => u.owner === 0
      );

      // 攻撃可能な敵を探す
      let targets = enemies.filter(
        enemy => canAttack(unit, enemy)
      );

      if (targets.length) {
        if (difficulty === 'hard') {
          targets.sort((a, b) => a.hp - b.hp);
        }

        attackUnit(unit, targets[0]);

        if (!G) break;
        continue;
      }

      // 未占領の都市へ向かう
      let goals = [];

      for (let y = 0; y < G.h; y++) {
        for (let x = 0; x < G.w; x++) {
          const tile = at(x, y);

          if (tile.city && tile.owner !== 1) {
            goals.push({x, y});
          }
        }
      }

      if (!goals.length) {
        goals = enemies.map(u => ({
          x: u.x,
          y: u.y
        }));
      }

      if (!goals.length) continue;

      goals.sort(
        (a, b) => dist(unit, a) - dist(unit, b)
      );

      const goal = goals[0];

      let best = null;
      let bestDistance = dist(unit, goal);

      for (let dy = -TYPES[unit.type].mov;
           dy <= TYPES[unit.type].mov;
           dy++) {
        for (let dx = -TYPES[unit.type].mov;
             dx <= TYPES[unit.type].mov;
             dx++) {

          const x = unit.x + dx;
          const y = unit.y + dy;

          if (!inside(x, y)) continue;
          if (unitAt(x, y)) continue;

          const path = findPath(unit, x, y);

          if (!path || !path.length) continue;

          const distance = dist({x, y}, goal);

          if (distance < bestDistance) {
            bestDistance = distance;
            best = {x, y};
          }
        }
      }

      if (best) {
        moveUnit(unit, best.x, best.y);
      }

      if (!G) break;

      enemies = G.units.filter(
        u => u.owner === 0
      );

      targets = enemies.filter(
        enemy => canAttack(unit, enemy)
      );

      if (targets.length) {
        attackUnit(unit, targets[0]);
      }
    }

    if (G) {
      G.turn++;
      beginTurn(0);
      saveGame();
      notify('青軍のターンです');
    }

    busy = false;
    render();
  }, 350);
}

function checkVictory() {
  if (!G) return;

  for (const winner of [0, 1]) {
    const loser = 1 - winner;

    const enemyCities = G.tiles.some(
      t => t.city && t.owner === loser
    );

    const enemyUnits = G.units.some(
      u => u.owner === loser
    );

    if (enemyCities || enemyUnits) continue;

    const finished = G;

    G = null;
    selected = null;

    localStorage.removeItem(saveKey);

    $('play').hidden = true;
    $('result').hidden = false;

    $('outcome').textContent =
      winner === 0 ?
      '青軍の勝利！' :
      '赤軍の勝利！';

    const blueCities = finished.tiles.filter(
      t => t.city && t.owner === 0
    ).length;

    const redCities = finished.tiles.filter(
      t => t.city && t.owner === 1
    ).length;

    $('summary').textContent =
      finished.turn + 'ターン ｜ ' +
      '撃破 青' + finished.kills[0] +
      '・赤' + finished.kills[1] +
      ' ｜ 都市 青' + blueCities +
      '・赤' + redCities;
  }
}

function saveGame() {
  if (!G) return;

  localStorage.setItem(
    saveKey,
    JSON.stringify({G, nextId})
  );
}

function loadGame() {
  const saved = localStorage.getItem(saveKey);

  if (!saved) {
    alert('保存データがありません');
    return;
  }

  try {
    const data = JSON.parse(saved);

    G = data.G;
    nextId = data.nextId;

    selected = null;
    busy = false;

    showGame();
    render();

    if (G.side === 1) {
      aiTurn();
    }
  } catch (error) {
    alert('保存データを読み込めませんでした');
  }
}

$('start').onclick = setup;

$('end').onclick = endTurn;

$('save').onclick = () => {
  saveGame();
  notify('保存しました');
};

$('load').onclick = loadGame;

$('new').onclick = () => {
  if (confirm('新しい対戦を始めますか？')) {
    G = null;
    selected = null;
    busy = false;

    $('play').hidden = true;
    $('setup').hidden = false;
  }
};

$('again').onclick = () => {
  $('result').hidden = true;
  $('setup').hidden = false;
};
