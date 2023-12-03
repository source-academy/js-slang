// Main function calling WebGPU APIs
import initDevice from './initDevice'

export async function play_gpu(time: number, fs: number, kernelCode: string) {
  const device = await initDevice()
  const numCore = device.limits.maxComputeWorkgroupSizeX
  const k = Math.ceil((time * fs * 1.0) / numCore)
  const inp = [k, fs]
  const start = performance.now()
  const input = new Int32Array(inp)

  const gpuBufferInput = device.createBuffer({
    mappedAtCreation: true,
    size: input.byteLength,
    usage: GPUBufferUsage.STORAGE
  })
  const arrayBufferInput = gpuBufferInput.getMappedRange()

  new Int32Array(arrayBufferInput).set(input)
  gpuBufferInput.unmap()

  const resultBufferSize = Float32Array.BYTES_PER_ELEMENT * (k * numCore + 1)
  const resultBuffer = device.createBuffer({
    size: resultBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  })

  device.pushErrorScope('out-of-memory')
  device.pushErrorScope('validation')

  // Pipeline setup
  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({
        code:
          `struct Input {
          k: u32,
          fs: u32,
        }

        fn _random(x: u32) -> f32 {
          var state = x;
          state ^= state << 13;
          state ^= state >> 17;
          state ^= state << 5;
          state = state * 0x9E3779B1;
          let result: f32 = f32(state) / 4294967295.0;
          return result;
        }
        
        @group(0) @binding(0) var<storage, read> input : Input;
        @group(0) @binding(1) var<storage, read_write> result : array<f32>;
        
        @compute @workgroup_size(` +
          numCore.toString() +
          `)
        fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
          for (var i = 0u; i < input.k; i = i + 1u) {
            let index = i + global_id.x * input.k;
            let x = f32(index) / f32(input.fs);
            if (index < input.k * ` +
          numCore.toString() +
          `) {
              let temp: f32 = f32(` +
          kernelCode +
          `);
              result[index] = select(select(temp, -1.0, temp < -1.0), 1.0, temp > 1.0);
            }
          }}`
      }),
      entryPoint: 'main'
    }
  })

  // Bind group
  const bindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0 /* index */),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: gpuBufferInput
        }
      },
      {
        binding: 1,
        resource: {
          buffer: resultBuffer
        }
      }
    ]
  })

  // Commands submission
  const commandEncoder = device.createCommandEncoder()

  const passEncoder = commandEncoder.beginComputePass()
  passEncoder.setPipeline(computePipeline)
  passEncoder.setBindGroup(0, bindGroup)
  const workgroupCountX = k
  passEncoder.dispatchWorkgroups(workgroupCountX)
  passEncoder.end()

  // Get a GPU buffer for reading in an unmapped state.
  const gpuReadBuffer = device.createBuffer({
    size: resultBufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  })

  // Encode commands for copying buffer to buffer.
  commandEncoder.copyBufferToBuffer(
    resultBuffer /* source buffer */,
    0 /* source offset */,
    gpuReadBuffer /* destination buffer */,
    0 /* destination offset */,
    resultBufferSize /* size */
  )

  // Submit GPU commands.
  const gpuCommands = commandEncoder.finish()
  device.queue.submit([gpuCommands])

  const validationError = await device.popErrorScope()
  if (validationError) {
    throw new Error(`WebGPU Validation Error: ${validationError.message}`)
  }

  const outOfMemoryError = await device.popErrorScope()
  if (outOfMemoryError) {
    throw new Error(`WebGPU Out of Memory Error: ${outOfMemoryError.message}`)
  }

  // Read buffer.
  await gpuReadBuffer.mapAsync(GPUMapMode.READ)
  const arrayBuffer = gpuReadBuffer.getMappedRange()
  const end = performance.now()
  const output = Array.from(new Float32Array(arrayBuffer))

  return [end - start, numCore, output]
}
