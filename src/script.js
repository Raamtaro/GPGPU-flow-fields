import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import GUI from 'lil-gui'

//PostProcessing stuff
import { EffectComposer, RenderPass, ShaderPass, GammaCorrectionShader, SMAAPass } from 'three/examples/jsm/Addons.js'

// Shaders
import particlesVertexShader from './shaders/particles/vertex.glsl'
import particlesFragmentShader from './shaders/particles/fragment.glsl'
import gpgpuParticlesShader from './shaders/gpgpu/particles.glsl'
import postVertex from './shaders/post/vertex.glsl'
import postFragment from './shaders/post/fragment.glsl'

import { GPUComputationRenderer } from 'three/examples/jsm/Addons.js'

import '/style.css'


/**
 * Base
 */
// Debug
const gui = new GUI({ width: 340 })
const debugObject = {}

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Loaders
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

const gltf = await gltfLoader.loadAsync('./lotus.glb')
console.log(gltf)

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.min(window.devicePixelRatio, 2)
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    sizes.pixelRatio = Math.min(window.devicePixelRatio, 2)

    // Materials
    particles.material.uniforms.uResolution.value.set(sizes.width * sizes.pixelRatio, sizes.height * sizes.pixelRatio)

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(sizes.pixelRatio)

    //Update effectComposer
    effectComposer.setSize(sizes.width, sizes.height)
    effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    //Update customPass Uniforms
    customPass.uniforms.uResolution.value.y = sizes.height / sizes.width
    
})

/**
 * Camera
 */
//Group
const cameraGroup = new THREE.Group()
scene.add(cameraGroup)

// Base camera
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 100)
camera.position.set(4.5, 14, 20)
camera.lookAt(0, 0, 0)
cameraGroup.add(camera)

/**
 * Basic Parallax/Cursor tracking setup. Might be considering raycaster soon for interactive particle effects, so may modify.
 */

//Cursor
const cursor = {}
//Plx effect
cursor.parallaxX = 0;
cursor.parallaxY = 0;

//Custom Cursor
const customCursor = document.getElementById('cursor');


//RGB Shift effect
cursor.mouse = new THREE.Vector2()
cursor.followMouse = new THREE.Vector2()
cursor.previousMouse = new THREE.Vector2()

cursor.speed = 0
cursor.targetSpeed = 0

cursor.calculateSpeed = () => {
    // console.log('running')
    cursor.speed = Math.sqrt( (cursor.previousMouse.x - cursor.mouse.x)**2 + (cursor.previousMouse.y - cursor.mouse.y)**2 )

    const ease = 0.05

    cursor.targetSpeed -= ease * (cursor.targetSpeed - cursor.speed)
    cursor.followMouse.x -= ease * (cursor.followMouse.x - cursor.mouse.x)
    cursor.followMouse.y -= ease * (cursor.followMouse.y - cursor.mouse.y)

    cursor.previousMouse.x = cursor.mouse.x
    cursor.previousMouse.y = cursor.mouse.y
}

window.addEventListener('mousemove', (event) => {
    cursor.parallaxX = event.clientX/sizes.width - 0.5; //dividing only by the width (or the height, in the Y direciton) will normalize values from 0 to 1. However.... For parallax, it's better to set our context from -0.5 to 0.5
    cursor.parallaxY = event.clientY/sizes.height - 0.5;

    // console.log(`Mouse coordinates: (${cursor.parallaxX}, ${cursor.parallaxY})`)

    cursor.mouse.x = (event.clientX / sizes.width) 
    cursor.mouse.y =1.0 - (event.clientY / sizes.height) 
    // console.log(cursor.mouse)

    customCursor.style.transform = `translate(${event.clientX - 10}px, ${event.clientY - 10}px)`;
    // document.body.style.cursor = 'none'
})

// Controls
// const controls = new OrbitControls(camera, canvas)
// controls.enableDamping = true


/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
})

renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio)

debugObject.clearColor = '#7f7a7c'
renderer.setClearColor(debugObject.clearColor)

/**
 * Base Geometry
 */
