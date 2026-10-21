/**
 * GLSL for the hero globe (three.js ShaderMaterial, GLSL ES 1.0 style; three maps it to WebGL2).
 * All lighting is in world space and in linear light. Every fragment shader ends with three's
 * tone mapping (ACES Filmic, set on the renderer) and output colour-space chunks.
 * pow() is only ever given a non-negative base: pow(x, y) with x < 0 is undefined in GLSL.
 */
export const EARTH_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vEastW;
varying vec3 vNorthW;
varying vec3 vPosW;
varying float vCosLat;

void main() {
  vUv = uv;
  // Unit sphere: the object-space normal is the position. East follows +u and north follows +v
  // of three's SphereGeometry UVs, matching the upright equirectangular maps.
  vec3 n = normalize(position);
  vec3 e = vec3(n.z, 0.0, -n.x);
  vCosLat = length(e);
  e = vCosLat > 1e-5 ? e / vCosLat : vec3(0.0, 0.0, -1.0);
  mat3 toWorld = mat3(modelMatrix);
  vNormalW = normalize(toWorld * n);
  vEastW = normalize(toWorld * e);
  vNorthW = normalize(toWorld * cross(n, e));
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const EARTH_FRAGMENT = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uNormal;
uniform sampler2D uSpec;
uniform sampler2D uClouds;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uTwilight;
uniform vec3 uCityColor;
uniform vec3 uAtmoDay;
uniform float uCityGain;
uniform float uTwilightGain;
uniform float uRimGain;
uniform float uRelief;
uniform float uNormalGain;
uniform float uCloudOffset;
uniform float uCloudShadow;
uniform float uNightAmbient;
uniform float uReveal;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vEastW;
varying vec3 vNorthW;
varying vec3 vPosW;
varying float vCosLat;

const float PI = 3.141592653589793;
const float CLOUD_HEIGHT = 0.012;

void main() {
  vec3 n0 = normalize(vNormalW);
  vec3 east = normalize(vEastW);
  vec3 north = normalize(vNorthW);
  vec3 sun = normalize(uSunDir);
  vec3 view = normalize(cameraPosition - vPosW);

  // Relief: the normal map stores east and north slopes, multiplied by uNormalGain, around 0.5.
  vec2 slope = (texture2D(uNormal, vUv).rg * 2.0 - 1.0) / uNormalGain;
  vec3 n = normalize(n0 + uRelief * (slope.x * east + slope.y * north));

  // The terminator follows the smooth sphere; relief only shades within the day side.
  float sunDot = dot(n0, sun);
  float dayMix = smoothstep(-0.10, 0.22, sunDot);
  float nightMix = 1.0 - smoothstep(-0.18, 0.06, sunDot);
  float band = (sunDot - 0.03) / 0.07;
  float twilight = exp(-band * band);

  // Clouds: the shell turns faster than the surface (uCloudOffset, in turns). The shadow is the
  // cover one cloud height toward the sun.
  vec2 cloudUv = vec2(vUv.x - uCloudOffset, vUv.y);
  vec3 toward = sun - n0 * sunDot;
  float reach = CLOUD_HEIGHT / max(sunDot, 0.2);
  vec2 shadowUv = cloudUv + vec2(
    dot(toward, east) * reach / (2.0 * PI * max(vCosLat, 0.05)),
    dot(toward, north) * reach / PI
  );
  float cloudAbove = texture2D(uClouds, cloudUv).r;
  float cloudShadow = texture2D(uClouds, shadowUv).r;

  // Day: Lambert with relief, darkened under cloud shadows.
  vec3 albedo = texture2D(uDay, vUv).rgb;
  vec3 color = albedo * uSunColor * max(dot(n, sun), 0.0) * (1.0 - uCloudShadow * cloudShadow * dayMix);

  // Oceans: a Blinn-Phong glint on the smooth normal, masked by the ocean map and open sky.
  float ocean = texture2D(uSpec, vUv).r;
  vec3 halfway = normalize(sun + view);
  float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(n0, view), 0.0), 5.0);
  float glint = pow(max(dot(n0, halfway), 0.0), 140.0) * (0.5 + fresnel);
  color += uSunColor * glint * ocean * dayMix * (1.0 - cloudAbove) * 0.7;

  // Twilight: brand-orange light along the terminator.
  color += albedo * uTwilight * twilight * uTwilightGain;

  // Night: only the city lights (sRGB-encoded luminance), warm and over-bright, dimmed under clouds.
  float lights = pow(texture2D(uNight, vUv).r, 2.2);
  color += uCityColor * uCityGain * lights * nightMix * (1.0 - 0.7 * cloudAbove);
  color += albedo * uNightAmbient * (1.0 - dayMix);

  // Day-side limb haze.
  float rim = pow(1.0 - max(dot(n0, view), 0.0), 3.0);
  color += uAtmoDay * rim * dayMix * uRimGain;

  gl_FragColor = vec4(color * uReveal, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
