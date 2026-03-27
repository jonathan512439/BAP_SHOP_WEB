import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { PHYSICAL_CONDITION, PRODUCT_TYPE } from '@bap-shop/shared'
import { useCatalogStore } from '../src/stores/catalog'
import { useFilters } from '../src/composables/useFilters'

const route = reactive<{ query: Record<string, string | undefined> }>({
  query: {},
})

const router = {
  replace: vi.fn(async ({ query }: { query: Record<string, string | undefined> }) => {
    route.query = { ...query }
  }),
}

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => router,
}))

const makeSneaker = (id: string, overrides: Partial<any> = {}) => ({
  id,
  type: PRODUCT_TYPE.SNEAKER,
  status: 'active',
  name: `Sneaker ${id}`,
  brand: { id: 'brand-1', name: 'Nike', slug: 'nike' },
  model: { id: 'model-1', name: 'Air Force 1' },
  size: '42',
  price: 45000,
  promo_price: null,
  discount_pct: null,
  physical_condition: PHYSICAL_CONDITION.LIKE_NEW,
  primary_image_url: `https://assets.test/${id}.webp`,
  sort_order: 0,
  ...overrides,
})

const makeOther = (id: string, overrides: Partial<any> = {}) => ({
  id,
  type: PRODUCT_TYPE.OTHER,
  status: 'active',
  name: `Other ${id}`,
  brand: null,
  model: null,
  size: null,
  price: 20000,
  promo_price: null,
  discount_pct: null,
  physical_condition: PHYSICAL_CONDITION.GOOD,
  primary_image_url: `https://assets.test/${id}.webp`,
  sort_order: 0,
  ...overrides,
})

beforeEach(() => {
  setActivePinia(createPinia())
  route.query = {}
  router.replace.mockClear()
})

describe('useFilters', () => {
  it('aplica filtros desde query params al store', async () => {
    const catalog = useCatalogStore()
    route.query = {
      brand: 'brand-1',
      model: 'model-1',
      size: '42',
      condition: PHYSICAL_CONDITION.LIKE_NEW,
      page: '2',
    }

    const filters = useFilters(computed(() => PRODUCT_TYPE.SNEAKER), 12)

    filters.applyRouteFilters()
    await nextTick()

    expect(catalog.selectedBrand).toBe('brand-1')
    expect(catalog.selectedModel).toBe('model-1')
    expect(catalog.selectedSize).toBe('42')
    expect(catalog.selectedCondition).toBe(PHYSICAL_CONDITION.LIKE_NEW)
    expect(filters.currentPage.value).toBe(1)
  })

  it('sincroniza filtros y pagina en la query', async () => {
    const catalog = useCatalogStore()
    catalog.products = [
      makeSneaker('p-1'),
      makeSneaker('p-2'),
      makeSneaker('p-3'),
    ]

    const filters = useFilters(computed(() => PRODUCT_TYPE.SNEAKER), 2)

    catalog.selectedBrand = 'brand-1'
    catalog.selectedModel = 'model-1'
    catalog.selectedSize = '42'
    catalog.selectedCondition = PHYSICAL_CONDITION.LIKE_NEW
    await nextTick()

    filters.goToPage(2)
    await nextTick()

    expect(route.query).toEqual({
      brand: 'brand-1',
      model: 'model-1',
      size: '42',
      condition: PHYSICAL_CONDITION.LIKE_NEW,
      page: '2',
    })
    expect(filters.totalPages.value).toBe(2)
    expect(filters.paginatedProducts.value).toHaveLength(1)
  })

  it('limpia filtros de sneaker al cambiar a categoria other', async () => {
    const catalog = useCatalogStore()
    catalog.selectedBrand = 'brand-1'
    catalog.selectedModel = 'model-1'
    catalog.selectedSize = '42'
    catalog.selectedCondition = PHYSICAL_CONDITION.LIKE_NEW

    const category = ref(PRODUCT_TYPE.SNEAKER)
    useFilters(computed(() => category.value), 12)
    await nextTick()

    category.value = PRODUCT_TYPE.OTHER
    await nextTick()

    expect(catalog.selectedBrand).toBe('')
    expect(catalog.selectedModel).toBe('')
    expect(catalog.selectedSize).toBe('')
    expect(catalog.selectedCondition).toBe(PHYSICAL_CONDITION.LIKE_NEW)
  })

  it('clearFilters resetea filtros y vuelve a la primera pagina', async () => {
    const catalog = useCatalogStore()
    catalog.products = [makeSneaker('p-1'), makeOther('p-2')]
    route.query = { page: '3' }

    const filters = useFilters(computed(() => PRODUCT_TYPE.SNEAKER), 1)
    filters.applyRouteFilters()

    catalog.selectedBrand = 'brand-1'
    catalog.selectedCondition = PHYSICAL_CONDITION.LIKE_NEW
    await nextTick()

    filters.clearFilters()
    await nextTick()

    expect(catalog.selectedBrand).toBe('')
    expect(catalog.selectedModel).toBe('')
    expect(catalog.selectedSize).toBe('')
    expect(catalog.selectedCondition).toBe('')
    expect(filters.currentPage.value).toBe(1)
  })
})
