import type { Session, AuthConfig, RegisterPendingResponse } from '@/shared/lib/api';

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export interface AuthFields {
  fullName: string;
  email: string;
  password: string;
  confirm: string;
  consent: boolean;
}

export interface PendingRegistration {
  challengeId: string;
  email: string;
  fullName: string;
  password: string;
  expiresAt: number;
  resendAvailableAt: number;
  message?: string;
}

export type GisStatus = 'loading' | 'ready' | 'unavailable' | 'error' | 'slow_load_error';

export interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

export interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: 'signin' | 'signup' | 'use';
}

export interface GoogleButtonConfiguration {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number | string;
  locale?: string;
}

export interface GoogleAccountsId {
  initialize: (config: GoogleIdConfiguration) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonConfiguration) => void;
  prompt?: () => void;
  disableAutoSelect?: () => void;
  revoke?: (hint: string, callback?: () => void) => void;
}

export interface GoogleAccountLinkProps {
  email: string | null;
}

export type GoogleWindow = Window &
  typeof globalThis & {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  };

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

export type { Session, AuthConfig, RegisterPendingResponse };
