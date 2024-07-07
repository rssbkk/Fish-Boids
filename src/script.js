import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import fragmentShaderPosition from './shaders/fragmentShaderPosition.glsl';
import fragmentShaderVelocity from './shaders/fragmentShaderVelocity.glsl';
import { log } from 'three/examples/jsm/nodes/Nodes.js';

/* TEXTURE WIDTH FOR SIMULATION */
const WIDTH = 64;
const BIRDS = WIDTH * WIDTH;

/**
 * Base
 */
// Debug
const gui = new GUI()
const debugObject = {}

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Loaders
const gltfLoader = new GLTFLoader()

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

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(sizes.pixelRatio)
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 10, 3000)
camera.position.set(350, 150, 0)
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Lights
 */
const dirLight = new THREE.DirectionalLight( 0x00CED1, 2.0 );
dirLight.color.setHSL( 0.1, 1, 0.95, THREE.SRGBColorSpace );
dirLight.position.set( - 1, 1.75, 1 );
dirLight.position.multiplyScalar( 30 );
scene.add( dirLight );

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio)

debugObject.clearColor = '#7CC0CF' ; 
renderer.setClearColor(debugObject.clearColor)

/**
 * Needed Functions
 */
function nextPowerOf2( n ) 
{
    return Math.pow( 2, Math.ceil( Math.log( n ) / Math.log( 2 ) ) );
}

Math.lerp = function ( value1, value2, amount ) 
{
    amount = Math.max( Math.min( amount, 1 ), 0 );
    return value1 + ( value2 - value1 ) * amount;
};

function fillPositionTexture( texture ) 
{
    const theArray = texture.image.data;

    for ( let k = 0, kl = theArray.length; k < kl; k += 4 ) {

        const x = Math.random() * BOUNDS - BOUNDS_HALF;
        const y = Math.random() * BOUNDS - BOUNDS_HALF;
        const z = Math.random() * BOUNDS - BOUNDS_HALF;

        theArray[ k + 0 ] = x;
        theArray[ k + 1 ] = y;
        theArray[ k + 2 ] = z;
        theArray[ k + 3 ] = 1;
    }
}

function fillVelocityTexture( texture ) 
{
    const theArray = texture.image.data;

    for ( let k = 0, kl = theArray.length; k < kl; k += 4 ) {

        const x = Math.random() - 0.5;
        const y = Math.random() - 0.5;
        const z = Math.random() - 0.5;

        theArray[ k + 0 ] = x * 10;
        theArray[ k + 1 ] = y * 10;
        theArray[ k + 2 ] = z * 10;
        theArray[ k + 3 ] = 1;
    }
}

/**
 * Model Bits (I hope)
 */
/* BAKE ANIMATION INTO TEXTURE and CREATE GEOMETRY FROM BASE MODEL */
const BirdGeometry = new THREE.BufferGeometry();
let textureAnimation, durationAnimation, birdMesh, materialShader, indicesPerBird;

const gltfs = [ 'models/hammerhead.glb' ];
const modelColors = [ 0xccFFFF, 0xffdeff ];
const modelSizes = [ 1.0, 0.2, 0.1 ];
const selectModel = Math.floor( Math.random() * gltfs.length );

// Preload the models
let preloadedModels = [];

function preloadModels() 
{
    gltfs.forEach((gltfPath, index) => {
        gltfLoader.load(gltfPath, (gltf) => {
            preloadedModels[index] = gltf;
            if (index === selectModel) {
                initModel(gltf, effectController);
            }
        })
    })
}

preloadModels();

