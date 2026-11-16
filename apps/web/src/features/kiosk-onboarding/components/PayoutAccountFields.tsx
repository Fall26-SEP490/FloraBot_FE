import { VietnamBankSelect } from '@/shared/components/VietnamBankSelect';

interface PayoutAccountFieldsProps {
  bankName: string;
  onBankNameChange: (val: string) => void;
  bankNameError?: string;
  bankHolder: string;
  onBankHolderChange: (val: string) => void;
  bankHolderError?: string;
  bankAccountNumber: string;
  onBankAccountNumberChange: (val: string) => void;
  bankAccountNumberError?: string;
}

export function PayoutAccountFields({
  bankName,
  onBankNameChange,
  bankNameError,
  bankHolder,
  onBankHolderChange,
  bankHolderError,
  bankAccountNumber,
  onBankAccountNumberChange,
  bankAccountNumberError,
}: PayoutAccountFieldsProps) {
  return (
    <fieldset className="kiosk-form-group">
      <legend>Tài khoản nhận hoàn phí</legend>
      <p className="kiosk-group-note">
        FloraBot dùng tài khoản này để chuyển khoản nếu hồ sơ được hoàn phí thuê.
      </p>

      <div className="form-fields-grid-2">
        <div className="kiosk-form-field">
          <label htmlFor="bank-name-input">
            Tên ngân hàng <span className="required-star">*</span>
          </label>
          <VietnamBankSelect
            id="bank-name-input"
            value={bankName}
            onValueChange={onBankNameChange}
            required
            invalid={!!bankNameError}
            describedBy={bankNameError ? 'lease-bank-name-error' : undefined}
          />
          {bankNameError && (
            <p id="lease-bank-name-error" className="kiosk-field-error">
              {bankNameError}
            </p>
          )}
        </div>

        <div className="kiosk-form-field">
          <label htmlFor="bank-holder-input">
            Tên chủ tài khoản (in hoa không dấu) <span className="required-star">*</span>
          </label>
          <input
            id="bank-holder-input"
            type="text"
            maxLength={120}
            value={bankHolder}
            onChange={(e) => onBankHolderChange(e.target.value.toUpperCase())}
            placeholder="NGUYEN VAN A"
            required
            aria-invalid={!!bankHolderError}
          />
          {bankHolderError && <p className="kiosk-field-error">{bankHolderError}</p>}
        </div>
      </div>

      <div className="kiosk-form-field">
        <label htmlFor="bank-account-number-input">
          Số tài khoản ngân hàng <span className="required-star">*</span>
        </label>
        <input
          id="bank-account-number-input"
          type="text"
          maxLength={34}
          value={bankAccountNumber}
          onChange={(e) => onBankAccountNumberChange(e.target.value)}
          placeholder="Số tài khoản ngân hàng thụ hưởng"
          required
          aria-invalid={!!bankAccountNumberError}
        />
        {bankAccountNumberError && <p className="kiosk-field-error">{bankAccountNumberError}</p>}
      </div>
    </fieldset>
  );
}