const baseGeometry = {}
// baseGeometry.instance = new THREE.SphereGeometry(3) //Hello World
// baseGeometry.instance = gltf.scene.children[0].geometry //uncomment if using the lesson provided model.glb

//Lotus traverse ---> baseGeometry.instance
gltf.scene.traverse((child) => {
    if(child.isMesh) {

        // child.scale.set(3, 3, 3)

        baseGeometry.instance = child.geometry


        
        console.log(baseGeometry.instance)


        return
    }
})
baseGeometry.count = baseGeometry.instance.attributes.position.count

/**
 * GPU Compute
 */

//Setup
const gpgpu = {}
gpgpu.size = Math.ceil(Math.sqrt(baseGeometry.count))
gpgpu.computation = new GPUComputationRenderer(gpgpu.size, gpgpu.size, renderer)

//Base Particles
const baseParticlesTexture = gpgpu.computation.createTexture()

for (let i =0; i < baseGeometry.count; i++) {
    const i3 = i * 3
    const i4 = i * 4

    //Set Positions
    baseParticlesTexture.image.data[i4 + 0] = baseGeometry.instance.attributes.position.array[i3 + 0]
    baseParticlesTexture.image.data[i4 + 1] = baseGeometry.instance.attributes.position.array[i3 + 1]
    baseParticlesTexture.image.data[i4 + 2] = baseGeometry.instance.attributes.position.array[i3 + 2]
    // baseParticlesTexture.image.data[i4 + 3] = 0

    baseParticlesTexture.image.data[i4 + 3] = Math.random()
}

// console.log(baseParticlesTexture.image.data)

//Particles Variable
gpgpu.particlesVariable = gpgpu.computation.addVariable('uParticles', gpgpuParticlesShader, baseParticlesTexture) //this is the texture for the particle positions
gpgpu.computation.setVariableDependencies(gpgpu.particlesVariable, [gpgpu.particlesVariable])

//GPGPU Uniforms
gpgpu.particlesVariable.material.uniforms.uTime = new THREE.Uniform(0)
gpgpu.particlesVariable.material.uniforms.uDeltaTime = new THREE.Uniform(0)
gpgpu.particlesVariable.material.uniforms.uBase = new THREE.Uniform(baseParticlesTexture)
gpgpu.particlesVariable.material.uniforms.uFlowFieldInfluence = new THREE.Uniform(0.974)
gpgpu.particlesVariable.material.uniforms.uFlowFieldStrength = new THREE.Uniform(1.129)
gpgpu.particlesVariable.material.uniforms.uFlowFieldFrequency = new THREE.Uniform(0.708)

//init
gpgpu.computation.init()

//Debug plane
gpgpu.debug = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.MeshBasicMaterial(
        {
            map: gpgpu.computation.getCurrentRenderTarget(gpgpu.particlesVariable).texture
        }
    )
)
gpgpu.debug.position.x = 3
gpgpu.debug.visible = false;
scene.add(gpgpu.debug)

// console.log(gpgpu.computation.getCurrentRenderTarget(gpgpu.particlesVariable).texture)



/**
 * Particles
 */
const particles = {}

// Geometry
const particlesUvArray = new Float32Array(baseGeometry.count * 2)
const sizesArray = new Float32Array(baseGeometry.count)

for(let y = 0; y < gpgpu.size; y++)
    {
        for(let x = 0; x < gpgpu.size; x++)
        {
            const i = (y * gpgpu.size + x)
            const i2 = i * 2

            //normalize to 0 -> 1
            const uvX = (x + 0.5) / gpgpu.size
            const uvY = (y + 0.5) / gpgpu.size

            particlesUvArray[i2 + 0] = uvX;
            particlesUvArray[i2 + 1] = uvY;

            //size
            sizesArray[i] = Math.random()
        }
    }

particles.geometry = new THREE.BufferGeometry()
particles.geometry.setDrawRange(0, baseGeometry.count)
particles.geometry.setAttribute('aParticlesUv', new THREE.BufferAttribute(particlesUvArray, 2))
particles.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizesArray, 1))

