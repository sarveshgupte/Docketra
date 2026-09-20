import { useEffect } from 'react';

const DEFAULT_ORIGIN = 'https://docketra.in';
const DEFAULT_TITLE = 'Docketra — The Company Brain for Indian Professional Firms';
const DEFAULT_DESC = 'Manage client dockets, deadlines, and task assignments in one place. Built for Indian CS, CA, and legal firms. Start free.';
const DEFAULT_IMAGE = 'https://docketra.in/og-image.png';

const setMetaTag = (attrName, attrValue, content) => {
  if (typeof document === 'undefined' || !content) return;
  let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const setCanonicalTag = (url) => {
  if (typeof document === 'undefined' || !url) return;
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
};

/**
 * Reusable client-side head manager for page-level SEO & OpenGraph tags
 */
export const SeoHead = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESC,
  canonicalPath = '/',
  canonicalUrl,
  ogImage = DEFAULT_IMAGE,
  ogType = 'website',
  jsonLd,
  noIndex = false,
}) => {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const originalTitle = document.title;
    document.title = title;

    const resolvedCanonical = canonicalUrl || `${DEFAULT_ORIGIN}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`;

    setMetaTag('name', 'description', description);
    setCanonicalTag(resolvedCanonical);

    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', resolvedCanonical);
    setMetaTag('property', 'og:image', ogImage);
    setMetaTag('property', 'og:type', ogType);

    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', title);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', ogImage);

    if (noIndex) {
      setMetaTag('name', 'robots', 'noindex, nofollow');
    } else {
      setMetaTag('name', 'robots', 'index, follow');
    }

    let scriptTag = document.getElementById('route-jsonld');
    if (jsonLd) {
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.id = 'route-jsonld';
        scriptTag.type = 'application/ld+json';
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(jsonLd);
    } else if (scriptTag) {
      scriptTag.remove();
    }

    return () => {
      document.title = originalTitle;
      const cleanupScript = document.getElementById('route-jsonld');
      if (cleanupScript) cleanupScript.remove();
    };
  }, [title, description, canonicalPath, canonicalUrl, ogImage, ogType, jsonLd, noIndex]);

  return null;
};

export default SeoHead;
