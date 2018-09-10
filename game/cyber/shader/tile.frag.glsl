precision lowp float;

varying vec2 TexPos;

uniform sampler2D Texture;

float voronoi(in vec2 v) {
    vec2 tile = floor(v), center;
    v -= tile;
    vec3 d = vec3(1.0);
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            center = vec2(x, y);
            center += texture2D(Texture, (tile + center) / 128.0).xy - v;
            d.z = dot(center, center);
            d.y = max(d.x, min(d.y, d.z));
            d.x = min(d.x, d.z);
        }
    }
    return d.y - d.x;
}

void main() {
    gl_FragColor = vec4(voronoi(TexPos));
}
