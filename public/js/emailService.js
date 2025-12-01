import { EMAIL_API_CONFIG } from './config.js';

export function isEmailApiConfigured(){
  return !!(EMAIL_API_CONFIG?.endpoint && !EMAIL_API_CONFIG.endpoint.includes('REPLACE'));
}

export async function sendEmailViaApi({ to, subject, message, replyTo, fromEmail, fromName }){
  if(!isEmailApiConfigured()){
    throw new Error('Email API nije konfigurisan.');
  }

  const endpoint = EMAIL_API_CONFIG.endpoint;
  const payload = {
    email: replyTo || fromEmail || EMAIL_API_CONFIG.fromEmail || 'no-reply@codearena.local',
    name: fromName || EMAIL_API_CONFIG.fromName || 'CodeArena',
    subject: subject || 'Poruka',
    message: message || '',
  };
  // Formspree šalje na adresu podešenu u dashboardu; "to" koristimo samo za fallback info
  if(to || EMAIL_API_CONFIG.to){
    payload.to = to || EMAIL_API_CONFIG.to;
  }

  const res = await fetch(endpoint, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(()=> ({}));
  if(!res.ok){
    const msg = data?.error || data?.message || `Email API error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}
