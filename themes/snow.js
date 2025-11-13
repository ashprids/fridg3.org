(function () {
    // expose a start/stop API on window so callers can reliably disable the effect
    if (!window.__frdg3_snow) window.__frdg3_snow = {};

    function createConfetti() {
        const colors = ['#fff'];
        const shapes = ["*"];
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.innerHTML = shapes[(Math.random() * shapes.length) | 0];
        confetti.style.position = 'fixed';
        confetti.style.left = Math.random() * window.innerWidth + 'px';
        confetti.style.top = '-20px';
        confetti.style.fontSize = Math.random() * 14 + 10 + 'px';
        confetti.style.opacity = (Math.random() * 0.5 + 0.1).toString();
        confetti.style.color = colors[(Math.random() * colors.length) | 0];
        confetti.style.pointerEvents = 'none';
        confetti.style.zIndex = '0';
        const duration = Math.random() * 1 + 7;
        // simple fade/drop animation via CSS -- keep animation names neutral
        confetti.style.transition = `transform ${duration}s linear, opacity ${duration}s linear`;
        confetti.style.transform = `translateY(${window.innerHeight + 40}px)`;
        document.body.appendChild(confetti);
        // remove after animation
        setTimeout(() => { try { confetti.remove(); } catch (e) {} }, duration * 1000 + 250);
    }

    window.__frdg3_snow.start = function () {
        if (window.__frdg3_snow._interval) return;
        window.__frdg3_snow._interval = setInterval(createConfetti, 100);
    };

    window.__frdg3_snow.stop = function () {
        try {
            if (window.__frdg3_snow._interval) { clearInterval(window.__frdg3_snow._interval); window.__frdg3_snow._interval = null; }
        } catch (e) {}
        // remove existing confetti elements
        try {
            document.querySelectorAll && document.querySelectorAll('.confetti').forEach(el => el.remove());
        } catch (e) {}
    };

    // start immediately when the script loads (original behavior)
    window.__frdg3_snow.start();
})();