---
pageClass: detail
pagination:
  data: albums
  alias: album
  size: 1
permalink: albums/{{ album.directory }}/index.html
layout: page.webc
eleventyComputed:
  title: "{{ album.name }} • {{ album.dates }}"
  description: "Photos from {{ album.name }}, {{ album.dates}}"
---

<photo-header :token="this.mapbox" :album="album" webc:nokeep></photo-header>

<section class="color__bg--contrast flow__grid flow__gap--m padding__m">
<photo webc:for="(photo, index) of this.photoData.filter(item => item.directory === album.directory)" :photo="photo" :index="index + 1" :prevdisabled="index === 0 ? true:false" :nextdisabled="index + 1 === this.photoData.filter(item => item.directory === album.directory).length ? true:false" webc:nokeep></photo>
</section>
