// Draw a stone texture using Voronoi diagram.
precision lowp float;

#include "levelfrag.glsl"
#include "lighting.glsl"
#include "voronoi.glsl"

void main() {
    vec4 vor = voronoi(TexPos.xy * 2.0);
    gl_FragColor =
        vec4(light(vor.xyz) * min(1.0, vor.w) * min(1.0, TexPos.z * 10.0), 1.0);
}
