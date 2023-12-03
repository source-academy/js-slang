// Initialization for utilizing WebGPU
const initDevice = async () => {
  const _navigator = navigator as any
  if (!_navigator.gpu) {
    const err =
      'WebGPU is not supported. ' +
      'See https://developer.chrome.com/docs/web-platform/webgpu/ for more details.'
    console.error(err)
    throw err
  }

  const adapter = await _navigator.gpu.requestAdapter()
  if (!adapter) {
    const err = 'Failed to get GPU adapter.'
    console.error(err)
    throw err
  }

  const device = await adapter.requestDevice()
  if (!device) {
    const err = 'Failed to get GPU device.'
    console.error(err)
    throw err
  }
  return device
}

export default initDevice
