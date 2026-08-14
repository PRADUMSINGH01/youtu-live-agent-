// Master Flag Battle Application Loop & Composite Renderer
import { COUNTRIES, preloadFlags } from './flags.js';
import { SoundEngine } from './audio.js';
import { WebGLArenaRenderer } from './webgl-renderer.js';
import { BattlePhysics } from './physics.js';
import { CanvasRecorder } from './recorder.js';
import { UIManager } from './ui.js';

class FlagBattleApp {
  constructor() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d", { alpha: true, desynchronized: true });
    this.glCanvas = document.getElementById("glBg");

    this.width = 1280;
    this.height = 720;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    if (this.glCanvas) {
      this.glCanvas.width = this.width;
      this.glCanvas.height = this.height;
    }

    this.sound = new SoundEngine();
    this.webgl = this.glCanvas ? new WebGLArenaRenderer(this.glCanvas) : null;
    this.recorder = new CanvasRecorder(this.canvas, this.sound);
    this.ui = null;
    this.physics = null;

    this.circularCanvasMap = null;
    this.countries = COUNTRIES;
    this.lastFrameTime = performance.now();
    this.screenShake = 0;
    this.cameraZoom = 1.0;
    this.targetZoom = 1.0;
    this.roundCount = 1;
    this.fpsCounter = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.isCleanMode = false;

