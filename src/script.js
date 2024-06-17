import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import fragmentShaderPosition from './shaders/fragmentShaderPosition.glsl';
import fragmentShaderVelocity from './shaders/fragmentShaderVelocity.glsl';

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
camera.position.set(0, 0, 350)
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

debugObject.clearColor = '#29191f'
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

const gltfs = [ 'models/Flamingo.glb' ];
const modelColors = [ 0xffdeff ];
const modelSizes = [ 0.1 ];
const selectModel = Math.floor( Math.random() * gltfs.length );
let textureAnimation, durationAnimation, materialShader, indicesPerBird;

gltfLoader.load( gltfs[ selectModel ], function ( gltf ) 
{
    const animations = gltf.animations;
    durationAnimation = Math.round( animations[ 0 ].duration * 60 );
    const birdGeo = gltf.scene.children[ 0 ].geometry;
    const morphAttributes = birdGeo.morphAttributes.position;
    const tHeight = nextPowerOf2( durationAnimation );
    const tWidth = nextPowerOf2( birdGeo.getAttribute( 'position' ).count );
    indicesPerBird = birdGeo.index.count;
    const tData = new Float32Array( 4 * tWidth * tHeight );

    for ( let i = 0; i < tWidth; i ++ ) {

        for ( let j = 0; j < tHeight; j ++ ) {

            const offset = j * tWidth * 4;

            const curMorph = Math.floor( j / durationAnimation * morphAttributes.length );
            const nextMorph = ( Math.floor( j / durationAnimation * morphAttributes.length ) + 1 ) % morphAttributes.length;
            const lerpAmount = j / durationAnimation * morphAttributes.length % 1;

            if ( j < durationAnimation ) {

                let d0, d1;

                d0 = morphAttributes[ curMorph ].array[ i * 3 ];
                d1 = morphAttributes[ nextMorph ].array[ i * 3 ];

                if ( d0 !== undefined && d1 !== undefined ) tData[ offset + i * 4 ] = Math.lerp( d0, d1, lerpAmount );

                d0 = morphAttributes[ curMorph ].array[ i * 3 + 1 ];
                d1 = morphAttributes[ nextMorph ].array[ i * 3 + 1 ];

                if ( d0 !== undefined && d1 !== undefined ) tData[ offset + i * 4 + 1 ] = Math.lerp( d0, d1, lerpAmount );

                d0 = morphAttributes[ curMorph ].array[ i * 3 + 2 ];
                d1 = morphAttributes[ nextMorph ].array[ i * 3 + 2 ];

                if ( d0 !== undefined && d1 !== undefined ) tData[ offset + i * 4 + 2 ] = Math.lerp( d0, d1, lerpAmount );

                tData[ offset + i * 4 + 3 ] = 1;

            }

        }

    }

    textureAnimation = new THREE.DataTexture( tData, tWidth, tHeight, THREE.RGBAFormat, THREE.FloatType );
    textureAnimation.needsUpdate = true;

    const vertices = [], color = [], reference = [], seeds = [], indices = [];
    const totalVertices = birdGeo.getAttribute( 'position' ).count * 3 * BIRDS;
    for ( let i = 0; i < totalVertices; i ++ ) {

        const bIndex = i % ( birdGeo.getAttribute( 'position' ).count * 3 );
        vertices.push( birdGeo.getAttribute( 'position' ).array[ bIndex ] );
        color.push( birdGeo.getAttribute( 'color' ).array[ bIndex ] );

    }

    let r = Math.random();
    for ( let i = 0; i < birdGeo.getAttribute( 'position' ).count * BIRDS; i ++ ) {

        const bIndex = i % ( birdGeo.getAttribute( 'position' ).count );
        const bird = Math.floor( i / birdGeo.getAttribute( 'position' ).count );
        if ( bIndex == 0 ) r = Math.random();
        const j = ~ ~ bird;
        const x = ( j % WIDTH ) / WIDTH;
        const y = ~ ~ ( j / WIDTH ) / WIDTH;
        reference.push( x, y, bIndex / tWidth, durationAnimation / tHeight );
        seeds.push( bird, r, Math.random(), Math.random() );

    }

    for ( let i = 0; i < birdGeo.index.array.length * BIRDS; i ++ ) {

        const offset = Math.floor( i / birdGeo.index.array.length ) * ( birdGeo.getAttribute( 'position' ).count );
        indices.push( birdGeo.index.array[ i % birdGeo.index.array.length ] + offset );

    }

    BirdGeometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array( vertices ), 3 ) );
    BirdGeometry.setAttribute( 'birdColor', new THREE.BufferAttribute( new Float32Array( color ), 3 ) );
    BirdGeometry.setAttribute( 'color', new THREE.BufferAttribute( new Float32Array( color ), 3 ) );
    BirdGeometry.setAttribute( 'reference', new THREE.BufferAttribute( new Float32Array( reference ), 4 ) );
    BirdGeometry.setAttribute( 'seeds', new THREE.BufferAttribute( new Float32Array( seeds ), 4 ) );

    BirdGeometry.setIndex( indices );
});

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
    shader.uniforms.time = { value: 1.0 };
    shader.uniforms.size = { value: effectController.size };
    shader.uniforms.delta = { value: 0.0 };

    let token = '#define STANDARD';

    let insert = /* glsl */`
        attribute vec4 reference;
        attribute vec4 seeds;
        attribute vec3 birdColor;
        uniform sampler2D texturePosition;
        uniform sampler2D textureVelocity;
        uniform sampler2D textureAnimation;
        uniform float size;
        uniform float time;
    `;

    shader.vertexShader = shader.vertexShader.replace( token, token + insert );

    token = '#include <begin_vertex>';

    insert = /* glsl */`
        vec4 tmpPos = texture( texturePosition, reference.xy );

        vec3 pos = tmpPos.xyz;
        vec3 velocity = normalize(texture( textureVelocity, reference.xy ).xyz);
        vec3 aniPos = texture( textureAnimation, vec2( reference.z, mod( time + ( seeds.x ) * ( ( 0.0004 + seeds.y / 10000.0) + normalize( velocity ) / 20000.0 ), reference.w ) ) ).xyz;
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

const birdMesh = new THREE.Mesh( geometry, m);
birdMesh.rotation.y = Math.PI / 2;

birdMesh.castShadow = true;
birdMesh.receiveShadow = true;

scene.add( birdMesh );

/**
 * GPU Compute
 */
let mouseX = 0, mouseY = 0;

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

const positionUniforms = positionVariable.material.uniforms;
const velocityUniforms = velocityVariable.material.uniforms;

positionUniforms[ 'time' ] = { value: 0.0 };
positionUniforms[ 'delta' ] = { value: 0.0 };
velocityUniforms[ 'time' ] = { value: 1.0 };
velocityUniforms[ 'delta' ] = { value: 0.0 };
velocityUniforms[ 'testing' ] = { value: 1.0 };
velocityUniforms[ 'separationDistance' ] = { value: 1.0 };
velocityUniforms[ 'alignmentDistance' ] = { value: 1.0 };
velocityUniforms[ 'cohesionDistance' ] = { value: 1.0 };
velocityUniforms[ 'freedomFactor' ] = { value: 1.0 };
velocityUniforms[ 'predator' ] = { value: new THREE.Vector3() };
velocityVariable.material.defines.BOUNDS = BOUNDS.toFixed( 2 );

velocityVariable.wrapS = THREE.RepeatWrapping;
velocityVariable.wrapT = THREE.RepeatWrapping;
positionVariable.wrapS = THREE.RepeatWrapping;
positionVariable.wrapT = THREE.RepeatWrapping;

const effectController = 
{
    separation: 20.0,
    alignment: 20.0,
    cohesion: 20.0,
    freedom: 0.75,
    size: modelSizes[ selectModel ],
    count: Math.floor( BIRDS / 4 )
};

const valuesChanger = () =>
{
    velocityUniforms[ 'separationDistance' ].value = effectController.separation;
    velocityUniforms[ 'alignmentDistance' ].value = effectController.alignment;
    velocityUniforms[ 'cohesionDistance' ].value = effectController.cohesion;
    velocityUniforms[ 'freedomFactor' ].value = effectController.freedom;
    if( materialShader ) materialShader.uniforms[ 'size' ].value = effectController.size;
    BirdGeometry.setDrawRange( 0, indicesPerBird * effectController.count );
};

valuesChanger();

gui.add( effectController, 'separation', 0.0, 100.0, 1.0 ).onChange( valuesChanger );
gui.add( effectController, 'alignment', 0.0, 100, 0.001 ).onChange( valuesChanger );
gui.add( effectController, 'cohesion', 0.0, 100, 0.025 ).onChange( valuesChanger );
gui.add( effectController, 'size', 0, 1, 0.01 ).onChange( valuesChanger );
gui.add( effectController, 'count', 0, BIRDS, 1 ).onChange( valuesChanger );
gui.close();

// Init
gpgpu.computation.init();


// Debug
gpgpu.debug = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.MeshBasicMaterial({
        map: gpgpu.computation.getCurrentRenderTarget(velocityVariable).texture
    })
)
gpgpu.positionTextureDebug = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.MeshBasicMaterial({
        map: gpgpu.computation.getCurrentRenderTarget(positionVariable).texture
    })
)

gpgpu.debug.position.x = 3;
gpgpu.positionTextureDebug.position.x = -3;
// gpgpu.debug.visible = false;
scene.add(gpgpu.debug, gpgpu.positionTextureDebug);


/**
 * Pointer (predetor)
 */
window.addEventListener('pointermove', (event) => {
    const mouseX = (event.clientX / sizes.width) * 2 - 1;
    const mouseY = (event.clientY / sizes.height) * 2 - 1;
});

/**
 * Animate
 */
let last = performance.now();

const tick = () =>
{
    const now = performance.now();
    let delta = ( now - last ) / 1000;

    if ( delta > 1 ) delta = 1; // safety cap on large deltas
    last = now;
    
    // Update controls
    controls.update()

    // Update Uniforms
    positionUniforms[ 'time' ].value = now;
    positionUniforms[ 'delta' ].value = delta;
    velocityUniforms[ 'time' ].value = now;
    velocityUniforms[ 'delta' ].value = delta;
    if ( materialShader ) materialShader.uniforms[ 'time' ].value = now / 1000;
    if ( materialShader ) materialShader.uniforms[ 'delta' ].value = delta;

    velocityUniforms[ 'predator' ].value.set( 0.5 * mouseX / (sizes.width / 2), - 0.5 * mouseY / (sizes.height / 2), 0 );

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

// import * as THREE from 'three';

// import Stats from 'three/addons/libs/stats.module.js';
// import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// import fragmentShaderPosition from './shaders/fragmentShaderPosition.glsl';
// import fragmentShaderVelocity from './shaders/fragmentShaderVelocity.glsl';

// /* TEXTURE WIDTH FOR SIMULATION */
// const WIDTH = 64;
// const BIRDS = WIDTH * WIDTH;

// /* BAKE ANIMATION INTO TEXTURE and CREATE GEOMETRY FROM BASE MODEL */
// const BirdGeometry = new THREE.BufferGeometry();
// let textureAnimation, durationAnimation, birdMesh, materialShader, indicesPerBird;

// function nextPowerOf2( n ) {

//     return Math.pow( 2, Math.ceil( Math.log( n ) / Math.log( 2 ) ) );

// }

// Math.lerp = function ( value1, value2, amount ) {

//     amount = Math.max( Math.min( amount, 1 ), 0 );
//     return value1 + ( value2 - value1 ) * amount;

// };

// const gltfs = [ 'models/Flamingo.glb' ];
// const colors = [ 0xffdeff ];
// const sizes = [ 0.1 ];
// const selectModel = Math.floor( Math.random() * gltfs.length );
// new GLTFLoader().load( gltfs[ selectModel ], function ( gltf ) {

//     const animations = gltf.animations;
//     durationAnimation = Math.round( animations[ 0 ].duration * 60 );
//     const birdGeo = gltf.scene.children[ 0 ].geometry;
//     const morphAttributes = birdGeo.morphAttributes.position;
//     const tHeight = nextPowerOf2( durationAnimation );
//     const tWidth = nextPowerOf2( birdGeo.getAttribute( 'position' ).count );
//     indicesPerBird = birdGeo.index.count;
//     const tData = new Float32Array( 4 * tWidth * tHeight );

//     for ( let i = 0; i < tWidth; i ++ ) {

//         for ( let j = 0; j < tHeight; j ++ ) {

//             const offset = j * tWidth * 4;

//             const curMorph = Math.floor( j / durationAnimation * morphAttributes.length );
//             const nextMorph = ( Math.floor( j / durationAnimation * morphAttributes.length ) + 1 ) % morphAttributes.length;
//             const lerpAmount = j / durationAnimation * morphAttributes.length % 1;

//             if ( j < durationAnimation ) {

//                 let d0, d1;

//                 d0 = morphAttributes[ curMorph ].array[ i * 3 ];
//                 d1 = morphAttributes[ nextMorph ].array[ i * 3 ];

//                 if ( d0 !== undefined && d1 !== undefined ) tData[ offset + i * 4 ] = Math.lerp( d0, d1, lerpAmount );

//                 d0 = morphAttributes[ curMorph ].array[ i * 3 + 1 ];
//                 d1 = morphAttributes[ nextMorph ].array[ i * 3 + 1 ];

//                 if ( d0 !== undefined && d1 !== undefined ) tData[ offset + i * 4 + 1 ] = Math.lerp( d0, d1, lerpAmount );

//                 d0 = morphAttributes[ curMorph ].array[ i * 3 + 2 ];
//                 d1 = morphAttributes[ nextMorph ].array[ i * 3 + 2 ];

//                 if ( d0 !== undefined && d1 !== undefined ) tData[ offset + i * 4 + 2 ] = Math.lerp( d0, d1, lerpAmount );

//                 tData[ offset + i * 4 + 3 ] = 1;

//             }

//         }

//     }

//     textureAnimation = new THREE.DataTexture( tData, tWidth, tHeight, THREE.RGBAFormat, THREE.FloatType );
//     textureAnimation.needsUpdate = true;

//     const vertices = [], color = [], reference = [], seeds = [], indices = [];
//     const totalVertices = birdGeo.getAttribute( 'position' ).count * 3 * BIRDS;
//     for ( let i = 0; i < totalVertices; i ++ ) {

//         const bIndex = i % ( birdGeo.getAttribute( 'position' ).count * 3 );
//         vertices.push( birdGeo.getAttribute( 'position' ).array[ bIndex ] );
//         color.push( birdGeo.getAttribute( 'color' ).array[ bIndex ] );

//     }

//     let r = Math.random();
//     for ( let i = 0; i < birdGeo.getAttribute( 'position' ).count * BIRDS; i ++ ) {

//         const bIndex = i % ( birdGeo.getAttribute( 'position' ).count );
//         const bird = Math.floor( i / birdGeo.getAttribute( 'position' ).count );
//         if ( bIndex == 0 ) r = Math.random();
//         const j = ~ ~ bird;
//         const x = ( j % WIDTH ) / WIDTH;
//         const y = ~ ~ ( j / WIDTH ) / WIDTH;
//         reference.push( x, y, bIndex / tWidth, durationAnimation / tHeight );
//         seeds.push( bird, r, Math.random(), Math.random() );

//     }

//     for ( let i = 0; i < birdGeo.index.array.length * BIRDS; i ++ ) {

//         const offset = Math.floor( i / birdGeo.index.array.length ) * ( birdGeo.getAttribute( 'position' ).count );
//         indices.push( birdGeo.index.array[ i % birdGeo.index.array.length ] + offset );

//     }

//     BirdGeometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array( vertices ), 3 ) );
//     BirdGeometry.setAttribute( 'birdColor', new THREE.BufferAttribute( new Float32Array( color ), 3 ) );
//     BirdGeometry.setAttribute( 'color', new THREE.BufferAttribute( new Float32Array( color ), 3 ) );
//     BirdGeometry.setAttribute( 'reference', new THREE.BufferAttribute( new Float32Array( reference ), 4 ) );
//     BirdGeometry.setAttribute( 'seeds', new THREE.BufferAttribute( new Float32Array( seeds ), 4 ) );

//     BirdGeometry.setIndex( indices );

//     init();

// } );

// let container, stats;
// let camera, scene, renderer;
// let mouseX = 0, mouseY = 0;

// let windowHalfX = window.innerWidth / 2;
// let windowHalfY = window.innerHeight / 2;

// const BOUNDS = 800, BOUNDS_HALF = BOUNDS / 2;

// let last = performance.now();

// let gpuCompute;
// let velocityVariable;
// let positionVariable;
// let positionUniforms;
// let velocityUniforms;

// function init() {

//     container = document.querySelector('canvas.webgl');

//     camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 3000 );
//     camera.position.z = 350;

//     scene = new THREE.Scene();
//     scene.background = new THREE.Color( colors[ selectModel ] );
//     scene.fog = new THREE.Fog( colors[ selectModel ], 100, 1000 );

//     // LIGHTS

//     const hemiLight = new THREE.HemisphereLight( colors[ selectModel ], 0xffffff, 4.5 );
//     hemiLight.color.setHSL( 0.6, 1, 0.6, THREE.SRGBColorSpace );
//     hemiLight.groundColor.setHSL( 0.095, 1, 0.75, THREE.SRGBColorSpace );
//     hemiLight.position.set( 0, 50, 0 );
//     scene.add( hemiLight );

//     const dirLight = new THREE.DirectionalLight( 0x00CED1, 2.0 );
//     dirLight.color.setHSL( 0.1, 1, 0.95, THREE.SRGBColorSpace );
//     dirLight.position.set( - 1, 1.75, 1 );
//     dirLight.position.multiplyScalar( 30 );
//     scene.add( dirLight );

//     renderer = new THREE.WebGLRenderer( { canvas: container, antialias: true } );
//     renderer.setPixelRatio( window.devicePixelRatio );
//     renderer.setSize( window.innerWidth, window.innerHeight );
//     renderer.setAnimationLoop( animate );
//     container.appendChild( renderer.domElement );

//     initComputeRenderer();

//     stats = new Stats();
//     container.appendChild( stats.dom );

//     container.style.touchAction = 'none';
//     container.addEventListener( 'pointermove', onPointerMove );

//     window.addEventListener( 'resize', onWindowResize );

//     const gui = new GUI();

//     const effectController = {

//         separation: 20.0,
//         alignment: 20.0,
//         cohesion: 20.0,
//         freedom: 0.75,
//         size: sizes[ selectModel ],
//         count: Math.floor( BIRDS / 4 )

//     };

//     const valuesChanger = function () {

//         velocityUniforms[ 'separationDistance' ].value = effectController.separation;
//         velocityUniforms[ 'alignmentDistance' ].value = effectController.alignment;
//         velocityUniforms[ 'cohesionDistance' ].value = effectController.cohesion;
//         velocityUniforms[ 'freedomFactor' ].value = effectController.freedom;
//         if ( materialShader ) materialShader.uniforms[ 'size' ].value = effectController.size;
//         BirdGeometry.setDrawRange( 0, indicesPerBird * effectController.count );

//     };

//     valuesChanger();

//     gui.add( effectController, 'separation', 0.0, 100.0, 1.0 ).onChange( valuesChanger );
//     gui.add( effectController, 'alignment', 0.0, 100, 0.001 ).onChange( valuesChanger );
//     gui.add( effectController, 'cohesion', 0.0, 100, 0.025 ).onChange( valuesChanger );
//     gui.add( effectController, 'size', 0, 1, 0.01 ).onChange( valuesChanger );
//     gui.add( effectController, 'count', 0, BIRDS, 1 ).onChange( valuesChanger );
//     gui.close();

//     initBirds( effectController );

// }

// function initComputeRenderer() {

//     gpuCompute = new GPUComputationRenderer( WIDTH, WIDTH, renderer );

//     const dtPosition = gpuCompute.createTexture();
//     const dtVelocity = gpuCompute.createTexture();
//     fillPositionTexture( dtPosition );
//     fillVelocityTexture( dtVelocity );

//     velocityVariable = gpuCompute.addVariable( 'textureVelocity', fragmentShaderVelocity, dtVelocity );
//     positionVariable = gpuCompute.addVariable( 'texturePosition', fragmentShaderPosition, dtPosition );

//     gpuCompute.setVariableDependencies( velocityVariable, [ positionVariable, velocityVariable ] );
//     gpuCompute.setVariableDependencies( positionVariable, [ positionVariable, velocityVariable ] );

//     positionUniforms = positionVariable.material.uniforms;
//     velocityUniforms = velocityVariable.material.uniforms;

//     positionUniforms[ 'time' ] = { value: 0.0 };
//     positionUniforms[ 'delta' ] = { value: 0.0 };
//     velocityUniforms[ 'time' ] = { value: 1.0 };
//     velocityUniforms[ 'delta' ] = { value: 0.0 };
//     velocityUniforms[ 'testing' ] = { value: 1.0 };
//     velocityUniforms[ 'separationDistance' ] = { value: 1.0 };
//     velocityUniforms[ 'alignmentDistance' ] = { value: 1.0 };
//     velocityUniforms[ 'cohesionDistance' ] = { value: 1.0 };
//     velocityUniforms[ 'freedomFactor' ] = { value: 1.0 };
//     velocityUniforms[ 'predator' ] = { value: new THREE.Vector3() };
//     velocityVariable.material.defines.BOUNDS = BOUNDS.toFixed( 2 );

//     velocityVariable.wrapS = THREE.RepeatWrapping;
//     velocityVariable.wrapT = THREE.RepeatWrapping;
//     positionVariable.wrapS = THREE.RepeatWrapping;
//     positionVariable.wrapT = THREE.RepeatWrapping;

//     const error = gpuCompute.init();

//     if ( error !== null ) {

//         console.error( error );

//     }

// }

// function initBirds( effectController ) {

//     const geometry = BirdGeometry;

//     const m = new THREE.MeshStandardMaterial( {
//         vertexColors: true,
//         flatShading: true,
//         roughness: 1,
//         metalness: 0
//     } );

//     m.onBeforeCompile = ( shader ) => {

//         shader.uniforms.texturePosition = { value: null };
//         shader.uniforms.textureVelocity = { value: null };
//         shader.uniforms.textureAnimation = { value: textureAnimation };
//         shader.uniforms.time = { value: 1.0 };
//         shader.uniforms.size = { value: effectController.size };
//         shader.uniforms.delta = { value: 0.0 };

//         let token = '#define STANDARD';

//         let insert = /* glsl */`
//             attribute vec4 reference;
//             attribute vec4 seeds;
//             attribute vec3 birdColor;
//             uniform sampler2D texturePosition;
//             uniform sampler2D textureVelocity;
//             uniform sampler2D textureAnimation;
//             uniform float size;
//             uniform float time;
//         `;

