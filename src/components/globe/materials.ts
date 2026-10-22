import * as THREE from "three";
import { ATMOSPHERE_RADIUS, CLOUD_RADIUS } from "./constants";
import { ATMOSPHERE_FRAGMENT, ATMOSPHERE_VERTEX, CLOUDS_FRAGMENT, CLOUDS_VERTEX, EARTH_FRAGMENT, EARTH_VERTEX } from "./shaders";
import { NORMAL_GAIN } from "./texture-manifest";
import type { GlobeTextureSet } from "./textures";

/**
 * Look tunables. Colours are sRGB hex (three converts them to linear); gains are linear and
 * calibrated for ACES Filmic at EXPOSURE 1.2 (constants.ts).
 */
export const LOOK = {
  sunColor: "#fff4e8",
  sunIntensity: 1.3,
  /**
   * The input is pre-compensated for ACES Filmic: at the band's brightness the brand #fa6e43 renders
   * as brick red, while #ff8240 renders at the brand hue #fa6e43.
   */
  twilight: "#ff8240",
  /** Twilight band: gain × (albedo luminance + floor); the floor keeps it visible over dark oceans. */
  twilightGain: 0.26,
  twilightFloor: 0.06,
  city: "#ffb46b",
  cityGain: 4.5,
  atmosphereDay: "#5aa2ff",
  rimGain: 0.3,
  relief: 3,
  cloudShadow: 0.45,
  nightAmbient: 0.0125,
  /** Ocean specular: a tight sun glint plus a broad, faint sheen (Blinn-Phong exponents and gains). */
  glintExponent: 700,
  glintGain: 0.7,
  sheenExponent: 40,
  sheenGain: 0.055,
  /** Cloud shell: opacity, brightness (× the sun colour) and the ambient floor of its sunlit wrap. */
  cloudOpacity: 0.95,
  cloudGain: 1,
  cloudAmbient: 0.08,
  /** Coverage below the first value reads as clear sky, above the second as full cover. */
  cloudCover: [0.12, 0.85],
  cloudTwilightGain: 0.42,
  /** Night side: clouds fade to a faint moonlit rim (colour, opacity and fresnel power). */
  cloudNight: "#222731",
  cloudNightRim: 0.18,
  cloudRimPower: 2,
  /** Atmosphere: a back-face fresnel shell, blue by day (atmosphereDay), deep blue by night. */
  atmosphereNight: "#1b2a55",
  atmosphereNightGain: 1,
  atmosphereIntensity: 0.85,
  /** Fall-off from the limb to the shell's edge (higher is a thinner rim). */
  atmospherePower: 3,
  /** How far the twilight orange replaces the blue along the terminator (0…1). */
  atmosphereTwilightGain: 0.85,
  /** Share of the glow that remains on the night limb. */
  atmosphereFloor: 0.12,
  /** Forward scattering when backlit: extra gain and lobe power. */
  atmosphereForward: 2.5,
  atmosphereForwardPower: 3,
} as const;

export type GlobeMaterials = { earth: THREE.ShaderMaterial; clouds: THREE.ShaderMaterial; atmosphere: THREE.ShaderMaterial };

export function createGlobeMaterials(textures: GlobeTextureSet): GlobeMaterials {
  // Shared by reference, so one write per frame updates every shell.
  const uSunDir = { value: new THREE.Vector3(0, 0, 1) };
  const uSunColor = { value: new THREE.Color(LOOK.sunColor).multiplyScalar(LOOK.sunIntensity) };
  const uTwilight = { value: new THREE.Color(LOOK.twilight) };
  const uAtmoDay = { value: new THREE.Color(LOOK.atmosphereDay) };
  const uReveal = { value: 1 };

  const earth = new THREE.ShaderMaterial({
    name: "GlobeEarth",
    vertexShader: EARTH_VERTEX,
    fragmentShader: EARTH_FRAGMENT,
    uniforms: {
      uDay: { value: textures.day },
      uNight: { value: textures.night },
      uNormal: { value: textures.normal },
      uSpec: { value: textures.spec },
      uClouds: { value: textures.clouds },
      uSunDir,
      uSunColor,
      uTwilight,
      uAtmoDay,
      uReveal,
      uCityColor: { value: new THREE.Color(LOOK.city) },
      uCityGain: { value: LOOK.cityGain },
      uTwilightGain: { value: LOOK.twilightGain },
      uTwilightFloor: { value: LOOK.twilightFloor },
      uRimGain: { value: LOOK.rimGain },
      uRelief: { value: LOOK.relief },
      uNormalGain: { value: NORMAL_GAIN },
      uCloudOffset: { value: 0 },
      uCloudHeight: { value: CLOUD_RADIUS - 1 },
      uCloudShadow: { value: LOOK.cloudShadow },
      uNightAmbient: { value: LOOK.nightAmbient },
      uGlintExp: { value: LOOK.glintExponent },
      uGlintGain: { value: LOOK.glintGain },
      uSheenExp: { value: LOOK.sheenExponent },
      uSheenGain: { value: LOOK.sheenGain },
    },
  });

  const clouds = new THREE.ShaderMaterial({
    name: "GlobeClouds",
    vertexShader: CLOUDS_VERTEX,
    fragmentShader: CLOUDS_FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uClouds: { value: textures.clouds },
      uSunDir,
      uSunColor,
      uTwilight,
      uReveal,
      uNightColor: { value: new THREE.Color(LOOK.cloudNight) },
      uCover: { value: new THREE.Vector2(...LOOK.cloudCover) },
      uCloudGain: { value: LOOK.cloudGain },
      uCloudAmbient: { value: LOOK.cloudAmbient },
      uCloudTwilightGain: { value: LOOK.cloudTwilightGain },
      uNightRim: { value: LOOK.cloudNightRim },
      uRimPower: { value: LOOK.cloudRimPower },
      uOpacity: { value: LOOK.cloudOpacity },
    },
  });

  const atmosphere = new THREE.ShaderMaterial({
    name: "GlobeAtmosphere",
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    // ONE, ONE: the shader writes premultiplied colour (see ATMOSPHERE_FRAGMENT).
    premultipliedAlpha: true,
    uniforms: {
      uSunDir,
      uTwilight,
      uAtmoDay,
      uAtmoNight: { value: new THREE.Color(LOOK.atmosphereNight) },
      uRimDepth: { value: Math.sqrt(1 - 1 / (ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS)) },
      uIntensity: { value: LOOK.atmosphereIntensity },
      uPower: { value: LOOK.atmospherePower },
      uNightGain: { value: LOOK.atmosphereNightGain },
      uTwilightGain: { value: LOOK.atmosphereTwilightGain },
      uFloor: { value: LOOK.atmosphereFloor },
      uForward: { value: LOOK.atmosphereForward },
      uForwardPower: { value: LOOK.atmosphereForwardPower },
    },
  });

  return { earth, clouds, atmosphere };
}

/** Rebinds a new texture set (2k → 4k) in place. */
export function applyGlobeTextures(target: { earth: THREE.ShaderMaterial; clouds?: THREE.ShaderMaterial }, textures: GlobeTextureSet): void {
  const uniforms = target.earth.uniforms;
  uniforms.uDay.value = textures.day;
  uniforms.uNight.value = textures.night;
  uniforms.uNormal.value = textures.normal;
  uniforms.uSpec.value = textures.spec;
  uniforms.uClouds.value = textures.clouds;
  if (target.clouds) target.clouds.uniforms.uClouds.value = textures.clouds;
}
