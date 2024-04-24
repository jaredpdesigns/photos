---
pageClass: detail
pagination:
  data: albums
  alias: album
  size: 1
permalink: albums/{{ album.directory }}/index.html
layout: detail.webc
eleventyComputed:
  title: "📷 from {{ album.name }} • {{ album.dates }}"
  description: "Photos from {{ album.name }}, {{ album.dates}}"
---

<photo webc:for="(photo, index) of this.photoData.filter(item => item.directory === album.directory)" :photo="photo" :index="index + 1" :prevdisabled="index === 0 ? true:false" :nextdisabled="index + 1 === this.photoData.filter(item => item.directory === album.directory).length ? true:false" webc:nokeep></photo>
