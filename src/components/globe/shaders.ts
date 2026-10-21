/**
 * GLSL for the hero globe (three.js ShaderMaterial, GLSL ES 1.0 style; three maps it to WebGL2).
 * All lighting is in world space and in linear light. Every fragment shader ends with three's
 * tone mapping (ACES Filmic, set on the renderer) and output colour-space chunks.
 * pow() is only ever given a non-negative base: pow(x, y) with x < 0 is undefined in GLSL.
 */
export const EARTH_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vAxisW;
varying vec3 vPosW;

void main() {
  vUv = uv;
  // Unit sphere: the object-space normal is the position. The spin axis (object +Y) in world space
  // lets the fragment shader build east and north per pixel, so they stay exact near the poles.
  vec3 n = normalize(position);
  vNormalW = normalize(mat3(modelMatrix) * n);
  vAxisW = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
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
uniform float uTwilightFloor;
uniform float uRimGain;
uniform float uRelief;
uniform float uNormalGain;
uniform float uCloudOffset;
uniform float uCloudHeight;
uniform float uCloudShadow;
uniform float uNightAmbient;
uniform float uGlintExp;
uniform float uGlintGain;
uniform float uSheenExp;
uniform float uSheenGain;
uniform float uReveal;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vAxisW;
varying vec3 vPosW;

const float PI = 3.141592653589793;

void main() {
  vec3 n0 = normalize(vNormalW);
  vec3 sun = normalize(uSunDir);
  vec3 view = normalize(cameraPosition - vPosW);

  // Tangent frame: east follows +u and north follows +v of three's SphereGeometry UVs, matching the
  // upright equirectangular maps. |axis × n| is the cosine of the latitude.
  vec3 east = cross(vAxisW, n0);
  float cosLat = length(east);
  east /= max(cosLat, 1e-4);
  vec3 north = cross(n0, east);

  // Relief: the normal map stores east and north slopes × uNormalGain around 128 (flat), in 0…255.
  vec2 slope = (texture2D(uNormal, vUv).rg * 255.0 - 128.0) / (127.5 * uNormalGain);
  vec3 n = normalize(n0 + uRelief * (slope.x * east + slope.y * north));

  // The terminator follows the smooth sphere; relief only shades within the day side.
  float sunDot = dot(n0, sun);
  float dayMix = smoothstep(-0.10, 0.22, sunDot);
  float nightMix = 1.0 - smoothstep(-0.18, 0.06, sunDot);
  float band = (sunDot - 0.03) / 0.07;
  float twilight = exp(-band * band);

  // Clouds: the shell turns faster than the surface (uCloudOffset, in turns). The shadow is the
  // cover one cloud height (the shell's radius above the surface) toward the sun.
  vec2 cloudUv = vec2(vUv.x - uCloudOffset, vUv.y);
  vec3 toward = sun - n0 * sunDot;
  float reach = uCloudHeight / max(sunDot, 0.2);
  vec2 shadowUv = cloudUv + vec2(
    dot(toward, east) * reach / (2.0 * PI * max(cosLat, 0.05)),
    dot(toward, north) * reach / PI
  );
  float cloudAbove = texture2D(uClouds, cloudUv).r;
  float cloudShadow = texture2D(uClouds, shadowUv).r;

  // Day: Lambert with relief, darkened under cloud shadows. The smooth-sphere gate keeps relief
  // from lighting slopes past the terminator.
  vec3 albedo = texture2D(uDay, vUv).rgb;
  vec3 color = albedo * uSunColor * max(dot(n, sun), 0.0) * smoothstep(-0.04, 0.02, sunDot) * (1.0 - uCloudShadow * cloudShadow * dayMix);

  // Oceans: Blinn-Phong on the smooth normal, masked by the ocean map and open sky: a tight glint
  // plus a broad, faint sheen.
  float ocean = texture2D(uSpec, vUv).r;
  vec3 halfway = normalize(sun + view);
  float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(n0, view), 0.0), 5.0);
  float nh = max(dot(n0, halfway), 0.0);
  float glint = (uGlintGain * pow(nh, uGlintExp) + uSheenGain * pow(nh, uSheenExp)) * (0.5 + fresnel);
  color += uSunColor * glint * ocean * dayMix * (1.0 - cloudAbove);

  // Twilight: brand-orange light along the terminator, weighted by the ground's luminance (so bright
  // desert reads orange, not brick red) plus a floor so it still shows over dark oceans.
  float albedoLuma = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
  color += (albedoLuma + uTwilightFloor) * uTwilight * twilight * uTwilightGain;

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

