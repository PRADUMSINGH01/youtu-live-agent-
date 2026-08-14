// Broadcast Esports HUD, Interactive Tabbed Leaderboard, Radar Minimap, and Studio Controls
import { getFlagUrl } from './flags.js';

export class UIManager {
  constructor(options = {}) {
    this.elements = {
      scoreList: document.getElementById("scores"),
      aliveHeader: document.getElementById("aliveHeader"),
      searchInput: document.getElementById("flagSearch"),
      roundText: document.getElementById("round"),
      aliveText: document.getElementById("alive"),
      pacingText: document.getElementById("pacingText"),
      eventName: document.getElementById("eventName"),
      eventBanner: document.getElementById("eventBanner"),
      eventTitle: document.getElementById("eventTitle"),
      eventDesc: document.getElementById("eventDesc"),
      killFeed: document.getElementById("killFeed"),
      champModal: document.getElementById("champ"),
      champFlag: document.getElementById("champFlag"),
      champName: document.getElementById("champName"),
      champKills: document.getElementById("champKills"),
      champRival: document.getElementById("champRival"),
      champTimer: document.getElementById("champTimer"),
      nextBattleBtn: document.getElementById("nextBattleBtn"),
      recordBtn: document.getElementById("recordBtn"),
      cleanViewBtn: document.getElementById("cleanViewBtn"),
      recordBadge: document.getElementById("recordBadge"),
      recTimer: document.getElementById("recTimer"),
      soundHeaderBtn: document.getElementById("soundHeaderBtn"),
      soundText: document.getElementById("soundText"),
      snapshotBtn: document.getElementById("snapshotBtn"),
      webcamVideo: document.getElementById("webcamVideo"),
      webcamPlaceholder: document.getElementById("webcamPlaceholder"),
      toggleWebcamBtn: document.getElementById("toggleWebcamBtn"),
      settingsDrawer: document.getElementById("settingsDrawer"),
      toggleSettingsBtn: document.getElementById("toggleSettingsBtn"),
      speedSelect: document.getElementById("speedSelect"),
      themeSelect: document.getElementById("themeSelect"),
      trackSelect: document.getElementById("trackSelect"),
      soundToggle: document.getElementById("soundToggle"),
      musicToggle: document.getElementById("musicToggle"),
      sfxVolume: document.getElementById("sfxVolume"),
      musicVolume: document.getElementById("musicVolume"),
      upiInput: document.getElementById("upiInput"),
      upiText: document.getElementById("upiText"),
      qrImg: document.getElementById("qrImg"),
      radarCanvas: document.getElementById("radarCanvas"),
      radarPinnedInfo: document.getElementById("radarPinnedInfo"),
      pinnedName: document.getElementById("pinnedName"),
      tabAlive: document.getElementById("tabAlive"),
      tabKills: document.getElementById("tabKills"),
      tabOut: document.getElementById("tabOut"),
    };

    this.radarCtx = this.elements.radarCanvas ? this.elements.radarCanvas.getContext("2d") : null;
    this.activeTab = "alive";
    this.searchTerm = "";
    this.pinnedFlagId = null;
    this.nextBattleTimer = null;
    this.webcamStream = null;

    this.onRestart = options.onRestart || (() => {});
    this.onRecordToggle = options.onRecordToggle || (() => {});
    this.onToggleCleanView = options.onToggleCleanView || (() => {});
    this.onSnapshot = options.onSnapshot || (() => {});
    this.onSpeedChange = options.onSpeedChange || (() => {});
    this.onThemeChange = options.onThemeChange || (() => {});
    this.onSoundChange = options.onSoundChange || (() => {});
    this.onPinFlag = options.onPinFlag || (() => {});

    this.initEventListeners();
  }

