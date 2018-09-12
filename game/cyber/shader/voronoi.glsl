// Voronoi... requires:
//
// uniform sampler2D Texture;

vec4 voronoi(in vec2 v) {
    vec2 tile = floor(v), center;
    v -= tile;
    vec3 d1 = vec3(1.0), d2 = d1, n;
    float dist;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            center = vec2(x, y);
            center += texture2D(Texture, (tile + center) / 128.0).xy - v;
            float dist = dot(center, center);
            if (dist < d1.z) {
                d2 = d1;
                d1 = vec3(center, dist);
            } else if (dist < d2.z) {
                d2 = vec3(center, dist);
            }
        }
    }
    dist = sqrt(d2.z - d1.z);
    if (dist < 0.5) {
        n = normalize(vec3(normalize(d2.xy - d1.xy), 6.0));
    } else {
        n = vec3(0.0, 0.0, 1.0);
    }
    return vec4(n, dist);
}
