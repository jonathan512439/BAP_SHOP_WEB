import { computed, watch, type ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PRODUCT_TYPE, type ProductType } from '@bap-shop/shared'
import { useCatalogStore } from '../stores/catalog'

export function useFilters(categoryType: ComputedRef<ProductType>, itemsPerPage = 12) {
  const route = useRoute()
  const router = useRouter()
  const catalogStore = useCatalogStore()

  const currentPage = computed({
    get: () => {
      const raw = Number(route.query.page ?? 1)
      return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1
    },
    set: (value: number) => {
      void router.replace({
        query: {
          ...route.query,
          page: value > 1 ? String(value) : undefined,
        },
      })
    },
  })

  const visibleProducts = computed(() => catalogStore.getFilteredProducts(categoryType.value))
  const totalPages = computed(() => Math.max(1, Math.ceil(visibleProducts.value.length / itemsPerPage)))
  const paginatedProducts = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage
    return visibleProducts.value.slice(start, start + itemsPerPage)
  })

  const applyRouteFilters = () => {
    catalogStore.selectedBrand = typeof route.query.brand === 'string' ? route.query.brand : ''
    catalogStore.selectedModel = typeof route.query.model === 'string' ? route.query.model : ''
    catalogStore.selectedSize = typeof route.query.size === 'string' ? route.query.size : ''
    catalogStore.selectedCondition = typeof route.query.condition === 'string' ? route.query.condition : ''
  }

  const syncQueryFromFilters = () => {
    void router.replace({
      query: {
        ...route.query,
        brand: catalogStore.selectedBrand || undefined,
        model: catalogStore.selectedModel || undefined,
        size: catalogStore.selectedSize || undefined,
        condition: catalogStore.selectedCondition || undefined,
        page: currentPage.value > 1 ? String(currentPage.value) : undefined,
      },
    })
  }

  const resetPage = () => {
    currentPage.value = 1
  }

  const goToPage = (page: number) => {
    currentPage.value = Math.min(Math.max(1, page), totalPages.value)
  }

  const clearFilters = () => {
    catalogStore.clearFilters()
    goToPage(1)
  }

  watch(categoryType, (nextType) => {
    if (nextType === PRODUCT_TYPE.OTHER) {
      catalogStore.selectedBrand = ''
      catalogStore.selectedModel = ''
      catalogStore.selectedSize = ''
    }

    resetPage()
    syncQueryFromFilters()
  })

  watch(
    () => route.query,
    () => {
      applyRouteFilters()
    }
  )

  watch(
    [
      () => catalogStore.selectedBrand,
      () => catalogStore.selectedModel,
      () => catalogStore.selectedSize,
      () => catalogStore.selectedCondition,
    ],
    () => {
      resetPage()
      syncQueryFromFilters()
    }
  )

  watch(totalPages, (pages) => {
    if (currentPage.value > pages) {
      currentPage.value = pages
    }
  })

  return {
    currentPage,
    visibleProducts,
    totalPages,
    paginatedProducts,
    applyRouteFilters,
    clearFilters,
    goToPage,
  }
}
