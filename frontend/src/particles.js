// Particle background animation — lazy loaded to avoid blocking graph init
const cv = document.getElementById('bgCanvas');
if (cv) {
    const ctx = cv.getContext('2d');
    let W, H;
    let rafId = 0;
    let paused = false;
    let graphLoaded = false;
    const COLORS = ['#c8d8f0', '#a0b8e0', '#e0e8f8', '#8eaadc', '#d0dff5', '#b8c8e4', '#f0f4ff'];
    const particles = [];
    const isNarrowViewport = window.innerWidth < 900;
    const cores = Number(window.navigator.hardwareConcurrency || 4);
    const lowPower = isNarrowViewport || cores <= 4;
    const COUNT = lowPower ? 18 : 35;
    const MAX_DIST = lowPower ? 75 : 100;
    const MAX_DIST_SQ = MAX_DIST * MAX_DIST;
    const TARGET_FPS = 24;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;
    let lastFrameTime = 0;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
        W = cv.width = window.innerWidth;
        H = cv.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < COUNT; i++) {
        particles.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.6 + 0.5,
            vx: (Math.random() - 0.5) * 0.18,
            vy: (Math.random() - 0.5) * 0.18,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            alpha: Math.random() * 0.5 + 0.3
        });
    }

    function draw(now) {
        if (paused) return;
        if (now - lastFrameTime < FRAME_INTERVAL) {
            rafId = requestAnimationFrame(draw);
            return;
        }
        lastFrameTime = now;

        if (!graphLoaded && document.body.classList.contains('graph-ready')) {
            graphLoaded = true;
            cv.style.opacity = '0.4';
        }

        ctx.clearRect(0, 0, W, H);
        for (let i = 0; i < COUNT; i++) {
            const pi = particles[i];
            for (let j = i + 1; j < COUNT; j++) {
                const pj = particles[j];
                const dx = pi.x - pj.x;
                const dy = pi.y - pj.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < MAX_DIST_SQ) {
                    const dist = Math.sqrt(distSq);
                    ctx.beginPath();
                    ctx.moveTo(pi.x, pi.y);
                    ctx.lineTo(pj.x, pj.y);
                    ctx.strokeStyle = `rgba(180,200,240,${0.06 * (1 - dist / MAX_DIST)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = W;
            if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H;
            if (p.y > H) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        rafId = requestAnimationFrame(draw);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            paused = true;
            if (rafId) cancelAnimationFrame(rafId);
            return;
        }
        if (!prefersReducedMotion) {
            paused = false;
            rafId = requestAnimationFrame(draw);
        }
    });

    if (!prefersReducedMotion) rafId = requestAnimationFrame(draw);
}
