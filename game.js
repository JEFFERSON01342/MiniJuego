const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const backgroundMusic = document.querySelector('#background-music');
const musicToggle = document.querySelector('#music-toggle');
const themeToggle = document.querySelector('#theme-toggle');
const entityScale = 2;
const enemyHealthMultipliers = { enemy: 1, enemy1: 2.5, enemy2: 1.5, enemyB: 2 };
const enemiesPerWave = 100;
const totalEnemiesToWin = 2000;
const totalWaves = totalEnemiesToWin / enemiesPerWave;
const specialWeaponDuration = 15000;
const playerNames = { player: 'KATZU', player1: 'TURRON', player2: 'JALEA' };
const playerSelectionSounds = {
  player1: new Audio('assets/audio/player1.MP3'),
  player2: new Audio('assets/audio/player2.MP3')
};
Object.values(playerSelectionSounds).forEach((sound) => { sound.preload = 'auto'; });

const state = {
  width: 0,
  height: 0,
  scale: 1,
  player: { x: 0, y: 0, radius: 22 * entityScale },
  bullets: [],
  segments: [],
  path: [],
  pathLengths: [],
  pathTotal: 0,
  wormDistance: 0,
  segmentSpacing: 28 * entityScale,
  pointerX: 0,
  lastShot: 0,
  damage: 1,
  fireRate: 0,
  bulletCount: 1,
  weapon: 'normal',
  selectedWeapon: 'normal',
  playerSkin: 'player',
  projectileSkin: 'flor',
  weaponTimer: 0,
  lastFrame: 0,
  score: 0,
  gameOver: false,
  gameWon: false,
  wave: 1,
  enemySpeedBoost: 0,
  initialSpeedBoost: 0,
  bonusChoices: null,
  skins: {}
};

const skinFiles = {
  background: 'assets/skins/background.jpg',
  player: 'assets/skins/player.png',
  player1: 'assets/skins/player1.png',
  player2: 'assets/skins/player2.png',
  flor: 'assets/skins/flor.png',
  turron: 'assets/skins/turron.png',
  huevo: 'assets/skins/huevo.png',
  enemy: 'assets/skins/enemy.png',
  enemy1: 'assets/skins/enemy1.png',
  enemy2: 'assets/skins/enemy2.png',
  enemyB: 'assets/skins/enemyB.png',
  enemydefeat: 'assets/skins/enemydefeat.png'
};

function loadSkins() {
  for (const [skinName, file] of Object.entries(skinFiles)) {
    const image = new Image();
    image.src = file;
    state.skins[skinName] = image;
  }
}

function drawSkin(skinName, x, y, radius) {
  const image = state.skins[skinName];
  if (!image || !image.complete || image.naturalWidth === 0) return false;
  ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
  return true;
}

function resize() {
  const bounds = canvas.getBoundingClientRect();
  state.scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(bounds.width * state.scale);
  canvas.height = Math.floor(bounds.height * state.scale);
  state.width = bounds.width;
  state.height = bounds.height;
  ctx.setTransform(state.scale, 0, 0, state.scale, 0, 0);
  state.player.y = state.height - state.player.radius - 12;
  state.pointerX = state.pointerX || state.width / 2;
  state.player.x = Math.max(state.player.radius, Math.min(state.width - state.player.radius, state.pointerX));
  createPath();
}

function createPath() {
  const points = [
    [0.50, -0.05], [0.72, -0.02], [0.93, 0.12], [0.95, 0.22],
    [0.84, 0.28], [0.58, 0.30], [0.32, 0.28], [0.10, 0.32],
    [0.07, 0.40], [0.22, 0.47], [0.48, 0.48], [0.75, 0.47],
    [0.90, 0.52], [0.94, 0.62], [0.82, 0.68], [0.58, 0.69],
    [0.32, 0.68], [0.12, 0.72], [0.11, 0.82], [0.28, 0.89],
    [0.52, 0.88], [0.66, 0.83], [0.61, 0.76], [0.42, 0.75]
  ];
  state.path = points.map(([x, y]) => ({ x: x * state.width, y: y * state.height }));
  state.pathLengths = [0];
  for (let index = 1; index < state.path.length; index += 1) {
    const previous = state.path[index - 1];
    const current = state.path[index];
    state.pathLengths[index] = state.pathLengths[index - 1] + Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  state.pathTotal = state.pathLengths[state.pathLengths.length - 1];
}

function pointOnPath(distance) {
  if (distance <= 0) {
    const start = state.path[0];
    return { x: start.x, y: start.y - Math.abs(distance) };
  }
  const clampedDistance = Math.min(distance, state.pathTotal);
  let index = 1;
  while (index < state.pathLengths.length && state.pathLengths[index] < clampedDistance) index += 1;
  const start = state.path[index - 1];
  const end = state.path[index] || start;
  const sectionLength = state.pathLengths[index] - state.pathLengths[index - 1] || 1;
  const progress = (clampedDistance - state.pathLengths[index - 1]) / sectionLength;
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress
  };
}

