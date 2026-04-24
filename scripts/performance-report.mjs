import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { gzipSync } from 'node:zlib'

const strict = process.argv.includes('--strict')

const KiB = 1024

const apps = [
  {
    name: 'store',
    dist: join(process.cwd(), 'apps', 'store', 'dist'),
    budgets: {
      totalJs: 220 * KiB,
      totalCss: 80 * KiB,
      maxAsset: 180 * KiB,
      totalDist: 650 * KiB,
    },
  },
  {
    name: 'admin',
    dist: join(process.cwd(), 'apps', 'admin', 'dist'),
    budgets: {
      totalJs: 350 * KiB,
      totalCss: 120 * KiB,
      maxAsset: 220 * KiB,
      totalDist: 900 * KiB,
    },
  },
]

function listFiles(dir) {
  const result = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      result.push(...listFiles(fullPath))
      continue
    }

    result.push(fullPath)
  }

  return result
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`
  return `${(bytes / 1024).toFixed(1)} KiB`
}

function extensionOf(file) {
  const match = file.match(/\.([a-z0-9]+)$/i)
  return match?.[1]?.toLowerCase() ?? 'unknown'
}

function summarizeApp(app) {
  if (!existsSync(app.dist)) {
    throw new Error(`No existe ${relative(process.cwd(), app.dist)}. Ejecuta el build antes del reporte.`)
  }

  const files = listFiles(app.dist).map((file) => {
    const raw = statSync(file).size
    const gzip = gzipSync(readFileSync(file)).length

    return {
      file,
      rel: relative(app.dist, file).replaceAll('\\', '/'),
      ext: extensionOf(file),
      raw,
      gzip,
    }
  })

  const totals = files.reduce(
    (acc, file) => {
      acc.raw += file.raw
      acc.gzip += file.gzip

      if (file.ext === 'js') {
        acc.jsRaw += file.raw
        acc.jsGzip += file.gzip
      }

      if (file.ext === 'css') {
        acc.cssRaw += file.raw
        acc.cssGzip += file.gzip
      }

      return acc
    },
    { raw: 0, gzip: 0, jsRaw: 0, jsGzip: 0, cssRaw: 0, cssGzip: 0 },
  )

  const largestAsset = files.reduce((largest, file) => (file.raw > largest.raw ? file : largest), files[0])
  const warnings = []

  if (totals.jsRaw > app.budgets.totalJs) {
    warnings.push(`JS total excede presupuesto: ${formatBytes(totals.jsRaw)} > ${formatBytes(app.budgets.totalJs)}`)
  }

  if (totals.cssRaw > app.budgets.totalCss) {
    warnings.push(`CSS total excede presupuesto: ${formatBytes(totals.cssRaw)} > ${formatBytes(app.budgets.totalCss)}`)
  }

  if (largestAsset.raw > app.budgets.maxAsset) {
    warnings.push(
      `Asset mas pesado excede presupuesto: ${largestAsset.rel} ${formatBytes(largestAsset.raw)} > ${formatBytes(app.budgets.maxAsset)}`,
    )
  }

  if (totals.raw > app.budgets.totalDist) {
    warnings.push(`Dist total excede presupuesto: ${formatBytes(totals.raw)} > ${formatBytes(app.budgets.totalDist)}`)
  }

  return {
    app,
    files,
    totals,
    largest: files.sort((a, b) => b.raw - a.raw).slice(0, 8),
    warnings,
  }
}

let hasWarnings = false

console.log('Reporte de rendimiento estatico')
console.log('')

for (const app of apps) {
  const report = summarizeApp(app)
  hasWarnings ||= report.warnings.length > 0

  console.log(`== ${app.name} ==`)
  console.log(`Archivos: ${report.files.length}`)
  console.log(`Dist total: ${formatBytes(report.totals.raw)} raw / ${formatBytes(report.totals.gzip)} gzip estimado`)
  console.log(`JS total: ${formatBytes(report.totals.jsRaw)} raw / ${formatBytes(report.totals.jsGzip)} gzip estimado`)
  console.log(`CSS total: ${formatBytes(report.totals.cssRaw)} raw / ${formatBytes(report.totals.cssGzip)} gzip estimado`)
  console.log('Archivos mas pesados:')

  for (const file of report.largest) {
    console.log(`- ${file.rel}: ${formatBytes(file.raw)} raw / ${formatBytes(file.gzip)} gzip`)
  }

  if (report.warnings.length > 0) {
    console.log('Advertencias:')
    for (const warning of report.warnings) console.log(`- ${warning}`)
  } else {
    console.log('Presupuestos estaticos: OK')
  }

  console.log('')
}

console.log('Nota: este reporte mide bundles estaticos. Imagenes R2, video, LCP, CLS e INP se validan con DevTools/Lighthouse.')

if (strict && hasWarnings) {
  process.exitCode = 1
}
