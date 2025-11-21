// Postavite vaš Google OAuth klijentski ID ovde.
// U Google Cloud Console > Credentials napravite OAuth 2.0 Client ID (Web).
// Authorized JavaScript origins uključite npr. http://localhost:5500
// Authorized redirect URIs nisu potrebni za GIS token (One Tap/Sign-In button) u ovoj varijanti.

export const GOOGLE_CLIENT_ID = 'REPLACE_WITH_YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

// Slanje emailova preko besplatnog servisa (primer Web3Forms free plan).
// Dodajte svoj access key. Ako je polje accessKey prazno, pada se na mailto fallback.
export const EMAIL_API_CONFIG = {
  provider: "web3forms",
  endpoint: "https://api.web3forms.com/submit",
  accessKey: "4b67f2c2-1d64-47ec-ac99-c6674049a957",
  to: "slavisa.radovic@gmail.com",
  fromEmail: "no-reply@codearena.local",
  fromName: "CodeArena",
};