export const CLOUDS_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const CLOUDS_FRAGMENT = /* glsl */ `
uniform sampler2D uClouds;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uTwilight;
uniform vec3 uNightColor;
uniform vec2 uCover;
uniform float uCloudGain;
uniform float uCloudAmbient;
uniform float uCloudTwilightGain;
uniform float uNightRim;
uniform float uRimPower;
uniform float uOpacity;
uniform float uReveal;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  // Crush the thinnest haze so the coverage reads as clouds, not fog.
  float cover = smoothstep(uCover.x, uCover.y, texture2D(uClouds, vUv).r);
  vec3 n = normalize(vNormalW);
  vec3 sun = normalize(uSunDir);
  vec3 view = normalize(cameraPosition - vPosW);
  float sunDot = dot(n, sun);
  float dayMix = smoothstep(-0.12, 0.25, sunDot);
  float band = (sunDot - 0.03) / 0.08;
  float twilight = exp(-band * band);

  // Sunlit white tops (wrapped by an ambient floor), warmed along the terminator.
  vec3 lit = uSunColor * uCloudGain * (uCloudAmbient + (1.0 - uCloudAmbient) * max(sunDot, 0.0)) + uTwilight * twilight * uCloudTwilightGain;
  // Night: clouds fade out except for a faint moonlit rim. The day and night parts are weighted by
  // their own opacity, so across the terminator a cloud keeps its warm lit colour while it fades,
  // instead of turning into a dark smudge over the twilight.
  float rim = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), uRimPower);
  float nightWeight = uNightRim * rim * (1.0 - dayMix);
  float weight = dayMix + nightWeight;
  vec3 color = (lit * dayMix + uNightColor * nightWeight) / max(weight, 1e-4);
  float alpha = cover * uOpacity * weight * uReveal;
  // Clear sky covers most of the shell: skip blending it.
  if (alpha < 0.002) discard;

  gl_FragColor = vec4(color * uReveal, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const ATMOSPHERE_VERTEX = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vCentreW;

void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vCentreW = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const ATMOSPHERE_FRAGMENT = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uAtmoDay;
uniform vec3 uAtmoNight;
uniform vec3 uTwilight;
uniform float uRimDepth;
uniform float uIntensity;
uniform float uPower;
uniform float uNightGain;
uniform float uTwilightGain;
uniform float uFloor;
uniform float uForward;
uniform float uForwardPower;

varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vCentreW;

void main() {
  vec3 n = normalize(vNormalW);
  vec3 view = normalize(cameraPosition - vPosW);
  vec3 sun = normalize(uSunDir);
  // Back faces only: n·view runs from 0 at the shell's edge to -uRimDepth where the line of sight
  // grazes the planet, so the glow is brightest against the limb and fades outward (fresnel rim).
  float depth = clamp(-dot(n, view) / uRimDepth, 0.0, 1.0);
  float glow = pow(depth, uPower);
  // Lit where the line of sight passes closest to the planet (the limb under this pixel), not at the
  // back face: the back-face normal leans up to ~23° away from the viewer, which shifted the twilight
  // arc onto the daylit limb.
  vec3 rel = vPosW - vCentreW;
  vec3 perp = rel - view * dot(rel, view);
  vec3 limb = perp / max(length(perp), 1e-4);
  float sunDot = dot(limb, sun);
  float dayMix = smoothstep(-0.3, 0.4, sunDot);
  float band = (sunDot - 0.02) / 0.13;
  float twilight = exp(-band * band);
  // Forward scattering: the rim flares when the sun is behind the planet.
  float forward = pow(max(dot(-view, sun), 0.0), uForwardPower);
  // Blue by day, a faint deep blue by night; along the terminator the blue gives way to the twilight
  // orange (mixed rather than added, so the two never sum to magenta).
  vec3 base = mix(uAtmoNight * uNightGain, uAtmoDay, dayMix);
  vec3 color = mix(base, uTwilight, twilight * uTwilightGain);
  float strength = glow * uIntensity * (uFloor + (1.0 - uFloor) * max(dayMix, twilight)) * (1.0 + uForward * forward);

  gl_FragColor = vec4(color * strength, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // Premultiplied output (the material blends ONE, ONE): the glow adds light, and its alpha is its own
  // brightness, so on a transparent canvas it never turns the space around the globe opaque.
  gl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
}
`;