    this.init();
  }

  async init() {
    const loadingScreen = document.getElementById("loadingScreen");
    const loadProgress = document.getElementById("loadProgress");
    const loadStatus = document.getElementById("loadStatus");

    // Ultra-fast flag preloading
    const { circularCanvasMap } = await preloadFlags((loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      if (loadProgress) loadProgress.style.width = `${pct}%`;
      if (loadStatus) loadStatus.textContent = `Loading Flags (${loaded}/${total})...`;
    });
    this.circularCanvasMap = circularCanvasMap;

    // Initialize Physics Engine
    this.physics = new BattlePhysics({
      width: this.width,
      height: this.height,
      arenaRadius: 335,
      onBounce: (intensity) => {
        this.sound.playBounce(intensity);
      },
      onBladeHit: () => {
        this.sound.playBladeHit();
        this.screenShake = 12;
      },
      onBumperHit: () => {
        this.sound.playBumperHit();
        this.screenShake = 7;
      },
      onElimination: (eventData) => {
        this.sound.playElimination();
        this.screenShake = 15;
        if (this.webgl) {
          this.webgl.triggerShockwave(eventData.victim.x, eventData.victim.y);
        }
        if (this.ui) {
          this.ui.addKillFeed(eventData);
        }
      },
      onEventTrigger: (eventName, eventDesc) => {
        this.sound.playEventAlarm();
        if (this.ui) {
          this.ui.showEventBanner(eventName, eventDesc);
        }
      },
      onWinner: (champion) => {
        this.sound.playVictoryFanfare();
        if (this.ui) {
          this.ui.showChampionModal(champion, 6);
        }
      },
    });

    // Initialize UI Manager
    this.ui = new UIManager({
      onRestart: () => this.startNewMatch(),
      onRecordToggle: () => this.toggleRecording(),
      onToggleCleanView: () => this.toggleCleanMode(),
      onSnapshot: () => this.recorder.takeSnapshot(),
      onSpeedChange: (speed) => (this.physics.speedMultiplier = speed),
      onThemeChange: (theme) => {
        if (this.webgl) this.webgl.setTheme(theme);
      },
      onSoundChange: (key, val) => {
        if (key === 'headerToggle') {
          if (!this.sound.isUnlocked) {
            this.sound.unlock();
          } else {
            this.sound.setMuted(!this.sound.isMuted);
          }
          this.ui.updateSoundStatus(this.sound.isMuted, this.sound.isUnlocked);
        }
        if (key === 'trackSelect') {
          this.sound.setMusicTrack(val);
        }
        if (key === 'sfxToggle') this.sound.soundEnabled = val;
        if (key === 'musicToggle') {
          this.sound.musicEnabled = val;
          if (val) this.sound.startMusicLoop();
          else this.sound.stopMusicLoop();
        }
        if (key === 'sfxVolume') this.sound.setSfxVolume(val);
        if (key === 'musicVolume') this.sound.setMusicVolume(val);
      },
    });

    this.sound.onUnlock = () => {
      if (this.ui) this.ui.updateSoundStatus(this.sound.isMuted, true);
    };

    this.recorder.onStatusChange = (statusData) => {
      this.ui.updateRecordingStatus(statusData);
    };

    // Canvas interactive hover & click
    this.initCanvasInteractivity();

    // Keybindings (H = Clean Mode toggle, R = Record, Space = Pause)
    window.addEventListener("keydown", (e) => {
      if (e.key === "h" || e.key === "H") {
        this.toggleCleanMode();
      }
    });

    // Hide loading overlay smoothly
    if (loadingScreen) {
      loadingScreen.style.opacity = "0";
      setTimeout(() => (loadingScreen.style.display = "none"), 350);
    }

    // Start first match
    this.startNewMatch();

    // Start procedural background music
    this.sound.startMusicLoop();

    // Start main render loop
    requestAnimationFrame((t) => this.loop(t));
  }

  initCanvasInteractivity() {
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      const scaleY = this.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      let hovered = null;
      for (const f of this.physics.flags) {
        if (!f.alive) continue;
        if (Math.hypot(f.x - mouseX, f.y - mouseY) <= f.radius + 6) {
          hovered = f.id;
          break;
        }
      }
      this.physics.setHoveredFlag(hovered);
    });

    this.canvas.addEventListener("click", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      const scaleY = this.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      for (const f of this.physics.flags) {
        if (!f.alive) continue;
        if (Math.hypot(f.x - mouseX, f.y - mouseY) <= f.radius + 8) {
          const newPin = this.physics.pinnedFlagId === f.id ? null : f.id;
          this.physics.setPinnedFlag(newPin);
          if (this.ui) {
            this.ui.pinnedFlagId = newPin;
            this.ui.updateLeaderboard(this.physics);
          }
          break;
        }
      }
    });
  }

  toggleCleanMode() {
    this.isCleanMode = !this.isCleanMode;
    document.body.classList.toggle("cleanMode", this.isCleanMode);
  }

  startNewMatch() {
    this.physics.roundNumber = this.roundCount++;
    this.physics.initMatch(this.countries, this.circularCanvasMap);
    this.cameraZoom = 1.0;
    this.targetZoom = 1.0;
    if (this.ui) {
      this.ui.updateLeaderboard(this.physics);
      this.ui.updateTelemetry(this.physics);
    }
  }

  toggleRecording() {
    if (this.recorder.isRecording) {
      this.recorder.stop();
    } else {
      this.recorder.start({ fps: 60, bitrate: 14000000 });
    }
  }

  loop(currentTime) {
    const dt = Math.min(2.0, (currentTime - this.lastFrameTime) / 16.666);
    this.lastFrameTime = currentTime;

    // Real-time FPS Calculation
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.fpsCounter = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
      const fpsEl = document.getElementById("fpsMetric");
      if (fpsEl) fpsEl.textContent = `${this.fpsCounter} FPS`;
    }

    // Dynamic Camera Zoom Director (Smooth late-game focus)
    if (this.physics.aliveCount <= 6 && this.physics.aliveCount > 1) {
      this.targetZoom = 1.28;
    } else if (this.physics.aliveCount <= 2 && this.physics.aliveCount > 0) {
      this.targetZoom = 1.45;
    } else {
      this.targetZoom = 1.0;
    }
    this.cameraZoom += (this.targetZoom - this.cameraZoom) * 0.04 * dt;

    // Update Physics
    this.physics.update(dt);

    // Render WebGL Background Shader
    if (this.webgl) {
      this.webgl.render({ x: this.physics.cx, y: this.physics.cy }, this.physics.arenaRadius);
    }

    // Render 2D Composite Layer
    this.render2D();

    // Update UI telemetry and Leaderboard
    if (this.frameCount % 5 === 0 && this.ui) {
      this.ui.updateTelemetry(this.physics);
      this.ui.updateLeaderboard(this.physics);
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  render2D() {
    const ctx = this.ctx;
    const p = this.physics;

    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    // Apply Camera Screen Shake
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
      this.screenShake *= 0.88;
      if (this.screenShake < 0.1) this.screenShake = 0;
    }

    // Apply Smooth Dynamic Camera Zoom
    if (Math.abs(this.cameraZoom - 1.0) > 0.01) {
      ctx.translate(p.cx, p.cy);
      ctx.scale(this.cameraZoom, this.cameraZoom);
      ctx.translate(-p.cx, -p.cy);
    }

    // 1. Arena Boundary
    this.drawArenaRing(ctx, p.cx, p.cy, p.arenaRadius);

    // 2. Hazards
    this.drawHazards(ctx, p);

    // 3. Flags and Spotlight
    this.drawFlags(ctx, p.flags, p.pinnedFlagId, p.hoveredFlagId);

    // 4. Particles, Confetti, and Floating Combat Text
    this.drawParticles(ctx, p.particles, p.confetti, p.floatingTexts);

    ctx.restore();
  }

  drawArenaRing(ctx, cx, cy, radius) {
    ctx.save();

    // Outer Neon Glow
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
    ctx.lineWidth = 6;
    ctx.stroke();

    // Main Metallic Ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Glowing perimeter hazard notches
    const notchCount = 32;
    for (let i = 0; i < notchCount; i++) {
      const angle = (i / notchCount) * Math.PI * 2;
      const x1 = cx + Math.cos(angle) * (radius - 5);
      const y1 = cy + Math.sin(angle) * (radius - 5);
      const x2 = cx + Math.cos(angle) * (radius + 5);
      const y2 = cy + Math.sin(angle) * (radius + 5);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = i % 2 === 0 ? "#ff0077" : "#00e5ff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  drawHazards(ctx, p) {
    const cb = p.hazards.centralBlade;

    // 1. Central Sawblade
    ctx.save();
    ctx.translate(cb.x, cb.y);
    ctx.rotate(cb.angle);

    ctx.beginPath();
    const teeth = cb.bladeCount * 2;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const r = i % 2 === 0 ? cb.radius : cb.radius - 16;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "#112033";
    ctx.fill();
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Central Core Danger Zone
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fillStyle = "#ff0055";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 2. Orbital Sawblades
    p.hazards.orbitalBlades.forEach((ob) => {
      ctx.save();
      ctx.translate(ob.x, ob.y);
      ctx.rotate(ob.angle);

      ctx.beginPath();
      const oTeeth = ob.bladeCount * 2;
      for (let i = 0; i < oTeeth; i++) {
        const a = (i / oTeeth) * Math.PI * 2;
        const r = i % 2 === 0 ? ob.radius : ob.radius - 9;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = "#ff0077";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });

    // 3. Pinball Bumpers
    p.hazards.bumpers.forEach((b) => {
      ctx.save();
      ctx.translate(b.x, b.y);

      if (b.pulse > 0.05) {
        ctx.beginPath();
        ctx.arc(0, 0, b.radius + b.pulse * 20, 0, Math.PI * 2);
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2.5 * b.pulse;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#0a1424";
      ctx.fill();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, b.radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.restore();
    });

    // 4. Laser Gate
    if (p.hazards.lasers[0].active) {
      const laser = p.hazards.lasers[0];
      ctx.save();
      ctx.translate(p.cx, p.cy);
      ctx.rotate(laser.angle);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(laser.length, 0);
      ctx.strokeStyle = "#ff0055";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawFlags(ctx, flags, pinnedId, hoveredId) {
    // Sort flags by kills to identify Top 3 Leaders
    const aliveSorted = flags.filter((f) => f.alive).sort((a, b) => b.kills - a.kills);
    const top1 = aliveSorted[0];
    const top2 = aliveSorted[1];
    const top3 = aliveSorted[2];

    flags.forEach((f) => {
      if (!f.alive) return;

      // Draw motion trails
      f.trail.forEach((t) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(t.x, t.y, f.radius * 0.75, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 229, 255, ${t.alpha * 0.3})`;
        ctx.fill();
        ctx.restore();
      });

      // Draw Flag Orb
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);

      if (f.circularCanvas) {
        const size = f.radius * 2;
        ctx.drawImage(f.circularCanvas, -f.radius, -f.radius, size, size);
      }

      // Hit flash
      if (f.highlight > 0.05) {
        ctx.beginPath();
        ctx.arc(0, 0, f.radius + 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${f.highlight})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Top 3 Leader Aura Rings
      if (f === top1 && f.kills > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, f.radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (f === top2 && f.kills > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, f.radius + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else if (f === top3 && f.kills > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, f.radius + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = "#cd7f32";
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      // Kill Count Badge
      if (f.kills > 0) {
        ctx.rotate(-f.rotation);
        ctx.beginPath();
        ctx.arc(f.radius * 0.72, -f.radius * 0.72, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#ff0055";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(f.kills), f.radius * 0.72, -f.radius * 0.72);
        ctx.rotate(f.rotation);
      }

      // Hover / Pin Spotlight Crosshair
      if (f.id === pinnedId || f.id === hoveredId) {
        ctx.rotate(-f.rotation);
        ctx.beginPath();
        ctx.arc(0, 0, f.radius + 7, 0, Math.PI * 2);
        ctx.strokeStyle = f.id === pinnedId ? "#ffd700" : "#00e5ff";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Country name label badge above flag
        ctx.fillStyle = "rgba(6, 12, 22, 0.9)";
        ctx.fillRect(-40, -f.radius - 23, 80, 16);
        ctx.strokeStyle = f.id === pinnedId ? "#ffd700" : "#00e5ff";
        ctx.lineWidth = 1;
        ctx.strokeRect(-40, -f.radius - 23, 80, 16);

        ctx.fillStyle = f.id === pinnedId ? "#ffd700" : "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(f.name.toUpperCase().slice(0, 12), 0, -f.radius - 15);
      }

      ctx.restore();
    });
  }

  drawParticles(ctx, particles, confetti, floatingTexts) {
    // Regular sparks
    particles.forEach((p) => {
      ctx.save();
      if (p.type === "ring") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * p.alpha;
        ctx.globalAlpha = p.alpha;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.restore();
    });

    // Floating Combat Text
    floatingTexts.forEach((ft) => {
      ctx.save();
      ctx.font = "900 12px Outfit, Inter, sans-serif";
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.alpha;
      ctx.textAlign = "center";
      ctx.shadowColor = "#000000";
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // Confetti
    confetti.forEach((c) => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    });
  }
}

// Bootstrap
window.addEventListener("DOMContentLoaded", () => {
  new FlagBattleApp();
});