//         shader.vertexShader = shader.vertexShader.replace( token, token + insert );

//         token = '#include <begin_vertex>';

//         insert = /* glsl */`
//             vec4 tmpPos = texture2D( texturePosition, reference.xy );

//             vec3 pos = tmpPos.xyz;
//             vec3 velocity = normalize(texture2D( textureVelocity, reference.xy ).xyz);
//             vec3 aniPos = texture2D( textureAnimation, vec2( reference.z, mod( time + ( seeds.x ) * ( ( 0.0004 + seeds.y / 10000.0) + normalize( velocity ) / 20000.0 ), reference.w ) ) ).xyz;
//             vec3 newPosition = position;

//             newPosition = mat3( modelMatrix ) * ( newPosition + aniPos );
//             newPosition *= size + seeds.y * size * 0.2;

//             velocity.z *= -1.;
//             float xz = length( velocity.xz );
//             float xyz = 1.;
//             float x = sqrt( 1. - velocity.y * velocity.y );

//             float cosry = velocity.x / xz;
//             float sinry = velocity.z / xz;

//             float cosrz = x / xyz;
//             float sinrz = velocity.y / xyz;

//             mat3 maty =  mat3( cosry, 0, -sinry, 0    , 1, 0     , sinry, 0, cosry );
//             mat3 matz =  mat3( cosrz , sinrz, 0, -sinrz, cosrz, 0, 0     , 0    , 1 );

