import { ref } from 'vue'
import type { ApiResponse, CreateOrderResponse, InvalidCartItem } from '@bap-shop/shared'
import { useCartStore } from '../stores/cart'

export function useOrder() {
  const cartStore = useCartStore()
  const isSubmitting = ref(false)
  const invalidItems = ref<InvalidCartItem[]>([])
  const submitError = ref('')

  const resetOrderFeedback = () => {
    invalidItems.value = []
    submitError.value = ''
  }

  const submitOrder = async (input: {
    apiUrl: string
    customerName: string
    customerPhone: string
    turnstileToken: string
  }) => {
    resetOrderFeedback()
    isSubmitting.value = true

    try {
      const response = await fetch(`${input.apiUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: input.customerName.trim(),
          customerPhone: input.customerPhone.trim(),
          turnstileToken: input.turnstileToken,
          items: cartStore.items.map((item) => ({
            productId: item.id,
            cartPrice: item.promo_price ?? item.price,
          })),
        }),
      })

      const result = (await response.json()) as ApiResponse<CreateOrderResponse & { invalidItems?: InvalidCartItem[] }>

      if (!response.ok) {
        if (response.status === 422 && result.data?.invalidItems) {
          invalidItems.value = result.data.invalidItems
          submitError.value = 'Algunos articulos de tu carrito ya no estan disponibles.'
          return { success: false as const, result }
        }

        submitError.value = result.error || 'No se pudo procesar el pedido.'
        return { success: false as const, result }
      }

      return { success: true as const, result }
    } catch {
      submitError.value = 'Ocurrio un error de red al procesar el pedido.'
      return { success: false as const, result: null }
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    isSubmitting,
    invalidItems,
    submitError,
    resetOrderFeedback,
    submitOrder,
  }
}
