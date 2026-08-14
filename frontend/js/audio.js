// 100% Copyright-Free, DMCA-Safe Procedural Sound & Music Synthesizer Engine
export class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.analyser = null;
    this.streamDestination = null;
    this.soundEnabled = true;
    this.musicEnabled = true;
    this.isMuted = false;
    this.currentTrack = 'synthwave'; // 'synthwave', 'techno', 'arcade', 'lofi'
    this.lastBounceTime = 0;
    this.musicInterval = null;
    this.musicStep = 0;
    this.isUnlocked = false;

    this.onUnlock = () => {};
  }

  init() {
    if (this.audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();

      // Master Gain
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.audioCtx.destination);

      // Real-time Audio Spectrum Analyser for visualizers
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      this.masterGain.connect(this.analyser);

      // Stream destination for direct video/audio recording
      this.streamDestination = this.audioCtx.createMediaStreamDestination();
      this.masterGain.connect(this.streamDestination);

      // SFX and Music Buses
      this.sfxGain = this.audioCtx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.audioCtx.createGain();
      this.musicGain.gain.value = 0.4;
      this.musicGain.connect(this.masterGain);

      // Unlock on first interaction
      const unlockAudio = () => {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().then(() => {
            this.isUnlocked = true;
            this.onUnlock();
          });
        } else {
          this.isUnlocked = true;
          this.onUnlock();
        }
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };

      window.addEventListener('click', unlockAudio);
      window.addEventListener('touchstart', unlockAudio);
      window.addEventListener('keydown', unlockAudio);
    } catch (e) {
      console.warn("AudioContext init error:", e);
    }
  }

  unlock() {
    this.init();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => {
        this.isUnlocked = true;
        this.onUnlock();
      });
    } else {
      this.isUnlocked = true;
      this.onUnlock();
    }
  }

  getAudioStream() {
    this.init();
    return this.streamDestination ? this.streamDestination.stream : null;
  }

  getFrequencyData(array) {
    if (!this.analyser) return;
    this.analyser.getByteFrequencyData(array);
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (!this.masterGain) return;
    this.masterGain.gain.value = muted ? 0 : 0.8;
  }

  setSfxVolume(vol) {
    if (!this.sfxGain) return;
    this.sfxGain.gain.value = Math.max(0, Math.min(1, vol));
  }

  setMusicVolume(vol) {
    if (!this.musicGain) return;
    this.musicGain.gain.value = Math.max(0, Math.min(1, vol));
  }

  setMusicTrack(trackName) {
    this.currentTrack = trackName;
    this.musicStep = 0;
  }

  // --- Sound Effects (SFX) ---

  playBounce(intensity = 1) {
    if (!this.soundEnabled || this.isMuted) return;
    this.init();
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    const now = performance.now();
    if (now - this.lastBounceTime < 28) return;
    this.lastBounceTime = now;

    try {
      const t = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      const freq = 190 + Math.random() * 80 + intensity * 70;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.05);

      gain.gain.setValueAtTime(Math.min(0.2, 0.04 + intensity * 0.08), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.05);
    } catch (e) {}
  }

  playBladeHit() {
    if (!this.soundEnabled || this.isMuted) return;
    this.init();
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    try {
      const t = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const filter = this.audioCtx.createBiquadFilter();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700 + Math.random() * 220, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.09);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600, t);
      filter.Q.setValueAtTime(5, t);

      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.09);
    } catch (e) {}
  }

  playBumperHit() {
    if (!this.soundEnabled || this.isMuted) return;
    this.init();
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    try {
      const t = this.audioCtx.currentTime;

      // Heavy bass boom
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(140, t);
      osc1.frequency.exponentialRampToValueAtTime(32, t + 0.2);
      gain1.gain.setValueAtTime(0.38, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc1.connect(gain1);
      gain1.connect(this.sfxGain);
      osc1.start(t);
      osc1.stop(t + 0.2);

      // High electric pop
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(850, t);
      osc2.frequency.exponentialRampToValueAtTime(280, t + 0.06);
      gain2.gain.setValueAtTime(0.14, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc2.connect(gain2);
      gain2.connect(this.sfxGain);
      osc2.start(t);
      osc2.stop(t + 0.06);
    } catch (e) {}
  }

  playLaserZap() {
    if (!this.soundEnabled || this.isMuted) return;
    this.init();
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    try {
      const t = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.12);
    } catch (e) {}
  }

  playElimination() {
    if (!this.soundEnabled || this.isMuted) return;
    this.init();
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    try {
      const t = this.audioCtx.currentTime;

      // Sonic bass drop
      const osc = this.audioCtx.createOscillator();
      const oscGain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(20, t + 0.4);
      oscGain.gain.setValueAtTime(0.45, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(oscGain);
      oscGain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.4);

      // Noise explosion blast
      const bufferSize = this.audioCtx.sampleRate * 0.28;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, t);
      filter.frequency.exponentialRampToValueAtTime(80, t + 0.28);

      const noiseGain = this.audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.35, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      noise.start(t);

      // Trigger brief crowd cheer on key moments
      this.playCrowdCheer(0.6);
    } catch (e) {}
  }

  playEventAlarm() {
    if (!this.soundEnabled || this.isMuted) return;
    this.init();
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    try {
      const t = this.audioCtx.currentTime;
      for (let i = 0; i < 3; i++) {
        const time = t + i * 0.13;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(920, time);
        osc.frequency.exponentialRampToValueAtTime(460, time + 0.09);
        gain.gain.setValueAtTime(0.22, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(time);
        osc.stop(time + 0.09);
      }
    } catch (e) {}
  }

  playCrowdCheer(durationSec = 2.0) {
    if (!this.soundEnabled || this.isMuted) return;
    this.init();
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    try {
      const t = this.audioCtx.currentTime;
      const bufferSize = Math.floor(this.audioCtx.sampleRate * durationSec);
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate pink noise for stadium crowd cheer
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2 + white * 0.1) * 0.25;
      }

      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;

      const bandpass = this.audioCtx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(850, t);
      bandpass.Q.setValueAtTime(1.5, t);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, t + durationSec);

      source.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(this.sfxGain);

      source.start(t);
      source.stop(t + durationSec);
    } catch (e) {}
  }

  playVictoryFanfare() {
    if (!this.soundEnabled || this.isMuted) return;
    this.init();
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    try {
      const t = this.audioCtx.currentTime;
      // Majestic triumphant arpeggio
      const notes = [
        { f: 261.63, d: 0.15 }, // C4
        { f: 329.63, d: 0.15 }, // E4
        { f: 392.00, d: 0.15 }, // G4
        { f: 523.25, d: 0.22 }, // C5
        { f: 392.00, d: 0.12 }, // G4
        { f: 523.25, d: 0.55 }, // C5
        { f: 659.25, d: 0.75 }, // E5
      ];

      let accumulatedTime = t;
      notes.forEach((note) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note.f, accumulatedTime);

        gain.gain.setValueAtTime(0.22, accumulatedTime);
        gain.gain.exponentialRampToValueAtTime(0.001, accumulatedTime + note.d);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(accumulatedTime);
        osc.stop(accumulatedTime + note.d);

        accumulatedTime += note.d * 0.75;
      });

      // Big stadium roar for the champion
      setTimeout(() => this.playCrowdCheer(4.0), 300);
    } catch (e) {}
  }

  // --- Copyright-Free Procedural Music Synthesizer ---

  startMusicLoop() {
    if (this.musicInterval) return;
    this.init();

    const bpm = 126;
    const stepTimeMs = (60 / bpm / 4) * 1000;

    // Scales for different track styles
    const synthwaveScale = [55, 55, 65.4, 73.4, 55, 82.4, 73.4, 65.4]; // A minor
    const technoScale = [65.41, 65.41, 77.78, 65.41, 98.00, 87.31, 65.41, 110.00]; // C minor techno
    const arcadeScale = [261.63, 329.63, 392.00, 523.25, 440.00, 392.00, 329.63, 293.66]; // 8-bit pentatonic
    const lofiScale = [43.65, 43.65, 51.91, 58.27, 43.65, 65.41, 58.27, 51.91]; // F minor chill

    this.musicInterval = setInterval(() => {
      if (!this.musicEnabled || this.isMuted || !this.audioCtx || this.audioCtx.state !== 'running') return;

      try {
        const t = this.audioCtx.currentTime;
        const step = this.musicStep % 16;
        this.musicStep++;

        let activeScale = synthwaveScale;
        if (this.currentTrack === 'techno') activeScale = technoScale;
        else if (this.currentTrack === 'arcade') activeScale = arcadeScale;
        else if (this.currentTrack === 'lofi') activeScale = lofiScale;

        // 1. Kick Drum on beats (0, 4, 8, 12)
        if (step % 4 === 0) {
          const kick = this.audioCtx.createOscillator();
          const kickGain = this.audioCtx.createGain();
          kick.type = 'sine';
          const startF = this.currentTrack === 'techno' ? 160 : 135;
          kick.frequency.setValueAtTime(startF, t);
          kick.frequency.exponentialRampToValueAtTime(36, t + 0.09);
          kickGain.gain.setValueAtTime(0.3, t);
          kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
          kick.connect(kickGain);
          kickGain.connect(this.musicGain);
          kick.start(t);
          kick.stop(t + 0.09);
        }

        // 2. Snare / Clap on 4, 12
        if (step === 4 || step === 12) {
          const bufferSize = this.audioCtx.sampleRate * 0.04;
          const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

          const snare = this.audioCtx.createBufferSource();
          snare.buffer = buffer;
          const filter = this.audioCtx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(1200, t);
          const gain = this.audioCtx.createGain();
          gain.gain.setValueAtTime(0.12, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
          snare.connect(filter);
          filter.connect(gain);
          gain.connect(this.musicGain);
          snare.start(t);
        }

        // 3. Bass synth on 16th steps
        if (step % 2 === 0) {
          const noteIndex = Math.floor(step / 2) % activeScale.length;
          const freq = activeScale[noteIndex];
          const bass = this.audioCtx.createOscillator();
          const filter = this.audioCtx.createBiquadFilter();
          const bassGain = this.audioCtx.createGain();

          bass.type = this.currentTrack === 'arcade' ? 'square' : 'sawtooth';
          bass.frequency.setValueAtTime(freq, t);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(340 + (step % 4) * 90, t);
          filter.Q.setValueAtTime(3.5, t);

          bassGain.gain.setValueAtTime(0.14, t);
          bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

          bass.connect(filter);
          filter.connect(bassGain);
          bassGain.connect(this.musicGain);

          bass.start(t);
          bass.stop(t + 0.12);
        }

        // 4. Hi-hats on off-beats
        if (step % 2 === 1) {
          const bufferSize = this.audioCtx.sampleRate * 0.02;
          const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

          const hat = this.audioCtx.createBufferSource();
          hat.buffer = buffer;
          const filter = this.audioCtx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(7500, t);
          const hatGain = this.audioCtx.createGain();
          hatGain.gain.setValueAtTime(0.045, t);
          hatGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
          hat.connect(filter);
          filter.connect(hatGain);
          hatGain.connect(this.musicGain);
          hat.start(t);
        }
      } catch (e) {}
    }, stepTimeMs);
  }

  stopMusicLoop() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}
