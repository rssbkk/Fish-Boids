uniform float uTime;
uniform float uDelta; // about 0.016
uniform float uSeparationDistance; // 20
uniform float uAlignmentDistance; // 40
uniform float uCohesionDistance; //
uniform float uFreedomFactor;
uniform vec3 uPredatorPosition;
uniform float uSpeed;
// uniform float uZone;
uniform float uCentripetal;
// uniform vec3 uAvoidancePosition;
// uniform float uAvoidanceRadius;
// uniform float uAvoidanceStrength;
uniform float uFleeRadius;
uniform float uFleeSpeed;
uniform float uZFlee;

const float width = resolution.x;
const float height = resolution.y;

const float PI = 3.141592653589793;
const float PI_2 = PI * 2.0;
// const float VISION = PI * 0.55;

float zoneRadius = 40.0;
float zoneRadiusSquared = 1600.0;

float separationThresh = 0.45;
float alignmentThresh = 0.65;

const float UPPER_BOUNDS = BOUNDS;
const float LOWER_BOUNDS = -UPPER_BOUNDS;

const float SPEED_LIMIT = 9.0;

float rand( vec2 co ){
    return fract( sin( dot( co.xy, vec2(12.9898,78.233) ) ) * 43758.5453 );
}

void main() {

    zoneRadius = uSeparationDistance + uAlignmentDistance + uCohesionDistance;
    separationThresh = uSeparationDistance / zoneRadius;
    alignmentThresh = ( uSeparationDistance + uAlignmentDistance ) / zoneRadius;
    zoneRadiusSquared = zoneRadius * zoneRadius;


    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 birdPosition, birdVelocity;

    vec3 selfPosition = texture2D( texturePosition, uv ).xyz;
    vec3 selfVelocity = texture2D( textureVelocity, uv ).xyz;

    float dist;
    vec3 dir; // direction
    float distSquared;

    float separationSquared = uSeparationDistance * uSeparationDistance;
    float cohesionSquared = uCohesionDistance * uCohesionDistance;

    float f;
    float percent;

    vec3 velocity = selfVelocity;

    float limit = uSpeed;

    dir = uPredatorPosition * UPPER_BOUNDS - selfPosition;
    dir.z = uZFlee;
    // dir.z *= 0.6;
    dist = length( dir );
    distSquared = dist * dist;

    float preyRadius = uFleeRadius;
    float preyRadiusSq = preyRadius * preyRadius;


    // move birds away from uPredatorPosition
    if ( dist < preyRadius ) {

        f = ( distSquared / preyRadiusSq - 1.0 ) * uDelta * 100.;
        velocity += normalize( dir ) * f;
        limit += uFleeSpeed;
    }


    // if (testing == 0.0) {}
    // if ( rand( uv + uTime ) < uFreedomFactor ) {}


    // Attract flocks to the center
    vec3 central = vec3( 0., 0., 0. );
    dir = selfPosition - central;
    dist = length( dir );

    dir.y *= 2.5;
    velocity -= normalize( dir ) * uDelta * uCentripetal;

    for ( float y = 0.0; y < height; y++ ) {
        for ( float x = 0.0; x < width; x++ ) {

            vec2 ref = vec2( x + 0.5, y + 0.5 ) / resolution.xy;
            birdPosition = texture2D( texturePosition, ref ).xyz;

            dir = birdPosition - selfPosition;
            dist = length( dir );

            if ( dist < 0.0001 ) continue;

            distSquared = dist * dist;

            if ( distSquared > zoneRadiusSquared ) continue;

            percent = distSquared / zoneRadiusSquared;

            if ( percent < separationThresh ) { // low

                // Separation - Move apart for comfort
                f = ( separationThresh / percent - 1.0 ) * uDelta;
                velocity -= normalize( dir ) * f;

            } else if ( percent < alignmentThresh ) { // high

                // Alignment - fly the same direction
                float threshDelta = alignmentThresh - separationThresh;
                float adjustedPercent = ( percent - separationThresh ) / threshDelta;

                birdVelocity = texture2D( textureVelocity, ref ).xyz;

                f = ( 0.5 - cos( adjustedPercent * PI_2 ) * 0.5 + 0.5 ) * uDelta;
                velocity += normalize( birdVelocity ) * f;

            } else {

                // Attraction / Cohesion - move closer
                float threshDelta = 1.0 - alignmentThresh;
                float adjustedPercent;
                if( threshDelta == 0. ) adjustedPercent = 1.;
                else adjustedPercent = ( percent - alignmentThresh ) / threshDelta;

                f = ( 0.5 - ( cos( adjustedPercent * PI_2 ) * -0.5 + 0.5 ) ) * uDelta;

                velocity += normalize( dir ) * f;

            }
        }
    }

    // this make tends to fly around than down or up
    // if (velocity.y > 0.) velocity.y *= (1. - 0.2 * uDelta);

    // Speed Limits
    if ( length( velocity ) > limit ) {
        velocity = normalize( velocity ) * limit;
    }

    gl_FragColor = vec4( velocity, 1.0 );

}