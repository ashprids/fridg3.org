document.addEventListener('DOMContentLoaded', function() {
    const themeButton = document.getElementById('change-theme');
    const rssImage = document.querySelector('.rss img');
    const currentTheme = localStorage.getItem('theme') || 'light';
    const popupClicked = localStorage.getItem('popup1') === 'true';

    // TO RESET THE POPUP COOKIES:
    // Find & replace:
    // 'popup0'
    // with:
    // 'popup1'
    // Replace the numbers so they increment. This ensures that
    // users who have cleared the popup will see new ones.

    const themeTooltip = document.createElement('div');
    themeTooltip.id = 'themeTooltip';
    themeTooltip.className = 'speech-bubble';
    themeTooltip.innerHTML = '<img src="/resources/popup.png">';
    document.body.appendChild(themeTooltip);

    if (currentTheme === 'dark') {
        document.body.classList.add('dark');
        document.querySelector('.container').classList.add('dark');
        themeButton.classList.add('dark');
        themeButton.querySelector('i').classList.remove('fa-sun');
        themeButton.querySelector('i').classList.add('fa-moon');
        if (rssImage) {
            document.querySelector('.rss').classList.add('dark');
            rssImage.src = '/resources/rss_dark.png';
        }
        document.querySelectorAll('.post').forEach(post => post.classList.add('dark'));
    } else {
        themeButton.classList.add('light');
    }

    // Show tooltip if not clicked before
    if (!popupClicked && document.querySelector('.speech-bubble')) {
        setTimeout(() => {
            themeTooltip.classList.add('show-tooltip');
        }, 1000);
        setTimeout(() => {
            themeTooltip.classList.remove('show-tooltip');
        }, 8000);
    }

    if (themeTooltip) {
        themeTooltip.addEventListener('click', function() {
            themeTooltip.classList.remove('show-tooltip');
            localStorage.setItem('popup1', true);
        });
    }

    themeButton.addEventListener('click', function() {
        document.body.classList.toggle('dark');
        document.querySelector('.container').classList.toggle('dark');
        document.querySelectorAll('.post').forEach(post => post.classList.toggle('dark'));
        document.querySelectorAll('#date').forEach(post => post.classList.toggle('dark'));
        themeButton.classList.toggle('dark');
        themeButton.classList.toggle('light');

        const icon = themeButton.querySelector('i');
        if (document.body.classList.contains('dark')) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            localStorage.setItem('theme', 'dark');
            if (rssImage) {
                document.querySelector('.rss').classList.add('dark');
                rssImage.src = '/resources/rss_dark.png';
            }
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            localStorage.setItem('theme', 'light');
            if (rssImage) {
                document.querySelector('.rss').classList.remove('dark');
                rssImage.src = '/resources/rss_light.png';
            }
        }
    });

    function createConfetti() {
        const colors = ['#fff']; // Define your set of colors here
        const shapes = ["*"]; // Define your set of shapes here
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.innerHTML = shapes[Math.floor(Math.random() * shapes.length)]; // Randomly select a shape
        confetti.style.left = Math.random() * window.innerWidth + 'px';
        confetti.style.top = '-20px';
        confetti.style.fontSize = Math.random() * 15 + 10 + 'px';
        confetti.style.opacity = Math.random() * 0.5 + 0.5;
        confetti.style.color = colors[Math.floor(Math.random() * colors.length)]; // Randomly select a color
        const duration = Math.random() * 1 + 7;
        confetti.style.animationDuration = duration + 's, ' + (Math.random() * 0.1 + 1) + 's';
        document.body.appendChild(confetti);

        setTimeout(() => {
            confetti.remove();
        }, duration * 1000);
    }

    //setInterval(createConfetti,160);
    
});

