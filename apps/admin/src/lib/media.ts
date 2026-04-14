type ImageOptimizationOptions = {
  maxWidth: number
  maxHeight: number
  quality: number
  outputType: 'image/webp' | 'image/jpeg'
}

type VideoProgressCallback = (progress: number) => void

const MAX_BRANDING_VIDEO_BYTES = 8 * 1024 * 1024
const RECOMMENDED_BRANDING_VIDEO_BYTES = 5 * 1024 * 1024

let ffmpegToolkitPromise: Promise<{
  ffmpeg: import('@ffmpeg/ffmpeg').FFmpeg
  fetchFile: typeof import('@ffmpeg/util').fetchFile
}> | null = null

function renameWithExtension(filename: string, extension: string) {
  return filename.replace(/\.[^.]+$/, '') + extension
}

function getTargetSize(width: number, height: number, maxWidth: number, maxHeight: number) {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/webp' | 'image/jpeg', quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo generar la version optimizada del archivo.'))
          return
        }

        resolve(blob)
      },
      type,
      quality
    )
  })
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('No se pudo leer la imagen seleccionada.'))
    }

    image.src = objectUrl
  })
}

async function optimizeRasterImage(file: File, options: ImageOptimizationOptions) {
  const image = await loadImage(file)
  const { width, height } = getTargetSize(image.naturalWidth, image.naturalHeight, options.maxWidth, options.maxHeight)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', { alpha: true })
  if (!context) {
    throw new Error('No se pudo preparar el optimizador de imagenes en este navegador.')
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)

  const blob = await canvasToBlob(canvas, options.outputType, options.quality)

  return new File([blob], renameWithExtension(file.name, '.webp'), {
    type: options.outputType,
    lastModified: Date.now(),
  })
}

async function getFfmpegToolkit() {
  if (!ffmpegToolkitPromise) {
    ffmpegToolkitPromise = Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')])
      .then(async ([ffmpegLib, utilLib]) => {
        const ffmpeg = new ffmpegLib.FFmpeg()
        await ffmpeg.load()
        return { ffmpeg, fetchFile: utilLib.fetchFile }
      })
      .catch((error) => {
        ffmpegToolkitPromise = null
        throw error
      })
  }

  return ffmpegToolkitPromise
}

async function encodeBannerVideo(
  ffmpeg: import('@ffmpeg/ffmpeg').FFmpeg,
  inputName: string,
  outputName: string,
  args: string[],
  onProgress?: VideoProgressCallback
) {
  const progressHandler = onProgress
    ? ({ progress }: { progress: number }) => onProgress(Math.max(0, Math.min(1, progress)))
    : null

  if (progressHandler) {
    ffmpeg.on('progress', progressHandler)
  }

  try {
    const exitCode = await ffmpeg.exec(args, 180000)
    if (exitCode !== 0) {
      throw new Error('No se pudo optimizar el video seleccionado.')
    }

    const output = await ffmpeg.readFile(outputName)
    if (!(output instanceof Uint8Array)) {
      throw new Error('No se pudo leer el video optimizado.')
    }

    return output
  } finally {
    if (progressHandler) {
      ffmpeg.off('progress', progressHandler)
    }

    await Promise.allSettled([
      ffmpeg.deleteFile(inputName),
      ffmpeg.deleteFile(outputName),
    ])
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export async function optimizeProductImage(file: File) {
  return optimizeRasterImage(file, {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.84,
    outputType: 'image/webp',
  })
}

export async function optimizeBrandingImage(file: File, variant: 'logo' | 'banner') {
  if (file.type === 'image/svg+xml' && variant === 'logo') {
    return file
  }

  return optimizeRasterImage(file, {
    maxWidth: variant === 'logo' ? 1400 : 1800,
    maxHeight: variant === 'logo' ? 1400 : 900,
    quality: variant === 'logo' ? 0.9 : 0.82,
    outputType: 'image/webp',
  })
}

export async function optimizeBrandingVideo(file: File, onProgress?: VideoProgressCallback) {
  if (file.type !== 'video/mp4') {
    throw new Error('El video debe estar en formato MP4.')
  }

  const { ffmpeg, fetchFile } = await getFfmpegToolkit()
  const inputName = `input-${Date.now()}.mp4`
  const outputName = `output-${Date.now()}.mp4`
  const sourceBytes = await fetchFile(file)
  const originalBytes = sourceBytes.slice()

  await ffmpeg.writeFile(inputName, originalBytes.slice())

  const primaryArgs = [
    '-i',
    inputName,
    '-an',
    '-vf',
    'scale=1600:-2:force_original_aspect_ratio=decrease,fps=30',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '28',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outputName,
  ]

  let encoded = await encodeBannerVideo(ffmpeg, inputName, outputName, primaryArgs, onProgress)

  if (encoded.byteLength > RECOMMENDED_BRANDING_VIDEO_BYTES) {
    await ffmpeg.writeFile(inputName, originalBytes.slice())

    const fallbackArgs = [
      '-i',
      inputName,
      '-an',
      '-vf',
      'scale=1280:-2:force_original_aspect_ratio=decrease,fps=24',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '32',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputName,
    ]

    encoded = await encodeBannerVideo(ffmpeg, inputName, outputName, fallbackArgs, onProgress)
  }

  if (encoded.byteLength > MAX_BRANDING_VIDEO_BYTES) {
    throw new Error('El video sigue siendo demasiado pesado incluso despues de optimizarlo. Reduce duracion o resolucion.')
  }

  const normalizedBytes = new Uint8Array(encoded.byteLength)
  normalizedBytes.set(encoded)

  return new File([normalizedBytes], renameWithExtension(file.name, '.mp4'), {
    type: 'video/mp4',
    lastModified: Date.now(),
  })
}

export function describeImageOptimization(file: File, optimizedFile: File) {
  if (file === optimizedFile) {
    return `Archivo listo para subir: ${formatBytes(file.size)}.`
  }

  return `Imagen optimizada a WebP: ${formatBytes(file.size)} -> ${formatBytes(optimizedFile.size)}.`
}

export function describeVideoOptimization(file: File, optimizedFile: File) {
  return `Video optimizado a MP4 sin audio: ${formatBytes(file.size)} -> ${formatBytes(optimizedFile.size)}.`
}
