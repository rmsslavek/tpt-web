import { EMAIL_API_CONFIG } from './config.js';

export function isEmailApiConfigured(){
  const hasEndpoint = EMAIL_API_CONFIG?.endpoint && !String(EMAIL_API_CONFIG.endpoint).includes('REPLACE');
  const hasAccessKey = EMAIL_API_CONFIG?.accessKey && !String(EMAIL_API_CONFIG.accessKey).includes('REPLACE');
  return !!(hasEndpoint && hasAccessKey);
}

export async function sendEmailViaApi({ to, subject, message, replyTo, fromEmail, fromName }){
  if(!isEmailApiConfigured()){
    throw new Error('Email API nije konfigurisan.');
  }

  const endpoint = EMAIL_API_CONFIG.endpoint;
  const payload = {
    access_key: EMAIL_API_CONFIG.accessKey,
    from_email: replyTo || fromEmail || EMAIL_API_CONFIG.fromEmail || 'no-reply@codearena.local',
    from_name: fromName || EMAIL_API_CONFIG.fromName || 'CodeArena',
    subject: subject || 'Poruka',
    message: message || '',
  };

  // Web3Forms payload; raniji Formspree JSON payload je ostavljen ispod za referencu.
  // const payload = { email, name, subject, message, to }; // Formspree varijanta (komentarisana)
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
