import "./style.css";
import { createWorld } from "./scene/world";
import { palettes, type PaletteId } from "./scene/palettes";
import { visualStyles, type VisualStyleId } from "./scene/styles";

const waveIcon = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M3 13c4-5 8 5 13 0s8 5 13 0M3 20c4-5 8 5 13 0s8 5 13 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const playIcon = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6Z" fill="currentColor"/></svg>`;
const pauseIcon = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const downloadIcon = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3v9m-3-3 3 3 3-3M4 13v3h12v-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const menuIcon = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 9h14M5 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="gallery">
    <header class="masthead">
      <a class="brand" href="./" aria-label="Crescent Lake home">${waveIcon}<span>Crescent Lake<small>A LIVING LANDSCAPE</small></span></a>
      <p class="edition"><span class="status-dot"></span> A PLACE TO LINGER <span class="edition-number">NO. 001</span></p>
    </header>
    <section class="landscape" aria-label="Crescent Lake, a living landscape">
      <div class="scene" id="scene"></div><div class="paper-fade" aria-hidden="true"></div>
      <div class="scene-note"><span class="tiny-line"></span><span id="season-note">SPRING / MORNING</span></div>
      <div class="loading" id="loading" role="status"><span class="loading-wave">${waveIcon}</span><p>The landscape is unfolding</p></div>
      <div class="scene-mark" aria-hidden="true">A LITTLE STILLNESS, IN MOTION.</div>
    </section>
    <footer class="caption"><div class="caption-copy"><p class="eyebrow">FIELD NOTES / SCENE 001</p><h1>Where the water slows<span>.</span></h1><p class="poem">A white bird. A quiet shore.<br class="mobile-break"> A little time, left to the ripples.</p></div><p class="caption-aside">Nothing to hurry.<br>Just something to notice.</p></footer>
    <div class="colophon"><span>A LANDSCAPE, SLOWLY HAPPENING</span><span>CREATED TO BE UNHURRIED</span></div>
    <button id="panel-toggle" class="panel-toggle" aria-label="Open scene settings" aria-controls="settings" aria-expanded="false">${menuIcon}</button>
    <aside id="settings" class="settings" aria-labelledby="settings-title" inert>
      <div class="panel-heading"><div><p class="eyebrow">MAKE A LITTLE WEATHER</p><h2 id="settings-title">Scene settings</h2></div><button id="panel-close" aria-label="Close scene settings">×</button></div>
      <div class="actions"><button id="pause" disabled aria-label="Pause landscape" aria-pressed="false">${pauseIcon}<span>Pause</span></button><button id="save" disabled>${downloadIcon}<span>Save image</span></button></div>
      <fieldset class="palette-control"><legend>Color story</legend>${Object.entries(
        palettes,
      )
        .map(
          ([id, p]) =>
            `<button class="palette-choice ${id === "sage" ? "active" : ""}" data-palette="${id}" aria-pressed="${id === "sage"}"><span class="palette-swatch" style="--deep:${p.deep};--pale:${p.pale};--sky:${p.sky}"></span><span>${p.name}<small>${p.note}</small></span><span class="selection-dot" aria-hidden="true"></span></button>`,
        )
        .join("")}</fieldset>
      <fieldset><legend>Light</legend><div class="segmented"><button class="active" data-light="0" aria-pressed="true">Morning</button><button data-light="1" aria-pressed="false">Golden hour</button></div></fieldset>
      <fieldset><legend>Visual language</legend><div class="style-grid">${Object.entries(
        visualStyles,
      )
        .map(
          ([id, style]) =>
            `<button class="style-choice ${id === "cel" ? "active" : ""}" data-style="${id}" aria-pressed="${id === "cel"}"><span>${style.name}</span><small>${style.description}</small></button>`,
        )
        .join(
          "",
        )}</div><div class="range-label second-range"><label for="brushwork">Effect strength</label><output id="brushwork-label" for="brushwork">65%</output></div><input id="brushwork" type="range" min="0" max="100" value="65"><div class="range-extents"><span>Subtle</span><span>Bold</span></div></fieldset>
      <fieldset><legend>Movement</legend><div class="range-label"><label for="wind">Wind strength</label><output id="wind-label" for="wind">Breezy</output></div><input id="wind" type="range" min="0" max="100" value="55"><div class="range-extents"><span>Still</span><span>Windy</span></div><div class="range-label second-range"><label for="activity">Swan movement</label><output id="activity-label" for="activity">Natural</output></div><input id="activity" type="range" min="0" max="100" value="65"><div class="range-extents"><span>Subtle</span><span>Lively</span></div></fieldset>
      <fieldset><legend>Passing overhead</legend><label class="switch-row" for="clouds"><span>Drifting clouds</span><input id="clouds" type="checkbox" checked><span class="switch" aria-hidden="true"></span></label><label class="switch-row" for="birds"><span>Flying birds</span><input id="birds" type="checkbox" checked><span class="switch" aria-hidden="true"></span></label></fieldset>
      <a class="portrait-link" href="./review.html" target="_top">Open 9:16 portrait preview ↗</a>
      <p class="panel-footnote">A change of color. A breath of wind.<br>The same small moment, made yours.</p>
    </aside>
    <p class="notice" id="notice" role="status" aria-live="polite"></p>
  </main>`;

const get = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const loading = get<HTMLDivElement>("#loading");
const pause = get<HTMLButtonElement>("#pause");
const save = get<HTMLButtonElement>("#save");
const notice = get<HTMLParagraphElement>("#notice");
const panel = get<HTMLElement>("#settings");
const panelToggle = get<HTMLButtonElement>("#panel-toggle");
function setPanel(open: boolean, restoreFocus = false) {
  panel.inert = !open;
  panel.classList.toggle("open", open);
  panelToggle.setAttribute("aria-expanded", String(open));
  panelToggle.setAttribute(
    "aria-label",
    open ? "Close scene settings" : "Open scene settings",
  );
  if (open) get<HTMLButtonElement>("#panel-close").focus();
  else if (restoreFocus) panelToggle.focus();
}
panelToggle.addEventListener("click", () => setPanel(panel.inert));
get("#panel-close").addEventListener("click", () => setPanel(false, true));
function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape" && !panel.inert) setPanel(false, true);
}
function onPointerDown(event: PointerEvent) {
  if (
    !panel.inert &&
    !panel.contains(event.target as Node) &&
    !panelToggle.contains(event.target as Node)
  )
    setPanel(false);
}
document.addEventListener("keydown", onKeyDown);
document.addEventListener("pointerdown", onPointerDown);
let clearNotice: ReturnType<typeof setTimeout>;
function announce(message: string) {
  notice.textContent = message;
  notice.classList.add("visible");
  clearTimeout(clearNotice);
  clearNotice = setTimeout(() => notice.classList.remove("visible"), 3200);
}
function showError(message: string) {
  loading.classList.remove("loaded");
  loading.replaceChildren();
  const text = document.createElement("p");
  text.textContent = message;
  const retry = document.createElement("button");
  retry.textContent = "Try again";
  retry.addEventListener("click", () => location.reload());
  loading.append(text, retry);
}
function selectButton(button: HTMLButtonElement, selector: string) {
  document.querySelectorAll<HTMLButtonElement>(selector).forEach((choice) => {
    choice.classList.toggle("active", choice === button);
    choice.setAttribute("aria-pressed", String(choice === button));
  });
}
try {
  const world = await createWorld(get("#scene"), {
    onReady() {
      loading.classList.add("loaded");
      pause.disabled = false;
      save.disabled = false;
    },
    onError: showError,
  });
  function updatePause() {
    pause.innerHTML = world.paused
      ? `${playIcon}<span>Resume</span>`
      : `${pauseIcon}<span>Pause</span>`;
    pause.setAttribute(
      "aria-label",
      world.paused ? "Resume landscape" : "Pause landscape",
    );
    pause.setAttribute("aria-pressed", String(world.paused));
  }
  updatePause();
  pause.addEventListener("click", () => {
    world.togglePause();
    updatePause();
  });
  document
    .querySelectorAll<HTMLButtonElement>("[data-palette]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        world.setPalette(button.dataset.palette as PaletteId);
        selectButton(button, "[data-palette]");
      }),
    );
  document
    .querySelectorAll<HTMLButtonElement>("[data-light]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        const value = Number(button.dataset.light);
        world.setWarmth(value);
        selectButton(button, "[data-light]");
        get("#season-note").textContent = value
          ? "SPRING / GOLDEN HOUR"
          : "SPRING / MORNING";
      }),
    );
  document
    .querySelectorAll<HTMLButtonElement>("[data-style]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        const id = button.dataset.style as VisualStyleId;
        selectButton(button, "[data-style]");
        get<HTMLInputElement>("#brushwork").disabled = id === "original";
        world.setStyle(id);
      }),
    );
  get<HTMLInputElement>("#brushwork").addEventListener("input", (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    get("#brushwork-label").textContent = `${value}%`;
    world.setPainting(value / 100);
  });
  get<HTMLInputElement>("#wind").addEventListener("input", (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    world.setWind(value / 100);
    get("#wind-label").textContent =
      value === 0
        ? "Still"
        : value < 35
          ? "Gentle"
          : value < 75
            ? "Breezy"
            : "Windy";
  });
  get<HTMLInputElement>("#activity").addEventListener("input", (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    world.setActivity(value / 100);
    get("#activity-label").textContent =
      value < 35 ? "Subtle" : value < 75 ? "Natural" : "Lively";
  });
  get<HTMLInputElement>("#clouds").addEventListener("change", (event) =>
    world.setClouds((event.target as HTMLInputElement).checked),
  );
  get<HTMLInputElement>("#birds").addEventListener("change", (event) =>
    world.setBirds((event.target as HTMLInputElement).checked),
  );
  save.addEventListener("click", async () => {
    try {
      await world.saveImage();
      announce("A little lake light, saved.");
    } catch {
      announce("The image could not be saved. Please try again.");
    }
  });
  // A page restored from the back/forward cache keeps the same world instance.
  const onPageHide = (event: PageTransitionEvent) => {
    if (!event.persisted) world.dispose();
  };
  window.addEventListener("pagehide", onPageHide);
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      clearTimeout(clearNotice);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      world.dispose();
    });
} catch (error) {
  console.error(error);
  showError(
    "This landscape needs a browser with WebGL 2. Please refresh to try again.",
  );
}