function createWorm() {
  const segmentCount = enemiesPerWave;
  const spacing = state.segmentSpacing;
  const defeatedEnemies = state.score / 10;
  const baseHealth = 1 + Math.floor(defeatedEnemies / 10) * 1.5;

  state.wormDistance = -55;
  state.segments = Array.from({ length: segmentCount }, (_, index) => {
    const typeSequence = [
      'enemy', 'enemy', 'enemy1', 'enemy', 'enemy2', 'enemy', 'enemy',
      'enemy1', 'enemy', 'enemy2', 'enemy', 'enemy', 'enemy', 'enemyB'
    ];
    const type = typeSequence[index % typeSequence.length];
    const health = baseHealth * enemyHealthMultipliers[type];
    return {
      x: state.width / 2,
      y: -35,
      radius: { enemy: 15, enemy1: 21, enemy2: 17, enemyB: 19 }[type] * entityScale,
      health,
      maxHealth: health,
      shield: type === 'enemy2' ? health * 0.75 : 0,
      maxShield: type === 'enemy2' ? health * 0.75 : 0,
      shieldCooldown: 0,
      type,
      distance: -index * spacing,
      alive: true,
      phase: index * 0.35
    };
  });
}

function reset() {
  state.bullets = [];
  state.score = 0;
  state.damage = 1;
  state.fireRate = 0;
  state.bulletCount = 1;
  state.selectedWeapon = 'normal';
  state.weapon = 'normal';
  state.weaponTimer = 0;
  state.lastShot = 0;
  state.gameOver = false;
  state.gameWon = false;
  state.wave = 1;
  state.enemySpeedBoost = 0;
  state.initialSpeedBoost = 5;
  state.bonusChoices = null;
  document.querySelector('#bonus-menu').hidden = true;
  state.player.x = state.width / 2;
  createWorm();
}

function setPointer(clientX) {
  const bounds = canvas.getBoundingClientRect();
  state.pointerX = clientX - bounds.left;
}

function weaponDamage(weapon) {
  const extraDamage = Math.max(0, state.damage - 1);
  if (weapon === 'laser') return state.damage * (2 + extraDamage);
  if (weapon === 'bomb') return state.damage * (3 + extraDamage * 1.5);
  if (weapon === 'cuts') return state.damage * (1.5 + extraDamage * 0.75);
  return state.damage;
}

function shoot(time, forced = false, origin = null) {
  const shotInterval = Math.max(180, 1280 / (1 + state.fireRate));
  if (state.weapon === 'cuts' && !forced) return;
  if (time - state.lastShot < shotInterval || state.gameOver || state.gameWon) return;
  state.lastShot = time;
  if (state.weapon === 'laser') {
    state.bullets.push({ x: state.player.x, y: state.player.y - 18 * entityScale, radius: 8 * entityScale, speed: 700, damage: weaponDamage('laser'), laser: true });
    return;
  }
  if (state.weapon === 'bomb') {
    state.bullets.push({ x: state.player.x, y: state.player.y - 18 * entityScale, radius: 7 * entityScale, speed: 230, damage: weaponDamage('bomb'), bomb: true });
    return;
  }
  if (state.weapon === 'cuts') {
    const cutOrigin = origin || { x: state.player.x, y: state.player.y - 18 * entityScale };
    const cutCount = 5;
    for (let index = 0; index < cutCount; index += 1) {
      const angle = Math.random() * Math.PI;
      const distance = 20 + Math.random() * 75;
      const positionAngle = Math.random() * Math.PI * 2;
      state.bullets.push({
        x: cutOrigin.x + Math.cos(positionAngle) * distance,
        y: cutOrigin.y + Math.sin(positionAngle) * distance,
        originX: cutOrigin.x,
        originY: cutOrigin.y,
        radius: 24 * entityScale,
        angle,
        age: 0,
        delay: index * 120,
        life: 700,
        damage: weaponDamage('cuts'),
        cut: true
      });
    }
    return;
  }
  const spread = 0.12;
  for (let index = 0; index < state.bulletCount; index += 1) {
    const offset = index - (state.bulletCount - 1) / 2;
    state.bullets.push({
      x: state.player.x,
      y: state.player.y - 18 * entityScale,
      radius: 5 * entityScale,
      speed: 430,
      drift: offset * spread,
      damage: state.damage,
      projectileSkin: state.projectileSkin
    });
  }
}

