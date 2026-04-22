<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

interface GalleryImage {
  r2_key: string
  url: string
  variants?: {
    thumb_url: string | null
    card_url: string | null
    detail_url: string | null
    full_url: string | null
  } | null
  is_primary: boolean
  sort_order: number
}

const props = defineProps<{
  images: GalleryImage[]
  alt: string
}>()

const selectedUrl = ref<string | null>(null)
const isLightboxOpen = ref(false)

const orderedImages = computed(() => {
  return [...props.images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) {
      return a.is_primary ? -1 : 1
    }

    return a.sort_order - b.sort_order
  })
})

const selectedIndex = computed(() => {
  if (!selectedUrl.value) {
    return 0
  }

  const index = orderedImages.value.findIndex((image) => image.url === selectedUrl.value)
  return index >= 0 ? index : 0
})

const selectedImage = computed(() => orderedImages.value[selectedIndex.value] ?? null)
const canNavigate = computed(() => orderedImages.value.length > 1)

watch(
  orderedImages,
  (images) => {
    selectedUrl.value = images[0]?.url ?? null
  },
  { immediate: true }
)

const selectImage = (url: string) => {
  selectedUrl.value = url
}

const imageNumber = (r2Key: string) => orderedImages.value.findIndex((image) => image.r2_key === r2Key) + 1

const getVariantUrl = (image: GalleryImage | null, variant: 'thumb_url' | 'detail_url' | 'full_url') => {
  if (!image) return ''
  return image.variants?.[variant] || image.url
}

const navigate = (direction: 'prev' | 'next') => {
  if (!canNavigate.value) {
    return
  }

  const total = orderedImages.value.length
  const nextIndex =
    direction === 'prev' ? (selectedIndex.value - 1 + total) % total : (selectedIndex.value + 1) % total

  selectedUrl.value = orderedImages.value[nextIndex]?.url ?? selectedUrl.value
}

const openLightbox = () => {
  if (!selectedImage.value) {
    return
  }

  isLightboxOpen.value = true
}

const closeLightbox = () => {
  isLightboxOpen.value = false
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!isLightboxOpen.value) return

  if (event.key === 'Escape') {
    closeLightbox()
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    navigate('prev')
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    navigate('next')
  }
}

watch(isLightboxOpen, (open) => {
  if (open) {
    window.addEventListener('keydown', handleKeydown)
    return
  }

  window.removeEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="gallery glass-card">
    <div class="hero-frame">
      <button
        v-if="selectedImage"
        type="button"
        class="hero-trigger"
        :aria-label="`Abrir imagen completa de ${alt}`"
        @click="openLightbox"
      >
        <img :src="getVariantUrl(selectedImage, 'detail_url')" :alt="alt" class="hero-image" decoding="async" />
      </button>
      <div v-else class="hero-image empty-image">Sin imagen</div>

      <template v-if="canNavigate">
        <button type="button" class="nav-btn nav-prev" aria-label="Imagen anterior" @click="navigate('prev')">&lsaquo;</button>
        <button type="button" class="nav-btn nav-next" aria-label="Siguiente imagen" @click="navigate('next')">&rsaquo;</button>
      </template>
    </div>

    <div v-if="orderedImages.length" class="thumbs">
      <button
        v-for="image in orderedImages"
        :key="image.r2_key"
        type="button"
        class="thumb"
        :class="{ active: selectedImage?.url === image.url }"
        :aria-label="`Ver imagen ${imageNumber(image.r2_key)} de ${orderedImages.length}`"
        :aria-pressed="selectedImage?.url === image.url"
        @click="selectImage(image.url)"
      >
        <img
          :src="getVariantUrl(image, 'thumb_url')"
          :alt="`${alt} miniatura ${imageNumber(image.r2_key)}`"
          loading="lazy"
          decoding="async"
        />
      </button>
    </div>
  </div>

  <div
    v-if="isLightboxOpen && selectedImage"
    class="lightbox"
    role="dialog"
    aria-modal="true"
    :aria-label="`Visor de imagenes de ${alt}`"
    @click.self="closeLightbox"
  >
    <button type="button" class="lightbox-close" aria-label="Cerrar visor" @click="closeLightbox">×</button>

    <button
      v-if="canNavigate"
      type="button"
      class="lightbox-nav lightbox-prev"
      aria-label="Imagen anterior"
      @click.stop="navigate('prev')"
    >
      &lsaquo;
    </button>

    <div class="lightbox-frame">
      <img :src="getVariantUrl(selectedImage, 'full_url')" :alt="alt" class="lightbox-image" decoding="async" />
    </div>

    <button
      v-if="canNavigate"
      type="button"
      class="lightbox-nav lightbox-next"
      aria-label="Siguiente imagen"
      @click.stop="navigate('next')"
    >
      &rsaquo;
    </button>
  </div>
</template>

<style scoped>
.gallery {
  padding: 1.75rem;
}

.hero-frame {
  position: relative;
}

.hero-trigger {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}

.hero-image {
  width: 100%;
  aspect-ratio: 1 / 1.14;
  object-fit: cover;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
}

.empty-image {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(12, 15, 24, 0.72);
  color: var(--text-primary);
  font-size: 1.5rem;
  line-height: 1;
}

.nav-prev {
  left: 0.9rem;
}

.nav-next {
  right: 0.9rem;
}

.thumbs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 0.9rem;
  margin-top: 1.15rem;
}

.thumb {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  overflow: hidden;
  padding: 0;
  background: transparent;
}

.thumb.active {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 1px rgba(244, 114, 182, 0.16);
}

.thumb img {
  width: 100%;
  height: 104px;
  object-fit: cover;
  display: block;
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: rgba(7, 10, 16, 0.92);
  backdrop-filter: blur(10px);
}

.lightbox-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.lightbox-image {
  max-width: min(92vw, 1240px);
  max-height: 88vh;
  width: auto;
  height: auto;
  border-radius: var(--radius-md);
  object-fit: contain;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.45);
}

.lightbox-close,
.lightbox-nav {
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(12, 15, 24, 0.78);
  color: var(--text-primary);
}

.lightbox-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 46px;
  height: 46px;
  border-radius: 999px;
  font-size: 1.8rem;
  line-height: 1;
}

.lightbox-nav {
  width: 52px;
  height: 52px;
  border-radius: 999px;
  font-size: 1.8rem;
  line-height: 1;
}

@media (max-width: 720px) {
  .gallery {
    padding: 1.1rem;
  }

  .hero-image {
    aspect-ratio: 1 / 1.08;
  }

  .thumbs {
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 0.7rem;
  }

  .thumb img {
    height: 88px;
  }

  .lightbox {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    padding: 1rem 0.9rem 1.25rem;
  }

  .lightbox-frame {
    order: 1;
  }

  .lightbox-image {
    max-width: 100%;
    max-height: 78vh;
  }

  .lightbox-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 46px;
    height: 46px;
  }

  .lightbox-prev {
    left: 0.75rem;
  }

  .lightbox-next {
    right: 0.75rem;
  }
}
</style>
