import type { components } from '../../../../../packages/contracts/src/generated/api';

export type KioskCoordinates = components['schemas']['KioskCoordinates'];
export type SellerKioskDto = components['schemas']['SellerKioskDto'];
export type SellerKioskItem = SellerKioskDto;
export type UpdateKioskLocationPayload = components['schemas']['UpdateKioskLocationRequest'];
export type PublicKioskDto = components['schemas']['PublicKioskDto'];

export type CustomerKioskLocationItem = Omit<
  PublicKioskDto,
  'code' | 'name' | 'address' | 'region' | 'status' | 'latitude' | 'longitude'
> & {
  code: string;
  name: string;
  address: string;
  region: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
};

export type CustomerKioskLocationsResponse = CustomerKioskLocationItem[];

export interface GoongMapTileConfig {
  isGoong: boolean;
  styleUrl: string;
  tileUrl: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
  minZoom: number;
}

export interface GoongPrediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

export interface GoongPlaceDetail {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}