// Material
particles.material = new THREE.ShaderMaterial({
    vertexShader: particlesVertexShader,
    fragmentShader: particlesFragmentShader,
    uniforms:
    {
        uSize: new THREE.Uniform(0.023099),
        uResolution: new THREE.Uniform(new THREE.Vector2(sizes.width * sizes.pixelRatio, sizes.height * sizes.pixelRatio)),
        uParticlesTexture: new THREE.Uniform()
    }
})

// Points
particles.points = new THREE.Points(particles.geometry, particles.material)
particles.points.frustumCulled = false
scene.add(particles.points)

/**
 * Post Processing
 */
const renderTarget = new THREE.WebGLRenderTarget(
    800,
    600,
    {
        samples: renderer.getPixelRatio() === 1 ? 2 : 0
    }
) //For antialiasing

//The Effect Composer
const effectComposer = new EffectComposer(renderer, renderTarget)
effectComposer.setSize(sizes.width, sizes.height)
effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

//First Pass
const renderPass = new RenderPass(scene, camera)
effectComposer.addPass(renderPass)

//CustomPost Pass
const RGBShiftShader = {
    uniforms: {
        "tDiffuse": { value: null },   
        "uResolution": { value: new THREE.Vector2(1.,window.innerHeight/window.innerWidth) },
        "uMouse": { value: new THREE.Vector2(-10,-10) },
        "uVelo": { value: 0 },     
        "time": { value: 0 }
    },
    vertexShader: postVertex,
    fragmentShader: postFragment,
}

const customPass = new ShaderPass(RGBShiftShader)
customPass.renderToScreen = true
effectComposer.addPass(customPass)




//Last Pass is the Gamma Shader
const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader)
effectComposer.addPass(gammaCorrectionPass)

//JK, last pass is anti-alias set up if necessary.
if(renderer.getPixelRatio() === 1 && !renderer.capabilities.isWebGL2)
    {
        const smaaPass = new SMAAPass()
        effectComposer.addPass(smaaPass)
    
        console.log('Using SMAA')
    }



/**
 * Tweaks
 */
gui.addColor(debugObject, 'clearColor').onChange(() => { renderer.setClearColor(debugObject.clearColor) })
gui.add(particles.material.uniforms.uSize, 'value').min(0).max(1).step(0.001).name('uSize')
gui.add(gpgpu.particlesVariable.material.uniforms.uFlowFieldInfluence, 'value').min(0).max(1).step(0.001).name('uFlowfieldInfluence')
gui.add(gpgpu.particlesVariable.material.uniforms.uFlowFieldStrength, 'value').min(0).max(10).step(0.001).name('uFlowfieldStrength')
gui.add(gpgpu.particlesVariable.material.uniforms.uFlowFieldFrequency, 'value').min(0).max(1).step(0.001).name('uFlowfieldFrequency')

gui.destroy()



/**
 * Animate
 */
const clock = new THREE.Clock()
let previousTime = 0

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime

    //Overall Model Rotation
    particles.points.rotateOnAxis(new THREE.Vector3(0, 1, 0), deltaTime*0.12)
    
    // Update controls
    // controls.update()

    // GPGPU Update
    gpgpu.particlesVariable.material.uniforms.uTime.value = elapsedTime
    gpgpu.particlesVariable.material.uniforms.uDeltaTime.value = deltaTime
    gpgpu.computation.compute()
    particles.material.uniforms.uParticlesTexture.value = gpgpu.computation.getCurrentRenderTarget(gpgpu.particlesVariable).texture

    //Parallax
    const parallaxX = cursor.parallaxX * 0.3;
    const parallaxY = - cursor.parallaxY * 0.3;

    cameraGroup.position.x += (parallaxX - cameraGroup.position.x) * 5 * deltaTime;
    cameraGroup.position.y += (parallaxY - cameraGroup.position.y) * 5 * deltaTime;


    //RGB Updates
    cursor.calculateSpeed()
    // customPass.uniforms.time.value = elapsedTime //I don't really use this in the shader and so I'm going to comment out
    customPass.uniforms.uMouse.value = cursor.followMouse
    customPass.uniforms.uVelo.value = Math.min(cursor.targetSpeed, 0.05)
    cursor.targetSpeed *= 0.999;

    

    // console.log(cameraGroup.position)

    // Render normal scene
    effectComposer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()