const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) || [];
}

export async function fetchLinkPreview(url: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
} | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Rhome-App/1.0' },
    });
    const html = await response.text();

    const getMetaContent = (property: string): string | undefined => {
      const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
      const altRegex = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`, 'i');
      return regex.exec(html)?.[1] || altRegex.exec(html)?.[1];
    };

    return {
      title: getMetaContent('og:title') || getMetaContent('twitter:title'),
      description: getMetaContent('og:description') || getMetaContent('twitter:description'),
      image: getMetaContent('og:image') || getMetaContent('twitter:image'),
      siteName: getMetaContent('og:site_name'),
    };
  } catch {
    return null;
  }
}
