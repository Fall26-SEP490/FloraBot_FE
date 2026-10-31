import { useCallback, useState } from 'react';
import { parseAndValidateCoordinate } from '../../installations/installations.utils';
import type { CreateKioskApplicationRequest } from '../../installations/installations.types';
import type { KioskLocationSource } from '../onboarding.types';
import { validateKioskApplicationDraft } from '../onboarding.utils';

export function useKioskApplicationForm() {
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [installationAddress, setInstallationAddress] = useState('');
  const [addressSelected, setAddressSelected] = useState(false);
  const [addressEditedAfterSelect, setAddressEditedAfterSelect] = useState(false);
  const [locationSource, setLocationSource] = useState<KioskLocationSource>('none');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleAddressChange = useCallback(
    (val: string) => {
      setInstallationAddress(val);
      if (addressSelected || latitude !== null || longitude !== null) {
        setAddressEditedAfterSelect(true);
      }
      setAddressSelected(false);
      setLatitude(null);
      setLongitude(null);
      setLatInput('');
      setLonInput('');
      setLocationSource('none');
      setFormErrors((prev) => {
        if (!prev.installationAddress && !prev.coordinates) return prev;
        const next = { ...prev };
        delete next.installationAddress;
        delete next.coordinates;
        return next;
      });
    },
    [addressSelected, latitude, longitude],
  );

  const handleSuggestionSelect = useCallback((address: string, lat: number, lon: number) => {
    const roundedLat = Number(lat.toFixed(6));
    const roundedLon = Number(lon.toFixed(6));
    setInstallationAddress(address);
    setAddressSelected(true);
    setAddressEditedAfterSelect(false);
    setLatitude(roundedLat);
    setLongitude(roundedLon);
    setLatInput(roundedLat.toFixed(6));
    setLonInput(roundedLon.toFixed(6));
    setLocationSource('suggestion');
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.installationAddress;
      delete next.coordinates;
      return next;
    });
  }, []);

  const handleLocationSelect = useCallback((lat: number, lon: number) => {
    const roundedLat = Number(lat.toFixed(6));
    const roundedLon = Number(lon.toFixed(6));
    setLatitude(roundedLat);
    setLongitude(roundedLon);
    setLatInput(roundedLat.toFixed(6));
    setLonInput(roundedLon.toFixed(6));
    setLocationSource('map');
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.coordinates;
      return next;
    });
  }, []);

  const handleGpsLocationSelect = useCallback((lat: number, lon: number) => {
    const roundedLat = Number(lat.toFixed(6));
    const roundedLon = Number(lon.toFixed(6));
    setLatitude(roundedLat);
    setLongitude(roundedLon);
    setLatInput(roundedLat.toFixed(6));
    setLonInput(roundedLon.toFixed(6));
    setLocationSource('gps');
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.coordinates;
      return next;
    });
  }, []);

  const handleLatInputChange = (val: string) => {
    setLatInput(val);
    const parsed = parseAndValidateCoordinate(val, 'lat');
    if (parsed.valid && parsed.value !== null) {
      setLatitude(parsed.value);
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.coordinates;
        return next;
      });
    } else {
      // Invalidate immediately so stale coordinate is NEVER submitted!
      setLatitude(null);
    }
  };

  const handleLonInputChange = (val: string) => {
    setLonInput(val);
    const parsed = parseAndValidateCoordinate(val, 'lon');
    if (parsed.valid && parsed.value !== null) {
      setLongitude(parsed.value);
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.coordinates;
        return next;
      });
    } else {
      // Invalidate immediately so stale coordinate is NEVER submitted!
      setLongitude(null);
    }
  };

  const validateAndGetPayload = (): CreateKioskApplicationRequest | null => {
    const result = validateKioskApplicationDraft({
      packageId: selectedPackageId,
      shopName,
      phone,
      contactEmail,
      installationAddress,
      addressSelected,
      latInput,
      lonInput,
      bankName,
      bankHolder,
      bankAccountNumber,
    });

    setFormErrors(result.errors);
    return result.sanitizedPayload;
  };

  const clearFieldError = (field: string) => {
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  return {
    selectedPackageId,
    setSelectedPackageId,
    shopName,
    setShopName,
    phone,
    setPhone,
    contactEmail,
    setContactEmail,
    installationAddress,
    setInstallationAddress,
    addressSelected,
    addressEditedAfterSelect,
    locationSource,
    latitude,
    longitude,
    latInput,
    lonInput,
    bankName,
    setBankName,
    bankHolder,
    setBankHolder,
    bankAccountNumber,
    setBankAccountNumber,
    formErrors,
    clearFieldError,
    handleAddressChange,
    handleSuggestionSelect,
    handleLocationSelect,
    handleGpsLocationSelect,
    handleLatInputChange,
    handleLonInputChange,
    validateAndGetPayload,
  };
}
