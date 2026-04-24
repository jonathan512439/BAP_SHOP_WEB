import { ref } from 'vue'
import type { ApiResponse, CreateOrderResponse, InvalidCartItem } from '@bap-shop/shared'
import { useCartStore } from '../stores/cart'

export function useOrder() {
  const cartStore = useCartStore()
  const isSubmitting = ref(false)
  const invalidItems = ref<InvalidCartItem[]>([])
  const submitError = ref('')
  const pendingIdempotencyKey = ref('')

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
    if (isSubmitting.value) {
      return { success: false as const, result: null }
    }

    resetOrderFeedback()

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
      submitError.value = 'No tienes conexion a internet. Revisa tu red y vuelve a intentar.'
      return { success: false as const, result: null }
    }

    isSubmitting.value = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    try {
      if (!pendingIdempotencyKey.value) {
        pendingIdempotencyKey.value = crypto.randomUUID()
      }

      const controller = new AbortController()
      timeoutId = setTimeout(() => controller.abort(new Error('request_timeout')), 15000)

      const response = await fetch(`${input.apiUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': pendingIdempotencyKey.value,
        },
        signal: controller.signal,
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
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      const result = (await response.json()) as ApiResponse<CreateOrderResponse & { invalidItems?: InvalidCartItem[] }>

      if (!response.ok) {
        if (response.status === 422 && result.data?.invalidItems) {
          invalidItems.value = result.data.invalidItems
          submitError.value = 'Algunos articulos de tu carrito ya no estan disponibles.'
          pendingIdempotencyKey.value = ''
          return { success: false as const, result }
        }

        submitError.value = result.error || 'No se pudo procesar el pedido.'
        if (response.status >= 400 && response.status < 500) {
          pendingIdempotencyKey.value = ''
        }
        return { success: false as const, result }
      }

      pendingIdempotencyKey.value = ''
      return { success: true as const, result }
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === 'AbortError'
      submitError.value = typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'La conexion se perdio mientras se enviaba el pedido. Vuelve a intentar cuando estes en linea.'
        : isTimeout
          ? 'El servidor demoro demasiado en responder. Puedes reintentar sin perder tu pedido.'
          : 'Ocurrio un error de red al procesar el pedido.'
      return { success: false as const, result: null }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
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
