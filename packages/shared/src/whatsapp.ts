import type { Order, OrderItem, CatalogCard } from './types'
import { formatPrice } from './utils'

// ============================================================
// GENERADOR DE MENSAJE Y URL DE WHATSAPP
// ============================================================

export interface WhatsAppSettings {
  whatsapp_number: string      // formato: 5491112345678 (sin + ni espacios)
  store_name: string
  whatsapp_header: string      // texto de cabecera personalizable
}

/**
 * Construye el mensaje de WhatsApp para un pedido.
 * El mensaje es editable por el cliente antes de enviarlo (limitación de WhatsApp).
 * El admin siempre debe verificar el pedido por order_code en el panel.
 */
export function buildWhatsappMessage(
  order: Pick<Order, 'order_code' | 'customer_name' | 'customer_phone' | 'subtotal' | 'discount' | 'total'>,
  items: OrderItem[],
  settings: WhatsAppSettings
): string {
  const lines: string[] = []

  // Cabecera
  lines.push(`🛍️ ${settings.store_name}${settings.whatsapp_header ? ' — ' + settings.whatsapp_header : ''}`)
  lines.push('')

  // Datos del pedido
  lines.push(`📋 Código: #${order.order_code}`)
  lines.push(`👤 Cliente: ${order.customer_name}`)
  lines.push(`📞 Teléfono: ${order.customer_phone}`)
  lines.push('')

  // Productos
  lines.push('🧾 Productos:')
  for (const item of items) {
    const sizeStr = item.product_size ? ` (Talla ${item.product_size})` : ''
    if (item.promo_price !== null && item.promo_price !== item.unit_price) {
      const discountPct = Math.round((1 - item.promo_price / item.unit_price) * 100)
      lines.push(
        `  • ${item.product_name}${sizeStr}`
      )
      lines.push(
        `    ${formatPrice(item.unit_price)} → ${formatPrice(item.promo_price)} (${discountPct}% off)`
      )
    } else {
      lines.push(`  • ${item.product_name}${sizeStr}`)
      lines.push(`    ${formatPrice(item.unit_price)}`)
    }
  }
  lines.push('')

  // Totales
  lines.push(`💰 Subtotal: ${formatPrice(order.subtotal)}`)
  if (order.discount > 0) {
    lines.push(`🏷️ Descuento: −${formatPrice(order.discount)}`)
  }
  lines.push(`✅ Total: ${formatPrice(order.total)}`)
  lines.push('')

  // Nota para el admin
  lines.push(`⚠️ Verificar pedido en el panel: #${order.order_code}`)

  return lines.join('\n')
}

/**
 * Construye la URL completa de WhatsApp con el mensaje pre-llenado.
 * Nota: el cliente puede editar el mensaje antes de enviarlo.
 */
export function buildWhatsappUrl(phone: string, message: string): string {
  // Limpiar el número: remover +, espacios y guiones
  const cleanPhone = phone.replace(/[\s+\-()]/g, '')
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}

/**
 * Calcula el precio final de una card del catálogo considerando la promo activa.
 */
export function getEffectivePrice(card: CatalogCard): number {
  return card.promo_price !== null ? card.promo_price : card.price
}
