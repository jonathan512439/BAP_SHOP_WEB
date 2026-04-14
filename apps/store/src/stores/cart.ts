import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { CatalogCard } from '@bap-shop/shared'
import { PRODUCT_STATUS } from '@bap-shop/shared'

export interface CartItem extends CatalogCard {}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  // Inicializar desde localStorage (sincrónico)
  const savedCart = localStorage.getItem('bap_cart')
  if (savedCart) {
    try {
      items.value = JSON.parse(savedCart)
    } catch (e) {
      console.error('Error parseando carrito de localStorage', e)
      localStorage.removeItem('bap_cart')
    }
  }

  // Persistir en localStorage automáticamente al cambiar
  watch(items, (newItems) => {
    localStorage.setItem('bap_cart', JSON.stringify(newItems))
  }, { deep: true })

  const count = computed(() => items.value.length)
  const itemCount = computed(() => items.value.length)
  
  const subtotal = computed(() => {
    return items.value.reduce((sum, item) => sum + item.price, 0)
  })

  const discount = computed(() => {
    return items.value.reduce((sum, item) => {
      if (item.promo_price) {
        return sum + (item.price - item.promo_price)
      }
      return sum
    }, 0)
  })
  const totalDiscount = computed(() => discount.value)

  const total = computed(() => subtotal.value - discount.value)
  const isInCart = (id: string) => items.value.some((item) => item.id === id)

  const addItem = (item: CatalogCard) => {
    if (item.status === PRODUCT_STATUS.SOLD) {
      return
    }

    if (!isInCart(item.id)) {
      items.value.push(item)
    }
  }

  const removeItem = (id: string) => {
    items.value = items.value.filter(i => i.id !== id)
  }

  const clearCart = () => {
    items.value = []
  }

  return {
    items,
    count,
    itemCount,
    subtotal,
    discount,
    totalDiscount,
    total,
    isInCart,
    addItem,
    removeItem,
    clearCart
  }
})
