<template>
  <v-container class="r-about" max-width="1100">
    <header class="r-about-header">
      <h1 class="r-about-title">ABOUT</h1>
      <p class="r-about-sub">The team behind ResistanceOnline.</p>
    </header>

    <!-- 2x2 grid of contributors. -->
    <section class="r-team-grid">
      <ContributorCard
        :ascii-art="logoArt"
        bio="Hi, I'm Matt — a software developer and Computer Science student at the University of Illinois Urbana-Champaign."
        :links="mattLinks"
        name="MATTHEW HIRSTIUS"
      />

      <ContributorCard
        bio="Hey, my name is Joseph Habisohn and I am studying Computer Science at the University of Illinois at Urbana-Champaign. My current interests include the creation of person-first software and the application of software in robotics"
        :image-src="joePic"
        :links="joeLinks"
        name="JOSEPH HABISOHN"
      />

      <ContributorCard
        bio="Placeholder bio for the third contributor."
        :links="placeholderLinks"
        name="CONTRIBUTOR THREE"
      />

      <ContributorCard
        bio="Placeholder bio for the fourth contributor."
        :links="placeholderLinks"
        name="CONTRIBUTOR FOUR"
      />
    </section>
  </v-container>
</template>

<script setup lang="ts">
  import joePic from '@assets/JoeSax.jpg'
  import logoArt from '@/assets/personal-logo.txt?raw'
  import ContributorCard from '@/components/ContributorCard.vue'

  const mattLinks = [
    { label: 'GitHub', href: 'https://github.com/Nioron07', icon: 'mdi-github' },
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/matthew-hirstius-b43334316/',
      icon: 'mdi-linkedin',
    },
  ]
  const joeLinks = [
    { label: 'GitHub', href: 'https://github.com/joebewon', icon: 'mdi-github' },
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/joseph-habisohn-a6245a321/',
      icon: 'mdi-linkedin',
    },
  ]
  // Placeholder until the other three contributors fill in their links.
  const placeholderLinks = [{ label: 'GitHub', href: '#', icon: 'mdi-github' }]
</script>

<style scoped>
.r-about {
  padding-top: 32px;
  padding-bottom: 64px;
}

.r-about-header {
  margin-bottom: 24px;
}
.r-about-title {
  font-size: 2rem;
  font-weight: 300;
  letter-spacing: 0.04em;
  margin: 0;
}
.r-about-sub {
  color: rgb(var(--v-theme-on-surface-muted));
  font-size: 0.825rem;
  letter-spacing: 0.04em;
  margin-top: 4px;
}

/* 2x2 on desktop, 1 column on mobile. */
.r-team-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
@media (max-width: 720px) {
  .r-team-grid {
    grid-template-columns: 1fr;
  }
}

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
