'use client';

import { useState } from 'react';
import { ArrowUpRight } from '@florabot/ui';
import { Modal } from '@/shared/components/Modal';

export function ProductGallery({ photo, name }: { photo: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hasPhoto = Boolean(photo && !failed);
  const src = hasPhoto ? photo! : '/images/floral-white-online.webp';

  return (
    <div className="flower-detail-gallery">
      <figure className="flower-detail-media">
        <img
          src={src}
          alt={hasPhoto ? name : 'Ảnh minh họa hoa'}
          onError={() => setFailed(true)}
          className="flower-detail-main-img"
          fetchPriority="high"
        />
        {hasPhoto ? (
          <button
            type="button"
            className="flower-detail-zoom"
            onClick={() => setExpanded(true)}
            aria-label="Phóng to ảnh mẫu hoa"
          >
            <ArrowUpRight size={18} aria-hidden="true" />
            <span>Phóng to ảnh</span>
          </button>
        ) : (
          <figcaption>Ảnh minh họa · Shop chưa có ảnh sản phẩm hiển thị</figcaption>
        )}
      </figure>
      <Modal
        open={expanded}
        title="Ảnh mẫu hoa"
        onClose={() => setExpanded(false)}
        size="lg"
        className="flower-detail-lightbox"
      >
        <img src={src} alt={name} />
      </Modal>
    </div>
  );
}
