(function(){
  "use strict";

  function installCalendarPolish(){
    if(document.getElementById("psd-calendar-polish-v3")) return;

    const style=document.createElement("style");
    style.id="psd-calendar-polish-v3";
    style.textContent=`
      .ec-icon-btn[data-action="sms"],
      label.ec-check:has(#default-sms-reminder){
        display:none!important;
      }

      label.ec-view-toggle:has(#my-markets-only){
        display:none!important;
      }

      .ec-hero .ec-status-wrap{
        display:none!important;
      }

      .ec-toolbar button,
      .ec-settings-panel button,
      .ec-filters button,
      .ec-next-up button{
        border-color:#d4a01f!important;
      }

      .ec-toolbar button:hover,
      .ec-settings-panel button:hover,
      .ec-filters button:hover,
      .ec-next-up button:hover,
      .ec-toolbar button.active,
      .ec-settings-panel button.active,
      .ec-filters button.active,
      .ec-next-up button.active,
      .ec-toolbar button[aria-pressed="true"],
      .ec-settings-panel button[aria-pressed="true"]{
        background:#fff2bf!important;
        border-color:#c99000!important;
        color:#4a3700!important;
        box-shadow:0 3px 9px rgba(181,128,0,.18)!important;
      }

      body[data-theme="dark"] .ec-toolbar button:hover,
      body[data-theme="dark"] .ec-settings-panel button:hover,
      body[data-theme="dark"] .ec-filters button:hover,
      body[data-theme="dark"] .ec-next-up button:hover,
      body[data-theme="dark"] .ec-toolbar button.active,
      body[data-theme="dark"] .ec-settings-panel button.active,
      body[data-theme="dark"] .ec-filters button.active,
      body[data-theme="dark"] .ec-next-up button.active,
      body[data-theme="dark"] .ec-toolbar button[aria-pressed="true"],
      body[data-theme="dark"] .ec-settings-panel button[aria-pressed="true"]{
        background:#3a2b08!important;
        border-color:#d4a01f!important;
        color:#f4cf69!important;
      }

      .ec-provider{
        font-size:9px!important;
        padding:7px 12px!important;
      }
    `;
    document.head.appendChild(style);
  }

  function cleanReminderSettings(){
    const group=document.querySelector(".ec-settings-group.ec-settings-alerts");
    if(group){
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
  }

  function renameCalendarExport(){
    const btn=document.getElementById("export-ics");
    if(!btn) return;
    btn.textContent="Add to Calendar";
    btn.title="Download visible events as a calendar file";
    btn.setAttribute("aria-label","Add visible events to calendar");
  }

  async function applyGuestDefaults(){
    const client=window.psdSupabase;
    if(!client || !client.auth) return;

    try{
      const sessionResult=await client.auth.getSession();
      const session=sessionResult.data&&sessionResult.data.session;

      if(session) return;

      const allCountries=document.getElementById("country-select-all");
      if(allCountries) allCountries.click();

      document.querySelectorAll('input[name="saved-category"],input[name="saved-impact"]').forEach(function(input){
        if(!input.checked){
          input.checked=true;
          input.dispatchEvent(new Event("change",{bubbles:true}));
        }
      });

      const upcoming=document.getElementById("upcoming-only");
      if(upcoming && upcoming.checked){
        upcoming.checked=false;
        upcoming.dispatchEvent(new Event("change",{bubbles:true}));
      }

      const myMarkets=document.getElementById("my-markets-only");
      if(myMarkets && myMarkets.checked){
        myMarkets.checked=false;
        myMarkets.dispatchEvent(new Event("change",{bubbles:true}));
      }

      ["country","impact","category"].forEach(function(id){
        const el=document.getElementById(id);
        if(el && el.value){
          el.value="";
          el.dispatchEvent(new Event("change",{bubbles:true}));
        }
      });

      const search=document.getElementById("search");
      if(search && search.value){
        search.value="";
        search.dispatchEvent(new Event("input",{bubbles:true}));
      }
    }catch(error){
      console.warn("Guest calendar defaults could not be applied",error);
    }
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

  function applyStaticUi(){
    installCalendarPolish();
    cleanReminderSettings();
    renameCalendarExport();
  }

  function run(){
    applyStaticUi();
    syncPhoneFromMyAccount();
    setTimeout(applyGuestDefaults,150);

    const observer=new MutationObserver(function(){
      applyStaticUi();
    });
    observer.observe(document.body,{childList:true,subtree:true});

    window.addEventListener("psd-profile-updated",syncPhoneFromMyAccount);
    window.addEventListener("psd-member-status-change",function(){
      setTimeout(function(){
        applyStaticUi();
        syncPhoneFromMyAccount();
        applyGuestDefaults();
      },100);
    });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",run,{once:true});
  }else{
    run();
  }
})();
