---
eleventyComputed:
  title: "{{ album.name }}"
  description: "Photos from {{ album.name }}, {{ album.dates}}"
  image: "{{ album.file | replace('images.jaredpendergraft.com', 'images.jaredpendergraft.com/cdn-cgi/image/w=1200,h=630,fit=cover,f=auto,q=auto,metadata=none') }}"
pageClass: detail
pagination:
  data: albums
  alias: album
  size: 1
permalink: albums/{{ album.directory }}/index.html
layout: detail.webc
---

<photo webc:for="(photo, index) of this[album.directory]" :photo="photo" :index="index + 1" :prevdisabled="index === 0 ? true:false" :nextdisabled="index + 1 === this[album.directory].length ? true:false" webc:nokeep></photo>
