export function isOtpMocked(): boolean {
  return process.env.IS_OTP_MOCKED === "true";
}

export const MOCK_OTP_CODE = "000000";
