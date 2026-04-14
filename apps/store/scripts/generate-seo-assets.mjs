import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')
const publicDir = path.join(appRoot, 'public')
const envFile = path.join(appRoot, '.env.production')

const DEFAULT_SITE_URL = 'https://bab-shop.com'
const DEFAULT_ASSETS_URL = 'https://pub-470a5675dc7d4e9d949688372b59b080.r2.dev/public'

const STATIC_ROUTES = ['/zapatillas', '/otros', '/como-comprar', '/nosotros', '/preguntas-frecuentes', '/politicas']

function normalizeUrl(value, fallback) {
  const input = value?.trim() || fallback
  return input.replace(/\/+$/, '')
}

async function readEnvMap() {
  try {
    const file = await readFile(envFile, 'utf8')
    return Object.fromEntries(
      file
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const [key, ...rest] = line.split('=')
          return [key.trim(), rest.join('=').trim()]
        })
    )
  } catch {
    return {}
  }
}

async function fetchProductRoutes(assetsUrl) {
  try {
    const response = await fetch(`${assetsUrl}/catalog/index.json`, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`Snapshot HTTP ${response.status}`)
    }

    const products = await response.json()
    if (!Array.isArray(products)) {
      return []
    }

    return products
      .map((product) => (product && typeof product.id === 'string' ? `/products/${product.id}` : null))
      .filter(Boolean)
  } catch (error) {
    console.warn(`[seo] No se pudo generar sitemap con productos dinamicos: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}

function renderSitemap(siteUrl, routes) {
  const now = new Date().toISOString()
  const urls = routes
    .map((route) => {
      const href = `${siteUrl}${route}`
      return [
        '  <url>',
        `    <loc>${href}</loc>`,
        `    <lastmod>${now}</lastmod>`,
        route.startsWith('/products/') ? '    <changefreq>daily</changefreq>' : '    <changefreq>weekly</changefreq>',
        route.startsWith('/products/') ? '    <priority>0.80</priority>' : '    <priority>0.70</priority>',
        '  </url>',
      ].join('\n')
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n')
}

function renderRobots(siteUrl) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /checkout',
    'Disallow: /confirmacion',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')
}

async function main() {
  await mkdir(publicDir, { recursive: true })

  const envMap = await readEnvMap()
  const siteUrl = normalizeUrl(process.env.VITE_SITE_URL || envMap.VITE_SITE_URL, DEFAULT_SITE_URL)
  const assetsUrl = normalizeUrl(process.env.VITE_ASSETS_URL || envMap.VITE_ASSETS_URL, DEFAULT_ASSETS_URL)

  const productRoutes = await fetchProductRoutes(assetsUrl)
  const uniqueRoutes = [...new Set([...STATIC_ROUTES, ...productRoutes])]

  await writeFile(path.join(publicDir, 'sitemap.xml'), renderSitemap(siteUrl, uniqueRoutes), 'utf8')
  await writeFile(path.join(publicDir, 'robots.txt'), renderRobots(siteUrl), 'utf8')
}

main().catch((error) => {
  console.error('[seo] Error generando sitemap y robots:', error)
  process.exitCode = 1
})
