(function attachUfoDeathEffect(global) {
  class UfoDeathEffect {
    constructor(opts = {}) {
      this.active = false;
      this.t = 0;
      this.duration = opts.duration ?? 800;
      this.center = { x: 0, y: 0 };

      this.baseRadius = opts.baseRadius ?? 104;
      this.thickness = opts.thickness ?? 2.2;
      this.color = opts.color ?? "120,245,255";
      this.arcCount = opts.arcCount ?? 16;
      this.jitter = opts.jitter ?? 10;
      this.glow = opts.glow ?? 14;
      this.flashStrength = opts.flashStrength ?? 1.0;
      this.sparkCount = opts.sparkCount ?? 64;

      this.secondaryDelay = opts.secondaryDelay ?? 100;
      this.secondaryDuration = opts.secondaryDuration ?? 650;
      this.secondaryPendingMs = -1;
      this.secondaryActive = false;
      this.secondaryT = 0;

      this.maxParticles = opts.maxParticles ?? 320;
      this.particles = [];
      this.pool = [];
      this.spin = 0;
    }

    trigger(x, y) {
      this.center.x = x;
      this.center.y = y;
      this.t = 0;
      this.active = true;
      this.secondaryPendingMs = this.secondaryDelay;
      this.secondaryActive = false;
      this.secondaryT = 0;
      this.emitParticles(this.sparkCount, 1.0, this.baseRadius);
    }

    update(dtMs, canvasW, canvasH) {
      if (this.active) {
        this.t += dtMs;
        this.spin += dtMs * 0.0023;
        if (this.t >= this.duration) this.active = false;
      }

      if (this.secondaryPendingMs >= 0) {
        this.secondaryPendingMs -= dtMs;
        if (this.secondaryPendingMs <= 0) {
          this.secondaryPendingMs = -1;
          this.secondaryActive = true;
          this.secondaryT = 0;
          const hugeR = Math.min(canvasW, canvasH) * 0.4; // 80% diameter
          this.emitParticles(120, 1.9, hugeR);
        }
      }

      if (this.secondaryActive) {
        this.secondaryT += dtMs;
        if (this.secondaryT >= this.secondaryDuration) this.secondaryActive = false;
      }

      const dt = dtMs / 1000;
      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles[i] = this.particles[this.particles.length - 1];
          this.particles.pop();
          this.pool.push(p);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;
      }
    }

    draw(ctx, canvasW, canvasH) {
      this.drawParticles(ctx);
      this.drawSecondaryPulse(ctx, canvasW, canvasH);
      if (!this.active) return;

      const p = this.t / this.duration;
      const easeOut = 1 - (1 - p) ** 3;
      const alpha = 1 - p;
      const radius = this.baseRadius + easeOut * 72;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const flashAlpha = Math.max(0, (0.18 - p) / 0.18) * this.flashStrength;
      if (flashAlpha > 0) {
        const grad = ctx.createRadialGradient(this.center.x, this.center.y, 0, this.center.x, this.center.y, radius * 1.2);
        grad.addColorStop(0, `rgba(230,250,255,${0.55 * flashAlpha})`);
        grad.addColorStop(1, "rgba(230,250,255,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.center.x, this.center.y, radius * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.lineWidth = this.thickness + (1 - p) * 1.2;
      ctx.shadowBlur = this.glow;
      ctx.shadowColor = `rgba(${this.color},${0.85 * alpha})`;
      ctx.strokeStyle = `rgba(${this.color},${0.95 * alpha})`;

      const seed = ((this.t * 0.03) | 0) % 997;
      for (let i = 0; i < this.arcCount; i += 1) {
        const a0 = this.spin + (i / this.arcCount) * Math.PI * 2;
        const arcLen = 0.15 + (((seed + i * 17) % 100) / 100) * 0.25;
        const a1 = a0 + arcLen;
        const n0 = Math.sin((seed + i * 1.7) * 0.18);
        const n1 = Math.sin((seed + i * 2.3) * 0.21);
        const nMid = Math.sin((seed + i * 2.9) * 0.24);
        const r0 = radius + n0 * this.jitter;
        const r1 = radius + n1 * this.jitter;
        const rMid = radius + nMid * this.jitter * 1.8;
        const am = (a0 + a1) * 0.5;

        const x0 = this.center.x + Math.cos(a0) * r0;
        const y0 = this.center.y + Math.sin(a0) * r0;
        const xm = this.center.x + Math.cos(am) * rMid;
        const ym = this.center.y + Math.sin(am) * rMid;
        const x1 = this.center.x + Math.cos(a1) * r1;
        const y1 = this.center.y + Math.sin(a1) * r1;

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(xm, ym, x1, y1);
        ctx.stroke();
      }

      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(${this.color},${0.25 * alpha})`;
      ctx.beginPath();
      ctx.arc(this.center.x, this.center.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    emitParticles(count, speedMult, emitRadius) {
      for (let i = 0; i < count; i += 1) {
        if (this.particles.length >= this.maxParticles) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = (70 + Math.random() * 260) * speedMult;
        const startR = emitRadius * (0.7 + Math.random() * 0.45);
        const ttl = 0.25 + Math.random() * 0.55;
        const p = this.pool.pop() || {};
        p.x = this.center.x + Math.cos(angle) * startR;
        p.y = this.center.y + Math.sin(angle) * startR;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = ttl;
        p.ttl = ttl;
        p.size = 1 + Math.random() * 2.8;
        this.particles.push(p);
      }
    }

    drawParticles(ctx) {
      if (!this.particles.length) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < this.particles.length; i += 1) {
        const p = this.particles[i];
        const a = p.life / p.ttl;
        ctx.fillStyle = `rgba(180,245,255,${0.75 * a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.65 + 0.35 * a), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawSecondaryPulse(ctx, canvasW, canvasH) {
      if (!this.secondaryActive) return;
      const p = this.secondaryT / this.secondaryDuration;
      const a = 1 - p;
      const flash = 0.45 + 0.55 * ((Math.sin(this.secondaryT * 0.09) + 1) * 0.5);
      const hugeR = Math.min(canvasW, canvasH) * 0.4;
      const radius = hugeR + p * 24;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const g = ctx.createRadialGradient(this.center.x, this.center.y, 0, this.center.x, this.center.y, radius);
      g.addColorStop(0, `rgba(235,250,255,${0.24 * a * flash})`);
      g.addColorStop(0.6, `rgba(165,235,255,${0.16 * a * flash})`);
      g.addColorStop(1, "rgba(165,235,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.center.x, this.center.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(215,248,255,${0.95 * a * flash})`;
      ctx.lineWidth = 4 + (1 - p) * 3;
      ctx.shadowBlur = 34;
      ctx.shadowColor = `rgba(210,245,255,${0.95 * a * flash})`;
      ctx.beginPath();
      ctx.arc(this.center.x, this.center.y, radius * (0.95 + 0.02 * flash), 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  global.UfoDeathEffect = UfoDeathEffect;
})(window);
