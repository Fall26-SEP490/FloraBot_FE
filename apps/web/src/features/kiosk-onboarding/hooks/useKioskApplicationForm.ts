import { useCallback, useState } from 'react';
import { parseAndValidateCoordinate } from '../../installations/installations.utils';
import type { CreateKioskApplicationRequest } from '../../installations/installations.types';
import { validateKioskApplicationDraft } from '../onboarding.utils';

export function useKioskApplicationForm() {
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [installationAddress, setInstallationAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleLocationSelect = useCallback((lat: number, lon: number) => {
    setLatitude(lat);
    setLongitude(lon);
    setLatInput(lat.toFixed(6));
    setLonInput(lon.toFixed(6));
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
    handleLocationSelect,
    handleLatInputChange,
    handleLonInputChange,
    validateAndGetPayload,
  };
}
