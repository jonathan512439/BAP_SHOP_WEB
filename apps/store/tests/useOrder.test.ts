import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { PRODUCT_STATUS, PRODUCT_TYPE, PHYSICAL_CONDITION } from '@bap-shop/shared'
import { useCartStore } from '../src/stores/cart'
import { useOrder } from '../src/composables/useOrder'

class LocalStorageMock {
  private store = new Map<string, string>()

  clear() {
    this.store.clear()
  }

  getItem(key: string) {
    return this.store.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.store.delete(key)
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value))
  }

  get length() {
    return this.store.size
  }
}

const makeProduct = (id: string, price: number, promoPrice?: number) => ({
  id,
  type: PRODUCT_TYPE.SNEAKER,
  status: PRODUCT_STATUS.ACTIVE,
  name: `Producto ${id}`,
  brand: { id: 'brand-1', name: 'Nike', slug: 'nike' },
  model: { id: 'model-1', name: 'Air Force 1' },
  size: '42',
  price,
  promo_price: promoPrice ?? null,
  discount_pct: promoPrice ? 20 : null,
  physical_condition: PHYSICAL_CONDITION.LIKE_NEW,
  primary_image_url: `https://assets.test/products/${id}.webp`,
  sort_order: 0,
})

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new LocalStorageMock(),
    configurable: true,
    writable: true,
  })

  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('useOrder', () => {
  it('envia el payload del carrito y resuelve exito', async () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('p-1', 45000, 36000))

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            orderId: 'order-1',
            orderCode: 'BAP-20260327-ABCD',
            whatsappUrl: 'https://wa.me/123',
            priceChanges: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const order = useOrder()
    const result = await order.submitOrder({
      apiUrl: 'https://api.test',
      customerName: ' Juan Perez ',
      customerPhone: ' 70000001 ',
      turnstileToken: 'token-1',
    })

    expect(result.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/orders',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body).toEqual({
      customerName: 'Juan Perez',
      customerPhone: '70000001',
      turnstileToken: 'token-1',
      items: [
        {
          productId: 'p-1',
          cartPrice: 36000,
        },
      ],
    })
    expect(order.submitError.value).toBe('')
    expect(order.invalidItems.value).toEqual([])
  })

  it('guarda invalidItems cuando el backend responde 422', async () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('p-1', 45000))

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          data: {
            invalidItems: [
              {
                productId: 'p-1',
                productName: 'Producto p-1',
                reason: 'reserved',
              },
            ],
          },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const order = useOrder()
    const result = await order.submitOrder({
      apiUrl: 'https://api.test',
      customerName: 'Juan Perez',
      customerPhone: '70000001',
      turnstileToken: 'token-1',
    })

    expect(result.success).toBe(false)
    expect(order.invalidItems.value).toHaveLength(1)
    expect(order.invalidItems.value[0]?.reason).toBe('reserved')
    expect(order.submitError.value).toContain('no estan disponibles')
  })

  it('devuelve error generico si falla la red', async () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('p-1', 45000))

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))

    const order = useOrder()
    const result = await order.submitOrder({
      apiUrl: 'https://api.test',
      customerName: 'Juan Perez',
      customerPhone: '70000001',
      turnstileToken: 'token-1',
    })

    expect(result.success).toBe(false)
    expect(order.submitError.value).toContain('error de red')
  })
})