//             newPosition =  maty * matz * newPosition;
//             newPosition += pos;

//             vec3 transformed = vec3( newPosition );
//         `;

//         shader.vertexShader = shader.vertexShader.replace( token, insert );

//         materialShader = shader;

//     };

//     birdMesh = new THREE.Mesh( geometry, m);
//     birdMesh.rotation.y = Math.PI / 2;

//     birdMesh.castShadow = true;
//     birdMesh.receiveShadow = true;

//     scene.add( birdMesh );

// }

// function fillPositionTexture( texture ) {

//     const theArray = texture.image.data;

//     for ( let k = 0, kl = theArray.length; k < kl; k += 4 ) {

//         const x = Math.random() * BOUNDS - BOUNDS_HALF;
//         const y = Math.random() * BOUNDS - BOUNDS_HALF;
//         const z = Math.random() * BOUNDS - BOUNDS_HALF;

//         theArray[ k + 0 ] = x;
//         theArray[ k + 1 ] = y;
//         theArray[ k + 2 ] = z;
//         theArray[ k + 3 ] = 1;

//     }

// }

// function fillVelocityTexture( texture ) {

//     const theArray = texture.image.data;

//     for ( let k = 0, kl = theArray.length; k < kl; k += 4 ) {

//         const x = Math.random() - 0.5;
//         const y = Math.random() - 0.5;
//         const z = Math.random() - 0.5;

