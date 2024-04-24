---
title: 📷 from Around the World
description: Photos from My Trips Around the World
pageClass: overview
layout: overview.webc
---

<a class="radius__m shadow" webc:for="album of this.albums" :href="`/albums/${album.directory}`">
    <photo-card :token="this.mapbox" :album="album" sizes="(min-width: 640px) 960px, 480px"
    widths="480, 960" webc:nokeep></photo-card>
</a>
