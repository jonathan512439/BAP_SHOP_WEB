import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { PHYSICAL_CONDITION, PRODUCT_TYPE } from '@bap-shop/shared'
import { useCatalogStore } from '../src/stores/catalog'

class StorageMock {
  private store = new Map<string, string>()

  clear() {
    this.store.clear()
  }

  getItem(key: string) {
    return this.store.get(key) ?? null
  }

  removeItem(key: string) {
    this.store.delete(key)
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value))
  }
}

const products = [
  {
    id: 'p-1',
    type: PRODUCT_TYPE.SNEAKER,
    status: 'active',
    name: 'Nike AF1',
    brand: { id: 'brand-1', name: 'Nike', slug: 'nike' },
    model: { id: 'model-1', name: 'Air Force 1' },
    size: '42',
    price: 45000,
    promo_price: 36000,
    discount_pct: 20,
    physical_condition: PHYSICAL_CONDITION.LIKE_NEW,
    primary_image_url: 'https://assets.test/p-1.webp',
    sort_order: 0,
  },
  {
    id: 'p-2',
    type: PRODUCT_TYPE.OTHER,
    status: 'active',
    name: 'Gorra BAP',
    brand: null,
    model: null,
    size: null,
    price: 15000,
    promo_price: null,
    discount_pct: null,
    physical_condition: PHYSICAL_CONDITION.GOOD,
    primary_image_url: 'https://assets.test/p-2.webp',
    sort_order: 1,
  },
]

const filters = {
  brands: [{ id: 'brand-1', name: 'Nike', slug: 'nike' }],
  models: [{ id: 'model-1', brand_id: 'brand-1', name: 'Air Force 1', slug: 'air-force-1' }],
  sizes: ['42'],
  conditions: [PHYSICAL_CONDITION.LIKE_NEW, PHYSICAL_CONDITION.GOOD],
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: new StorageMock(),
    configurable: true,
    writable: true,
  })

  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('catalog store', () => {
  it('carga snapshots remotos y persiste cache por version', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ catalog_version: 3, total_products: 2 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(products), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(filters), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

    const catalog = useCatalogStore()
    await catalog.fetchCatalog()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(catalog.isLoaded).toBe(true)
    expect(catalog.products).toHaveLength(2)
    expect(catalog.filters).toEqual(filters)
    expect(sessionStorage.getItem('bap_catalog_version')).toBe('3')
    expect(sessionStorage.getItem('bap_catalog_index')).toContain('"id":"p-1"')
  })

  it('reutiliza cache local cuando la version no cambia', async () => {
    sessionStorage.setItem('bap_catalog_version', '5')
    sessionStorage.setItem('bap_catalog_index', JSON.stringify(products))
    sessionStorage.setItem('bap_catalog_filters', JSON.stringify(filters))

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ catalog_version: 5, total_products: 2 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const catalog = useCatalogStore()
    await catalog.fetchCatalog()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(catalog.isLoaded).toBe(true)
    expect(catalog.products).toHaveLength(2)
    expect(catalog.filters).toEqual(filters)
  })

  it('filtra sneakers por marca, modelo, talla y condicion', async () => {
    const catalog = useCatalogStore()
    catalog.products = products
    catalog.filters = filters
    catalog.selectedBrand = 'brand-1'
    catalog.selectedModel = 'model-1'
    catalog.selectedSize = '42'
    catalog.selectedCondition = PHYSICAL_CONDITION.LIKE_NEW

    expect(catalog.sneakers).toHaveLength(1)
    expect(catalog.sneakers[0]?.id).toBe('p-1')
    expect(catalog.others).toHaveLength(0)
    expect(catalog.availableModels).toEqual(filters.models)
  })

  it('clearFilters limpia el estado de filtros', async () => {
    const catalog = useCatalogStore()
    catalog.selectedBrand = 'brand-1'
    catalog.selectedModel = 'model-1'
    catalog.selectedSize = '42'
    catalog.selectedCondition = PHYSICAL_CONDITION.LIKE_NEW

    catalog.clearFilters()

    expect(catalog.selectedBrand).toBe('')
    expect(catalog.selectedModel).toBe('')
    expect(catalog.selectedSize).toBe('')
    expect(catalog.selectedCondition).toBe('')
  })
})
