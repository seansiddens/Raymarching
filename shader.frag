#ifdef GL_ES
precision mediump float;
#endif

#define MAX_STEPS 100
#define MAX_DIST 100.
#define SURF_DIST .01

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D bayer8x8;
uniform sampler2D bayer16x16;
uniform sampler2D blueNoise64x64;

varying vec2 vTexCoord;


/* Dithering Utility Functions
---------------------------------------------------------------- */

// Return a random value between 0 and 1
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

// Convert from sRGB to a linear colorspace
vec3 srgbToLinear(vec3 col) {
    if (col.r <= 0.04045) col.r = col.r / 12.92;
    else col.r = pow((col.r + 0.055) / 1.055, 2.4);

    if (col.b <= 0.04045) col.b = col.b / 12.92;
    else col.b = pow((col.b + 0.055) / 1.055, 2.4);

    if (col.g <= 0.04045) col.g = col.g / 12.92;
    else col.g = pow((col.g + 0.055) / 1.055, 2.4);

    return col;
}

// Texture lookup for 8x8 Bayer matrix
float bayer8x8Lookup() {
    vec2 uv = vec2(int(mod(gl_FragCoord.x, 8.)), 
                   int(mod(gl_FragCoord.y, 8.)));
    
    return texture2D(bayer8x8, uv).r;
}

// Texture lookup for 16x16 Bayer matrix
float bayer16x16Lookup() {
    vec2 st = vec2(mod(gl_FragCoord.x, 16.) / 16.,
                   mod(gl_FragCoord.y, 16.) / 16.);

    float col = texture2D(bayer16x16, st).r;
    return col;
}

// Texture lookup for 64x64 blue noise texture
float blueNoise64x64Lookup() {
    vec2 st = vec2(mod(gl_FragCoord.x, 64.) / 64.,
                   mod(gl_FragCoord.y, 64.) / 64.);

    float col = texture2D(blueNoise64x64, st).r;
    return col;
}

vec3 bayerQuantize(vec3 col) {

    return vec3(step(bayer16x16Lookup(), col.r), 
                step(bayer16x16Lookup(), col.g),
                step(bayer16x16Lookup(), col.b));

}

vec3 quantize (vec3 col) {
    // float c = step(0.5, col.r + rand(col.gb) * 1.5 - 1.0);
    // float c = step(rand(col.gb), col.r);
    // float c = step(bayer8x8Lookup(), col.r);
    // float c = step(bayer16x16Lookup(), col.r);
    // float c = step(blueNoise64x64Lookup(), col.r);
    // float c = step((blueNoise64x64Lookup() + .05*rand(col.gb)), col.r);
    // float c = step((blueNoise64x64Lookup() + bayer16x16Lookup()) / 2.0, col.r);
    // col = vec3(step((blueNoise64x64Lookup() + bayer16x16Lookup()) / 2.0, col.r), 
    //            step((blueNoise64x64Lookup() + bayer16x16Lookup()) / 2.0, col.g),
    //            step((blueNoise64x64Lookup() + bayer16x16Lookup()) / 2.0, col.b));
    col = bayerQuantize(col);
    return col;
}

vec3 dither(vec3 col) {
    col = srgbToLinear(col);
    col = quantize(col);

    return col;
}
/* END Dither functions
---------------------------------------------------------------- */



/* Ray marching functions
---------------------------------------------------------------- */

/* Signed distance function describing a sphere positioned 
   at s.xyz with a radius of s.w */
float sphereSDF(vec3 samplePoint, vec4 s) {
    return length(samplePoint - s.xyz) - s.w;
}

/* Signed distance function describing the scene.
   Absolute value of the return value indicates the distance
   to the closest surface. Sign indicates whether the point is 
   inside or outside the surface, negative indicating inside. */
float sceneSDF(vec3 p) {
    vec4 s1 = vec4(0.0 + sin(u_time), 1.0, 6.0, 1.0);

    float d = sphereSDF(p, s1);

    return d;
}

float RayMarch(vec3 ro, vec3 rd) {
    float depth = 0.0;

    for (int i = 0; i < MAX_STEPS; i++) {
        // Take a step along view ray 
        vec3 p = ro + rd * depth;
        // Increase step dist based on scene
        float stepDist = sceneSDF(p);
        depth += stepDist;
        // Break if too far along view ray or sufficienty close to surface
        if (depth > MAX_DIST || stepDist < SURF_DIST) break;
    }

    return depth;
}
/* END Ray marching functions
---------------------------------------------------------------- */



