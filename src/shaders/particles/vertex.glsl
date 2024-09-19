uniform vec2 uResolution;
uniform float uSize;
uniform sampler2D uParticlesTexture;

attribute vec2 aParticlesUv;
attribute float aSize;

varying vec3 vColor;
varying vec2 vUv;

void main()
{

    vec4 particle = texture(uParticlesTexture, aParticlesUv);
    // Final position
    vec4 modelPosition = modelMatrix * vec4(particle.xyz, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;



    // Point size
    float sizeIn = smoothstep(0.0, 0.1, particle.a);
    float sizeOut = smoothstep(0.7, 1.0, particle.a);
    float size = min(sizeIn, sizeOut);

    gl_PointSize = aSize * uSize * uResolution.y;
    gl_PointSize *= (1.0 / - viewPosition.z);

    // Varyings
    vUv = uv;
    // vColor = vec3(aParticlesUv, 0.35); //makes a cool color
    // vColor = particle.xyz;
    vColor = vec3(vUv, 0.0); //But for now I would like black
}