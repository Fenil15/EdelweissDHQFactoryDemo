/**
 * Mock email sender. In a real POC we'd plug in nodemailer or an HTTP API;
 * here we just log to console so a developer can copy the OTP/token out of
 * the server log during testing.
 */
export const emailService = {
  sendOtp(to: string, otp: string): void {
     
    console.log(`[EMAIL] To: ${to} OTP: ${otp}`);
  },
  sendInvitation(to: string, invitationToken: string): void {
     
    console.log(`[EMAIL] To: ${to} INVITE_TOKEN: ${invitationToken}`);
  },
};
