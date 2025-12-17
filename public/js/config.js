// Postavite vaš Google OAuth klijentski ID ovde.
// U Google Cloud Console > Credentials napravite OAuth 2.0 Client ID (Web).
// Authorized JavaScript origins uključite npr. http://localhost:5500
// Authorized redirect URIs nisu potrebni za GIS token (One Tap/Sign-In button) u ovoj varijanti.

export const GOOGLE_CLIENT_ID = '126833017649-d2adn22f4830k1nk6i955gpdag75t0en.apps.googleusercontent.com';

// Slanje emailova preko Web3Forms (besplatni plan).
export const EMAIL_API_CONFIG = {
  provider: "web3forms",
  endpoint: "https://api.web3forms.com/submit",
  accessKey: "4b67f2c2-1d64-47ec-ac99-c6674049a957",
  to: "slavisa.radovic@gmail.com", // fallback za mailto
  fromEmail: "no-reply@codearena.local",
  fromName: "CodeArena",
};

// (Previous Formspree setup, ostavljeno kao referenca)
// export const EMAIL_API_CONFIG = {
//   provider: "formspree",
//   endpoint: "https://formspree.io/f/xzzlnpza",
//   to: "slavisa.radovic@gmail.com",
//   fromEmail: "no-reply@codearena.local",
//   fromName: "CodeArena",
// };
