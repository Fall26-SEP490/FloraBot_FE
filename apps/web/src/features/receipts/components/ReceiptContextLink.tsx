import type { ComponentProps } from 'react';
import { transferReceiptContext } from '../receipt-navigation';

export default function ReceiptContextLink({
  to,
  orderId,
  trackingToken,
  returnTo,
  children,
  ...props
}: {
  to: '/receipt' | '/phan-anh';
  orderId: string;
  trackingToken: string;
  returnTo: string | null;
} & Omit<ComponentProps<'a'>, 'href'>) {
  return (
    <a
      {...props}
      href={to}
      referrerPolicy="no-referrer"
      onClick={(event) => {
        props.onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        transferReceiptContext(to, orderId, trackingToken, returnTo);
      }}
    >
      {children}
    </a>
  );
}