function initModel(gltf, effectController) 
{
    const animations = gltf.animations;
    durationAnimation = Math.round(animations[0].duration * 60);
    const birdGeo = gltf.scene.children[0].geometry;

    console.log("Bird Geometry Loaded:", birdGeo);
    console.log(birdGeo.attributes);

    const morphAttributes = birdGeo.morphAttributes.position;
    if (!morphAttributes) {
        console.error("Morph attributes are not defined for the model.");
        return;
    }

    const tHeight = nextPowerOf2(durationAnimation);
    const tWidth = nextPowerOf2(birdGeo.getAttribute('position').count);
    indicesPerBird = birdGeo.index.count;
    const tData = new Float32Array(4 * tWidth * tHeight);

    for (let i = 0; i < tWidth; i++) {
        for (let j = 0; j < tHeight; j++) {
            const offset = j * tWidth * 4;
            const curMorph = Math.floor(j / durationAnimation * morphAttributes.length);
            const nextMorph = (Math.floor(j / durationAnimation * morphAttributes.length) + 1) % morphAttributes.length;
            const lerpAmount = j / durationAnimation * morphAttributes.length % 1;

            if (j < durationAnimation) {
                let d0, d1;
                
                if (morphAttributes[curMorph] && morphAttributes[curMorph].array) {
                    d0 = morphAttributes[curMorph].array[i * 3];
                } else {
                    console.error("CurMorph array is undefined for index:", curMorph);
                    continue;
                }

                if (morphAttributes[nextMorph] && morphAttributes[nextMorph].array) {
                    d1 = morphAttributes[nextMorph].array[i * 3];
                } else {
                    console.error("NextMorph array is undefined for index:", nextMorph);
                    continue;
                }

                if (d0 !== undefined && d1 !== undefined) tData[offset + i * 4] = Math.lerp(d0, d1, lerpAmount);

                if (morphAttributes[curMorph] && morphAttributes[curMorph].array) {
                    d0 = morphAttributes[curMorph].array[i * 3 + 1];
                } else {
                    console.error("CurMorph array is undefined for index:", curMorph);
                    continue;
                }

                if (morphAttributes[nextMorph] && morphAttributes[nextMorph].array) {
                    d1 = morphAttributes[nextMorph].array[i * 3 + 1];
                } else {
                    console.error("NextMorph array is undefined for index:", nextMorph);
                    continue;
                }

                if (d0 !== undefined && d1 !== undefined) tData[offset + i * 4 + 1] = Math.lerp(d0, d1, lerpAmount);

                if (morphAttributes[curMorph] && morphAttributes[curMorph].array) {
                    d0 = morphAttributes[curMorph].array[i * 3 + 2];
                } else {
                    console.error("CurMorph array is undefined for index:", curMorph);
                    continue;
                }

                if (morphAttributes[nextMorph] && morphAttributes[nextMorph].array) {
                    d1 = morphAttributes[nextMorph].array[i * 3 + 2];
                } else {
                    console.error("NextMorph array is undefined for index:", nextMorph);
                    continue;
                }

                if (d0 !== undefined && d1 !== undefined) tData[offset + i * 4 + 2] = Math.lerp(d0, d1, lerpAmount);
                tData[offset + i * 4 + 3] = 1;
            }
        }
    }


    textureAnimation = new THREE.DataTexture(tData, tWidth, tHeight, THREE.RGBAFormat, THREE.FloatType);
    textureAnimation.needsUpdate = true;

    const vertices = [], color = [], reference = [], seeds = [], indices = [];
    const totalVertices = birdGeo.getAttribute('position').count * 3 * BIRDS;
    for (let i = 0; i < totalVertices; i++) {
        const bIndex = i % (birdGeo.getAttribute('position').count * 3);
        vertices.push(birdGeo.getAttribute('position').array[bIndex]);
        // color.push(birdGeo.getAttribute('color').array[bIndex]);
    }

    let r = Math.random();
    for (let i = 0; i < birdGeo.getAttribute('position').count * BIRDS; i++) {
        const bIndex = i % (birdGeo.getAttribute('position').count);
        const bird = Math.floor(i / birdGeo.getAttribute('position').count);
        if (bIndex == 0) r = Math.random();
        const j = ~~bird;
        const x = (j % WIDTH) / WIDTH;
        const y = ~~(j / WIDTH) / WIDTH;
        reference.push(x, y, bIndex / tWidth, durationAnimation / tHeight);
        seeds.push(bird, r, Math.random(), Math.random());
    }

    for (let i = 0; i < birdGeo.index.array.length * BIRDS; i++) {
        const offset = Math.floor(i / birdGeo.index.array.length) * (birdGeo.getAttribute('position').count);
        indices.push(birdGeo.index.array[i % birdGeo.index.array.length] + offset);
    }

    BirdGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    BirdGeometry.setAttribute('birdColor', new THREE.BufferAttribute(new Float32Array(color), 3));
    // BirdGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(color), 3));
    BirdGeometry.setAttribute('reference', new THREE.BufferAttribute(new Float32Array(reference), 4));
    BirdGeometry.setAttribute('seeds', new THREE.BufferAttribute(new Float32Array(seeds), 4));

    BirdGeometry.setIndex(indices);

    valuesChanger();
    initFish(effectController);
}

