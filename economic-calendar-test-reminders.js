(function(){
  "use strict";

  function installTemporarySmsHide(){
    if(document.getElementById("psd-hide-calendar-sms")) return;

    const style=document.createElement("style");
    style.id="psd-hide-calendar-sms";
    style.textContent=`
      .ec-icon-btn[data-action="sms"]{
        display:none!important;
      }
      label.ec-check:has(#default-sms-reminder){
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function cleanReminderSettings(){
    const group=document.querySelector(".ec-settings-group.ec-settings-alerts");
    if(!group)return;

    const title=group.querySelector("h3");
    if(title) title.textContent="Reminder Preferences";

    const email=document.getElementById("account-email");
    if(email && email.parentElement) email.parentElement.style.display="none";

    const phone=document.getElementById("account-phone");
    if(phone){
      const phoneBlock=phone.closest("label");
      if(phoneBlock) phoneBlock.style.display="none";

      const note=phoneBlock && phoneBlock.nextElementSibling;
      if(note && note.classList.contains("ec-field-note")){
        note.style.display="none";
      }
    }

    const sms=document.getElementById("default-sms-reminder");
    if(sms) sms.checked=false;

    let helper=group.querySelector(".psd-reminder-account-note");
    if(!helper){
      helper=document.createElement("div");
      helper.className="ec-reminder-note psd-reminder-account-note";
      group.querySelector(".ec-contact-grid")?.appendChild(helper);
    }
    if(helper) helper.textContent="Email is managed in My Account.";
  }

  async function syncPhoneFromMyAccount(){
    const input=document.getElementById("account-phone");
    const client=window.psdSupabase;
    if(!input || !client || !client.auth)return;

    try{
      const sessionResult=await client.auth.getSession();
      const session=sessionResult.data&&sessionResult.data.session;
      if(!session)return;

      const result=await client
        .from("profiles")
        .select("phone_number")
        .eq("id",session.user.id)
        .maybeSingle();

      if(!result.error){
        input.value=(result.data&&result.data.phone_number)||"";
      }
    }catch(error){
      console.warn("Calendar reminder contact sync failed",error);
    }
  }

  function run(){
    installTemporarySmsHide();
    cleanReminderSettings();
    syncPhoneFromMyAccount();

    window.addEventListener("psd-profile-updated",syncPhoneFromMyAccount);
    window.addEventListener("psd-member-status-change",function(){
      setTimeout(syncPhoneFromMyAccount,50);
    });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",run,{once:true});
  }else{
    run();
  }
})();
