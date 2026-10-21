/**
 * Tunables for the hero globe. World units: the Earth's radius is 1 and the camera looks at the
 * origin from +Z. Change motion and framing numbers here, and shading numbers in LOOK (materials.ts).
 */
export type Vec3 = [number, number, number];

export const CLOUD_RADIUS = 1.012;
export const ATMOSPHERE_RADIUS = 1.08;
/** Earth's axial tilt (23.5°), as in the previous scene. */
export const AXIAL_TILT = 0.41;
/**
 * Spin about the axis at mount. rotation.y = -(λ + 90°) turns longitude λ toward +Z; the extra -21°
 * allows for the opening frame, where the camera sees the off-centre globe about 21° off-axis.
 * The final +0.45 rad turns the Atlantic off Mauritania under the ocean glint. West Africa faces
 * the reader at the first beat.
 */
export const INITIAL_SPIN = (-(10 + 90 + 21) * Math.PI) / 180 + 0.45;
/** rad/s, the previous scene's rate. */
export const IDLE_SPIN = 0.035;
/** rad/s on top of the surface spin. */
export const CLOUD_DRIFT = 0.006;

export const CAMERA_FOV = 38;
export const CAMERA_Z = 6.2;
/** ACES Filmic exposure, unchanged from the previous scene so the galaxy and stars keep their look. */
export const EXPOSURE = 1.2;

/** Toward the sun. Opening beat: front-left, the visible face lit. Centred beat: upper-left, behind. */
export const SUN_START: Vec3 = [-4, 2.5, 4];
export const SUN_END: Vec3 = [-0.8, 0.45, -0.45];
/** Scroll window of the sun sweep (the same window as the shrink to centre). */
export const SUN_SWEEP: [number, number] = [0.08, 0.62];
/**
 * The mobile globe's fixed sun: mostly night with a lit crescent, the desktop's centred beat (SUN_END).
 * At 0.8 the GPU render showed nearly half the disc lit, bright behind the statement.
 */
export const MOBILE_SUN_T = 1;
export const MOBILE_RADIUS = 1.5;
/**
 * Frames per second of the phone and tablet globe once it is on screen. Its light is fixed and nothing
 * reacts to input, so only the idle spin moves it: about 6 CSS px a second at the centre of a 468 px
 * phone globe, under half a pixel a frame at this rate. Rendering on demand at this rate instead of
 * every display frame saves most of the GPU work and the battery.
 */
export const MOBILE_FPS = 20;

/** Rig: the previous model's radius 5 × its 0.62 → 0.26 rig scale, now on a unit sphere. */
export const RIG_RANGE: [number, number] = [0.1, 0.62];
export const RIG_SCALE: [number, number] = [3.1, 1.3];
export const RIG_X: [number, number] = [2.4, 0];
/** Slow camera dolly-in over the whole hero. */
export const DOLLY_Z: [number, number] = [CAMERA_Z, 5.75];

/** Pointer tilt (≈6°), drag pitch limit and drag feel. */
export const MAX_TILT = (6 * Math.PI) / 180;
export const MAX_PITCH = 0.3;
export const DRAG_RADIANS_PER_VIEWPORT = Math.PI;
/** 1/s, exponential decay of the release velocity. */
export const DRAG_FRICTION = 2.2;
/** rad/s, the fastest fling: one turn a second. */
export const MAX_SPIN = 2 * Math.PI;
/** Radians at the viewport edge. */
export const STAR_PARALLAX = 0.03;

/**
 * Intro reveal: the globe holds as a black silhouette against the galaxy (an eclipse) for
 * REVEAL_DELAY_SECONDS after the overlay starts to lift, while the curtain clears (0.12 s + 0.9 s,
 * globals.css), then fades up while the atmosphere flares once, peaking about 1.5 s into the reveal.
 */
export const REVEAL_DELAY_SECONDS = 0.6;
export const REVEAL_SECONDS = 1.4;
export const FLARE_SECONDS = 1.8;
export const FLARE_GAIN = 2.2;
/** From the start of the overlay's lift until the globe's fade-up and flare are over. */
export const REVEAL_END_SECONDS = REVEAL_DELAY_SECONDS + Math.max(REVEAL_SECONDS, FLARE_SECONDS);
/**
 * Without the intro's reveal, the 4k stream waits this long after the first textured frame: the
 * canvas's 0.6 s fade-in over the poster (globals.css) and the end of the copy's entrance, plus a margin.
 */
export const STREAM_SETTLE_SECONDS = 1.2;

/**
 * The 4k stream (capable desktops) starts in an idle callback, forced after this long if the page
 * never goes idle. Safari has no requestIdleCallback: a plain timer of the fallback length stands in.
 */
export const STREAM_IDLE_TIMEOUT_MS = 3000;
export const STREAM_IDLE_FALLBACK_MS = 1000;
