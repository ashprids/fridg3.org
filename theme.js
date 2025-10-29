document.addEventListener('DOMContentLoaded', function() {
    const themeButton = document.getElementById('change-theme');
    const rssImage = document.querySelector('.rss img');
    const currentTheme = localStorage.getItem('theme') || 'dark'; // dark default
    const popupClicked = localStorage.getItem('popup1') === 'true';

    const themeTooltip = document.createElement('div');
    themeTooltip.id = 'themeTooltip';
    themeTooltip.className = 'speech-bubble';
    themeTooltip.innerHTML = '<img src="/resources/popup.png">';
    document.body.appendChild(themeTooltip);

    if (currentTheme === 'light') {
        document.body.classList.add('light');
        document.querySelector('.container').classList.add('light');
        themeButton.classList.add('light');
        themeButton.querySelector('i').classList.remove('fa-sun');
        themeButton.querySelector('i').classList.add('fa-moon');
        if (rssImage) {
            document.querySelector('.rss').classList.add('light');
            rssImage.src = '/resources/rss_light.png';
        }
        document.querySelectorAll('.post').forEach(post => post.classList.add('light'));
        document.querySelectorAll('#date').forEach(post => post.classList.add('light'));
    } else {
        themeButton.classList.add('dark');
    }

    themeButton.addEventListener('click', function() {
        document.body.classList.toggle('light');
        document.querySelector('.container').classList.toggle('light');
        document.querySelectorAll('.post').forEach(post => post.classList.toggle('light'));
        document.querySelectorAll('#date').forEach(post => post.classList.toggle('light'));
        themeButton.classList.toggle('light');
        themeButton.classList.toggle('dark');

        const icon = themeButton.querySelector('i');
        if (document.body.classList.contains('light')) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            localStorage.setItem('theme', 'light');
            if (rssImage) {
                document.querySelector('.rss').classList.add('light');
                rssImage.src = '/resources/rss_light.png';
            }
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            localStorage.setItem('theme', 'dark');
            if (rssImage) {
                document.querySelector('.rss').classList.remove('light');
                rssImage.src = '/resources/rss_dark.png';
            }
        }
    });

    // confetti generator
    function createConfetti() {
        const colors = ['#fff'];
        const shapes = ["🎃", "👻", "🕸️", "🍬", "🍭", "🦇", "🌕"];
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.innerHTML = shapes[Math.floor(Math.random() * shapes.length)];
        confetti.style.left = Math.random() * window.innerWidth + 'px';
        confetti.style.top = '-20px';
        confetti.style.fontSize = Math.random() * 15 + 10 + 'px';
        confetti.style.opacity = Math.random() * 0.5 + 0.5;
        confetti.style.color = colors[Math.floor(Math.random() * colors.length)];
        const duration = Math.random() * 1 + 7;
        confetti.style.animationDuration = duration + 's, ' + (Math.random() * 0.1 + 1) + 's';
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), duration * 1000);
    }

    setInterval(createConfetti,160);
});
