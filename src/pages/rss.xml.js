// src/pages/rss.xml.js
// RSS Feed do Protetor Digital
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog');
  const sorted = posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const siteUrl = 'https://protetordigital.com';

  const items = sorted.map(post => {
    const url = `${siteUrl}/blog/${post.slug}`;
    const pubDate = post.data.pubDate.toUTCString();
    const image = post.data.image ? `${siteUrl}${post.data.image}` : null;

    return `
    <item>
      <title><![CDATA[${post.data.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description><![CDATA[${post.data.description}]]></description>
      <pubDate>${pubDate}</pubDate>
      <author>contato@protetordigital.com (${post.data.author})</author>
      ${post.data.tags.map(t => `<category>${t}</category>`).join('\n      ')}
      ${image ? `<enclosure url="${image}" type="image/webp" />` : ''}
    </item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Protetor Digital — Blog de Segurança</title>
    <link>${siteUrl}</link>
    <description>Artigos sobre cibersegurança e proteção digital para o brasileiro.</description>
    <language>pt-BR</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <managingEditor>contato@protetordigital.com (Equipe PD)</managingEditor>
    <webMaster>contato@protetordigital.com (Equipe PD)</webMaster>
    <ttl>1440</ttl>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${siteUrl}/favicon.svg</url>
      <title>Protetor Digital</title>
      <link>${siteUrl}</link>
    </image>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
