import { describe, it, expect } from 'vitest'
import { buildWhatsappMessage, buildWhatsappUrl, DEFAULT_WHATSAPP_TEMPLATE } from '@bap-shop/shared'

describe('WhatsApp Utils', () => {
  it('buildWhatsappUrl should correctly encode a message and generate URL', () => {
    const number = '+5491112345678'
    const message = 'Hola, quiero el pedido BAP-1234'
    const expected = 'https://wa.me/5491112345678?text=Hola%2C%20quiero%20el%20pedido%20BAP-1234'

    const result = buildWhatsappUrl(number, message)
    expect(result).toBe(expected)
  })

  it('buildWhatsappMessage should generate a premium minimalist receipt-like message with size and no discount', () => {
    const order = {
      order_code: 'BAP-20261111-A1B2',
      customer_name: 'Juan Perez',
      customer_phone: '+12345',
      subtotal: 100000,
      discount: 0,
      total: 100000,
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
        final_price: 100000,
      },
    ]

    const settings = {
      whatsapp_number: '123',
      store_name: 'BAP Shop',
      whatsapp_header: 'Hola, quiero confirmar esta reserva',
      whatsapp_template: DEFAULT_WHATSAPP_TEMPLATE,
    }

    const message = buildWhatsappMessage(order, items as any, settings)

    expect(message).toContain('*BAP SHOP*')
    expect(message).toContain('*COMPROBANTE DE COMPRA*')
    expect(message).toContain('Hola, quiero confirmar esta reserva')
    expect(message).toContain('Pedido: *#BAP-20261111-A1B2*')
    expect(message).toContain('Cliente: *Juan Perez*')
    expect(message).toContain('*Detalle*')
    expect(message).toContain('1. *Nike Air Max*')
    expect(message).toContain('Talla: 9.5 US')
    expect(message).toContain('Precio base: Bs')
    expect(message).toContain('Precio final: *Bs')
    expect(message).toContain('Total: *Bs')
    expect(message).toContain('Comprobante generado para seguimiento y coordinacion de entrega.')
    expect(message).not.toContain('Descuento:')
  })

  it('buildWhatsappMessage should handle items without size and with discount', () => {
    const order = {
      order_code: 'BAP-9999-ABCD',
      customer_name: 'Ana',
      customer_phone: '123',
      subtotal: 50000,
      discount: 10000,
      total: 40000,
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
        final_price: 40000,
      },
    ]

    const message = buildWhatsappMessage(order, items as any, {
      store_name: 'Shop',
      whatsapp_number: '123',
      whatsapp_header: '',
      whatsapp_template: DEFAULT_WHATSAPP_TEMPLATE,
    })

    expect(message).toContain('1. *Supreme T-Shirt*')
    expect(message).not.toContain('Talla:')
    expect(message).toContain('Precio base: Bs')
    expect(message).toContain('Precio promo: Bs')
    expect(message).toContain('Subtotal: Bs')
    expect(message).toContain('Descuento: -Bs')
    expect(message).toContain('Total: *Bs')
  })

  it('buildWhatsappMessage should support a custom template with placeholders', () => {
    const message = buildWhatsappMessage(
      {
        order_code: 'BAP-ABCD',
        customer_name: 'Maria',
        customer_phone: '70000000',
        subtotal: 20000,
        discount: 3000,
        total: 17000,
      },
      [
        {
          id: '3',
          order_id: '1',
          product_id: 'p3',
          product_name: 'Jordan 4',
          product_type: 'sneaker',
          product_size: '42',
          unit_price: 20000,
          promo_price: 17000,
          final_price: 17000,
        },
      ] as any,
      {
        store_name: 'BAP Shop',
        whatsapp_number: '123',
        whatsapp_header: 'Atencion prioritaria',
        whatsapp_template: [
          'Hola equipo de {{store_name}}',
          '{{whatsapp_header_block}}',
          'Pedido {{order_code}}',
          '{{items}}',
          'Total final: {{total}}',
        ].join('\n'),
      }
    )

    expect(message).toContain('Hola equipo de BAP Shop')
    expect(message).toContain('Atencion prioritaria')
    expect(message).toContain('Pedido BAP-ABCD')
    expect(message).toContain('1. *Jordan 4*')
    expect(message).toContain('Total final: Bs')
  })
})
