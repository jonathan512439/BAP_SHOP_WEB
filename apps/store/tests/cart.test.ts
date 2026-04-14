import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { PRODUCT_STATUS, PRODUCT_TYPE, PHYSICAL_CONDITION } from '@bap-shop/shared'
import { useCartStore } from '../src/stores/cart'

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
})

describe('cart store', () => {
  it('agrega productos al carrito', () => {
    const cart = useCartStore()

    cart.addItem(makeProduct('p-1', 45000))

    expect(cart.items).toHaveLength(1)
    expect(cart.itemCount).toBe(1)
    expect(cart.isInCart('p-1')).toBe(true)
  })

  it('ignora duplicados por productId', () => {
    const cart = useCartStore()
    const product = makeProduct('p-1', 45000)

    cart.addItem(product)
    cart.addItem(product)

    expect(cart.items).toHaveLength(1)
  })

  it('no agrega productos agotados al carrito', () => {
    const cart = useCartStore()
    const soldProduct = {
      ...makeProduct('p-3', 52000),
      status: PRODUCT_STATUS.SOLD,
    }

    cart.addItem(soldProduct)

    expect(cart.items).toHaveLength(0)
  })

  it('elimina productos del carrito', () => {
    const cart = useCartStore()

    cart.addItem(makeProduct('p-1', 45000))
    cart.addItem(makeProduct('p-2', 50000))
    cart.removeItem('p-1')

    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]?.id).toBe('p-2')
    expect(cart.isInCart('p-1')).toBe(false)
  })

  it('calcula subtotal, descuento y total correctamente', () => {
    const cart = useCartStore()

    cart.addItem(makeProduct('p-1', 45000, 36000))
    cart.addItem(makeProduct('p-2', 30000))

    expect(cart.subtotal).toBe(75000)
    expect(cart.totalDiscount).toBe(9000)
    expect(cart.total).toBe(66000)
  })

  it('persiste el carrito en localStorage', async () => {
    const cart = useCartStore()

    cart.addItem(makeProduct('p-1', 45000))
    await nextTick()

    expect(globalThis.localStorage.getItem('bap_cart')).toContain('"id":"p-1"')
  })
})