function initFish( effectController )
{
    const geometry = BirdGeometry;

    const m = new THREE.MeshStandardMaterial( {
        vertexColors: true,
        flatShading: true,
        roughness: 1,
        metalness: 0
    } );

    m.onBeforeCompile = ( shader ) => {
        shader.uniforms.texturePosition = { value: null };
        shader.uniforms.textureVelocity = { value: null };
        shader.uniforms.textureAnimation = { value: textureAnimation };
        shader.uniforms.uTime = { value: 1.0 };
        shader.uniforms.size = { value: effectController.size };
        shader.uniforms.uDelta = { value: 0.0 };

        let token = '#define STANDARD';

        let insert = /* glsl */`
            attribute vec4 reference;
            attribute vec4 seeds;
            attribute vec3 birdColor;
            uniform sampler2D texturePosition;
            uniform sampler2D textureVelocity;
            uniform sampler2D textureAnimation;
            uniform float size;
            uniform float uTime;
        `;

        shader.vertexShader = shader.vertexShader.replace( token, token + insert );

        token = '#include <begin_vertex>';

        insert = /* glsl */`
            vec4 tmpPos = texture( texturePosition, reference.xy );

            vec3 pos = tmpPos.xyz;
            vec3 velocity = normalize(texture( textureVelocity, reference.xy ).xyz);
            vec3 aniPos = texture( textureAnimation, vec2( reference.z, mod( uTime + ( seeds.x ) * ( ( 0.0004 + seeds.y / 10000.0) + normalize( velocity ) / 20000.0 ), reference.w ) ) ).xyz;
            vec3 newPosition = position;

            newPosition = mat3( modelMatrix ) * ( newPosition + aniPos );
            newPosition *= size + seeds.y * size * 0.2;

            velocity.z *= -1.;
            float xz = length( velocity.xz );
            float xyz = 1.;
            float x = sqrt( 1. - velocity.y * velocity.y );

            float cosry = velocity.x / xz;
            float sinry = velocity.z / xz;

            float cosrz = x / xyz;
            float sinrz = velocity.y / xyz;

            mat3 maty =  mat3( cosry, 0, -sinry, 0    , 1, 0     , sinry, 0, cosry );
            mat3 matz =  mat3( cosrz , sinrz, 0, -sinrz, cosrz, 0, 0     , 0    , 1 );

            newPosition =  maty * matz * newPosition;
            newPosition += pos;

            vec3 transformed = vec3( newPosition );
        `;

        shader.vertexShader = shader.vertexShader.replace( token, insert );

        materialShader = shader;
    };

    birdMesh = new THREE.Mesh( geometry, m);
    birdMesh.rotation.y = Math.PI / 2;

    birdMesh.castShadow = true;
    birdMesh.receiveShadow = true;

    scene.add( birdMesh );
}

/**
 * GPU Compute
 */
const BOUNDS = 800, BOUNDS_HALF = BOUNDS / 2;

const gpgpu = {};
gpgpu.computation = new GPUComputationRenderer(WIDTH, WIDTH, renderer);

const dtPosition = gpgpu.computation.createTexture();
const dtVelocity = gpgpu.computation.createTexture();
fillPositionTexture( dtPosition );
fillVelocityTexture( dtVelocity );

const positionVariable = gpgpu.computation.addVariable( 'texturePosition', fragmentShaderPosition, dtPosition );
const velocityVariable = gpgpu.computation.addVariable( 'textureVelocity', fragmentShaderVelocity, dtVelocity );

gpgpu.computation.setVariableDependencies( velocityVariable, [ positionVariable, velocityVariable ] );
gpgpu.computation.setVariableDependencies( positionVariable, [ positionVariable, velocityVariable ] );

let positionUniforms = positionVariable.material.uniforms;
let velocityUniforms = velocityVariable.material.uniforms;