function applyBonus(bonus) {
  state.damage += bonus.damage || 0;
  state.fireRate += bonus.fireRate || 0;
  state.bulletCount += bonus.bulletCount || 0;
  if (bonus.weapon) {
    state.weapon = bonus.weapon;
    state.weaponTimer = specialWeaponDuration;
  }
}

function destroySegment(segment) {
  if (!segment.alive) return;
  const previousTier = Math.floor(state.score / 100);
  segment.alive = false;
  state.wormDistance -= state.segmentSpacing;
  state.score += 10;
  if (state.score / 10 >= totalEnemiesToWin) {
    state.gameWon = true;
    state.bonusChoices = null;
    document.querySelector('#bonus-menu').hidden = true;
    return;
  }
  const currentTier = Math.floor(state.score / 100);
  if (currentTier > previousTier) {
    const healthIncrease = (currentTier - previousTier) * 1.5;
    state.enemySpeedBoost = 3;
    for (const remainingSegment of state.segments) {
      if (!remainingSegment.alive) continue;
      const increase = healthIncrease * enemyHealthMultipliers[remainingSegment.type];
      remainingSegment.maxHealth += increase;
      remainingSegment.health += increase;
    }
  }
  if (segment.type === 'enemyB') {
    showBonusChoices();
  }
}

function getBonusChoices() {
  const normalBonuses = [
    { damage: 0.15, label: '+15% dano', rarity: 'green' },
    { fireRate: 0.2, label: '+20% cadencia', rarity: 'green' }
  ];
  const statisticBonuses = [
    { damage: 0.35, label: '+35% dano', rarity: 'blue' },
    { fireRate: 0.45, label: '+45% cadencia', rarity: 'blue' }
  ];
  const bundleBonuses = [
    { damage: 0.2, fireRate: 0.25, bulletCount: 1, label: '+20% dano, +25% cadencia y +1 bala', rarity: 'silver' },
    { damage: 0.3, bulletCount: 2, label: '+30% dano y +2 balas', rarity: 'silver' }
  ];
  const specialWeapons = [
    { weapon: 'laser', label: 'Arma: Laser', rarity: 'gold' },
    { weapon: 'bomb', label: 'Arma: Bombas', rarity: 'gold' },
    { weapon: 'cuts', label: 'Arma: Cortes', rarity: 'gold' }
  ];
  const pick = (bonuses) => bonuses[Math.floor(Math.random() * bonuses.length)];
  const pickByRarity = () => {
    const roll = Math.random();
    if (roll < 0.7) return pick(normalBonuses);
    if (roll < 0.93) return pick(statisticBonuses);
    if (roll < 0.99) return pick(bundleBonuses);
    return pick(specialWeapons);
  };
  return [pickByRarity(), pickByRarity(), pickByRarity()];
}

