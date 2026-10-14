/* Public Sentiment Dash · account MFA enrollment · v5
 * Uses authenticated Supabase MFA API; never records successful enrollment locally.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let pendingFactor = null;
  let busy = false;
  const status = (message, error=false) => {
    const el=$('mfa-status');if(!el)return;
    el.textContent=message;el.classList.toggle('error',error);el.classList.toggle('success',!error && /enabled|already configured/i.test(message));
  };
  const errorMessage = e => e && e.message ? e.message : 'Please try again.';
  const setBusy = on => {busy=on;['mfa-enroll','mfa-verify','mfa-cancel'].forEach(id=>{if($(id))$(id).disabled=on;});};
  function clearSetup(){
    $('mfa-setup').hidden=true;$('mfa-qr').removeAttribute('src');$('mfa-secret').textContent='';$('mfa-code').value='';pendingFactor=null;
  }
  async function init(){
    const client=window.psdSupabase;
    if(!client?.auth?.mfa){status('Authentication setup is unavailable: Supabase MFA did not load.',true);return;}
    try{
      const user=await client.auth.getUser();
      if(user.error||!user.data?.user){status('Please sign in before configuring authentication.',true);return;}
      const factors=await client.auth.mfa.listFactors();
      if(factors.error)throw factors.error;
      const verified=(factors.data?.totp||[]).some(f=>f.status==='verified');
      if(verified){status('Google Authenticator is enabled for this PSD account.');$('mfa-enroll').hidden=true;return;}
      status('Not configured. Select Set Up Google Authenticator to register your account.');
      $('mfa-enroll').disabled=false;
    }catch(e){status('Unable to check authenticator status: '+errorMessage(e),true);}
    $('mfa-enroll').addEventListener('click',async()=>{
      if(busy)return;setBusy(true);status('Creating secure authenticator setup…');
      try{
        const res=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'PSD Authenticator'});
        if(res.error)throw res.error;
        if(!res.data?.id || !res.data?.totp?.qr_code)throw new Error('Supabase did not return a valid QR code.');
        pendingFactor=res.data.id;
        const qr=res.data.totp.qr_code;
        // Supabase supplies the QR as an image data URI; never use untrusted remote image URLs.
        if(!/^data:image\/(?:svg\+xml|png|jpeg)(?:;charset=[^;,]+)?(?:;base64)?,/i.test(qr))throw new Error('Unexpected QR format returned by server.');
        $('mfa-qr').src=qr;
        $('mfa-secret').textContent=res.data.totp.secret||'Manual setup key unavailable';
        $('mfa-setup').hidden=false;
        status('Your personal QR is ready. Scan it with Google Authenticator, then verify the 6-digit code below.');
      }catch(e){status('Could not start setup: '+errorMessage(e),true);clearSetup();}
      finally{setBusy(false);}
    });
    $('mfa-verify').addEventListener('click',async()=>{
      if(busy||!pendingFactor)return;
      const code=$('mfa-code').value.trim();
      if(!/^\d{6}$/.test(code)){status('Enter the 6-digit code shown in your authenticator app.',true);return;}
      setBusy(true);
      try{
        const c=await client.auth.mfa.challenge({factorId:pendingFactor});
        if(c.error)throw c.error;
        const result=await client.auth.mfa.verify({factorId:pendingFactor,challengeId:c.data.id,code});
        if(result.error)throw result.error;
        clearSetup();$('mfa-enroll').hidden=true;
        status('Google Authenticator enabled for your PSD account.');
      }catch(e){status('Verification failed: '+errorMessage(e),true);}
      finally{setBusy(false);}
    });
    $('mfa-cancel').addEventListener('click',async()=>{
      if(busy)return;
      const id=pendingFactor;clearSetup();
      if(id){setBusy(true);try{const res=await client.auth.mfa.unenroll({factorId:id});if(res.error)throw res.error;}catch(e){status('Setup could not be fully cancelled: '+errorMessage(e),true);return;}finally{setBusy(false);}}
      status('Setup cancelled. No authenticator was verified.');
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
