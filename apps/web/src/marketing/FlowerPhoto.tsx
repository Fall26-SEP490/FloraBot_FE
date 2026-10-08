import type { FlowerPhoto as Photo } from '@florabot/ui/flower-photos';
export default function FlowerPhoto({
  photo,
  sizes = '(max-width: 700px) 44vw, 22vw',
  alt = photo.alt,
  className,
}: {
  photo: Photo;
  sizes?: string;
  alt?: string;
  className?: string;
}) {
  return (
    <picture>
      <source type="image/avif" srcSet={photo.avifSrcSet} sizes={sizes} />
      <img
        src={photo.src}
        srcSet={photo.webpSrcSet}
        sizes={sizes}
        width={photo.width}
        height={photo.height}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}
