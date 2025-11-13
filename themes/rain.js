(() => {
  // inject base css (no splat animation)
  const css = `
  .rain{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
  .rain.front-row{opacity:.9}
  .rain.back-row{opacity:.4;filter:blur(0.5px)}
  .rain .drop{position:absolute;bottom:100%;will-change:transform,opacity}
  .rain .stem{width:2px;height:80px;background:rgba(180,200,255,.6);display:block}
  @keyframes drop{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(0,130vh,0)}}
  @keyframes stem{0%{opacity:0}10%{opacity:1}90%{opacity:1}100%{opacity:0}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // make layers
  const front = document.createElement('div');
  front.className = 'rain front-row';
  const back = document.createElement('div');
  back.className = 'rain back-row';
  document.body.appendChild(front);
  document.body.appendChild(back);

  function makeItRain() {
    front.innerHTML = '';
    back.innerHTML = '';

    let increment = 0;
    let drops = '';
    let backDrops = '';

    while (increment < 100) {
      const randoHundo = Math.floor(Math.random() * 98) + 1;
      const randoFiver = Math.floor(Math.random() * 4) + 2;
      increment += randoFiver;

      const delay = `0.${randoHundo}s`;
      const dur   = `0.5${randoHundo}s`;

      drops += `
        <div class="drop" style="
          left:${increment}%;
          animation:drop ${dur} linear ${delay} infinite;
        ">
          <span class="stem" style="animation:stem ${dur} linear ${delay} infinite;"></span>
        </div>`;

      backDrops += `
        <div class="drop" style="
          right:${increment}%;
          animation:drop ${dur} linear ${delay} infinite;
        ">
          <span class="stem" style="animation:stem ${dur} linear ${delay} infinite;"></span>
        </div>`;
    }

    front.insertAdjacentHTML('beforeend', drops);
    back.insertAdjacentHTML('beforeend', backDrops);
  }

  makeItRain();
  let to;
  window.addEventListener('resize', () => {
    clearTimeout(to);
    to = setTimeout(makeItRain, 150);
  });
})();
