# Lake soundtrack: references and implementation

The first sketch was rejected for hard, piano-like attacks and simplistic note-by-note writing. The replacement uses a composed48-second cycle with returning motifs and controlled generative variation. Its first15seconds include a question, breathing spaces, a quiet answer and a harmonic change. Source and synthesis remain original code; no recordings or samples are imported.

## Reading

- [Audio Engineering Patterns skill](https://github.com/4444j99/a-i--skills/blob/HEAD/skills/creative/audio-engineering-patterns/SKILL.md): useful as a mixing checklist for gain staging, frequency roles, dynamics and spatial depth. Read as a reference; no software or skill package was installed. No dedicated music-production skill was present in the local skill catalog.
- [Cycling74: RNBO MIDI Synthesizer](https://rnbo.cycling74.com/learn/midi-synthesizer): polyphony, source/envelope/filter structure, and wet/dry reverb routing.
- [Cycling74: Sound Processing Techniques](https://docs.cycling74.com/legacy/max7/vignettes/sound_processing_techniques_topic): processing-chain concepts and example patch families.
- [Cycling74: gen~ and filtering](https://cycling74.com/tutorials/a-walk-around-the-block-an-introduction-to-gen~-and-filtering): filter block diagrams and sample-level signal flow.
- [Tone.js Reverb](https://tonejs.github.io/docs/15.1.22/classes/Reverb.html): convolution, predelay and decay. Implementation uses native Web Audio; Tone.js is not a dependency.

## Decisions

The retained mood is warm and airy. The audible lead no longer has a percussive bell/pluck envelope. A240–380ms cosine onset moves into a sustained body and long release. Near-unison sine components and low-level filtered air create a bowed, breathing timbre. Upper harmonics remain quiet.

Fmaj9, Am9, G6/9 and Cmaj9 share slowly moving upper voices. Adjacent voiced notes move no more than three semitones, including the loop seam. The main phrase and its reply occupy different registers and pan positions. Silence separates their gestures; the score does not fill every beat with a random scale note.

Separate sends control near/far layers. Early reflections, a short predelay, filtered long reverb and damped modulation delay provide depth. A gentle midrange dip and slow compression control accumulation. The export bus shares the live mix; clone audio tracks so finishing a capture does not end the live destination. The selected clip ends with a two-second fade.

Tests verify score and signal-envelope invariants, not musical quality. Export metadata, decoding and level checks verify the generated audio exists and is technically valid. Listening judgment remains distinct from those checks.

## Final orchestration pass

Four roles enter in the first3.5seconds: warm bed at0, breathy glass lead at0.75, a lower wood-colored E–G reply at2.15, and a quiet breathing pulse at3.43seconds. Around5.75seconds a small upper color note adds lift; harmony changes at7seconds and the lower melodic answer enters around8.25seconds. The wood voice has110–145ms rounded attacks and faint damped modal partials; it is lower and quieter than the lead. The pulse uses low band-limited air and a small sine body. A70BPM compound6/8 grid contains pickups, omitted beats and entirely silent bars. This adds rhythmic shape without a hard drum loop or constant shaker.

## Continuous legato

The final lead uses one oscillator bank and one gain envelope for each multi-pitch sentence. Internal pitch changes hold the prior frequency then glide160–235ms to the next target; they do not retrigger the gain. Lead events live in `phrase.melody`, outside the per-note layer. The first C–E–D line runs about0.75–6.7seconds, with the lower A–C–B answer beginning around8.25seconds. The chord bed is29% stronger than the preceding sketch, the lead21% quieter, and the wood layer has fewer events with half the velocity and spatial send. This directly addresses the audible note-by-note attack rather than changing chord names.