function showBonusChoices() {
  state.bonusChoices = [
    { type: 'damage', label: '+15% daño' },
    { type: 'fireRate', label: '+20% cadencia' },
    { type: 'bulletCount', label: '+1 proyectil' },
    { type: 'weapon', weapon: 'laser', label: 'Arma: Laser' },
    { type: 'weapon', weapon: 'bomb', label: 'Arma: Bombas' },
    { type: 'weapon', weapon: 'cuts', label: 'Arma: Cortes' }
  ].sort(() => Math.random() - 0.5).slice(0, 3);
  state.bonusChoices = getBonusChoices();
  const bonusMenu = document.querySelector('#bonus-menu');
  bonusMenu.innerHTML = '<h2>Elige una bonificación</h2>';
  for (const bonus of state.bonusChoices) {
    const button = document.createElement('button');
    button.textContent = bonus.label;
    button.classList.add(`bonus-${bonus.rarity}`);
    button.addEventListener('click', () => {
      applyBonus(bonus);
      state.bonusChoices = null;
      bonusMenu.hidden = true;
    });
    bonusMenu.appendChild(button);
  }
  bonusMenu.hidden = false;
}

function update(delta, time) {
  if (state.bonusChoices || state.gameWon) return;
  state.enemySpeedBoost = Math.max(0, state.enemySpeedBoost - delta);
  state.initialSpeedBoost = Math.max(0, state.initialSpeedBoost - delta);
  state.player.x += (state.pointerX - state.player.x) * Math.min(1, delta * 14);
  state.player.x = Math.max(state.player.radius, Math.min(state.width - state.player.radius, state.player.x));
  shoot(time);

  for (const bullet of state.bullets) {
    if (bullet.cut) {
      bullet.age += delta * 1000;
    } else {
      bullet.y -= bullet.speed * delta;
      bullet.x += (bullet.drift || 0) * bullet.speed * delta;
    }
  }
  state.bullets = state.bullets.filter((bullet) => (
    !bullet.hit &&
    (bullet.cut ? bullet.age < bullet.delay + bullet.life : bullet.y > -10)
  ));

  if (!state.gameOver && !state.gameWon) {
    state.weaponTimer -= delta * 1000;
    if (state.weaponTimer <= 0) {
      state.weapon = state.selectedWeapon;
      state.weaponTimer = 0;
    }
  }

  const liveSegments = state.segments.filter((segment) => segment.alive);
  if (!state.gameOver && !state.gameWon) {
    const speedMultiplier = state.initialSpeedBoost > 0 ? 10.8 : state.enemySpeedBoost > 0 ? 3.6 : 1;
    const wormSpeed = ((42 + Math.min(14, state.score * 0.01)) / 4) * speedMultiplier;
    state.wormDistance += wormSpeed * delta;
    liveSegments.forEach((segment, index) => {
      const targetDistance = state.wormDistance - index * state.segmentSpacing;
      segment.distance += (targetDistance - segment.distance) * Math.min(1, delta * 10);
      const position = pointOnPath(segment.distance);
      segment.x = position.x;
      segment.y = position.y;
      if (segment.type === 'enemy2') {
        segment.shieldCooldown = Math.max(0, segment.shieldCooldown - delta);
        if (segment.shieldCooldown === 0) {
          segment.shield = Math.min(segment.maxShield, segment.shield + segment.maxShield * delta * 0.35);
        }
      }
      if (Math.hypot(segment.x - state.player.x, segment.y - state.player.y) < segment.radius + state.player.radius) {
        state.gameOver = true;
      }
    });
  }

  for (const bullet of state.bullets) {
    if (bullet.cut && bullet.age < bullet.delay) continue;
    for (const segment of state.segments) {
      if (!segment.alive || bullet.hit) continue;
      const hitsCut = bullet.cut && (
        Math.hypot(bullet.x - segment.x, bullet.y - segment.y) < bullet.radius + segment.radius ||
        Math.hypot(bullet.originX - segment.x, bullet.originY - segment.y) < 28 * entityScale + segment.radius
      );
      const hitsBullet = Math.hypot(bullet.x - segment.x, bullet.y - segment.y) < bullet.radius + segment.radius;
      if (hitsCut || hitsBullet) {
        let damage = bullet.damage || state.damage;
        if (segment.shield > 0) {
          const absorbed = Math.min(segment.shield, damage);
          segment.shield -= absorbed;
          segment.shieldCooldown = 1.2;
          damage -= absorbed;
        }
        segment.health -= damage;
        bullet.hit = true;
        if (bullet.bomb) {
          for (const nearbySegment of state.segments) {
            if (nearbySegment.alive && Math.hypot(bullet.x - nearbySegment.x, bullet.y - nearbySegment.y) < 48 * entityScale) {
              nearbySegment.health -= bullet.damage || state.damage;
              if (nearbySegment.health <= 0) {
                destroySegment(nearbySegment);
              }
            }
          }
        }
        if (segment.health <= 0) {
          destroySegment(segment);
        }
      }
    }
  }

  if (state.segments.every((segment) => !segment.alive) && !state.gameWon) {
    if (state.wave >= totalWaves) state.gameWon = true;
    else {
      state.wave += 1;
      createWorm();
    }
  }
}

