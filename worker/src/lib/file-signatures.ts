const RIFF = [0x52, 0x49, 0x46, 0x46] // "RIFF"
const WEBP = [0x57, 0x45, 0x42, 0x50] // "WEBP"
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function startsWithBytes(bytes: Uint8Array, expected: number[], offset = 0) {
  if (bytes.length < offset + expected.length) return false
  for (let index = 0; index < expected.length; index += 1) {
    if (bytes[offset + index] !== expected[index]) {
      return false
    }
  }
  return true
}

function isWebp(bytes: Uint8Array) {
  return startsWithBytes(bytes, RIFF, 0) && startsWithBytes(bytes, WEBP, 8)
}

function isPng(bytes: Uint8Array) {
  return startsWithBytes(bytes, PNG, 0)
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

function isMp4(bytes: Uint8Array) {
  // ISO Base Media File: size (4 bytes) + "ftyp" (4 bytes)
  return bytes.length >= 12 && startsWithBytes(bytes, [0x66, 0x74, 0x79, 0x70], 4)
}

function isSvg(bytes: Uint8Array) {
  const sample = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false })
    .decode(bytes.slice(0, 2048))
    .trimStart()
  if (!sample) return false
  if (sample.startsWith('<svg')) return true
  if (sample.startsWith('<?xml')) return sample.includes('<svg')
  return false
}

export function matchesContentType(buffer: ArrayBuffer, expectedMime: string) {
  const bytes = new Uint8Array(buffer)

  switch (expectedMime) {
    case 'image/webp':
      return isWebp(bytes)
    case 'image/png':
      return isPng(bytes)
    case 'image/jpeg':
      return isJpeg(bytes)
    case 'image/svg+xml':
      return isSvg(bytes)
    case 'video/mp4':
      return isMp4(bytes)
    default:
      return false
  }
}

export function matchesAnyContentType(buffer: ArrayBuffer, allowedMimes: readonly string[]) {
  return allowedMimes.some((mime) => matchesContentType(buffer, mime))
}
