import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { PRODUCT_TYPE, type CatalogCard, type CatalogFilters, type CatalogManifest, type ProductType } from '@bap-shop/shared'

const ASSETS_DOMAIN =
  (import.meta.env.VITE_ASSETS_URL || 'https://pub-470a5675dc7d4e9d949688372b59b080.r2.dev/public')
    .trim()
    .replace(/\/+$/, '')

export const useCatalogStore = defineStore('catalog', () => {
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let fetchCatalogPromise: Promise<void> | null = null

  const products = ref<CatalogCard[]>([])
  const filters = ref<CatalogFilters | null>(null)

  const selectedBrand = ref<string>('')
  const selectedModel = ref<string>('')
  const selectedCondition = ref<string>('')
  const selectedSize = ref<string>('')

  const fetchCatalog = async () => {
    if (fetchCatalogPromise) return fetchCatalogPromise

    fetchCatalogPromise = (async () => {
      isLoading.value = true
      error.value = null

      try {
        const manifestResponse = await fetch(`${ASSETS_DOMAIN}/manifest.json`)
        if (!manifestResponse.ok) throw new Error('Error al verificar version del catalogo')
        const manifest = (await manifestResponse.json()) as CatalogManifest

        const localVersion = sessionStorage.getItem('bap_catalog_version')
        const localProducts = sessionStorage.getItem('bap_catalog_index')
        const localFilters = sessionStorage.getItem('bap_catalog_filters')

        if (localVersion === String(manifest.catalog_version) && localProducts && localFilters) {
          products.value = JSON.parse(localProducts)
          filters.value = JSON.parse(localFilters)
          isLoaded.value = true
          return
        }

        const [productsResponse, filtersResponse] = await Promise.all([
          fetch(`${ASSETS_DOMAIN}/catalog/index.json`),
          fetch(`${ASSETS_DOMAIN}/catalog/filters.json`),
        ])

        if (!productsResponse.ok || !filtersResponse.ok) {
          throw new Error('Error al cargar el catalogo')
        }

        const nextProducts = await productsResponse.json()
        const nextFilters = await filtersResponse.json()

        products.value = nextProducts
        filters.value = nextFilters

        sessionStorage.setItem('bap_catalog_index', JSON.stringify(nextProducts))
        sessionStorage.setItem('bap_catalog_filters', JSON.stringify(nextFilters))
        sessionStorage.setItem('bap_catalog_version', String(manifest.catalog_version))

        isLoaded.value = true
      } catch (err: unknown) {
        error.value = err instanceof Error ? err.message : 'Error de red'
        console.error(err)
      } finally {
        isLoading.value = false
      }
    })()

    try {
      await fetchCatalogPromise
    } finally {
      fetchCatalogPromise = null
    }
  }

  const availableModels = computed(() => {
    return (filters.value?.models ?? []).filter((model) => {
      return !selectedBrand.value || model.brand_id === selectedBrand.value
    })
  })

  const getFilteredProducts = (type?: ProductType) => {
    return products.value.filter((product) => {
      const applySneakerFilters = (type ?? product.type) === PRODUCT_TYPE.SNEAKER

      if (type && product.type !== type) return false
      if (applySneakerFilters && selectedBrand.value && product.brand?.id !== selectedBrand.value) return false
      if (applySneakerFilters && selectedModel.value && product.model?.id !== selectedModel.value) return false
      if (selectedCondition.value && product.physical_condition !== selectedCondition.value) return false
      if (applySneakerFilters && selectedSize.value && product.size !== selectedSize.value) return false
      return true
    })
  }

  const filteredProducts = computed(() => getFilteredProducts())
  const sneakers = computed(() => getFilteredProducts(PRODUCT_TYPE.SNEAKER))
  const others = computed(() => getFilteredProducts(PRODUCT_TYPE.OTHER))

  const clearFilters = () => {
    selectedBrand.value = ''
    selectedModel.value = ''
    selectedCondition.value = ''
    selectedSize.value = ''
  }

  return {
    isLoaded,
    isLoading,
    error,
    products,
    filters,
    selectedBrand,
    selectedModel,
    selectedCondition,
    selectedSize,
    availableModels,
    fetchCatalog,
    getFilteredProducts,
    filteredProducts,
    sneakers,
    others,
    clearFilters,
  }
})
