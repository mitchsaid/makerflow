import React from 'react';

export function getProductPhotoUrl(photo?: string, fallbackSeed: string = 'product'): string {
  if (!photo || photo.trim() === '') {
    return `https://picsum.photos/seed/${encodeURIComponent(fallbackSeed)}/400/400`;
  }
  
  // Unsplash CDN URLs frequently block hotlinks or sandboxed requests with CORS/403 errors.
  // Convert unsplash URLs to picsum seeds using the photo ID for 100% reliable loading.
  if (photo.includes('unsplash.com')) {
    const match = photo.match(/photo-([a-zA-Z0-9-]+)/);
    const photoId = match ? match[1] : fallbackSeed;
    return `https://picsum.photos/seed/${photoId}/400/400`;
  }
  
  return photo;
}

export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>, fallbackSeed: string = 'craft') {
  const target = e.currentTarget;
  const fallbackUrl = `https://picsum.photos/seed/${encodeURIComponent(fallbackSeed)}/400/400`;
  if (target.src !== fallbackUrl) {
    target.src = fallbackUrl;
  }
}
