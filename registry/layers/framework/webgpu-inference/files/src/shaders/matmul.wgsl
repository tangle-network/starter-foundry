// Tiled matmul: C = A @ B where A is MxK, B is KxN, C is MxN.
// Dimensions are injected via the Dims uniform so one pipeline handles
// any shape. Workgroup 8x8 gives good occupancy on most consumer GPUs;
// tune to 16x16 for large matrices on desktop, 4x4 for mobile.

struct Dims {
  M: u32,
  N: u32,
  K: u32,
  _pad: u32,
}

@group(0) @binding(0) var<uniform> dims: Dims;
@group(0) @binding(1) var<storage, read> a: array<f32>;
@group(0) @binding(2) var<storage, read> b: array<f32>;
@group(0) @binding(3) var<storage, read_write> c: array<f32>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let row = gid.x;
  let col = gid.y;
  if (row >= dims.M || col >= dims.N) {
    return;
  }
  var acc: f32 = 0.0;
  for (var k: u32 = 0u; k < dims.K; k = k + 1u) {
    acc = acc + a[row * dims.K + k] * b[k * dims.N + col];
  }
  c[row * dims.N + col] = acc;
}
