import { EMAIL_API_CONFIG } from './config.js';

export function isEmailApiConfigured(){
  return !!(EMAIL_API_CONFIG?.accessKey && EMAIL_API_CONFIG.accessKey !== 'REPLACE_WITH_WEB3FORMS_ACCESS_KEY');
}

export async function sendEmailViaApi({ to, subject, message, replyTo, fromEmail, fromName }){
  if(!isEmailApiConfigured()){
    throw new Error('Email API nije konfigurisan.');
  }

  const endpoint = EMAIL_API_CONFIG.endpoint || 'https://api.web3forms.com/submit';
  const fd = new FormData();
  fd.append('access_key', EMAIL_API_CONFIG.accessKey);
  fd.append('subject', subject || 'Poruka');
  fd.append('from_name', fromName || EMAIL_API_CONFIG.fromName || 'CodeArena');
  fd.append('from_email', fromEmail || EMAIL_API_CONFIG.fromEmail || 'no-reply@codearena.local');
  fd.append('message', message || '');

  const destination = to || EMAIL_API_CONFIG.to;
  if(destination) fd.append('to', destination);
  if(replyTo) fd.append('replyto', replyTo);

  const res = await fetch(endpoint, { method:'POST', body: fd });
  const payload = await res.json().catch(()=> ({}));

  if(!res.ok || payload?.success === false){
    const msg = payload?.message || `Email API error ${res.status}`;
    throw new Error(msg);
  }
  return payload;
}
