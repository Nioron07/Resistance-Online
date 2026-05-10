<template>
  <article class="r-contrib r-card-hover">
    <!-- Hero: ASCII art OR image OR fallback icon. -->
    <div class="r-contrib-hero" :class="heroClass">
      <pre v-if="asciiArt" aria-hidden="true" class="r-contrib-ascii">{{
        asciiArt
      }}</pre>

      <img
        v-else-if="imageSrc"
        :alt="`${name} portrait`"
        class="r-contrib-img"
        :src="imageSrc"
      />

      <div v-else class="r-contrib-fallback">
        <v-icon icon="mdi-account" size="64" />
      </div>
    </div>

    <h2 class="r-contrib-name">{{ name }}</h2>

    <p v-if="bio" class="r-contrib-bio">{{ bio }}</p>

    <ul v-if="links && links.length > 0" class="r-contrib-links">
      <li v-for="link in links" :key="link.href">
        <a
          class="r-contrib-link"
          :href="link.href"
          rel="noopener noreferrer"
          target="_blank"
        >
          <v-icon
            v-if="link.icon"
            class="mr-1"
            :icon="link.icon"
            size="x-small"
          />
          {{ link.label }}
        </a>
      </li>
    </ul>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface ContribLink {
  label: string;
  href: string;
  icon?: string;
}

const props = withDefaults(
  defineProps<{
    name: string;
    bio?: string;
    /** Mutually exclusive with imageSrc — if both are present, ASCII wins. */
    asciiArt?: string;
    imageSrc?: string;
    links?: ContribLink[];
  }>(),
  {
    bio: "",
    asciiArt: "",
    imageSrc: "",
    links: () => [],
  },
);

/**
 * Different hero kinds need slightly different padding / sizing rules.
 * The class hook lets us scope those without conflating selectors.
 */
const heroClass = computed(() => ({
  "r-contrib-hero-ascii": !!props.asciiArt,
  "r-contrib-hero-img": !props.asciiArt && !!props.imageSrc,
  "r-contrib-hero-empty": !props.asciiArt && !props.imageSrc,
}));
</script>

<style scoped>
.r-contrib {
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ---------- hero ---------- */
.r-contrib-hero {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgb(var(--v-theme-surface-elevated));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 8px;
  margin-bottom: 6px;
  height: 300px;
  overflow: hidden;
}

/* Image hero: contain inside a square, keep aspect. */
.r-contrib-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

/* ASCII hero: tiny mono so the wide art fits within a half-page card. */
.r-contrib-hero-ascii {
  padding: 6px;
}
.r-contrib-ascii {
  font-family: var(--r-mono);
  /* Tighter than the standalone hero variant — these cards are ~half page wide. */
  font-size: clamp(1.4px, 0.34vw, 3px);
  line-height: 1;
  letter-spacing: 0;
  white-space: pre;
  margin: 0;
  color: var(--r-resistance);
  user-select: none;
  text-shadow: 0 0 4px rgba(59, 130, 246, 0.25);
}

/* Fallback icon when neither ASCII nor image is provided. */
.r-contrib-fallback {
  color: rgb(var(--v-theme-on-surface-muted));
}

/* ---------- text ---------- */
.r-contrib-name {
  font-size: 1.1rem;
  font-weight: 400;
  letter-spacing: 0.04em;
  margin: 4px 0 0;
}
.r-contrib-bio {
  font-size: 0.85rem;
  line-height: 1.55;
  color: rgb(var(--v-theme-on-surface));
  margin: 4px 0 0;
}

/* ---------- links ---------- */
.r-contrib-links {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.r-contrib-links li {
  display: inline-flex;
}
.r-contrib-link {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 4px;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--r-resistance);
  text-decoration: none;
  transition:
    color 200ms ease-out,
    border-color 200ms ease-out;
}
.r-contrib-link:hover {
  color: rgb(var(--v-theme-on-surface));
  border-color: rgba(203, 213, 225, 0.18);
}
</style>
