const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

const state = {
  width: 0,
  height: 0,
  scale: 1,
  player: { x: 0, y: 0, radius: 15 },
  bullets: [],
  segments: [],
  path: [],
  pathLengths: [],
  pathTotal: 0,
  wormDistance: 0,
  segmentSpacing: 22,
  pointerX: 0,
  lastShot: 0,
  damage: 1,
  fireRate: 0,
  bulletCount: 1,
  weapon: 'normal',
  weaponTimer: 0,
  lastFrame: 0,
  score: 0,
  gameOver: false
};

function resize() {
  const bounds = canvas.getBoundingClientRect();
  state.scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(bounds.width * state.scale);
  canvas.height = Math.floor(bounds.height * state.scale);
  state.width = bounds.width;
  state.height = bounds.height;
  ctx.setTransform(state.scale, 0, 0, state.scale, 0, 0);
  state.player.y = state.height - 38;
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
  const segmentCount = 200;
  const spacing = state.segmentSpacing;
  const baseHealth = 5 + Math.floor(state.score / 50);

  state.wormDistance = -55;
  state.segments = Array.from({ length: segmentCount }, (_, index) => {
    const sequence = ['green', 'green', 'silver', 'silver', 'gold', 'gold', 'purple'];
    const variant = sequence[index % sequence.length];
    const health = baseHealth;
    return {
      x: state.width / 2,
      y: -35,
      radius: 12,
      health,
      maxHealth: health,
      shield: 0,
      variant,
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
  state.weapon = 'normal';
  state.weaponTimer = 0;
  state.lastShot = 0;
  state.gameOver = false;
  state.player.x = state.width / 2;
  createWorm();
}

function setPointer(clientX) {
  const bounds = canvas.getBoundingClientRect();
  state.pointerX = clientX - bounds.left;
}

function shoot(time, forced = false, origin = null) {
  const shotInterval = Math.max(180, 1280 / (1 + state.fireRate));
  if (state.weapon === 'cuts' && !forced) return;
  if (time - state.lastShot < shotInterval || state.gameOver) return;
  state.lastShot = time;
  if (state.weapon === 'laser') {
    state.bullets.push({ x: state.player.x, y: state.player.y - 18, radius: 8, speed: 700, damage: state.damage * 2, laser: true });
    return;
  }
  if (state.weapon === 'bomb') {
    state.bullets.push({ x: state.player.x, y: state.player.y - 18, radius: 7, speed: 230, damage: state.damage * 3, bomb: true });
    return;
  }
  if (state.weapon === 'cuts') {
    const cutOrigin = origin || { x: state.player.x, y: state.player.y - 18 };
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
        radius: 24,
        angle,
        age: 0,
        delay: index * 120,
        life: 700,
        damage: state.damage,
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
      y: state.player.y - 18,
      radius: 3,
      speed: 430,
      drift: offset * spread,
      damage: state.damage
    });
  }
}

function applyBonus(variant) {
  const bonus = {
    green: { fireRate: 0.05, damage: 0.01 },
    silver: { fireRate: 0.10, damage: 0.02 },
    gold: { fireRate: 0.20, damage: 0.05 },
    purple: { fireRate: 0.35, damage: 0.10, bulletCount: 1 }
  }[variant];
  if (!bonus) return;
  state.fireRate += bonus.fireRate;
  state.damage += bonus.damage;
  state.bulletCount += bonus.bulletCount || 0;
  if (variant === 'purple') {
    const weapons = ['laser', 'bomb', 'cuts'];
    state.weapon = weapons[Math.floor(Math.random() * weapons.length)];
    state.weaponTimer = variant === 'purple' ? 20000 : 12000;
  }
}

function destroySegment(segment) {
  if (!segment.alive) return;
  segment.alive = false;
  state.wormDistance -= state.segmentSpacing;
  state.score += 10;
  applyBonus(segment.variant);
}

function update(delta, time) {
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

  if (!state.gameOver) {
    state.weaponTimer -= delta * 1000;
    if (state.weaponTimer <= 0) state.weapon = 'normal';
  }

  const liveSegments = state.segments.filter((segment) => segment.alive);
  if (!state.gameOver) {
    const wormSpeed = 42 + Math.min(14, state.score * 0.01);
    state.wormDistance += wormSpeed * delta;
    liveSegments.forEach((segment, index) => {
      const targetDistance = state.wormDistance - index * state.segmentSpacing;
      segment.distance += (targetDistance - segment.distance) * Math.min(1, delta * 10);
      const position = pointOnPath(segment.distance);
      segment.x = position.x;
      segment.y = position.y;
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
        Math.hypot(bullet.originX - segment.x, bullet.originY - segment.y) < 28 + segment.radius
      );
      const hitsBullet = Math.hypot(bullet.x - segment.x, bullet.y - segment.y) < bullet.radius + segment.radius;
      if (hitsCut || hitsBullet) {
        let damage = bullet.damage || state.damage;
        if (segment.shield > 0) {
          const absorbed = Math.min(segment.shield, damage);
          segment.shield -= absorbed;
          damage -= absorbed;
        }
        segment.health -= damage;
        bullet.hit = true;
        if (bullet.bomb) {
          for (const nearbySegment of state.segments) {
            if (nearbySegment.alive && Math.hypot(bullet.x - nearbySegment.x, bullet.y - nearbySegment.y) < 48) {
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

  if (state.segments.every((segment) => !segment.alive)) createWorm();
}

function drawBackground() {
  ctx.fillStyle = '#080b10';
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.strokeStyle = '#111a23';
  ctx.lineWidth = 1;
  for (let x = 0; x < state.width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, state.height);
    ctx.stroke();
  }
  for (let y = 0; y < state.height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }
}

function draw() {
  drawBackground();

  for (const segment of state.segments) {
    if (!segment.alive) continue;
    const colors = {
      normal: '#b94652',
      green: '#54bd78',
      silver: '#b9c4d0',
      gold: '#e1b84d',
      purple: '#a76bda'
    };
    ctx.fillStyle = colors[segment.variant];
    ctx.beginPath();
    ctx.arc(segment.x, segment.y, segment.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = segment.variant === 'normal' ? '#f07069' : '#ffffff';
    ctx.stroke();
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
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(beamX, beamStart);
    ctx.lineTo(beamX, beamEnd);
    ctx.stroke();
    ctx.strokeStyle = '#ff3030';
    ctx.lineWidth = 4;
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
    ctx.fillStyle = bullet.laser ? '#55e8f2' : bullet.bomb ? '#e88955' : bullet.cut ? '#d779e8' : '#65d8e8';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#70e5b3';
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c0ffe2';
  ctx.stroke();

  ctx.fillStyle = '#d8e5ef';
  ctx.font = '14px monospace';
  ctx.fillText(`Puntos: ${state.score}`, 12, 22);
  ctx.fillText(`Daño: ${state.damage.toFixed(2)}  Cadencia: +${Math.round(state.fireRate * 100)}%  Balas: ${state.bulletCount}`, 12, 42);
  if (state.weapon !== 'normal') ctx.fillText(`Arma: ${state.weapon} (${Math.ceil(state.weaponTimer / 1000)}s)`, 12, 62);
  if (state.gameOver) {
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '22px monospace';
    ctx.fillText('GAME OVER', state.width / 2, state.height / 2);
    ctx.font = '14px monospace';
    ctx.fillText('Haz clic para reiniciar', state.width / 2, state.height / 2 + 26);
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

canvas.addEventListener('pointermove', (event) => setPointer(event.clientX));
canvas.addEventListener('pointerdown', (event) => {
  setPointer(event.clientX);
  if (state.gameOver) reset();
  else if (state.weapon === 'cuts') {
    const bounds = canvas.getBoundingClientRect();
    shoot(performance.now(), true, {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    });
  }
});
window.addEventListener('resize', resize);

resize();
reset();
requestAnimationFrame(frame);