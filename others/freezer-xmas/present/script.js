document.addEventListener('DOMContentLoaded', () => {
	const envelope = document.getElementById('envelope');
	const open1 = document.getElementById('envelope-open1');
	const open2 = document.getElementById('envelope-open2');
	const letter = document.getElementById('letter');
	const hint = document.getElementById('hint');
	const openAudio = new Audio('/others/freezer-xmas/present/open.ogg');
	const ascendAudio = new Audio('/others/freezer-xmas/present/ascend.ogg');
	const musicAudio = new Audio('/others/freezer-xmas/present/music.ogg');
	if (!envelope) return;

	// Inject keyframes for the flight + spin sequence
	const style = document.createElement('style');
	style.textContent = `
		@keyframes envelope-flight {
			0% {
				top: 120%;
				transform: translate(-50%, -50%) rotateX(0deg) rotateY(0deg);
			}
			80% {
				top: 50%;
				transform: translate(-50%, -50%) rotateX(720deg) rotateY(720deg);
			}
			100% {
				top: 50%;
				transform: translate(-50%, -50%) rotateX(720deg) rotateY(720deg);
			}
		}
		@keyframes envelopes-fall {
			0% {
				top: 50%;
				opacity: 1;
			}
			100% {
				top: 150%;
				opacity: 0;
			}
		}
		@keyframes letter-expand {
			0% {
				transform: translate(-50%, -100%) scale(1);
			}
			100% {
				transform: translate(-50%, -100%) scale(2);
			}
		}
		@keyframes confetti-fall {
			0% {
				top: -10%;
				opacity: 1;
			}
			100% {
				top: 110%;
				opacity: 0.8;
			}
		}
		.confetti-container {
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
			z-index: 1;
		}
		.confetti {
			position: absolute;
			width: 10px;
			height: 10px;
			top: -10%;
			animation: confetti-fall linear infinite;
		}
		@keyframes hint-fade-in {
			0% {
				opacity: 0;
			}
			100% {
				opacity: 1;
			}
		}
		#hint {
			animation: hint-fade-in 2s ease-in-out forwards;
		}
	`;
	document.head.appendChild(style);

	// Create confetti function
	const createConfetti = () => {
		const container = document.createElement('div');
		container.className = 'confetti-container';
		document.body.appendChild(container);

		const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#fd79a8'];
		
		for (let i = 0; i < 100; i++) {
			const confetti = document.createElement('div');
			confetti.className = 'confetti';
			confetti.style.left = Math.random() * 100 + '%';
			confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
			confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
			confetti.style.animationDelay = Math.random() * 2 + 's';
			confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
			container.appendChild(confetti);
		}
	};

	// Prepare envelope positioning (animation will be triggered on click)
	envelope.style.position = 'fixed';
	envelope.style.left = '50%';
	envelope.style.top = '120%'; // off-screen bottom
    envelope.style.transform = 'translate(-50%, -50%)';
	envelope.style.transformStyle = 'preserve-3d';
	envelope.style.backfaceVisibility = 'visible';
	envelope.style.animation = 'none';

	// Position opened images in the center and keep hidden initially
	[open1, open2].forEach((el) => {
		if (!el) return;
		el.style.position = 'fixed';
		el.style.left = '50%';
		el.style.top = '50%';
		el.style.transform = 'translate(-50%, -50%)';
		el.style.visibility = 'hidden';
	});

	// Position letter so its bottom aligns with open1's bottom
	if (letter) {
		letter.style.position = 'fixed';
		letter.style.left = '50%';
		letter.style.top = 'calc(50% + 90px)';
		letter.style.transform = 'translate(-50%, -100%)';
		letter.style.visibility = 'hidden';
	}

	// Trigger ascend animation and sound on first body click
	let ascended = false;
	document.body.addEventListener('click', () => {
		// Hide hint on first click with fade out
		if (hint) {
			hint.style.transition = 'opacity 0.5s ease-out';
			hint.style.opacity = '0';
			setTimeout(() => {
				hint.style.display = 'none';
			}, 500);
		}
		
		if (ascended) return;
		ascended = true;
		ascendAudio.play().catch(() => {});
		envelope.style.animation = 'envelope-flight 3s ease-out forwards';
	}, { once: true });

	// On envelope click: hide closed envelope, show opened variants
	let letterVisible = false;
	envelope.addEventListener('click', (e) => {
		openAudio.play().catch(() => {});
		envelope.style.visibility = 'hidden';
		if (open1) open1.style.visibility = 'visible';
		if (letter) letter.style.visibility = 'visible';
		if (open2) open2.style.visibility = 'visible';
		
		// Prevent this click from triggering the letter expand logic
		e.stopPropagation();
		
		// Set flag after a short delay to allow next clicks to work
		setTimeout(() => {
			letterVisible = true;
		}, 100);
	});

	// On screen click while letter is visible: animate envelopes down and letter expand
	let letterClickHandled = false;
	document.body.addEventListener('click', (e) => {
		if (letterClickHandled || !letterVisible) return;
		if (letter && letter.style.visibility === 'visible') {
			letterClickHandled = true;

			// Animate envelopes falling off-screen
			const fallDuration = '1s';
			[open1, open2].forEach((el) => {
				if (!el) return;
				el.style.transition = 'top ' + fallDuration + ' ease-in, opacity ' + fallDuration + ' ease-in';
				el.style.top = '150%';
				el.style.opacity = '0';
			});

			// After envelopes fall, expand letter
			setTimeout(() => {
				if (letter) {
					letter.style.transition = 'transform 1s ease-out';
					letter.style.transform = 'translate(-50%, -100%) scale(2)';
				}
			}, 1000);

			// After 2 seconds from click, trigger confetti and music
			setTimeout(() => {
				createConfetti();
				musicAudio.play().catch(() => {});
			}, 2000);
		}
	});
});
