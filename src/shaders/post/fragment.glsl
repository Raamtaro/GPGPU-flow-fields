varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uVelo;

float circle(vec2 uv, vec2 disc_center, float disc_radius, float border_size) {
    uv -= disc_center;
    uv*=uResolution;
    float dist = sqrt(dot(uv, uv));
    return smoothstep(disc_radius+border_size, disc_radius-border_size, dist);
}


void main() {
    vec2 newUv = vUv;

    //Hello World
    vec4 uvTexture = texture2D(tDiffuse, vUv); 
    

    float c = circle(newUv, uMouse, 0.0, 0.2);
    float r = texture2D(tDiffuse, newUv.xy += c * (uVelo * .5)).x;
    float g = texture2D(tDiffuse, newUv.xy += c * (uVelo * .525)).y;
    float b = texture2D(tDiffuse, newUv.xy += c * (uVelo * .55)).z;

    gl_FragColor = vec4(r, g, b, 1.0);



}