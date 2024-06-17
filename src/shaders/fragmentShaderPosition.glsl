uniform float uTime;
uniform float uDelta;

void main()	{

    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 tmpPos = texture2D( texturePosition, uv );
    vec3 position = tmpPos.xyz;
    vec3 velocity = texture2D( textureVelocity, uv ).xyz;

    float phase = tmpPos.w;

    phase = mod( ( phase + uDelta +
        length( velocity.xz ) * uDelta * 3. +
        max( velocity.y, 0.0 ) * uDelta * 6. ), 62.83 );

    gl_FragColor = vec4( position + velocity * uDelta * 15. , phase );

}