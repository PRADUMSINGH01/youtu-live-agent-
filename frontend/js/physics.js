// High-Performance Spatial Grid Physics Engine with Enhanced Visibility & Combat FX
class SpatialHashGrid {
  constructor(cellSize = 40) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  key(cellX, cellY) {
    return (cellX & 0xFFFF) << 16 | (cellY & 0xFFFF);
  }

  insert(entity) {
    const cellX = Math.floor(entity.x / this.cellSize);
    const cellY = Math.floor(entity.y / this.cellSize);
    const k = this.key(cellX, cellY);
    let list = this.grid.get(k);
    if (!list) {
      list = [];
      this.grid.set(k, list);
    }
    list.push(entity);
  }

  getNearby(entity) {
    const cellX = Math.floor(entity.x / this.cellSize);
    const cellY = Math.floor(entity.y / this.cellSize);
    const nearby = [];

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        const list = this.grid.get(this.key(cellX + x, cellY + y));
        if (list) {
          for (let i = 0; i < list.length; i++) {
            nearby.push(list[i]);
          }
        }
      }
    }
    return nearby;
  }
}

export class BattlePhysics {
  constructor(config = {}) {
    this.width = config.width || 1280;
    this.height = config.height || 720;
    this.cx = this.width / 2;
    this.cy = this.height / 2;
    this.baseArenaRadius = config.arenaRadius || 335;
    this.arenaRadius = this.baseArenaRadius;
    this.flagRadius = 16.5; // Larger radius for crisp visibility

    this.flags = [];
    this.particles = [];
    this.confetti = [];
    this.floatingTexts = [];
    this.eliminated = [];
    this.aliveCount = 0;
    this.winner = null;
    this.pinnedFlagId = null;
    this.hoveredFlagId = null;

    this.grid = new SpatialHashGrid(40);

    // Arena Hazards
    this.hazards = {
      centralBlade: {
        active: true,
        x: this.cx,
        y: this.cy,
        radius: 82,
        bladeCount: 8,
        angle: 0,
        speed: 0.045,
      },
      orbitalBlades: [
        { angle: 0, dist: 205, radius: 38, bladeCount: 6, speed: 0.06, orbitSpeed: 0.015, x: 0, y: 0 },
        { angle: Math.PI, dist: 205, radius: 38, bladeCount: 6, speed: -0.06, orbitSpeed: 0.015, x: 0, y: 0 },
      ],
      bumpers: [
        { id: 1, x: this.cx - 180, y: this.cy - 120, radius: 32, color: "#00e5ff", pulse: 0 },
        { id: 2, x: this.cx + 180, y: this.cy - 120, radius: 32, color: "#ff0077", pulse: 0 },
        { id: 3, x: this.cx - 180, y: this.cy + 120, radius: 32, color: "#00ff88", pulse: 0 },
        { id: 4, x: this.cx + 180, y: this.cy + 120, radius: 32, color: "#ffea00", pulse: 0 },
      ],
      lasers: [
        { active: false, angle: 0, speed: 0.022, length: 325 },
      ],
      vortex: {
        active: false,
        strength: 0.25,
      },
      shrinkingRing: {
        active: false,
        minRadius: 165,
        shrinkSpeed: 0.18,
      },
    };

    this.roundNumber = 1;
    this.gameTime = 0;
    this.speedMultiplier = 1.0;
    this.currentEvent = "NORMAL";
    this.eventTimeRemaining = 0;
    this.suddenDeathTriggered = false;

    this.onBounce = config.onBounce || (() => {});
    this.onBladeHit = config.onBladeHit || (() => {});
    this.onBumperHit = config.onBumperHit || (() => {});
    this.onElimination = config.onElimination || (() => {});
    this.onEventTrigger = config.onEventTrigger || (() => {});
    this.onWinner = config.onWinner || (() => {});
  }

