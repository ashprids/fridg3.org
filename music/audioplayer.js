document.addEventListener("DOMContentLoaded", function() {
    const audio = document.getElementById("audio");
    const playPauseButton = document.getElementById("play-pause");
    const playIcon = document.getElementById("play-icon");
    const pauseIcon = document.getElementById("pause-icon");
    const seekBar = document.getElementById("seek-bar");
    const currentTimeElement = document.getElementById("current-time");
    const durationElement = document.getElementById("duration");

    playPauseButton.addEventListener("click", function() {
        if (audio.paused) {
            audio.play();
            playIcon.style.display = "none";
            pauseIcon.style.display = "inline";
        } else {
            audio.pause();
            playIcon.style.display = "inline";
            pauseIcon.style.display = "none";
        }
    });

    audio.addEventListener("timeupdate", function() {
        const currentTime = audio.currentTime;
        const duration = audio.duration;
        seekBar.value = (currentTime / duration) * 100;
        currentTimeElement.textContent = formatTime(currentTime);
        durationElement.textContent = formatTime(duration);
    });

    seekBar.addEventListener("input", function() {
        const seekTime = (seekBar.value / 100) * audio.duration;
        audio.currentTime = seekTime;
    });

    function formatTime(time) {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
});