positionUniforms[ 'uTime' ] = { value: 0.0 };
positionUniforms[ 'uDelta' ] = { value: 0.016 };
velocityUniforms[ 'uTime' ] = { value: 1.0 };
velocityUniforms[ 'uDelta' ] = { value: 0.016 };
velocityUniforms[ 'uTesting' ] = { value: 1.0 };
velocityUniforms[ 'uSeparationDistance' ] = { value: 1.0 };
velocityUniforms[ 'uAlignmentDistance' ] = { value: 1.0 };
velocityUniforms[ 'uCohesionDistance' ] = { value: 1.0 };
velocityUniforms[ 'uFreedomFactor' ] = { value: 1.0 };
velocityUniforms[ 'uPredatorPosition' ] = { value: new THREE.Vector3() };
velocityVariable.material.defines.BOUNDS = BOUNDS.toFixed( 2 );
velocityUniforms[ 'uSpeed' ] = { value: 4.0 }; // 9.0
// velocityUniforms[ 'uZone' ] = { value: 50.0 }; // 60
velocityUniforms[ 'uCentripetal' ] = { value: 2 }; //5.0
// velocityUniforms[ 'uAvoidancePosition' ] = { value: 1.0 };
velocityUniforms[ 'uAvoidanceRadius' ] = { value: 50.0 };
velocityUniforms[ 'uAvoidanceStrength' ] = { value: 5.0 };
velocityUniforms[ 'uFleeRadius' ] = { value: 125.0 }; // 150
velocityUniforms[ 'uFleeSpeed' ] = { value: 5.0 };
velocityUniforms[ 'uZFlee' ] = { value: 0.5 }; // 0.0


velocityVariable.wrapS = THREE.RepeatWrapping;
velocityVariable.wrapT = THREE.RepeatWrapping;
positionVariable.wrapS = THREE.RepeatWrapping;
positionVariable.wrapT = THREE.RepeatWrapping;

const effectController = 
{
    separation: 40.0,
    alignment: 10.0,
    cohesion: 20.0,
    freedom: 0.75,
    uSpeed: 4,
    // uZone: 75,
    uCentripetal: 2,
    // uAvoidancePosition: 0.75,
    uAvoidanceRadius: 50.0,
    uAvoidanceStrength: 5.0,
    uFleeRadius: 125,
    uFleeSpeed: 5,
    uZFlee: 0.5,
    size: modelSizes[ selectModel ],
    count: Math.floor( BIRDS / 4 ),
};

const valuesChanger = () =>
{
    velocityUniforms[ 'uSeparationDistance' ].value = effectController.separation;
    velocityUniforms[ 'uAlignmentDistance' ].value = effectController.alignment;
    velocityUniforms[ 'uCohesionDistance' ].value = effectController.cohesion;
    velocityUniforms[ 'uFreedomFactor' ].value = effectController.freedom;
    velocityUniforms[ 'uSpeed' ].value = effectController.uSpeed;
    // velocityUniforms[ 'uZone' ].value = effectController.uZone;
    velocityUniforms[ 'uCentripetal' ].value = effectController.uCentripetal;
    // velocityUniforms[ 'uAvoidancePosition' ].value = effectController.uAvoidancePosition;
    velocityUniforms[ 'uAvoidanceRadius' ].value = effectController.uAvoidanceRadius;
    velocityUniforms[ 'uAvoidanceStrength' ].value = effectController.uAvoidanceStrength;
    velocityUniforms[ 'uFleeRadius' ].value = effectController.uFleeRadius;
    velocityUniforms[ 'uFleeSpeed' ].value = effectController.uFleeSpeed;
    velocityUniforms[ 'uZFlee' ].value = effectController.uZFlee;
    if( materialShader ) materialShader.uniforms[ 'size' ].value = effectController.size;
    BirdGeometry.setDrawRange( 0, indicesPerBird * effectController.count );
};

function switchModel(modelIndex) 
{
    if (birdMesh) {
        scene.remove(birdMesh);
        birdMesh.geometry.dispose();
        birdMesh.material.dispose();
    }

    const gltf = preloadedModels[modelIndex];
    initModel(gltf, effectController);
}

// Fish Debug
const behavior = gui.addFolder('behavior');
behavior.add( effectController, 'separation', 0.0, 100.0, 1.0 ).onChange( valuesChanger );
behavior.add( effectController, 'alignment', 0.0, 100, 0.25 ).onChange( valuesChanger );
behavior.add( effectController, 'cohesion', 0.0, 100, 0.25 ).onChange( valuesChanger );
// behavior.add( effectController, 'freedom', 0.0, 2, 0.025 ).onChange( valuesChanger );
behavior.add( effectController, 'uSpeed', 0, 20, 0.25 ).onChange( valuesChanger );

const population = gui.addFolder('population');
population.add( effectController, 'size', 0, 2, 0.01 ).onChange( valuesChanger );
population.add( effectController, 'count', 0, 2048, 1 ).onChange( valuesChanger );
// population.add( effectController, 'uZone', 10, 120, 1 ).onChange( valuesChanger );

