// Vertex + fragment stages in one module. The vertex stage emits three
// hard-coded clip-space positions from @builtin(vertex_index), so we draw
// a full-colour triangle with zero vertex buffers — the canonical "hello
// WebGPU" shape. Replace with a vertex buffer binding once you add real
// geometry.

struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec3<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VSOut {
  // Equilateral triangle filling ~2/3 of the viewport.
  var positions = array<vec2<f32>, 3>(
    vec2<f32>( 0.0,  0.65),
    vec2<f32>(-0.65, -0.5),
    vec2<f32>( 0.65, -0.5),
  );
  var colors = array<vec3<f32>, 3>(
    vec3<f32>(1.0, 0.25, 0.4),
    vec3<f32>(0.25, 0.75, 1.0),
    vec3<f32>(0.45, 1.0, 0.45),
  );

  var out: VSOut;
  out.position = vec4<f32>(positions[vi], 0.0, 1.0);
  out.color = colors[vi];
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  // Interpolated vertex colours give a free gradient — a real scene
  // would sample textures or compute lighting here.
  return vec4<f32>(in.color, 1.0);
}
