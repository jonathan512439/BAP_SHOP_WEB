import type { Order, OrderItem, CatalogCard } from './types'
import { formatPrice } from './utils'
import { DEFAULT_WHATSAPP_TEMPLATE } from './constants'

// ============================================================
// GENERADOR DE MENSAJE Y URL DE WHATSAPP
// ============================================================

export interface WhatsAppSettings {
  whatsapp_number: string // formato: 5491112345678 (sin + ni espacios)
  store_name: string
  whatsapp_header: string // texto de cabecera personalizable
  whatsapp_template?: string
}

/**
 * Construye un mensaje con formato tipo recibo para que el cliente lo envíe
 * por WhatsApp y el admin lo identifique rápido en el panel.
 */
export function buildWhatsappMessage(
  order: Pick<Order, 'order_code' | 'customer_name' | 'customer_phone' | 'subtotal' | 'discount' | 'total'>,
  items: OrderItem[],
  settings: WhatsAppSettings
): string {
  const renderedItems = renderItems(items)
  const template = settings.whatsapp_template?.trim() || DEFAULT_WHATSAPP_TEMPLATE
  const whatsappHeader = settings.whatsapp_header?.trim() || ''
  const discountBlock = order.discount > 0 ? `Descuento: -${formatPrice(order.discount)}` : ''
  const headerBlock = whatsappHeader ? whatsappHeader : ''
  const replacements = [
    ['{{store_name}}', settings.store_name],
    ['{{store_name_upper}}', settings.store_name.toUpperCase()],
    ['{{whatsapp_header}}', whatsappHeader],
    ['{{whatsapp_header_block}}', headerBlock],
    ['{{order_code}}', order.order_code],
    ['{{customer_name}}', order.customer_name],
    ['{{customer_phone}}', order.customer_phone],
    ['{{items}}', renderedItems],
    ['{{subtotal}}', formatPrice(order.subtotal)],
    ['{{discount}}', formatPrice(order.discount)],
    ['{{discount_block}}', discountBlock],
    ['{{total}}', formatPrice(order.total)],
  ] as const

  return normalizeTemplateOutput(
    replacements.reduce((output, [token, value]) => output.split(token).join(value), template)
  )
}

function renderItems(items: OrderItem[]): string {
  const lines: string[] = []

  items.forEach((item, index) => {
    if (index > 0) lines.push('')
    lines.push(`${index + 1}. *${item.product_name}*`)
    if (item.product_size) {
      lines.push(`   Talla: ${item.product_size}`)
    }
    lines.push(`   Precio base: ${formatPrice(item.unit_price)}`)
    if (item.promo_price !== null && item.promo_price !== item.unit_price) {
      lines.push(`   Precio promo: ${formatPrice(item.promo_price)}`)
    }
    lines.push(`   Precio final: *${formatPrice(item.final_price)}*`)
  })

  return lines.join('\n')
}

function normalizeTemplateOutput(message: string): string {
  return message
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Construye la URL completa de WhatsApp con el mensaje pre-llenado.
 * Nota: el cliente puede editar el mensaje antes de enviarlo.
 */
export function buildWhatsappUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[\s+\-()]/g, '')
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}

/**
 * Calcula el precio final de una card del catalogo considerando la promo activa.
 */
export function getEffectivePrice(card: CatalogCard): number {
  return card.promo_price !== null ? card.promo_price : card.price
}