//         theArray[ k + 0 ] = x * 10;
//         theArray[ k + 1 ] = y * 10;
//         theArray[ k + 2 ] = z * 10;
//         theArray[ k + 3 ] = 1;

//     }

// }

// function onWindowResize() {

//     windowHalfX = window.innerWidth / 2;
//     windowHalfY = window.innerHeight / 2;

//     camera.aspect = window.innerWidth / window.innerHeight;
//     camera.updateProjectionMatrix();

//     renderer.setSize( window.innerWidth, window.innerHeight );

// }

// function onPointerMove( event ) {

//     if ( event.isPrimary === false ) return;

//     mouseX = event.clientX - windowHalfX;
//     mouseY = event.clientY - windowHalfY;

// }

// //

// function animate() {

//     render();
//     stats.update();

// }

// function render() {

//     const now = performance.now();
//     let delta = ( now - last ) / 1000;

//     if ( delta > 1 ) delta = 1; // safety cap on large deltas
//     last = now;

//     positionUniforms[ 'time' ].value = now;
//     positionUniforms[ 'delta' ].value = delta;
//     velocityUniforms[ 'time' ].value = now;
//     velocityUniforms[ 'delta' ].value = delta;
//     if ( materialShader ) materialShader.uniforms[ 'time' ].value = now / 1000;
//     if ( materialShader ) materialShader.uniforms[ 'delta' ].value = delta;

//     velocityUniforms[ 'predator' ].value.set( 0.5 * mouseX / windowHalfX, - 0.5 * mouseY / windowHalfY, 0 );

//     mouseX = 10000;
//     mouseY = 10000;

//     gpuCompute.compute();

//     if ( materialShader ) materialShader.uniforms[ 'texturePosition' ].value = gpuCompute.getCurrentRenderTarget( positionVariable ).texture;
//     if ( materialShader ) materialShader.uniforms[ 'textureVelocity' ].value = gpuCompute.getCurrentRenderTarget( velocityVariable ).texture;

//     renderer.render( scene, camera );

// }