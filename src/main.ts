import "./style.css";
import { createLakeMusic } from "./scene/music";
import { createWorld } from "./scene/world";
import { palettes, type PaletteId } from "./scene/palettes";
import { visualStyles, type VisualStyleId } from "./scene/styles";

const waveIcon = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M3 13c4-5 8 5 13 0s8 5 13 0M3 20c4-5 8 5 13 0s8 5 13 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const playIcon = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6Z" fill="currentColor"/></svg>`;
const pauseIcon = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const downloadIcon = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3v9m-3-3 3 3 3-3M4 13v3h12v-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const menuIcon = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 9h14M5 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="gallery" data-frame="portrait">
    <section class="landscape" aria-label="Crescent Lake, a living landscape">
      <div class="scene" id="scene"></div>
      <div class="loading" id="loading" role="status"><span class="loading-wave">${waveIcon}</span><p>The landscape is unfolding</p></div>
    </section>
    <button id="panel-toggle" class="panel-toggle" aria-label="Open scene settings" aria-controls="settings" aria-expanded="false">${menuIcon}</button>
    <aside id="settings" class="settings" aria-labelledby="settings-title" inert>
      <div class="panel-heading"><div><p class="eyebrow">MAKE A LITTLE WEATHER</p><h2 id="settings-title">Scene settings</h2></div><button id="panel-close" aria-label="Close scene settings">×</button></div>
      <div class="actions"><button id="pause" disabled aria-label="Pause landscape" aria-pressed="false">${pauseIcon}<span>Pause</span></button><button id="save" disabled>${downloadIcon}<span>Save image</span></button></div>
      <fieldset><legend>Frame</legend><div class="segmented"><button class="active" data-frame="portrait" aria-pressed="true">Portrait 9:16</button><button data-frame="landscape" aria-pressed="false">Landscape 16:9</button></div></fieldset>
      <fieldset><legend>Soundtrack</legend><div class="actions"><button id="music" aria-pressed="false">Play lake music</button><button id="save-audio">Save loop audio</button></div><label class="switch-row" for="include-music"><span>Include music in video</span><input id="include-music" type="checkbox" checked><span class="switch" aria-hidden="true"></span></label><p class="export-note">Warm chords & a slow stereo drift. Headphones welcome.</p></fieldset>
      <fieldset class="video-control"><legend>Export video</legend><div class="video-options"><label for="duration">Duration</label><select id="duration"><option value="5">5 seconds</option><option value="10">10 seconds</option><option value="15">15 seconds</option><option value="17">17 seconds</option><option value="20">20 seconds</option><option value="24" selected>24 seconds</option><option value="30">30 seconds</option><option value="60">60 seconds</option></select></div><label class="switch-row" for="loop-film"><span>Loop one lake circuit · 24 s</span><input id="loop-film" type="checkbox" checked><span class="switch" aria-hidden="true"></span></label><label class="switch-row" for="light-journey"><span id="journey-label">Morning → Golden → Morning</span><input id="light-journey" type="checkbox" checked><span class="switch" aria-hidden="true"></span></label><button id="record" class="record-button" disabled>Export video</button><progress id="record-progress" max="20" value="0" hidden></progress><p id="record-status" class="export-note" role="status" aria-live="polite">1080 × 1920 · 30 fps · artwork + titles</p></fieldset>
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
      <fieldset><legend>Movement</legend><div class="range-label"><label for="wind">Wind strength</label><output id="wind-label" for="wind">Windy · 100%</output></div><input id="wind" type="range" min="0" max="200" value="100"><div class="range-extents"><span>Still · 0%</span><span>Gusty · 200%</span></div><div class="range-label second-range"><label for="activity">Swan movement</label><output id="activity-label" for="activity">Lively · 100%</output></div><input id="activity" type="range" min="0" max="200" value="100"><div class="range-extents"><span>Subtle · 0%</span><span>Expressive · 200%</span></div></fieldset>
      <fieldset><legend>Passing overhead</legend><label class="switch-row" for="clouds"><span>Drifting clouds</span><input id="clouds" type="checkbox" checked><span class="switch" aria-hidden="true"></span></label><label class="switch-row" for="birds"><span>Flying birds</span><input id="birds" type="checkbox" checked><span class="switch" aria-hidden="true"></span></label></fieldset>
      <p class="panel-footnote">A change of color. A breath of wind.<br>The same small moment, made yours.</p>
    </aside>
    <p class="notice" id="notice" role="status" aria-live="polite"></p>
  </main>`;

const get = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const loading = get<HTMLDivElement>("#loading");
const pause = get<HTMLButtonElement>("#pause");
const save = get<HTMLButtonElement>("#save");
const record = get<HTMLButtonElement>("#record");
const recordStatus = get<HTMLParagraphElement>("#record-status");
const progress = get<HTMLProgressElement>("#record-progress");
const duration = get<HTMLSelectElement>("#duration");
const loopFilm = get<HTMLInputElement>("#loop-film");
duration.disabled = true;
loopFilm.addEventListener("change", () => {
  duration.disabled = loopFilm.checked;
  if (loopFilm.checked) duration.value = "24";
  get("#journey-label").textContent = loopFilm.checked
    ? "Morning → Golden → Morning"
    : "Morning → Golden hour";
});
let recording = false;
const music = createLakeMusic();
let musicPlaying = false;
const musicButton = get<HTMLButtonElement>("#music");
function updateMusic() {
  musicButton.textContent = musicPlaying
    ? "Pause lake music"
    : "Play lake music";
  musicButton.setAttribute("aria-pressed", String(musicPlaying));
}
musicButton.addEventListener("click", async () => {
  try {
    if (musicPlaying) {
      music.stop();
      musicPlaying = false;
    } else {
      await music.start();
      musicPlaying = true;
    }
    updateMusic();
  } catch {
    announce("Audio could not be started. Please try again.");
  }
});
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
  if (event.key === "Escape" && recording) {
    get<HTMLButtonElement>("#record").click();
    return;
  }
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
  await document.fonts.load('32px "Goudy Bookletter"');
  const world = await createWorld(get("#scene"), {
    onReady() {
      loading.classList.add("loaded");
      pause.disabled = false;
      save.disabled = false;
    },
    onError: showError,
    onRecording(state, elapsed) {
      progress.value = elapsed;
      if (state === "recording") {
        record.textContent = "Stop & save video";
        recordStatus.textContent = `Recording · ${elapsed.toFixed(1)} / ${duration.value} s`;
      } else if (state === "finalizing") {
        record.disabled = true;
        record.textContent = "Saving video…";
        recordStatus.textContent =
          "Finishing the video. Please keep this page open.";
      }
    },
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
  function videoNote() {
    const portrait = get(".gallery").dataset.frame === "portrait";
    return `${portrait ? "1080 × 1920" : "1920 × 1080"} · 30 fps · ${world.videoFormat} · artwork + titles`;
  }
  record.disabled = !world.videoSupported;
  recordStatus.textContent = world.videoSupported
    ? videoNote()
    : "Video export is unavailable in this browser.";
  document
    .querySelectorAll<HTMLButtonElement>("button[data-frame]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        get(".gallery").dataset.frame = button.dataset.frame;
        selectButton(button, "button[data-frame]");
        recordStatus.textContent = videoNote();
      }),
    );
  get<HTMLButtonElement>("#save-audio").addEventListener("click", async () => {
    if (recording) return;
    const button = get<HTMLButtonElement>("#save-audio");
    const wasPlaying = musicPlaying;
    button.disabled = record.disabled = musicButton.disabled = true;
    try {
      music.stop();
      await music.prepareLoop(24);
      const url = URL.createObjectURL(music.getLoopWav());
      const link = document.createElement("a");
      link.href = url;
      link.download = "crescent-lake-loop-24s.wav";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      announce("Your loop soundtrack is ready to download.");
    } catch {
      announce("The soundtrack could not be saved. Please try again.");
    } finally {
      musicPlaying = false;
      if (wasPlaying) {
        try { await music.start(); musicPlaying = true; } catch { /* Retry through Play. */ }
      }
      updateMusic();
      button.disabled = musicButton.disabled = false;
      record.disabled = !world.videoSupported;
    }
  });
  record.addEventListener("click", async () => {
    if (recording) {
      world.stopVideo();
      return;
    }
    recording = true;
    const musicWasPlaying = musicPlaying;
    const loop = loopFilm.checked;
    const controls = Array.from(
      panel.querySelectorAll<
        HTMLButtonElement | HTMLInputElement | HTMLSelectElement
      >("button, input, select"),
    ).filter(
      (control) => control.id !== "record" && control.id !== "panel-close",
    );
    const previous = controls.map((control) => control.disabled);
    controls.forEach((control) => (control.disabled = true));
    progress.max = Number(duration.value);
    progress.value = 0;
    progress.hidden = false;
    let errorMessage = "";
    let musicFade: ReturnType<typeof setTimeout> | undefined;
    try {
      const includeMusic = get<HTMLInputElement>("#include-music").checked;
      if (includeMusic) {
        if (loop) {
          music.stop();
          musicPlaying = false;
          record.disabled = true;
          recordStatus.textContent = "Preparing the loop soundtrack…";
          await music.prepareLoop(24);
          record.disabled = false;
        } else if (!musicPlaying) {
          await music.start();
          musicPlaying = true;
          updateMusic();
        }
      }
      document.body.classList.add("is-recording");
      setPanel(false);
      if (includeMusic && !loop)
        musicFade = setTimeout(
          () => music.setVolume(0, 2),
          Math.max(0, Number(duration.value) - 2) * 1000,
        );
      await world.recordVideo(
        Number(duration.value),
        includeMusic ? music.stream : null,
        get<HTMLInputElement>("#light-journey").checked,
        loop,
        includeMusic && loop ? async () => {
          music.playPreparedLoop();
          // Let the live audio destination fill before the encoder attaches.
          // Recording a full 24s still closes the periodic score at any phase.
          await new Promise<void>((resolve) => setTimeout(resolve, 200));
        } : undefined,
      );
      announce("Your lake video is ready to download.");
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : "The video could not be exported. Please try again.";
      announce(errorMessage);
    } finally {
      recording = false;
      clearTimeout(musicFade);
      document.body.classList.remove("is-recording");
      if (loop) {
        music.stop();
        musicPlaying = false;
        if (musicWasPlaying) {
          try {
            await music.start();
            musicPlaying = true;
          } catch {
            musicPlaying = false;
          }
        }
        updateMusic();
      }
      if (!musicWasPlaying && musicPlaying) {
        music.stop();
        musicPlaying = false;
        updateMusic();
      }
      music.setVolume(0.65, 0.8);
      controls.forEach(
        (control, index) => (control.disabled = previous[index]),
      );
      record.disabled = !world.videoSupported;
      record.textContent = "Export video";
      recordStatus.textContent = errorMessage || videoNote();
      progress.hidden = true;
      duration.disabled = loopFilm.checked;
      updatePause();
    }
  });
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
    const label =
      value === 0
        ? "Still"
        : value < 35
          ? "Gentle"
          : value < 75
            ? "Breezy"
            : value <= 100
              ? "Windy"
              : "Gusty";
    get("#wind-label").textContent = `${label} · ${value}%`;
  });
  get<HTMLInputElement>("#activity").addEventListener("input", (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    world.setActivity(value / 100);
    get("#activity-label").textContent =
      `${value < 35 ? "Subtle" : value < 75 ? "Natural" : value <= 100 ? "Lively" : "Expressive"} · ${value}%`;
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
    if (!event.persisted) {
      music.dispose();
      world.dispose();
    }
  };
  window.addEventListener("pagehide", onPageHide);
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      clearTimeout(clearNotice);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      music.dispose();
      world.dispose();
    });
} catch (error) {
  console.error(error);
  showError(
    "This landscape needs a browser with WebGL 2. Please refresh to try again.",
  );
}
