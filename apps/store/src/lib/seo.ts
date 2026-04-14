const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://bab-shop.com'

type MetaConfig = {
  title: string
  description: string
  canonicalPath?: string
  robots?: string
  ogType?: 'website' | 'product' | 'article'
  imageUrl?: string | null
}

function upsertMeta(selector: string, create: () => HTMLMetaElement, updater: (element: HTMLMetaElement) => void) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)

  if (!element) {
    element = create()
    document.head.appendChild(element)
  }

  updater(element)
}

function upsertLink(selector: string, create: () => HTMLLinkElement, updater: (element: HTMLLinkElement) => void) {
  let element = document.head.querySelector<HTMLLinkElement>(selector)

  if (!element) {
    element = create()
    document.head.appendChild(element)
  }

  updater(element)
}

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString()
}

export function setDocumentMeta(config: MetaConfig) {
  const canonicalUrl = absoluteUrl(config.canonicalPath || '/')
  const robots = config.robots || 'index,follow'
  const ogType = config.ogType || 'website'
  const imageUrl = config.imageUrl || null

  document.title = config.title

  upsertMeta('meta[name="description"]', () => {
    const meta = document.createElement('meta')
    meta.name = 'description'
    return meta
  }, (meta) => meta.setAttribute('content', config.description))

  upsertMeta('meta[name="robots"]', () => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    return meta
  }, (meta) => meta.setAttribute('content', robots))

  upsertMeta('meta[property="og:title"]', () => {
    const meta = document.createElement('meta')
    meta.setAttribute('property', 'og:title')
    return meta
  }, (meta) => meta.setAttribute('content', config.title))

  upsertMeta('meta[property="og:description"]', () => {
    const meta = document.createElement('meta')
    meta.setAttribute('property', 'og:description')
    return meta
  }, (meta) => meta.setAttribute('content', config.description))

  upsertMeta('meta[property="og:type"]', () => {
    const meta = document.createElement('meta')
    meta.setAttribute('property', 'og:type')
    return meta
  }, (meta) => meta.setAttribute('content', ogType))

  upsertMeta('meta[property="og:url"]', () => {
    const meta = document.createElement('meta')
    meta.setAttribute('property', 'og:url')
    return meta
  }, (meta) => meta.setAttribute('content', canonicalUrl))

  upsertMeta('meta[name="twitter:card"]', () => {
    const meta = document.createElement('meta')
    meta.name = 'twitter:card'
    return meta
  }, (meta) => meta.setAttribute('content', imageUrl ? 'summary_large_image' : 'summary'))

  upsertMeta('meta[name="twitter:title"]', () => {
    const meta = document.createElement('meta')
    meta.name = 'twitter:title'
    return meta
  }, (meta) => meta.setAttribute('content', config.title))

  upsertMeta('meta[name="twitter:description"]', () => {
    const meta = document.createElement('meta')
    meta.name = 'twitter:description'
    return meta
  }, (meta) => meta.setAttribute('content', config.description))

  if (imageUrl) {
    upsertMeta('meta[property="og:image"]', () => {
      const meta = document.createElement('meta')
      meta.setAttribute('property', 'og:image')
      return meta
    }, (meta) => meta.setAttribute('content', imageUrl))

    upsertMeta('meta[name="twitter:image"]', () => {
      const meta = document.createElement('meta')
      meta.name = 'twitter:image'
      return meta
    }, (meta) => meta.setAttribute('content', imageUrl))
  }

  upsertLink('link[rel="canonical"]', () => {
    const link = document.createElement('link')
    link.rel = 'canonical'
    return link
  }, (link) => link.setAttribute('href', canonicalUrl))
}

export function stripHtml(text: string) {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function setStructuredData(id: string, payload: Record<string, unknown> | Array<Record<string, unknown>>) {
  let script = document.head.querySelector<HTMLScriptElement>(`script[data-schema-id="${id}"]`)

  if (!script) {
    script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.schemaId = id
    document.head.appendChild(script)
  }

  script.textContent = JSON.stringify(payload)
}

export function removeStructuredData(id: string) {
  document.head.querySelector(`script[data-schema-id="${id}"]`)?.remove()
}

export function setFavicon(url: string | null) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')

  if (!url) {
    link?.remove()
    return
  }

  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }

  link.type = url.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
  link.href = url
}
