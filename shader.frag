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


float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float GetDist(vec3 p) {
    vec4 s = vec4(0.0, 1.0, 6.0, 1.0);

    float sphereDist = length(p - s.xyz) - s.w;
    float planeDist = p.y;

    float d = min(sphereDist, planeDist);

    return d;
}

float RayMarch(vec3 ro, vec3 rd) {
    float dO = 0.0;

    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * dO;
        float dS = GetDist(p);
        dO += dS;
        if (dO > MAX_DIST || dS < SURF_DIST) break;
    }

    return dO;
}

vec3 GetNormal(vec3 p) {
    float d = GetDist(p);
    vec2 e = vec2(.01, 0.0);

    vec3 n = d - vec3(GetDist(p - e.xyy), 
                      GetDist(p - e.yxy), 
                      GetDist(p - e.yyx));

    return normalize(n);
}

float GetLight(vec3 p) {
    vec3 lightPos = vec3(0.0, 4.0, 4.0);
    lightPos.xy += vec2(sin(u_time), cos(u_time));
    vec3 l = normalize(lightPos - p);
    vec3 n = GetNormal(p);

    float dif = dot(n, l);

    return dif;
}

vec3 srgbToLinear(vec3 col) {
    if (col.r <= 0.04045) col.r = col.r / 12.92;
    else col.r = pow((col.r + 0.055) / 1.055, 2.4);

    if (col.b <= 0.04045) col.b = col.b / 12.92;
    else col.b = pow((col.b + 0.055) / 1.055, 2.4);

    if (col.g <= 0.04045) col.g = col.g / 12.92;
    else col.g = pow((col.g + 0.055) / 1.055, 2.4);

    return col;
}

float bayer8x8Lookup() {
    vec2 uv = vec2(int(mod(gl_FragCoord.x, 8.)), 
                   int(mod(gl_FragCoord.y, 8.)));
    
    return texture2D(bayer8x8, uv).r;
}

float bayer16x16Lookup() {
    vec2 st = vec2(mod(gl_FragCoord.x, 16.) / 16.,
                   mod(gl_FragCoord.y, 16.) / 16.);

    float col = texture2D(bayer16x16, st).r;
    return col;
}

float blueNoise64x64Lookup() {
    vec2 st = vec2(mod(gl_FragCoord.x, 64.) / 64.,
                   mod(gl_FragCoord.y, 64.) / 64.);

    float col = texture2D(blueNoise64x64, st).r;
    return col;
}

vec3 quantize (vec3 col) {
    // float c = step(0.5, col.r + rand(col.gb) * 1.5 - 1.0);
    // float c = step(rand(col.gb), col.r);
    // float c = step(bayer8x8Lookup(), col.r);
    // float c = step(bayer16x16Lookup(), col.r);
    // float c = step(blueNoise64x64Lookup(), col.r);
    // float c = step((blueNoise64x64Lookup() + .05*rand(col.gb)), col.r);
    float c = step((blueNoise64x64Lookup() + bayer16x16Lookup()) / 2.0, col.r);
    col = vec3(c);

    return col;
}



void main () {
    vec2 uv  = (gl_FragCoord.xy / u_resolution.xy / 2.0) - vec2(0.5);
    uv.x *= 2.0;

    vec3 col = vec3(0.0);

    vec3 ro = vec3(0.0, 1.0, 0.0);
    vec3 rd = normalize(vec3(uv.x, uv.y, 1.0));

    float d = RayMarch(ro, rd);

    vec3 p = ro + rd * d;

    float dif = GetLight(p);
    col = vec3(dif);

    col = srgbToLinear(col);

    col = quantize(col);



    gl_FragColor = vec4(col, 1.0);
}