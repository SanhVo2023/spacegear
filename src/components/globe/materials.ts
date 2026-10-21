import * as THREE from "three";
import { EARTH_FRAGMENT, EARTH_VERTEX } from "./shaders";
import { NORMAL_GAIN } from "./texture-manifest";
import type { GlobeTextureSet } from "./textures";

/**
 * Look tunables. Colours are sRGB hex (three converts them to linear); gains are linear and
 * calibrated for ACES Filmic at EXPOSURE 1.2 (constants.ts).
 */
export const LOOK = {
  sunColor: "#fff4e8",
  sunIntensity: 1.75,
  twilight: "#fa6e43",
  twilightGain: 0.38,
  city: "#ffb46b",
  cityGain: 3.75,
  atmosphereDay: "#5aa2ff",
  rimGain: 0.38,
  relief: 3,
  cloudShadow: 0.45,
  nightAmbient: 0.0125,
} as const;

export type GlobeMaterials = { earth: THREE.ShaderMaterial };

export function createGlobeMaterials(textures: GlobeTextureSet): GlobeMaterials {
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
      uSunDir: { value: new THREE.Vector3(0, 0, 1) },
      uSunColor: { value: new THREE.Color(LOOK.sunColor).multiplyScalar(LOOK.sunIntensity) },
      uTwilight: { value: new THREE.Color(LOOK.twilight) },
      uAtmoDay: { value: new THREE.Color(LOOK.atmosphereDay) },
      uReveal: { value: 1 },
      uCityColor: { value: new THREE.Color(LOOK.city) },
      uCityGain: { value: LOOK.cityGain },
      uTwilightGain: { value: LOOK.twilightGain },
      uRimGain: { value: LOOK.rimGain },
      uRelief: { value: LOOK.relief },
      uNormalGain: { value: NORMAL_GAIN },
      uCloudOffset: { value: 0 },
      uCloudShadow: { value: LOOK.cloudShadow },
      uNightAmbient: { value: LOOK.nightAmbient },
    },
  });
  return { earth };
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