  initEventListeners() {
    const el = this.elements;

    // Search filter
    if (el.searchInput) {
      el.searchInput.addEventListener("input", (e) => {
        this.searchTerm = e.target.value.toLowerCase().trim();
      });
    }

    // Tabs
    const tabs = [
      { btn: el.tabAlive, tab: "alive" },
      { btn: el.tabKills, tab: "kills" },
      { btn: el.tabOut, tab: "out" },
    ];
    tabs.forEach(({ btn, tab }) => {
      if (btn) {
        btn.addEventListener("click", () => {
          tabs.forEach((t) => t.btn && t.btn.classList.remove("active"));
          btn.classList.add("active");
          this.activeTab = tab;
        });
      }
    });

    // Champion Modal Start Next Button
    if (el.nextBattleBtn) {
      el.nextBattleBtn.addEventListener("click", () => {
        this.hideChampionModal();
        this.onRestart();
      });
    }

    // Record toggle
    if (el.recordBtn) {
      el.recordBtn.addEventListener("click", () => {
        this.onRecordToggle();
      });
    }

    // Clean View toggle
    if (el.cleanViewBtn) {
      el.cleanViewBtn.addEventListener("click", () => {
        this.onToggleCleanView();
      });
    }

    // Snapshot button
    if (el.snapshotBtn) {
      el.snapshotBtn.addEventListener("click", () => {
        this.onSnapshot();
      });
    }

    // Speed selector
    if (el.speedSelect) {
      el.speedSelect.addEventListener("change", (e) => {
        this.onSpeedChange(parseFloat(e.target.value));
      });
    }

    // Theme selector
    if (el.themeSelect) {
      el.themeSelect.addEventListener("change", (e) => {
        this.onThemeChange(e.target.value);
      });
    }

    // Track selector
    if (el.trackSelect) {
      el.trackSelect.addEventListener("change", (e) => {
        this.onSoundChange("trackSelect", e.target.value);
      });
    }

    // Sound Header Pill toggle
    if (el.soundHeaderBtn) {
      el.soundHeaderBtn.addEventListener("click", () => {
        this.onSoundChange("headerToggle");
      });
    }

    // Sound and music controls
    if (el.soundToggle) {
      el.soundToggle.addEventListener("change", (e) => {
        this.onSoundChange("sfxToggle", e.target.checked);
      });
    }
    if (el.musicToggle) {
      el.musicToggle.addEventListener("change", (e) => {
        this.onSoundChange("musicToggle", e.target.checked);
      });
    }
    if (el.sfxVolume) {
      el.sfxVolume.addEventListener("input", (e) => {
        this.onSoundChange("sfxVolume", parseFloat(e.target.value));
      });
    }
    if (el.musicVolume) {
      el.musicVolume.addEventListener("input", (e) => {
        this.onSoundChange("musicVolume", parseFloat(e.target.value));
      });
    }

    // Settings Drawer Toggle
    if (el.toggleSettingsBtn && el.settingsDrawer) {
      el.toggleSettingsBtn.addEventListener("click", () => {
        el.settingsDrawer.classList.toggle("open");
      });
    }

    // UPI Editor
    if (el.upiInput && el.upiText && el.qrImg) {
      el.upiInput.addEventListener("change", (e) => {
        const val = e.target.value.trim();
        if (val) {
          el.upiText.textContent = val;
          el.qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${encodeURIComponent(val)}&pn=FlagWarStream`;
        }
      });
    }

    // Live Webcam Enable
    if (el.toggleWebcamBtn) {
      el.toggleWebcamBtn.addEventListener("click", () => {
        this.toggleWebcam();
      });
    }
  }

  async toggleWebcam() {
    const el = this.elements;
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach((track) => track.stop());
      this.webcamStream = null;
      if (el.webcamVideo) {
        el.webcamVideo.srcObject = null;
        el.webcamVideo.style.display = "none";
      }
      if (el.webcamPlaceholder) el.webcamPlaceholder.style.display = "flex";
      if (el.toggleWebcamBtn) el.toggleWebcamBtn.textContent = "Turn Webcam ON";
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        this.webcamStream = stream;
        if (el.webcamVideo) {
          el.webcamVideo.srcObject = stream;
          el.webcamVideo.style.display = "block";
          el.webcamVideo.play();
        }
        if (el.webcamPlaceholder) el.webcamPlaceholder.style.display = "none";
        if (el.toggleWebcamBtn) el.toggleWebcamBtn.textContent = "Turn Webcam OFF";
      } catch (e) {
        alert("Webcam permission denied: " + e.message);
      }
    }
  }

  updateTelemetry(physics) {
    const el = this.elements;
    if (el.roundText) el.roundText.textContent = String(physics.roundNumber).padStart(3, "0");
    if (el.aliveText) el.aliveText.textContent = String(physics.aliveCount);
    if (el.aliveHeader) el.aliveHeader.textContent = `${physics.aliveCount} ALIVE`;
    if (el.pacingText) el.pacingText.textContent = `${physics.speedMultiplier.toFixed(1)}×`;
    if (el.eventName) el.eventName.textContent = physics.currentEvent;

    // Draw Tactical Radar
    this.drawRadar(physics);
  }

  drawRadar(physics) {
    if (!this.radarCtx) return;
    const ctx = this.radarCtx;
    const size = 110;
    const center = size / 2;
    const scale = (center - 6) / physics.baseArenaRadius;

    ctx.clearRect(0, 0, size, size);

    // Radar Arena Boundary
    ctx.beginPath();
    ctx.arc(center, center, physics.arenaRadius * scale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Radar Center & Crosshairs
    ctx.beginPath();
    ctx.moveTo(center, 4);
    ctx.lineTo(center, size - 4);
    ctx.moveTo(4, center);
    ctx.lineTo(size - 4, center);
    ctx.strokeStyle = "rgba(0, 229, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw Flag blips
    physics.flags.forEach((f) => {
      if (!f.alive) return;
      const rx = center + (f.x - physics.cx) * scale;
      const ry = center + (f.y - physics.cy) * scale;

      ctx.beginPath();
      ctx.arc(rx, ry, f.id === this.pinnedFlagId ? 3.5 : 1.5, 0, Math.PI * 2);
      ctx.fillStyle = f.id === this.pinnedFlagId ? "#ffd700" : (f.kills > 0 ? "#ff0077" : "#00e5ff");
      ctx.fill();
    });
  }

  updateLeaderboard(physics) {
    const el = this.elements;
    if (!el.scoreList) return;

    let list = [...physics.flags];

    if (this.activeTab === "alive") {
      list = list.filter((f) => f.alive).sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name));
    } else if (this.activeTab === "kills") {
      list = list.sort((a, b) => b.kills - a.kills || (a.alive ? -1 : 1));
    } else if (this.activeTab === "out") {
      list = list.filter((f) => !f.alive).sort((a, b) => (a.rank || 999) - (b.rank || 999));
    }

    const filtered = this.searchTerm
      ? list.filter((f) => f.name.toLowerCase().includes(this.searchTerm) || f.code.toLowerCase().includes(this.searchTerm))
      : list;

    let html = "";
    filtered.slice(0, 100).forEach((flag, idx) => {
      let rankBadge = "";
      if (flag.alive) {
        if (idx === 0) rankBadge = '<span class="rk gold">#1</span>';
        else if (idx === 1) rankBadge = '<span class="rk silver">#2</span>';
        else if (idx === 2) rankBadge = '<span class="rk bronze">#3</span>';
        else rankBadge = `<span class="rk">#${idx + 1}</span>`;
      } else {
        rankBadge = `<span class="rk dead">#${flag.rank || '-'}</span>`;
      }

      const isPinned = flag.id === this.pinnedFlagId;
      const statusClass = flag.alive ? "on" : "dead";
      const statusText = flag.alive ? (flag.kills > 0 ? `⚔ ${flag.kills}` : "ALIVE") : "OUT";

      html += `
        <div class="leaderboardRow ${statusClass} ${isPinned ? 'pinned' : ''}" data-flag-id="${flag.id}">
          ${rankBadge}
          <img class="flagThumb" src="${getFlagUrl(flag.code)}" alt="${flag.name}" loading="lazy" />
          <span class="countryName" title="${flag.name}">${isPinned ? '⭐ ' : ''}${flag.name}</span>
          <span class="statusBadge ${statusClass}">${statusText}</span>
        </div>
      `;
    });

    el.scoreList.innerHTML = html;

    // Attach click-to-pin listener on rows
    el.scoreList.querySelectorAll(".leaderboardRow").forEach((row) => {
      row.addEventListener("click", () => {
        const id = parseInt(row.getAttribute("data-flag-id"));
        if (this.pinnedFlagId === id) {
          this.pinnedFlagId = null;
          if (el.radarPinnedInfo) el.radarPinnedInfo.style.display = "none";
        } else {
          this.pinnedFlagId = id;
          const targetFlag = physics.flags.find((f) => f.id === id);
          if (targetFlag) {
            if (el.pinnedName) el.pinnedName.textContent = targetFlag.name.toUpperCase();
            if (el.radarPinnedInfo) el.radarPinnedInfo.style.display = "block";
          }
        }
        physics.setPinnedFlag(this.pinnedFlagId);
        this.onPinFlag(this.pinnedFlagId);
        this.updateLeaderboard(physics);
      });
    });
  }

  showEventBanner(title, desc) {
    const el = this.elements;
    if (!el.eventBanner) return;

    if (el.eventTitle) el.eventTitle.textContent = title;
    if (el.eventDesc) el.eventDesc.textContent = desc;

    el.eventBanner.classList.add("show");
    setTimeout(() => {
      el.eventBanner.classList.remove("show");
    }, 4000);
  }

  addKillFeed(eventData) {
    const el = this.elements;
    if (!el.killFeed) return;

    const entry = document.createElement("div");
    entry.className = "killEntry";

    const victimFlag = `<img class="feedFlag" src="${getFlagUrl(eventData.victim.code)}" />`;
    const killerName = eventData.killer && eventData.killer.name ? eventData.killer.name : eventData.cause;
    const streakHtml = eventData.streakCount > 1 ? `<span class="feedStreak">🔥 ${eventData.streakCount}x</span>` : "";

    entry.innerHTML = `
      <span class="feedVictim">${victimFlag} <b>${eventData.victim.name}</b></span>
      <span class="feedCause">${eventData.icon || '⚔'}</span>
      <span class="feedKiller"><b>${killerName}</b>${streakHtml}</span>
    `;

    el.killFeed.appendChild(entry);
    setTimeout(() => {
      entry.classList.add("fade-out");
      setTimeout(() => {
        if (entry.parentElement) entry.parentElement.removeChild(entry);
      }, 350);
    }, 3200);
  }

  showChampionModal(champion, autoRestartSec = 6) {
    const el = this.elements;
    if (!el.champModal) return;

    if (el.champFlag) el.champFlag.src = getFlagUrl(champion.code);
    if (el.champName) el.champName.textContent = champion.name.toUpperCase();
    if (el.champKills) el.champKills.textContent = String(champion.kills);
    if (el.champRival) el.champRival.textContent = champion.lastAttacker ? champion.lastAttacker.name : "ARENA HAZARDS";

    el.champModal.style.display = "flex";

    let remaining = autoRestartSec;
    if (el.champTimer) el.champTimer.textContent = `NEXT BATTLE IN ${remaining}s...`;

    if (this.nextBattleTimer) clearInterval(this.nextBattleTimer);
    this.nextBattleTimer = setInterval(() => {
      remaining--;
      if (el.champTimer) el.champTimer.textContent = `NEXT BATTLE IN ${remaining}s...`;
      if (remaining <= 0) {
        clearInterval(this.nextBattleTimer);
        this.hideChampionModal();
        this.onRestart();
      }
    }, 1000);
  }

  hideChampionModal() {
    const el = this.elements;
    if (el.champModal) el.champModal.style.display = "none";
    if (this.nextBattleTimer) {
      clearInterval(this.nextBattleTimer);
      this.nextBattleTimer = null;
    }
  }

  updateRecordingStatus(recData) {
    const el = this.elements;
    if (recData.status === 'recording') {
      if (el.recordBtn) {
        el.recordBtn.classList.add("recording");
        el.recordBtn.textContent = "⏹ STOP";
      }
      if (el.recordBadge) el.recordBadge.style.display = "inline-flex";
      if (el.recTimer) el.recTimer.textContent = recData.elapsedFormatted || "00:00";
    } else {
      if (el.recordBtn) {
        el.recordBtn.classList.remove("recording");
        el.recordBtn.textContent = "🔴 RECORD";
      }
      if (el.recordBadge) el.recordBadge.style.display = "none";
    }
  }

  updateSoundStatus(isMuted, isUnlocked = true) {
    const el = this.elements;
    if (!el.soundHeaderBtn) return;

    if (isMuted || !isUnlocked) {
      el.soundHeaderBtn.classList.add("muted");
      if (el.soundText) el.soundText.textContent = isUnlocked ? "MUTED" : "CLICK FOR AUDIO";
    } else {
      el.soundHeaderBtn.classList.remove("muted");
      if (el.soundText) el.soundText.textContent = "AUDIO ON";
    }
  }
}