function drawBackground() {
  ctx.fillStyle = '#080b10';
  ctx.fillRect(0, 0, state.width, state.height);
  const background = state.skins.background;
  if (background?.complete && background.naturalWidth > 0) {
    const scale = Math.max(state.width / background.naturalWidth, state.height / background.naturalHeight);
    const width = background.naturalWidth * scale;
    const height = background.naturalHeight * scale;
    ctx.drawImage(background, (state.width - width) / 2, (state.height - height) / 2, width, height);
  }
}

function draw() {
  drawBackground();

  for (const segment of state.segments) {
    if (!segment.alive) continue;
    if (!drawSkin(segment.type, segment.x, segment.y, segment.radius)) {
      ctx.fillStyle = '#b94652';
      ctx.beginPath();
      ctx.arc(segment.x, segment.y, segment.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f07069';
      ctx.stroke();
    }
    if (segment.shield > 0) {
      ctx.strokeStyle = '#6cc9ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(segment.x, segment.y, segment.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.fillStyle = '#11151a';
    const healthBarWidth = 20;
    ctx.fillRect(segment.x - healthBarWidth / 2, segment.y - segment.radius - 8, healthBarWidth, 3);
    ctx.fillStyle = '#6be0a0';
    ctx.fillRect(segment.x - healthBarWidth / 2, segment.y - segment.radius - 8, healthBarWidth * (segment.health / segment.maxHealth), 3);
    if (segment.shield > 0) {
      ctx.fillStyle = '#6cc9ff';
      ctx.fillRect(segment.x - healthBarWidth / 2, segment.y - segment.radius - 4, healthBarWidth * (segment.shield / (segment.maxHealth * 2)), 2);
    }
  }

  if (state.weapon === 'laser') {
    const beamX = state.player.x;
    const beamStart = state.player.y - state.player.radius;
    const beamEnd = 0;
    ctx.strokeStyle = 'rgba(255, 40, 40, 0.3)';
    ctx.lineWidth = 10 * entityScale;
    ctx.beginPath();
    ctx.moveTo(beamX, beamStart);
    ctx.lineTo(beamX, beamEnd);
    ctx.stroke();
    ctx.strokeStyle = '#ff3030';
    ctx.lineWidth = 4 * entityScale;
    ctx.beginPath();
    ctx.moveTo(beamX, beamStart);
    ctx.lineTo(beamX, beamEnd);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  for (const bullet of state.bullets) {
    if (bullet.laser) {
      continue;
    }
    if (bullet.cut) {
      const visibleAge = bullet.age - bullet.delay;
      const appearProgress = Math.min(1, visibleAge / 120);
      const fadeProgress = Math.min(1, (bullet.life - visibleAge) / 180);
      const opacity = Math.max(0, Math.min(1, fadeProgress));
      const slashLength = 60 * (0.35 + appearProgress * 0.65);
      const halfLengthX = Math.cos(bullet.angle) * slashLength / 2;
      const halfLengthY = Math.sin(bullet.angle) * slashLength / 2;
      const crossHalfLengthX = Math.cos(bullet.angle + Math.PI / 2) * slashLength / 2;
      const crossHalfLengthY = Math.sin(bullet.angle + Math.PI / 2) * slashLength / 2;
      ctx.strokeStyle = `rgba(240, 140, 255, ${opacity})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bullet.x - halfLengthX, bullet.y - halfLengthY);
      ctx.lineTo(bullet.x + halfLengthX, bullet.y + halfLengthY);
      ctx.moveTo(bullet.x - crossHalfLengthX, bullet.y - crossHalfLengthY);
      ctx.lineTo(bullet.x + crossHalfLengthX, bullet.y + crossHalfLengthY);
      ctx.stroke();
      ctx.lineWidth = 1;
      continue;
    }
    if (drawSkin(bullet.projectileSkin, bullet.x, bullet.y, bullet.radius * 2.5)) {
      continue;
    }
    ctx.fillStyle = bullet.laser ? '#55e8f2' : bullet.bomb ? '#e88955' : bullet.cut ? '#d779e8' : '#65d8e8';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!drawSkin(state.playerSkin, state.player.x, state.player.y, state.player.radius)) {
    ctx.fillStyle = '#70e5b3';
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c0ffe2';
    ctx.stroke();
  }

  ctx.fillStyle = '#d8e5ef';
  ctx.font = '14px monospace';
  ctx.fillText(`Puntos: ${state.score}`, 12, 22);
  ctx.fillText(`Jugador: ${playerNames[state.playerSkin]}`, 12, 122);
  ctx.fillText(`Daño: ${state.damage.toFixed(2)}  Cadencia: +${Math.round(state.fireRate * 100)}%  Balas: ${state.bulletCount}`, 12, 42);
  if (state.weapon !== 'normal') ctx.fillText(`Arma: ${state.weapon} (${Math.ceil(state.weaponTimer / 1000)}s)`, 12, 62);
  ctx.fillText(`Oleada: ${state.wave}/${totalWaves}`, 12, 82);
  if (state.enemySpeedBoost > 0) ctx.fillText(`Velocidad enemiga aumentada: ${state.enemySpeedBoost.toFixed(1)}s`, 12, 102);
  if (state.gameOver || state.gameWon) {
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '22px monospace';
    const messageY = state.gameWon ? state.height / 2 + 115 : state.height / 2;
    if (state.gameWon) {
      const victoryImage = state.skins.enemydefeat;
      if (victoryImage?.complete && victoryImage.naturalWidth > 0) {
        const imageSize = 180;
        ctx.drawImage(victoryImage, state.width / 2 - imageSize / 2, state.height / 2 - 145, imageSize, imageSize);
      }
    }
    ctx.fillText(state.gameWon ? 'VICTORIA' : 'GAME OVER', state.width / 2, messageY);
    ctx.font = '14px monospace';
    ctx.fillText('Haz clic para reiniciar', state.width / 2, messageY + 26);
    ctx.textAlign = 'left';
  }
}

function frame(time) {
  const delta = Math.min(0.033, (time - state.lastFrame) / 1000 || 0);
  state.lastFrame = time;
  update(delta, time);
  draw();
  requestAnimationFrame(frame);
}

function startMusic() {
  if (!backgroundMusic.muted) backgroundMusic.play().catch(() => {});
}

musicToggle.addEventListener('click', () => {
  backgroundMusic.muted = !backgroundMusic.muted;
  if (!backgroundMusic.muted) startMusic();
  musicToggle.textContent = backgroundMusic.muted ? 'Activar musica' : 'Silenciar musica';
});

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  themeToggle.textContent = document.body.classList.contains('light-theme') ? 'Modo oscuro' : 'Modo claro';
});

canvas.addEventListener('pointermove', (event) => setPointer(event.clientX));
canvas.addEventListener('pointerdown', (event) => {
  startMusic();
  setPointer(event.clientX);
  if (state.gameOver || state.gameWon) reset();
  else if (state.weapon === 'cuts') {
    const bounds = canvas.getBoundingClientRect();
    shoot(performance.now(), true, {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    });
  }
});

document.querySelectorAll('.skin-option').forEach((button) => {
  button.addEventListener('click', () => {
    state.playerSkin = button.dataset.skin;
    state.projectileSkin = {
      player: 'flor',
      player1: 'turron',
      player2: 'huevo'
    }[state.playerSkin];
    if (state.playerSkin === 'player1' || state.playerSkin === 'player2') {
      const selectionSound = playerSelectionSounds[state.playerSkin];
      selectionSound.currentTime = 0;
      selectionSound.play().catch(() => {});
    }
    document.querySelectorAll('.skin-option').forEach((option) => option.classList.remove('selected'));
    button.classList.add('selected');
  });
});

window.addEventListener('resize', resize);

resize();
loadSkins();
reset();
requestAnimationFrame(frame);
