'use client';
import { useEffect } from 'react';
import { installFormValidation } from '@/shared/lib/form-validation';

export default function FormFeedback() {
  useEffect(() => {
    return installFormValidation(document.body);
  }, []);
  return null;
}
