---
title: 📷 from Around the World
description: Photos from My Trips Around the World
pageClass: overview
layout: overview.webc
---

<ul class="flow__grid flow__gap--m cards" :style="`--numcards: ${this.albums.length}`">
    <li webc:for="(album,index) of this.albums" :style="`--index: ${index + 1}`">
        <a class="flow__block radius__m" :href="`/albums/${album.directory}`">
            <photo-card :token="this.mapbox" :album="album" sizes="(min-width: 640px) 960px, 480px"
            widths="480, 960" webc:nokeep></photo-card>
        </a>
    </li>
</ul>
