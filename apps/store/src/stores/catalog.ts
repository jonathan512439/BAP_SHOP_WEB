import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { PRODUCT_TYPE, type CatalogCard, type CatalogFilters, type CatalogManifest, type ProductType } from '@bap-shop/shared'

const ASSETS_DOMAIN =
  import.meta.env.VITE_ASSETS_URL || 'https://pub-470a5675dc7d4e9d949688372b59b080.r2.dev/public'

export const useCatalogStore = defineStore('catalog', () => {
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  const products = ref<CatalogCard[]>([])
  const filters = ref<CatalogFilters | null>(null)

  // Filters state
  const selectedBrand = ref<string>('')
  const selectedModel = ref<string>('')
  const selectedCondition = ref<string>('')
  const selectedSize = ref<string>('')
  
  const fetchCatalog = async () => {
    if (isLoading.value) return
    
    isLoading.value = true
    error.value = null
    
    try {
      // 1. Fetch manifest.json to check catalog version
      const manifestRes = await fetch(`${ASSETS_DOMAIN}/manifest.json`)
      if (!manifestRes.ok) throw new Error('Error al verificar versión del catálogo')
      const manifest = (await manifestRes.json()) as CatalogManifest

      const localVersion = sessionStorage.getItem('bap_catalog_version')
      const localProducts = sessionStorage.getItem('bap_catalog_index')
      const localFilters = sessionStorage.getItem('bap_catalog_filters')

      // 2. Compare versions, if same and local storage exists, load from session cache
      if (localVersion === String(manifest.catalog_version) && localProducts && localFilters) {
        products.value = JSON.parse(localProducts)
        filters.value = JSON.parse(localFilters)
        isLoaded.value = true
        return
      }

      // 3. Otherwise fetch the new catalog
      const [productsRes, filtersRes] = await Promise.all([
        fetch(`${ASSETS_DOMAIN}/catalog/index.json`),
        fetch(`${ASSETS_DOMAIN}/catalog/filters.json`)
      ])
      
      if (!productsRes.ok || !filtersRes.ok) throw new Error('Error al cargar el catálogo')
      
      const newProducts = await productsRes.json()
      const newFilters = await filtersRes.json()

      products.value = newProducts
      filters.value = newFilters

      // 4. Update session storage cache
      sessionStorage.setItem('bap_catalog_index', JSON.stringify(newProducts))
      sessionStorage.setItem('bap_catalog_filters', JSON.stringify(newFilters))
      sessionStorage.setItem('bap_catalog_version', String(manifest.catalog_version))

      isLoaded.value = true
    } catch (err: any) {
      error.value = err.message || 'Error de red'
      console.error(err)
    } finally {
      isLoading.value = false
    }
  }

  const availableModels = computed(() => {
    return (filters.value?.models ?? []).filter((model) => {
      return !selectedBrand.value || model.brand_id === selectedBrand.value
    })
  })

  const getFilteredProducts = (type?: ProductType) => {
    return products.value.filter((p) => {
      const applySneakerFilters = (type ?? p.type) === PRODUCT_TYPE.SNEAKER

      if (type && p.type !== type) return false
      if (applySneakerFilters && selectedBrand.value && p.brand?.id !== selectedBrand.value) return false
      if (applySneakerFilters && selectedModel.value && p.model?.id !== selectedModel.value) return false
      if (selectedCondition.value && p.physical_condition !== selectedCondition.value) return false
      if (applySneakerFilters && selectedSize.value && p.size !== selectedSize.value) return false
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
    clearFilters
  }
})