const movement = gui.addFolder('movement');
movement.add( effectController, 'uCentripetal', 0.1, 10, 0.25).onChange( valuesChanger );
// movement.add( effectController, 'uAvoidancePosition', 0.1, 10, 0.1).onChange( valuesChanger );
// movement.add( effectController, 'uAvoidanceRadius', 0, 200, 1).onChange( valuesChanger );
// movement.add( effectController, 'uAvoidanceStrength', 1, 30, 1).onChange( valuesChanger );

const dispersion = gui.addFolder('dispersion');
dispersion.add( effectController, 'uFleeRadius', 50, 250, 5).onChange( valuesChanger );
dispersion.add( effectController, 'uFleeSpeed', 1, 15, 0.5).onChange( valuesChanger );
dispersion.add( effectController, 'uZFlee', 0, 1, 0.1).onChange( valuesChanger );

gui.add(effectController, 'model', { 'Parrot': 0, 'Flamingo': 1 }).onChange((value) => switchModel(value));

gui.close();

// Options Menu to control EffectController
const sliders = [
    { id: 'separation', prop: 'separation' },
    { id: 'alignment', prop: 'alignment' },
    { id: 'cohesion', prop: 'cohesion' },
    { id: 'uSpeed', prop: 'uSpeed' },
    { id: 'size', prop: 'size' },
    { id: 'count', prop: 'count' },
    // { id: 'uZone', prop: 'uZone' },
    { id: 'uCentripetal', prop: 'uCentripetal' },
    { id: 'uFleeRadius', prop: 'uFleeRadius' },
    { id: 'uFleeSpeed', prop: 'uFleeSpeed' },
    { id: 'uZFlee', prop: 'uZFlee' }
];

sliders.forEach(slider => {
    const element = document.getElementById(slider.id);
    element.addEventListener('input', (event) => {
        effectController[slider.prop] = parseFloat(event.target.value);
        valuesChanger();
    });
});


// Init
gpgpu.computation.init();


// // Visual Texture Debug
// gpgpu.debug = new THREE.Mesh(
//     new THREE.PlaneGeometry(3, 3),
//     new THREE.MeshBasicMaterial({
//         map: gpgpu.computation.getCurrentRenderTarget(velocityVariable).texture
//     })
// )
// gpgpu.positionTextureDebug = new THREE.Mesh(
//     new THREE.PlaneGeometry(3, 3),
//     new THREE.MeshBasicMaterial({
//         map: gpgpu.computation.getCurrentRenderTarget(positionVariable).texture
//     })
// )

// gpgpu.debug.position.x = 3;
// gpgpu.positionTextureDebug.position.x = -3;
// // gpgpu.debug.visible = false;
// scene.add(gpgpu.debug, gpgpu.positionTextureDebug);


/**
 * Pointer (predetor)
 */
let mouseX = 0, mouseY = 0;

window.addEventListener('pointermove', (event) => {
    mouseX = event.clientX - (sizes.width / 2);
    mouseY = event.clientY - (sizes.height / 2);
    // mouseX = (event.clientX / sizes.width) * 2 - 1;
    // mouseY = (event.clientY / sizes.height) * 2 - 1;
});

/**
 * Animate
 */
let last = performance.now();

const tick = () =>
{
    const now = performance.now();
    let uDelta = ( now - last ) / 1000;

    if ( uDelta > 1 ) uDelta = 1; // safety cap on large deltas
    last = now;
    
    // Update controls
    controls.update()

    // Update Uniforms
    positionUniforms[ 'uTime' ].value = now;
    positionUniforms[ 'uDelta' ].value = uDelta;
    velocityUniforms[ 'uTime' ].value = now;
    velocityUniforms[ 'uDelta' ].value = uDelta;
    if ( materialShader ) materialShader.uniforms[ 'uTime' ].value = now / 1000;
    if ( materialShader ) materialShader.uniforms[ 'uDelta' ].value = uDelta;

    velocityUniforms[ 'uPredatorPosition' ].value.set( 0.5 * mouseX / (sizes.width / 2), - 0.5 * mouseY / (sizes.height / 2), 0 );

    // Reset Pointer Position
    mouseX = 10000;
    mouseY = 10000;

    // GPGPU Update
    gpgpu.computation.compute();
    if ( materialShader ) materialShader.uniforms[ 'texturePosition' ].value = gpgpu.computation.getCurrentRenderTarget( positionVariable ).texture;
    if ( materialShader ) materialShader.uniforms[ 'textureVelocity' ].value = gpgpu.computation.getCurrentRenderTarget( velocityVariable ).texture;

    // Render normal scene 
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()