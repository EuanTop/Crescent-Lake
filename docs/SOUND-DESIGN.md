# Sound design

The soundtrack is an original Web Audio composition with no imported recordings or samples. Five roles provide depth: a warm harmonic bed, a continuous bowed/glass-like lead, lower wooden replies, a quiet air pulse and rounded bass.

## Score

The 24-second film contains 14 full 6/8 bars at 70 BPM. Fmaj9, Am9, G6/9 and Cmaj9 enter at bars 0, 4, 8 and 12. Returning motifs and rests give the arrangement shape. Main layers enter within the first few seconds. Normal preview listening uses a longer 48-second score.

Each legato sentence shares an oscillator bank and one gain envelope. Internal pitches glide for 160–235 ms without retriggering amplitude. Bass roots and selected fifths follow the compound beat, with rounded attacks and restrained upper harmonics.

## Space and looping

The lead completes a left–right–left orbit every eight seconds in the film; lower replies use an opposing phase. Centered bass anchors the mix. Filtered echoes alternate between 480 ms and 570 ms delays, with early reflections and convolution reverb behind them.

The shared synthesis graph renders three consecutive cycles offline. Extracting the settled middle cycle retains incoming pad and reverb tails. A short additive endpoint correction closes residual sample discontinuity without fading to silence. The master uses the original float PCM; the share copy receives correctly timed AAC.

Audio initializes after user interaction. `prepareLoop()` renders silently, `playPreparedLoop()` starts the prepared cycle, and `getLoopWav()` exports stereo float32 WAV. Nodes, tracks and pending preparation are released on cancellation or disposal.

Tests verify timing, harmonic roles, legato envelopes, stereo curves and sample continuity. They do not measure subjective musical quality.

## References

[Cycling74: MIDI synthesizer](https://rnbo.cycling74.com/learn/midi-synthesizer) · [Cycling74: filtering](https://cycling74.com/tutorials/a-walk-around-the-block-an-introduction-to-gen~-and-filtering) · [Tone.js reverb concepts](https://tonejs.github.io/docs/15.1.22/classes/Reverb.html)
