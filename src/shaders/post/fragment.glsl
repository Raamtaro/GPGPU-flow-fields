varying vec2 vUv;
uniform sampler2D tDiffuse;

void main() {
    vec4 texture = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(texture);

}