/* Lighting Functions
---------------------------------------------------------------- */

// // Using the gradient of the SDF, estimate the normal on the 
// // surface at point p.
// vec3 estimateNormal(vec3 p) {
//     return normalize(vec3(
//         sceneSDF(vec3(p.x + EPSILON, p.y, p.z)) - sceneSDF(vec3(p.x - EPSILON, p.y, p.z)),
//         sceneSDF(vec3(p.x, p.y + EPSILON, p.z)) - sceneSDF(vec3(p.x, p.y - EPSILON, p.z)),
//         sceneSDF(vec3(p.x, p.y, p.z  + EPSILON)) - sceneSDF(vec3(p.x, p.y, p.z - EPSILON))
//     ));
// }

vec3 GetNormal(vec3 p) {
    float d = sceneSDF(p);
    vec2 e = vec2(.01, 0.0);

    vec3 n = d - vec3(sceneSDF(p - e.xyy), 
                      sceneSDF(p - e.yxy), 
                      sceneSDF(p - e.yyx));

    return normalize(n);
}

/* Lighting contribution of a single point light source via 
   Phong illumination
   The vec3 returned is the RGB color of the light's contribution.
   - k_d: Diffuse color
   - k_s: Specular color
   - alpha: Shininess coefficient
   - p: position of the point being lit
   - rO: position of the camera
   - lightPos: the position of the light
   - lightIntensity: color/intensity of the light */
vec3 phongContribForLight(vec3 k_d, vec3 k_s, float alpha, vec3 p, vec3 rO, vec3 lightPos, vec3 lightIntensity) {
    vec3 N = GetNormal(p);
    vec3 L = normalize(lightPos - p);
    vec3 V = normalize(rO - p);
    vec3 R = normalize(reflect(-L, N));

    float dotLN = dot(L, N);
    float dotRV = dot(R, V);

    if (dotLN < 0.0) {
        // Light not visible from this point on the surface
        return vec3(0.0, 0.0, 0.0);
    }

    if (dotRV < 0.0) {
        /* Light reflection in opposite direction as viewer,
           apply only diffuse component */
           return lightIntensity * (k_d * dotLN);
    }
    
    return lightIntensity * (k_d * dotLN + k_s * pow(dotRV, alpha));
}



/* Lighting via Phong illumination.
   The vec3 returned is the RGB color of that point after lighting
   is applied.
   - k_a: Ambient color
   - k_d: Diffuse color
   - k_s: Specular color
   - alpha: Shininess coefficient
   - p: position of the point being lit
   - rO: position of the camera */
vec3 phongIllumination(vec3 k_a, vec3 k_d, vec3 k_s, float alpha, vec3 p, vec3 rO) {
    const vec3 ambientLight = 0.5 * vec3(1.0, 1.0, 1.0);
    vec3 color = ambientLight * k_a;

    vec3 light1Pos = vec3(0.0, 4.0, 4.0);
    vec3 light1Intensity = vec3(0.4, 0.4, 0.4);

    color += phongContribForLight(k_d, k_s, alpha, p, rO,
                                  light1Pos, light1Intensity);

    return color;
}

/* END Lighting functions
---------------------------------------------------------------- */



void main () {
    // Normalize coordinates so that (0, 0) is in center screen
    vec2 uv  = (gl_FragCoord.xy / u_resolution.xy / 2.0) - vec2(0.5);
    uv.x *= 2.0;

    // Background color
    vec3 color = vec3(0.2);

    // Camera location
    vec3 ro = vec3(0.0, 1.0, 0.0);
    vec3 rd = normalize(vec3(uv.x, uv.y, 1.0));

    // Shortest distance to a surface
    float d = RayMarch(ro, rd);

    // Didn't hit anything
    if (d >= MAX_DIST) {
        color = dither(color);
        gl_FragColor = vec4(color, 1.0);
        return;
    }

    // Closest point on the surface along view ray
    vec3 p = ro + rd * d;

    vec3 K_a = vec3(0.2, 0.2, 0.2);
    vec3 K_d = vec3(0.7, 0.2, 0.2);
    vec3 K_s = vec3(1.0, 1.0, 1.0);
    float shininess = 10.0;
    
    color = phongIllumination(K_a, K_d, K_s, shininess, p, ro);

    color = dither(color);


    gl_FragColor = vec4(color, 1.0);
}