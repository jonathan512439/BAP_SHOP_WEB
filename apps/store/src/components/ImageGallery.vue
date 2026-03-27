<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface GalleryImage {
  r2_key: string
  url: string
  is_primary: boolean
  sort_order: number
}

const props = defineProps<{
  images: GalleryImage[]
  alt: string
}>()

const selectedUrl = ref<string | null>(null)

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

const navigate = (direction: 'prev' | 'next') => {
  if (!canNavigate.value) {
    return
  }

  const total = orderedImages.value.length
  const nextIndex =
    direction === 'prev' ? (selectedIndex.value - 1 + total) % total : (selectedIndex.value + 1) % total

  selectedUrl.value = orderedImages.value[nextIndex]?.url ?? selectedUrl.value
}
</script>

<template>
  <div class="gallery glass-card">
    <div class="hero-frame">
      <img v-if="selectedImage" :src="selectedImage.url" :alt="alt" class="hero-image" />
      <div v-else class="hero-image empty-image">Sin imagen</div>

      <template v-if="canNavigate">
        <button type="button" class="nav-btn nav-prev" @click="navigate('prev')">‹</button>
        <button type="button" class="nav-btn nav-next" @click="navigate('next')">›</button>
      </template>
    </div>

    <div v-if="orderedImages.length" class="thumbs">
      <button
        v-for="image in orderedImages"
        :key="image.r2_key"
        type="button"
        class="thumb"
        :class="{ active: selectedImage?.url === image.url }"
        @click="selectImage(image.url)"
      >
        <img :src="image.url" :alt="alt" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.gallery {
  padding: 1.25rem;
}

.hero-frame {
  position: relative;
}

.hero-image {
  width: 100%;
  aspect-ratio: 1;
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
  font-size: 1.4rem;
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
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
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
  height: 72px;
  object-fit: cover;
  display: block;
}
</style>
