import "./style.css";
import { createWorld } from "./scene/world";

const waveIcon = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M3 13c4-5 8 5 13 0s8 5 13 0M3 20c4-5 8 5 13 0s8 5 13 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const playIcon = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6Z" fill="currentColor"/></svg>`;
const pauseIcon = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const downloadIcon = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3v9m-3-3 3 3 3-3M4 13v3h12v-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="gallery">
    <header class="masthead">
      <a class="brand" href="./" aria-label="半湾首页">${waveIcon}<span>半湾<small>CRESCENT LAKE</small></span></a>
      <p class="edition"><span class="status-dot"></span> 一处可以停留的风景 <span class="edition-number">NO. 001</span></p>
    </header>
    <section class="landscape" aria-label="半湾，实时风景">
      <div class="scene" id="scene"></div>
      <div class="paper-fade" aria-hidden="true"></div>
      <div class="scene-note"><span class="tiny-line"></span><span id="season-note">春日 · 晨光</span></div>
      <div class="light-control" role="group" aria-label="光线">
        <button class="light-choice active" data-light="0" aria-pressed="true">晨光</button>
        <button class="light-choice" data-light="1" aria-pressed="false">暮色</button>
      </div>
      <div class="loading" id="loading" role="status"><span class="loading-wave">${waveIcon}</span><p>风景正在展开</p></div>
      <div class="scene-mark" aria-hidden="true">A LITTLE STILLNESS, IN MOTION.</div>
    </section>
    <footer class="caption">
      <div class="caption-copy"><p class="eyebrow">湖畔手记 · 第一景</p><h1>风轻，水慢<span>。</span></h1><p class="poem">一只白鸟，半弯湖水。<br class="mobile-break">把时间，留给涟漪。</p></div>
      <div class="studio-controls">
        <div class="wind-control"><label for="wind">风的轻重</label><input id="wind" type="range" min="0" max="100" value="35" aria-label="风的轻重"/><span id="wind-label">微风</span></div>
        <div class="actions"><button class="pause-button" id="pause" disabled aria-label="暂停风景" aria-pressed="false">${pauseIcon}<span>停一会儿</span></button><span class="action-divider"></span><button class="save-button" id="save" disabled>${downloadIcon}<span>留住此刻</span></button></div>
      </div>
    </footer>
    <div class="colophon"><span>一幅缓慢发生的风景</span><span>CREATED TO BE UNHURRIED</span></div>
    <p class="notice" id="notice" role="status" aria-live="polite"></p>
  </main>
`;

const sceneContainer = document.querySelector<HTMLDivElement>("#scene")!;
const loading = document.querySelector<HTMLDivElement>("#loading")!;
const pause = document.querySelector<HTMLButtonElement>("#pause")!;
const save = document.querySelector<HTMLButtonElement>("#save")!;
const notice = document.querySelector<HTMLParagraphElement>("#notice")!;
let clearNotice: ReturnType<typeof setTimeout>;
function announce(message: string) {
  notice.textContent = message;
  notice.classList.add("visible");
  clearTimeout(clearNotice);
  clearNotice = setTimeout(() => notice.classList.remove("visible"), 3200);
}

try {
  const world = await createWorld(sceneContainer, {
    onReady() {
      loading.classList.add("loaded");
      pause.disabled = false;
      save.disabled = false;
    },
    onError(message) {
      loading.classList.remove("loaded");
      loading.innerHTML = `<p>${message}</p><button type="button" id="retry">重新展开</button>`;
      document
        .querySelector("#retry")
        ?.addEventListener("click", () => location.reload());
    },
  });
  function updatePause() {
    pause.innerHTML = world.paused
      ? `${playIcon}<span>继续看风景</span>`
      : `${pauseIcon}<span>停一会儿</span>`;
    pause.setAttribute(
      "aria-label",
      world.paused ? "继续播放风景" : "暂停风景",
    );
    pause.setAttribute("aria-pressed", String(world.paused));
  }
  updatePause();
  pause.addEventListener("click", () => {
    world.togglePause();
    updatePause();
  });
  document
    .querySelectorAll<HTMLButtonElement>("[data-light]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const value = Number(button.dataset.light);
        world.setWarmth(value);
        document.querySelectorAll("[data-light]").forEach((choice) => {
          const active = choice === button;
          choice.classList.toggle("active", active);
          choice.setAttribute("aria-pressed", String(active));
        });
        document.querySelector("#season-note")!.textContent = value
          ? "春日 · 暮色"
          : "春日 · 晨光";
      });
    });
  document
    .querySelector<HTMLInputElement>("#wind")!
    .addEventListener("input", (event) => {
      const value = Number((event.target as HTMLInputElement).value);
      world.setWind(value / 100);
      document.querySelector("#wind-label")!.textContent =
        value === 0 ? "无风" : value < 60 ? "微风" : "轻拂";
    });
  save.addEventListener("click", async () => {
    try {
      await world.saveImage();
      announce("此刻的湖光，已为你留住。");
    } catch {
      announce("暂时没能保存画面，请再试一次。");
    }
  });
  // A page restored from the back/forward cache keeps this same world instance.
  const onPageHide = (event: PageTransitionEvent) => {
    if (!event.persisted) world.dispose();
  };
  window.addEventListener("pagehide", onPageHide);
  if (import.meta.hot) import.meta.hot.dispose(() => {
    window.removeEventListener("pagehide", onPageHide);
    world.dispose();
  });
} catch (error) {
  console.error(error);
  if (!loading.querySelector("#retry")) {
    loading.innerHTML =
      '<p>这里需要支持 WebGL 2 的浏览器，才能展开风景。</p><button id="retry" type="button">重新展开</button>';
    document
      .querySelector("#retry")
      ?.addEventListener("click", () => location.reload());
  }
}
