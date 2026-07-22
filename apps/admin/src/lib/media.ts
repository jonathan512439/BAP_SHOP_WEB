import { PRODUCT_IMAGE_VARIANT_LIMITS_BYTES } from '@bap-shop/shared'

type ImageOptimizationOptions = {
  maxWidth: number
  maxHeight: number
  quality: number
  minQuality?: number
  maxBytes?: number
  outputType: 'image/webp' | 'image/jpeg'
}

type VideoProgressCallback = (progress: number) => void
export type ProductImageVariantName = 'thumb' | 'card' | 'detail' | 'full'

export type ProductImageVariants = Record<ProductImageVariantName, File>

const MAX_BRANDING_VIDEO_BYTES = 8 * 1024 * 1024
const RECOMMENDED_BRANDING_VIDEO_BYTES = 5 * 1024 * 1024
const PRODUCT_IMAGE_FALLBACK_TYPE = 'image/jpeg'

let ffmpegToolkitPromise: Promise<{
  ffmpeg: import('@ffmpeg/ffmpeg').FFmpeg
  fetchFile: typeof import('@ffmpeg/util').fetchFile
}> | null = null
let productImageOutputTypePromise: Promise<'image/webp' | 'image/jpeg'> | null = null

function getBaseFilename(filename: string) {
  return filename.replace(/\.[^.]+$/, '')
}

function renameWithExtension(filename: string, extension: string) {
  return getBaseFilename(filename) + extension
}

function renameWithSuffix(filename: string, suffix: string, extension: string) {
  return `${getBaseFilename(filename)}-${suffix}${extension}`
}

function extensionForMime(type: 'image/webp' | 'image/jpeg') {
  return type === 'image/webp' ? '.webp' : '.jpg'
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
  const outputExtension = extensionForMime(options.outputType)

  return new File([blob], renameWithExtension(file.name, outputExtension), {
    type: blob.type || options.outputType,
    lastModified: Date.now(),
  })
}

async function encodeRasterImageFromElement(
  image: HTMLImageElement,
  sourceName: string,
  suffix: string,
  options: ImageOptimizationOptions
) {
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
  const outputExtension = extensionForMime(options.outputType)

  return new File([blob], renameWithSuffix(sourceName, suffix, outputExtension), {
    type: blob.type || options.outputType,
    lastModified: Date.now(),
  })
}

async function canEncodeCanvasType(type: 'image/webp' | 'image/jpeg') {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d')
  context?.fillRect(0, 0, 1, 1)

  try {
    const blob = await canvasToBlob(canvas, type, 0.8)
    if (blob.type !== type) return false

    if (type !== 'image/webp') return true

    const bytes = new Uint8Array(await blob.arrayBuffer())
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    )
  } catch {
    return false
  }
}

async function getProductImageOutputType(): Promise<'image/webp' | 'image/jpeg'> {
  if (!productImageOutputTypePromise) {
    productImageOutputTypePromise = canEncodeCanvasType('image/webp').then((supportsWebp) =>
      supportsWebp ? 'image/webp' : PRODUCT_IMAGE_FALLBACK_TYPE
    )
  }

  return productImageOutputTypePromise
}

async function optimizeRasterImageFromElement(
  image: HTMLImageElement,
  sourceName: string,
  suffix: string,
  options: ImageOptimizationOptions
) {
  const maxBytes = options.maxBytes
  if (!maxBytes) {
    return encodeRasterImageFromElement(image, sourceName, suffix, options)
  }

  const minQuality = options.minQuality ?? Math.max(0.68, options.quality - 0.12)
  let bestFile: File | null = null
  let maxWidth = options.maxWidth
  let maxHeight = options.maxHeight

  for (let scaleAttempt = 0; scaleAttempt < 3; scaleAttempt += 1) {
    for (let quality = options.quality; quality >= minQuality; quality -= 0.04) {
      const candidate = await encodeRasterImageFromElement(image, sourceName, suffix, {
        ...options,
        maxWidth,
        maxHeight,
        quality: Number(quality.toFixed(2)),
      })

      if (!bestFile || candidate.size < bestFile.size) {
        bestFile = candidate
      }

      if (candidate.size <= maxBytes) {
        return candidate
      }
    }

    maxWidth = Math.max(1, Math.round(maxWidth * 0.92))
    maxHeight = Math.max(1, Math.round(maxHeight * 0.92))
  }

  return bestFile ?? encodeRasterImageFromElement(image, sourceName, suffix, options)
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

export async function optimizeProductImageVariants(file: File): Promise<ProductImageVariants> {
  const image = await loadImage(file)
  const outputType = await getProductImageOutputType()

  const [thumb, card, detail, full] = await Promise.all([
    optimizeRasterImageFromElement(image, file.name, 'thumb', {
      maxWidth: 320,
      maxHeight: 320,
      quality: 0.8,
      minQuality: 0.72,
      maxBytes: PRODUCT_IMAGE_VARIANT_LIMITS_BYTES.thumb,
      outputType,
    }),
    optimizeRasterImageFromElement(image, file.name, 'card', {
      maxWidth: 640,
      maxHeight: 640,
      quality: 0.82,
      minQuality: 0.74,
      maxBytes: PRODUCT_IMAGE_VARIANT_LIMITS_BYTES.card,
      outputType,
    }),
    optimizeRasterImageFromElement(image, file.name, 'detail', {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.84,
      minQuality: 0.76,
      maxBytes: PRODUCT_IMAGE_VARIANT_LIMITS_BYTES.detail,
      outputType,
    }),
    optimizeRasterImageFromElement(image, file.name, 'full', {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.88,
      minQuality: 0.8,
      maxBytes: PRODUCT_IMAGE_VARIANT_LIMITS_BYTES.full,
      outputType,
    }),
  ])

  return { thumb, card, detail, full }
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

export function describeImageVariantOptimization(file: File, variants: ProductImageVariants) {
  const totalOptimized = Object.values(variants).reduce((total, variant) => total + variant.size, 0)
  return `Imagen reescalada para web: ${formatBytes(file.size)} -> ${formatBytes(totalOptimized)} en 4 versiones.`
}

export function describeVideoOptimization(file: File, optimizedFile: File) {
  return `Video optimizado a MP4 sin audio: ${formatBytes(file.size)} -> ${formatBytes(optimizedFile.size)}.`
}
