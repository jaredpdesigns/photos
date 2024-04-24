---
title: Travels Around the World
description: Photos from trips around the world
pageClass: overview
layout: page.webc
---

<header class="flow__flex flow__align--block-center flow__align--inline-between padding__m">
  <p><strong>Photos from Around the World</strong></p>
  <button class="flow__inline flow__align--block-center flow__align--inline-center" onclick="toggleTheme()"
    title="Toggle website theme">
    <icon name="moon" size="24" webc:nokeep></icon>
    <icon name="sun" size="24" webc:nokeep></icon>
  </button>
</header>
<section>
    <a class="radius__m shadow" webc:for="album of this.albums" :href="`/albums/${album.directory}`">
        <photo-card :token="this.mapbox" :album="album" sizes="(min-width: 640px) 960px, 480px"
        widths="480, 960" webc:nokeep></photo-card>
    </a>
</section>
