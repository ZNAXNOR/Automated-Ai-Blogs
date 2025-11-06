import axios from "axios";
import * as cheerio from "cheerio";

export interface UrlContext {
  url: string;
  title?: string;
  description?: string;
  text?: string;
  images: string[];
  lang?: string | null;
}

export async function fetchUrlContext(rawUrl: string): Promise<UrlContext> {
  const res = await axios.get(rawUrl, {
    timeout: 10_000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
  });
  const html = res.data as string;
  const $ = cheerio.load(html);

  const title =
    $("meta[property='og:title']").attr("content") ||
    $("meta[name='twitter:title']").attr("content") ||
    $("title").text() ||
    undefined;

  const description =
    $("meta[name='description']").attr("content") ||
    $("meta[property='og:description']").attr("content") ||
    $("meta[name='twitter:description']").attr("content") ||
    undefined;

  const images: string[] = [];
  const ogImage = $("meta[property='og:image']").attr("content");
  if (ogImage) images.push(ogImage);
  $("img").slice(0, 5).each((i, el) => {
    const src = $(el).attr("src");
    if (src) images.push(src);
  });

  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

  const lang = $("html").attr("lang") || null;

  return {
    url: rawUrl,
    title,
    description,
    text,
    images,
    lang,
  };
}
