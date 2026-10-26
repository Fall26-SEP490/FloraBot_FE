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
      <legend>Tài khoản nhận doanh thu bán hoa (Payout)</legend>
      <p className="kiosk-group-note">
        Đây là tài khoản để FloraBot chuyển tiền doanh thu bán hoa cho shop của bạn khi đối soát
        hàng kỳ. Chúng tôi tuyệt đối không ủy quyền trích nợ tự động hay thu phí từ tài khoản này.
      </p>

      <div className="form-fields-grid-2">
        <div className="kiosk-form-field">
          <label htmlFor="bank-name-input">
            Tên ngân hàng <span className="required-star">*</span>
          </label>
          <input
            id="bank-name-input"
            type="text"
            maxLength={100}
            value={bankName}
            onChange={(e) => onBankNameChange(e.target.value)}
            placeholder="Ví dụ: Vietcombank, MB Bank, v.v."
            required
            aria-invalid={!!bankNameError}
          />
          {bankNameError && <p className="kiosk-field-error">{bankNameError}</p>}
        </div>

        <div className="kiosk-form-field">
          <label htmlFor="bank-holder-input">
            Tên chủ tài khoản (in hoa không dấu) <span className="required-star">*</span>
          </label>
          <input
            id="bank-holder-input"
            type="text"
            maxLength={100}
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
          maxLength={30}
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
