// WebGL 2D/3D Shader Pipeline for Cyberpunk Arena Background & Visual FX
export class WebGLArenaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    this.program = null;
    this.positionBuffer = null;
    this.uniforms = {};
    this.startTime = performance.now();
    this.shockwaves = []; // { x, y, radius, maxRadius, alpha }
    this.theme = 'cyberpunk'; // 'cyberpunk', 'deepspace', 'magma', 'synthwave'
    this.pulseIntensity = 0;

    if (this.gl) {
      this.initShaders();
    } else {
      console.warn("WebGL not supported, falling back to 2D canvas effects.");
    }
  }

  initShaders() {
    const gl = this.gl;

    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      varying vec2 v_uv;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_arenaCenter;
      uniform float u_arenaRadius;
      uniform int u_theme;
      uniform float u_pulse;
      uniform vec4 u_shockwave; // x, y, radius, strength

      // Simplex-like pseudo noise
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution;
        vec2 p = (gl_FragCoord.xy - u_arenaCenter) / u_resolution.y;
        float dist = length(p) * u_resolution.y;

        // Apply shockwave ripple distortion
        if (u_shockwave.w > 0.01) {
          vec2 shockCenter = (u_shockwave.xy - u_arenaCenter) / u_resolution.y;
          float shockDist = length(p - shockCenter) * u_resolution.y;
          float diff = abs(shockDist - u_shockwave.z);
          if (diff < 35.0) {
            float wave = sin(diff * 0.18) * u_shockwave.w * (1.0 - diff / 35.0);
            p += normalize(p - shockCenter) * wave * 0.04;
            dist = length(p) * u_resolution.y;
          }
        }

        vec3 color = vec3(0.02, 0.04, 0.08);

        if (u_theme == 0) {
          // Cyberpunk Neon Arena
          float angle = atan(p.y, p.x);
          float grid = abs(sin(angle * 16.0 + u_time * 0.4)) * 0.15;
          float rings = abs(sin(dist * 0.035 - u_time * 1.5)) * 0.2;
          
          vec3 neonBlue = vec3(0.0, 0.65, 1.0);
          vec3 neonPink = vec3(1.0, 0.0, 0.55);
          vec3 neonCyan = vec3(0.0, 0.95, 0.75);

          vec3 bgGrad = mix(vec3(0.01, 0.02, 0.06), vec3(0.05, 0.1, 0.2), clamp(1.0 - dist / (u_arenaRadius * 1.6), 0.0, 1.0));
          color = bgGrad + (neonBlue * grid + neonPink * rings) * 0.35;

          // Arena boundary edge glow
          float edgeDist = abs(dist - u_arenaRadius);
          if (edgeDist < 8.0) {
            float glow = (1.0 - edgeDist / 8.0);
            color += mix(neonCyan, neonPink, sin(angle * 3.0 + u_time * 2.0) * 0.5 + 0.5) * glow * 1.4;
          }

          // Rotating laser scanner lines
          float scanAngle = mod(u_time * 0.8, 6.28318);
          float scanDiff = abs(mod(angle - scanAngle + 3.14159, 6.28318) - 3.14159);
          if (scanDiff < 0.04 && dist < u_arenaRadius) {
            color += neonCyan * (1.0 - scanDiff / 0.04) * 0.6;
          }

        } else if (u_theme == 1) {
          // Deep Space Nebula
          float angle = atan(p.y, p.x);
          float stars = step(0.985, hash(floor(gl_FragCoord.xy * 0.5) + floor(u_time * 0.05))) * 0.6;
          float swirl = sin(angle * 4.0 + dist * 0.02 - u_time * 0.8);
          
          vec3 spaceDeep = vec3(0.005, 0.008, 0.02);
          vec3 purpleNebula = vec3(0.4, 0.05, 0.7);
          vec3 goldDust = vec3(1.0, 0.7, 0.2);

          color = spaceDeep + purpleNebula * (swirl * 0.25 + 0.25) + vec3(stars);
          
          float edgeDist = abs(dist - u_arenaRadius);
          if (edgeDist < 6.0) {
            color += goldDust * (1.0 - edgeDist / 6.0) * 1.5;
          }

        } else if (u_theme == 2) {
          // Magma Inferno
          float noiseVal = sin(p.x * 20.0 + u_time) * cos(p.y * 20.0 + u_time);
          vec3 lavaDark = vec3(0.08, 0.01, 0.01);
          vec3 lavaBright = vec3(1.0, 0.25, 0.0);
          vec3 lavaCore = vec3(1.0, 0.85, 0.1);

          color = mix(lavaDark, lavaBright, clamp(noiseVal * 0.5 + 0.5, 0.0, 1.0) * 0.4);
          
          float edgeDist = abs(dist - u_arenaRadius);
          if (edgeDist < 8.0) {
            color += lavaCore * (1.0 - edgeDist / 8.0) * 1.8;
          }
        }

        // Global pulse & Vignette
        color += color * u_pulse * 0.6;
        float vignette = 1.0 - length(st - 0.5) * 0.9;
        color *= clamp(vignette, 0.1, 1.0);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error("WebGL program link error:", gl.getProgramInfoLog(this.program));
      return;
    }

    // Quad geometry covering whole viewport
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Uniform locations
    this.uniforms = {
      resolution: gl.getUniformLocation(this.program, "u_resolution"),
      time: gl.getUniformLocation(this.program, "u_time"),
      arenaCenter: gl.getUniformLocation(this.program, "u_arenaCenter"),
      arenaRadius: gl.getUniformLocation(this.program, "u_arenaRadius"),
      theme: gl.getUniformLocation(this.program, "u_theme"),
      pulse: gl.getUniformLocation(this.program, "u_pulse"),
      shockwave: gl.getUniformLocation(this.program, "u_shockwave"),
    };
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  setTheme(name) {
    this.theme = name;
  }

  triggerShockwave(x, y) {
    this.shockwaves.push({
      x,
      y,
      radius: 0,
      maxRadius: 380,
      strength: 1.0,
    });
    this.pulseIntensity = 0.8;
  }

  render(arenaCenter = { x: 640, y: 360 }, arenaRadius = 330) {
    const gl = this.gl;
    if (!gl || !this.program) return;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    gl.useProgram(this.program);

    const time = (performance.now() - this.startTime) / 1000.0;

    // Decay pulse intensity
    this.pulseIntensity *= 0.92;

    // Process shockwaves
    let activeShock = { x: 0, y: 0, radius: 0, strength: 0 };
    if (this.shockwaves.length > 0) {
      const sw = this.shockwaves[0];
      sw.radius += 12;
      sw.strength = Math.max(0, 1.0 - sw.radius / sw.maxRadius);
      activeShock = sw;
      if (sw.radius >= sw.maxRadius) {
        this.shockwaves.shift();
      }
    }

    const themeIndex = this.theme === 'deepspace' ? 1 : this.theme === 'magma' ? 2 : 0;

    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.time, time);
    gl.uniform2f(this.uniforms.arenaCenter, arenaCenter.x, this.canvas.height - arenaCenter.y);
    gl.uniform1f(this.uniforms.arenaRadius, arenaRadius);
    gl.uniform1i(this.uniforms.theme, themeIndex);
    gl.uniform1f(this.uniforms.pulse, this.pulseIntensity);
    gl.uniform4f(
      this.uniforms.shockwave,
      activeShock.x,
      this.canvas.height - activeShock.y,
      activeShock.radius,
      activeShock.strength
    );

    const posAttr = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posAttr);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
