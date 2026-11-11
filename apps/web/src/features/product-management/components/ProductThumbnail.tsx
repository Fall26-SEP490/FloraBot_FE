'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flower2 } from '@florabot/ui';
import { fetchProductPhotos } from '../product.api';
import { safeImage } from '../product.utils';

export default function ProductThumbnail({
  sellerId,
  productId,
  productName,
  className = 'product-flower-icon',
}: {
  sellerId: string;
  productId: string;
  productName: string;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photos = useQuery({
    queryKey: ['product-photos', sellerId, productId, 1],
    queryFn: () => fetchProductPhotos(productId, 1),
    enabled: Boolean(productId),
    staleTime: 60_000,
  });
  const url = photos.data?.items?.[0]?.url;
  const showImage = url && safeImage(url) && failedUrl !== url;

  return (
    <span
      className={showImage ? `${className} has-thumb` : className}
      aria-hidden={showImage ? undefined : 'true'}
    >
      {showImage ? (
        <img
          src={url}
          alt={`Ảnh ${productName}`}
          className="product-flower-thumb"
          width="48"
          height="52"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <Flower2 size={22} aria-hidden="true" />
      )}
    </span>
  );
}
