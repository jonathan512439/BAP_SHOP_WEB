import { describe, it, expect } from 'vitest'
import { buildWhatsappMessage, buildWhatsappUrl } from '@bap-shop/shared'

describe('WhatsApp Utils', () => {
  it('buildWhatsappUrl should correctly encode a message and generate URL', () => {
    const number = '+5491112345678'
    const message = 'Hola, quiero el pedido BAP-1234'
    const expected = 'https://wa.me/5491112345678?text=Hola%2C%20quiero%20el%20pedido%20BAP-1234'

    const result = buildWhatsappUrl(number, message)
    expect(result).toBe(expected)
  })

  it('buildWhatsappMessage should generate a proper message WITH size and NO discount', () => {
    const order = {
      order_code: 'BAP-20261111-A1B2',
      customer_name: 'Juan Perez',
      customer_phone: '+12345',
      subtotal: 100000,
      discount: 0,
      total: 100000
    }
    const items = [
      {
        id: '1',
        order_id: '1',
        product_id: 'p1',
        product_name: 'Nike Air Max',
        product_type: 'sneaker',
        product_size: '9.5 US',
        unit_price: 100000,
        promo_price: null,
        final_price: 100000
      }
    ]
    const settings = {
      whatsapp_number: '123',
      store_name: 'BAP Shop',
      whatsapp_header: '¡Hola! Te dejo los datos de mi pedido:'
    }

    const message = buildWhatsappMessage(order, items as any, settings)

    expect(message).toContain('¡Hola! Te dejo los datos de mi pedido:')
    expect(message).toContain('Código: #BAP-20261111-A1B2')
    expect(message).toContain('Nike Air Max')
    expect(message).toContain('Talla 9.5 US')
    expect(message).toContain('$100.000') // formated price
    expect(message).not.toContain('Descuento')
  })

  it('buildWhatsappMessage should handle items WITHOUT size and WITH discount', () => {
    const order = {
      order_code: 'BAP-9999-ABCD',
      customer_name: 'Ana',
      customer_phone: '123',
      subtotal: 50000,
      discount: 10000,
      total: 40000
    }
    const items = [
      {
        id: '2',
        order_id: '1',
        product_id: 'p2',
        product_name: 'Supreme T-Shirt',
        product_type: 'other',
        product_size: null,
        unit_price: 50000,
        promo_price: 40000,
        final_price: 40000
      }
    ]

    const message = buildWhatsappMessage(order, items as any, { store_name: 'Shop', whatsapp_number: '123', whatsapp_header: '' })

    expect(message).toContain('Supreme T-Shirt')
    expect(message).not.toContain('Talla')
    expect(message).toContain('Subtotal: $50.000')
    expect(message).toContain('Descuento: −$10.000')
    expect(message).toContain('Total: $40.000')
  })
})
