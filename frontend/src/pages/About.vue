<template>
  <v-container class="r-about" max-width="900">
    <!-- Personal logo (ASCII) ----------------------------------------- -->
    <div class="r-logo-frame">
      <pre aria-label="Personal logo" class="r-logo">{{ logoArt }}</pre>
    </div>

    <!-- Identity strip ------------------------------------------------ -->
    <header class="r-identity">
      <div class="r-identity-text">
        <h1 class="r-name">YOUR NAME</h1>
      </div>
    </header>

    <!-- Bio ----------------------------------------------------------- -->
    <v-card class="r-section r-card-hover side-resistance pa-5">
      <h2 class="r-section-title">ABOUT ME</h2>

      <p class="r-prose">
        Hi, I'm Matt — a software developer and Computer Science student at the University of Illinois Urbana-Champaign.
      </p>
    </v-card>

    <!-- Links --------------------------------------------------------- -->
    <v-card class="r-section r-card-hover pa-5">
      <h2 class="r-section-title">LINKS</h2>

      <ul class="r-link-list">
        <li>
          <span class="r-link-label">GITHUB</span>
          <a class="r-link" href="#" rel="noopener noreferrer" target="_blank">https://github.com/Nioron07</a>
        </li>

        <li>
          <span class="r-link-label">LINKEDIN</span>
          <a class="r-link" href="#" rel="noopener noreferrer" target="_blank">https://www.linkedin.com/in/matthew-hirstius-b43334316/</a>
        </li>
      </ul>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
  import logoArt from '@/assets/personal-logo.txt?raw'
</script>

<style scoped>
.r-about {
  padding-top: 32px;
  padding-bottom: 64px;
}

/* ------------ logo hero ------------ */
.r-logo-frame {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
  /* Tight border around the logo, subtle accent that matches the theme. */
  padding: 12px;
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 12px;
  background-color: rgb(var(--v-theme-surface));
  /* If the rendered art is wider than the screen, allow horizontal scroll
     rather than overflowing the page. */
  overflow-x: auto;
}
.r-logo {
  /* Mono is already site-wide, but be explicit so the columns line up. */
  font-family: var(--r-mono);
  /* Each glyph is small enough that the ~200-column art fits on most
     desktop widths; clamp keeps it readable but tiny on phones too. */
  font-size: clamp(2px, 0.55vw, 5px);
  line-height: 1;
  letter-spacing: 0;
  white-space: pre;
  margin: 0;
  color: var(--r-resistance);
  user-select: none;
  /* Faint glow gives the mark a stamped/etched feel matching the theme. */
  text-shadow: 0 0 6px rgba(59, 130, 246, 0.25);
}

/* ------------ identity strip ------------ */
.r-identity {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}
.r-identity-text {
  flex: 1;
  min-width: 0;
}
.r-name {
  font-size: 1.8rem;
  font-weight: 300;
  letter-spacing: 0.06em;
  margin: 0;
}
.r-tagline {
  color: rgb(var(--v-theme-on-surface-muted));
  font-size: 0.825rem;
  letter-spacing: 0.04em;
  margin: 4px 0 0;
}
.r-identity-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.r-meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 4px;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  color: rgb(var(--v-theme-on-surface));
}

/* ------------ section cards ------------ */
.r-section {
  background-color: rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgb(var(--v-theme-border)) !important;
  margin-bottom: 16px;
}
.r-section-title {
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  color: var(--r-resistance);
  margin: 0 0 12px;
  font-weight: 500;
}
.r-section-title-spy {
  color: var(--r-spy);
}

.r-prose {
  font-size: 0.9rem;
  line-height: 1.6;
  color: rgb(var(--v-theme-on-surface));
  margin: 0;
}

/* ------------ stack ------------ */
.r-stack-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
@media (max-width: 600px) {
  .r-stack-grid { grid-template-columns: 1fr; }
}
.r-stack-col {
  background-color: rgb(var(--v-theme-surface-elevated));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 8px;
  padding: 12px;
}
.r-stack-label {
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: rgb(var(--v-theme-on-surface-muted));
  margin-bottom: 8px;
}
.r-tag-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.r-tag-list li {
  font-size: 0.75rem;
  padding: 2px 8px;
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 4px;
  color: rgb(var(--v-theme-on-surface));
}

/* ------------ projects ------------ */
.r-project-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.r-project {
  border-left: 2px solid rgb(var(--v-theme-border));
  padding-left: 12px;
}
.r-project-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.r-project-name {
  font-size: 0.95rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: rgb(var(--v-theme-on-surface));
}
.r-project-year {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-on-surface-muted));
}
.r-project-blurb {
  margin: 4px 0 0;
  font-size: 0.825rem;
  line-height: 1.55;
  color: rgb(var(--v-theme-on-surface-muted));
}

/* ------------ links ------------ */
.r-link-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
}
.r-link-list li {
  display: flex;
  gap: 12px;
  align-items: baseline;
}
.r-link-label {
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-on-surface-muted));
  text-transform: uppercase;
  font-size: 0.7rem;
  width: 100px;
  flex-shrink: 0;
}
.r-link {
  color: var(--r-resistance);
  text-decoration: none;
  transition: color 200ms ease-out;
}
.r-link:hover {
  color: rgb(var(--v-theme-on-surface));
  text-decoration: underline;
}

/* ------------ footer ------------ */
.r-about-footer {
  margin-top: 32px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  color: rgb(var(--v-theme-on-surface-muted));
  text-transform: uppercase;
}
.r-sep {
  opacity: 0.6;
}
</style>