  initMatch(countries, circularCanvasMap) {
    this.flags = [];
    this.particles = [];
    this.confetti = [];
    this.floatingTexts = [];
    this.eliminated = [];
    this.winner = null;
    this.arenaRadius = this.baseArenaRadius;
    this.suddenDeathTriggered = false;
    this.currentEvent = "NORMAL";
    this.eventTimeRemaining = 0;
    this.gameTime = 0;

    const total = countries.length;
    this.aliveCount = total;

    countries.forEach(([name, code], i) => {
      const ring = Math.floor(Math.sqrt(i) * 1.5) + 1;
      const countInRing = Math.max(6, ring * 8);
      const angle = (i % countInRing) * ((Math.PI * 2) / countInRing) + (ring * 0.5);
      const dist = Math.min(this.arenaRadius - 42, 108 + ring * 22 + (Math.random() * 8 - 4));

      const x = this.cx + Math.cos(angle) * dist;
      const y = this.cy + Math.sin(angle) * dist;

      const tangent = angle + Math.PI / 2;
      const speed = 2.4 + Math.random() * 2.0;
      const vx = Math.cos(tangent) * speed * (Math.random() > 0.5 ? 1 : -1);
      const vy = Math.sin(tangent) * speed * (Math.random() > 0.5 ? 1 : -1);

      this.flags.push({
        id: i,
        name,
        code,
        circularCanvas: circularCanvasMap.get(code),
        x,
        y,
        vx,
        vy,
        radius: this.flagRadius,
        mass: 1.0,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.08,
        alive: true,
        hp: 100,
        kills: 0,
        killStreak: 0,
        lastAttacker: null,
        trail: [],
        highlight: 0,
      });
    });
  }

  setPinnedFlag(id) {
    this.pinnedFlagId = id;
  }

  setHoveredFlag(id) {
    this.hoveredFlagId = id;
  }

