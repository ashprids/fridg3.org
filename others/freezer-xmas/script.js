document.addEventListener('DOMContentLoaded', () => {
	const container = document.querySelector('.container');
	const changeThemeBtn = document.getElementById('change-theme');
	const body = document.body;

	if (!container) return;

	const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	const onTransitionEnd = (el, propertyName) =>
		new Promise((resolve) => {
			let resolved = false;
			const handler = (e) => {
				if (!propertyName || e.propertyName === propertyName) {
					el.removeEventListener('transitionend', handler);
					resolved = true;
					resolve();
				}
			};
			el.addEventListener('transitionend', handler, { once: true });
			// Fallback in case transitionend doesn't fire
			setTimeout(() => { if (!resolved) resolve(); }, 2500);
		});

	(async () => {
		// Phase 0: initial wait
		await wait(3000);

		// Phase 1: fade container out over 2s
		container.style.willChange = 'opacity';
		container.style.transition = 'opacity 2s ease';
		container.style.opacity = '0';
		await onTransitionEnd(container, 'opacity');

		// Phase 2: concurrently fade button and body background over 2s
		const promises = [];

		if (changeThemeBtn) {
			changeThemeBtn.style.willChange = 'opacity';
			changeThemeBtn.style.transition = 'opacity 2s ease';
			changeThemeBtn.style.opacity = '0';
			promises.push(onTransitionEnd(changeThemeBtn, 'opacity'));
		}

		// Animate body background to #121212 over 2s
		body.style.transition = 'background-color 2s ease, color 2s ease';
		body.style.backgroundColor = '#121212';
		promises.push(
			new Promise((resolve) => {
				let done = false;
				const bodyHandler = (e) => {
					if (e.propertyName === 'background-color') {
						body.removeEventListener('transitionend', bodyHandler);
						done = true;
						resolve();
					}
				};
				body.addEventListener('transitionend', bodyHandler, { once: true });
				setTimeout(() => { if (!done) resolve(); }, 2500);
			})
		);

		await Promise.all(promises);

		// Redirect after everything fully faded
		window.location.href = 'present/';
	})();
});

