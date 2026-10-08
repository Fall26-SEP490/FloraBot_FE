import { flowerPhotos } from '@florabot/ui/flower-photos';
import FlowerPhoto from './FlowerPhoto';
const collection = [
  flowerPhotos.sunflowers,
  flowerPhotos.pinkTulip,
  flowerPhotos.whiteRose,
  flowerPhotos.cherryBlossom,
  flowerPhotos.callaLilies,
  flowerPhotos.stripedTulips,
  flowerPhotos.roseGarden,
  flowerPhotos.pinkLilies,
];

export default function FlowerGallery() {
  return (
    <div className="floral-collection" aria-label="Bộ sưu tập cảm hứng hoa">
      {collection.map((photo) => (
        <figure key={photo.src}>
          <FlowerPhoto photo={photo} sizes="(max-width: 700px) 90vw, 60vw" />
        </figure>
      ))}
    </div>
  );
}
