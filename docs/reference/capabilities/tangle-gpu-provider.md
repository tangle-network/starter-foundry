# Capability: `capability:tangle-gpu-provider`

GPU blueprint capability — operators declare GPU resource requirements (CUDA compute capability, VRAM, count). Jobs run on GPU-enabled operators; non-GPU operators skip the job. Apply to tangle-blueprint for ML-inference, 3D rendering, video encoding, and scientific-compute blueprints.

**Applies to**: tangle-blueprint

## When to use

Attach when the job requires GPU acceleration — inference serving, video encoding, rendering, physics simulation, scientific workloads.

## First moves

- Declare required compute capability + VRAM in gpu-config.json
- Operators advertise GPU capacity via their operator registration
- Your job's execution matches on capacity at dispatch time