  addFloatingText(text, x, y, color = "#00e5ff") {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -1.2,
      alpha: 1.0,
      color,
    });
  }

  update(dt = 1) {
    const timeStep = Math.min(2.0, dt) * this.speedMultiplier;
    this.gameTime += timeStep;

    this.updateEvents(timeStep);
    this.updateHazards(timeStep);
    this.updateFlags(timeStep);

    // Fast Spatial Hash Collision Resolution
    this.resolveGridCollisions();

    // Hazard and Arena Boundary Collisions
    this.resolveHazardCollisions();
    this.resolveArenaBoundary();

    // Update Particles & Floating Text
    this.updateParticles(timeStep);
    this.updateFloatingTexts(timeStep);

    // Check for Winner
    if (this.aliveCount <= 1 && !this.winner && this.flags.length > 0) {
      const survivor = this.flags.find((f) => f.alive);
      if (survivor) {
        this.winner = survivor;
        survivor.rank = 1;
        this.createConfettiCannon(this.cx, this.cy);
        this.addFloatingText("🏆 CHAMPION!", survivor.x, survivor.y - 30, "#ffd700");
        this.onWinner(survivor);
      }
    }
  }

  updateEvents(timeStep) {
    if (this.eventTimeRemaining > 0) {
      this.eventTimeRemaining -= timeStep;
      if (this.eventTimeRemaining <= 0) {
        this.currentEvent = "NORMAL";
        this.hazards.vortex.active = false;
        this.hazards.lasers[0].active = false;
        this.onEventTrigger("NORMAL", "Standard Arena Dynamics");
      }
    }

    if (this.aliveCount <= 10 && this.aliveCount > 1 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.currentEvent = "SUDDEN DEATH";
      this.hazards.shrinkingRing.active = true;
      this.onEventTrigger("SUDDEN DEATH", "⚠️ Ring is shrinking! Final 10 Showdown!");
    }

    if (this.hazards.shrinkingRing.active && this.arenaRadius > this.hazards.shrinkingRing.minRadius) {
      this.arenaRadius -= this.hazards.shrinkingRing.shrinkSpeed * timeStep;
    }

    if (this.aliveCount > 15 && this.currentEvent === "NORMAL" && Math.random() < 0.0008 * timeStep) {
      const events = ["VORTEX PULL", "SPEED SURGE", "LASER SWEEP", "BOUNCER FRENZY"];
      const chosen = events[Math.floor(Math.random() * events.length)];
      this.currentEvent = chosen;
      this.eventTimeRemaining = 460;

      if (chosen === "VORTEX PULL") {
        this.hazards.vortex.active = true;
        this.onEventTrigger(chosen, "🌀 Gravitational Singularity Active!");
      } else if (chosen === "SPEED SURGE") {
        this.flags.forEach((f) => {
          if (f.alive) {
            f.vx *= 1.6;
            f.vy *= 1.6;
          }
        });
        this.onEventTrigger(chosen, "⚡ 2X Kinetic Velocity Surge!");
      } else if (chosen === "LASER SWEEP") {
        this.hazards.lasers[0].active = true;
        this.onEventTrigger(chosen, "🔴 Sweeping Laser Sweep Online!");
      } else if (chosen === "BOUNCER FRENZY") {
        this.hazards.bumpers.forEach((b) => (b.pulse = 1.4));
        this.onEventTrigger(chosen, "💥 Hyper-Charge Bumpers Activated!");
      }
    }
  }

  updateHazards(timeStep) {
    const cb = this.hazards.centralBlade;
    cb.angle += cb.speed * timeStep;

    this.hazards.orbitalBlades.forEach((ob) => {
      ob.angle += ob.speed * timeStep;
      ob.distAngle = (ob.distAngle || 0) + ob.orbitSpeed * timeStep;
      ob.x = this.cx + Math.cos(ob.distAngle) * ob.dist;
      ob.y = this.cy + Math.sin(ob.distAngle) * ob.dist;
    });

    this.hazards.bumpers.forEach((b) => {
      if (b.pulse > 0) b.pulse = Math.max(0, b.pulse - 0.045 * timeStep);
    });

    if (this.hazards.lasers[0].active) {
      this.hazards.lasers[0].angle += this.hazards.lasers[0].speed * timeStep;
    }
  }

  updateFlags(timeStep) {
    const vortex = this.hazards.vortex;

    for (let i = 0; i < this.flags.length; i++) {
      const f = this.flags[i];
      if (!f.alive) continue;

      if (vortex.active) {
        const dx = this.cx - f.x;
        const dy = this.cy - f.y;
        const d = Math.hypot(dx, dy);
        if (d > 10) {
          const force = (vortex.strength * 75) / Math.max(40, d);
          f.vx += (dx / d) * force * timeStep;
          f.vy += (dy / d) * force * timeStep;
        }
      }

      f.vx *= 0.9992;
      f.vy *= 0.9992;

      const speed = Math.hypot(f.vx, f.vy);
      const maxSpeed = 16.0;
      if (speed > maxSpeed) {
        f.vx = (f.vx / speed) * maxSpeed;
        f.vy = (f.vy / speed) * maxSpeed;
      }
      if (speed < 1.7 && speed > 0.001) {
        f.vx = (f.vx / speed) * 1.7;
        f.vy = (f.vy / speed) * 1.7;
      }

      f.x += f.vx * timeStep;
      f.y += f.vy * timeStep;
      f.rotation += f.rotSpeed * timeStep;
      f.highlight = Math.max(0, f.highlight - 0.08 * timeStep);

      if (Math.random() < 0.25) {
        f.trail.push({ x: f.x, y: f.y, alpha: 0.45 });
        if (f.trail.length > 3) f.trail.shift();
      }
      f.trail.forEach((t) => (t.alpha -= 0.05 * timeStep));
      f.trail = f.trail.filter((t) => t.alpha > 0);
    }
  }

  resolveGridCollisions() {
    this.grid.clear();
    const flags = this.flags;
    const len = flags.length;

    for (let i = 0; i < len; i++) {
      if (flags[i].alive) {
        this.grid.insert(flags[i]);
      }
    }

    for (let i = 0; i < len; i++) {
      const f1 = flags[i];
      if (!f1.alive) continue;

      const nearby = this.grid.getNearby(f1);
      for (let j = 0; j < nearby.length; j++) {
        const f2 = nearby[j];
        if (f1.id >= f2.id || !f2.alive) continue;

        const dx = f2.x - f1.x;
        const dy = f2.y - f1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = f1.radius + f2.radius;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          const overlap = (minDist - dist) * 0.5;
          f1.x -= nx * overlap;
          f1.y -= ny * overlap;
          f2.x += nx * overlap;
          f2.y += ny * overlap;

          const kx = f1.vx - f2.vx;
          const ky = f1.vy - f2.vy;
          const p = 2 * (nx * kx + ny * ky) / (f1.mass + f2.mass);

          const restitution = 1.04;
          f1.vx -= p * f2.mass * nx * restitution;
          f1.vy -= p * f2.mass * ny * restitution;
          f2.vx += p * f1.mass * nx * restitution;
          f2.vy += p * f1.mass * ny * restitution;

          f1.lastAttacker = f2;
          f2.lastAttacker = f1;

          f1.rotSpeed += (Math.random() - 0.5) * 0.08;
          f2.rotSpeed += (Math.random() - 0.5) * 0.08;

          const collisionIntensity = Math.hypot(kx, ky);
          if (collisionIntensity > 4.5) {
            this.createSparks((f1.x + f2.x) / 2, (f1.y + f2.y) / 2, 3, "#00e5ff");
            this.onBounce(Math.min(2.0, collisionIntensity / 8));
          }
        }
      }
    }
  }

  resolveHazardCollisions() {
    const cb = this.hazards.centralBlade;

    for (let i = 0; i < this.flags.length; i++) {
      const f = this.flags[i];
      if (!f.alive) continue;

      // 1. Central Blade
      const dxC = f.x - cb.x;
      const dyC = f.y - cb.y;
      const distC = Math.hypot(dxC, dyC);
      if (distC < cb.radius + f.radius) {
        this.eliminateFlag(f, "CENTRAL SAWBLADE", "🪚");
        this.onBladeHit();
        continue;
      }

      // 2. Orbital Blades
      for (const ob of this.hazards.orbitalBlades) {
        const dxO = f.x - ob.x;
        const dyO = f.y - ob.y;
        const distO = Math.hypot(dxO, dyO);
        if (distO < ob.radius + f.radius) {
          this.eliminateFlag(f, "ORBITAL BLADE", "🪚");
          this.onBladeHit();
          break;
        }
      }
      if (!f.alive) continue;

      // 3. Pinball Bumpers
      for (const b of this.hazards.bumpers) {
        const dxB = f.x - b.x;
        const dyB = f.y - b.y;
        const distB = Math.hypot(dxB, dyB);
        if (distB < b.radius + f.radius) {
          const nx = dxB / (distB || 1);
          const ny = dyB / (distB || 1);

          f.vx = nx * 14.5;
          f.vy = ny * 14.5;
          f.highlight = 1.0;
          b.pulse = 1.0;

          this.createSparks(b.x + nx * b.radius, b.y + ny * b.radius, 8, b.color);
          this.createShockwaveRing(b.x, b.y, b.color);
          this.addFloatingText("BOUNCE!", b.x, b.y - 20, b.color);
          this.onBumperHit();
        }
      }

      // 4. Laser Sweep
      if (this.hazards.lasers[0].active) {
        const laser = this.hazards.lasers[0];
        const flagAngle = Math.atan2(f.y - this.cy, f.x - this.cx);
        const angleDiff = Math.abs(Math.atan2(Math.sin(flagAngle - laser.angle), Math.cos(flagAngle - laser.angle)));
        const distFromCenter = Math.hypot(f.x - this.cx, f.y - this.cy);

        if (angleDiff < 0.08 && distFromCenter < laser.length) {
          this.eliminateFlag(f, "PLASMA LASER", "⚡");
          this.onBladeHit();
        }
      }
    }
  }

  resolveArenaBoundary() {
    for (let i = 0; i < this.flags.length; i++) {
      const f = this.flags[i];
      if (!f.alive) continue;

      const dx = f.x - this.cx;
      const dy = f.y - this.cy;
      const dist = Math.hypot(dx, dy);
      const maxAllowed = this.arenaRadius - f.radius;

      if (dist > maxAllowed) {
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);

        f.x = this.cx + nx * maxAllowed;
        f.y = this.cy + ny * maxAllowed;

        const dot = f.vx * nx + f.vy * ny;
        f.vx = (f.vx - 2 * dot * nx) * 1.02;
        f.vy = (f.vy - 2 * dot * ny) * 1.02;

        f.highlight = 0.5;
        this.createSparks(f.x, f.y, 3, "#ff0077");
        this.onBounce(0.7);
      }
    }
  }

  eliminateFlag(flag, cause = "ARENA HAZARD", icon = "💥") {
    if (!flag.alive) return;

    flag.alive = false;
    this.aliveCount--;
    flag.rank = this.aliveCount + 1;
    flag.eliminationTime = this.gameTime;

    let killer = flag.lastAttacker;
    let streakCount = 0;
    if (killer && killer.alive) {
      killer.kills++;
      killer.killStreak++;
      streakCount = killer.killStreak;
      this.addFloatingText(`+1 KILL! (${killer.name})`, killer.x, killer.y - 20, "#ff0055");
    } else {
      this.addFloatingText("KO!", flag.x, flag.y - 18, "#ff3b5c");
    }

    this.eliminated.unshift(flag);
    this.createExplosion(flag.x, flag.y);
    this.createShockwaveRing(flag.x, flag.y, "#ff0055");

    this.onElimination({
      victim: flag,
      killer: killer || { name: cause },
      cause,
      icon,
      streakCount,
      rank: flag.rank,
      aliveLeft: this.aliveCount,
    });
  }

  createSparks(x, y, count = 4, color = "#00e5ff") {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 2,
        color,
        alpha: 1.0,
        decay: 0.06 + Math.random() * 0.04,
      });
    }
  }

  createShockwaveRing(x, y, color = "#00e5ff") {
    this.particles.push({
      type: "ring",
      x,
      y,
      radius: 4,
      maxRadius: 55,
      color,
      alpha: 1.0,
      decay: 0.07,
    });
  }

  createExplosion(x, y) {
    const colors = ["#ff0055", "#00e5ff", "#ffea00", "#ffffff"];
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 4,
        color: colors[i % colors.length],
        alpha: 1.0,
        decay: 0.03 + Math.random() * 0.03,
      });
    }
  }

  createConfettiCannon(cx, cy) {
    const colors = ["#ffd700", "#ff007f", "#00e5ff", "#00ff88", "#ff9900", "#ffffff"];
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 10;
      this.confetti.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        w: 7 + Math.random() * 7,
        h: 4 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.25,
        color: colors[i % colors.length],
        alpha: 1.0,
        gravity: 0.12,
      });
    }
  }

  updateParticles(timeStep) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.type === "ring") {
        p.radius += 4 * timeStep;
        p.alpha -= p.decay * timeStep;
      } else {
        p.x += p.vx * timeStep;
        p.y += p.vy * timeStep;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.alpha -= p.decay * timeStep;
      }
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.x += c.vx * timeStep;
      c.y += c.vy * timeStep;
      c.vy += c.gravity * timeStep;
      c.vx *= 0.98;
      c.rot += c.rotSpeed * timeStep;
      if (c.y > this.height + 20) {
        this.confetti.splice(i, 1);
      }
    }
  }

  updateFloatingTexts(timeStep) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * timeStep;
      ft.alpha -= 0.025 * timeStep;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }
}
