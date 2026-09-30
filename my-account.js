(function(){
  "use strict";

  function status(message,type){
    const el=document.getElementById("my-account-status");
    if(!el)return;
    el.textContent=message||"";
    el.className="psd-status"+(type?" "+type:"");
  }

  function clean(v,max){
    return String(v||"").trim().slice(0,max||320);
  }

  function validOptionalEmail(v){
    if(!v)return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function validOptionalPhone(v){
    if(!v)return true;
    return /^\+?[0-9\s().-]{7,32}$/.test(v);
  }

  async function init(){
    const client=window.psdSupabase;
    if(!client){
      status("Account service is unavailable.","error");
      return;
    }

    const sessionResult=await client.auth.getSession();
    const session=sessionResult.data&&sessionResult.data.session;
    if(!session){
      window.location.replace("auth.html?next=my-account.html");
      return;
    }

    const user=session.user;
    const form=document.getElementById("my-account-form");
    const first=document.getElementById("first-name");
    const last=document.getElementById("last-name");
    const primary=document.getElementById("primary-email");
    const secondary=document.getElementById("secondary-email");
    const phone=document.getElementById("phone-number");
    const avatarFile=document.getElementById("avatar-file");
    const avatarPreview=document.getElementById("avatar-preview");
    const avatarPlaceholder=document.getElementById("avatar-placeholder");
    const avatarRemove=document.getElementById("avatar-remove");

    let currentAvatarUrl="";

    function showAvatar(url){
      currentAvatarUrl=String(url||"");
      if(currentAvatarUrl){
        avatarPreview.src=currentAvatarUrl;
        avatarPreview.classList.remove("hidden");
        avatarPlaceholder.classList.add("hidden");
        avatarRemove.disabled=false;
      }else{
        avatarPreview.removeAttribute("src");
        avatarPreview.classList.add("hidden");
        avatarPlaceholder.classList.remove("hidden");
        avatarRemove.disabled=true;
      }
    }

    async function load(){
      status("Loading your account…");
      const result=await client
        .from("profiles")
        .select("first_name,last_name,secondary_email,phone_number,avatar_url")
        .eq("id",user.id)
        .single();

      if(result.error){
        status(result.error.message,"error");
        return;
      }

      const p=result.data||{};
      first.value=p.first_name||"";
      last.value=p.last_name||"";
      primary.value=user.email||"";
      secondary.value=p.secondary_email||"";
      phone.value=p.phone_number||"";
      showAvatar(p.avatar_url||"");
      status("Account loaded.","success");
    }

    async function removeExistingAvatarFiles(){
      const listed=await client.storage.from("avatars").list(user.id,{limit:20});
      if(listed.error)return;
      const names=(listed.data||[]).filter(x=>x&&x.name).map(x=>user.id+"/"+x.name);
      if(names.length){
        await client.storage.from("avatars").remove(names);
      }
    }

    avatarFile.addEventListener("change",async function(){
      const file=avatarFile.files&&avatarFile.files[0];
      if(!file)return;

      if(file.size>5*1024*1024){
        status("Profile picture must be 5 MB or smaller.","error");
        avatarFile.value="";
        return;
      }

      const allowed={
        "image/jpeg":"jpg",
        "image/png":"png",
        "image/webp":"webp",
        "image/gif":"gif"
      };
      const ext=allowed[file.type];
      if(!ext){
        status("Please use JPG, PNG, WebP, or GIF.","error");
        avatarFile.value="";
        return;
      }

      status("Uploading profile picture…");
      avatarFile.disabled=true;

      try{
        await removeExistingAvatarFiles();
        const path=user.id+"/avatar."+ext;
        const uploaded=await client.storage.from("avatars").upload(path,file,{
          upsert:true,
          contentType:file.type,
          cacheControl:"3600"
        });
        if(uploaded.error)throw uploaded.error;

        const publicResult=client.storage.from("avatars").getPublicUrl(path);
        const publicUrl=publicResult.data&&publicResult.data.publicUrl
          ? publicResult.data.publicUrl+"?v="+Date.now()
          : "";
        if(!publicUrl)throw new Error("Profile picture URL could not be created.");

        const saved=await client.from("profiles")
          .update({avatar_url:publicUrl,updated_at:new Date().toISOString()})
          .eq("id",user.id);
        if(saved.error)throw saved.error;

        showAvatar(publicUrl);
        window.dispatchEvent(new CustomEvent("psd-profile-updated"));
        status("Profile picture updated.","success");
      }catch(error){
        console.error(error);
        status(error.message||"Profile picture upload failed.","error");
      }finally{
        avatarFile.disabled=false;
        avatarFile.value="";
      }
    });

    avatarRemove.addEventListener("click",async function(){
      if(!currentAvatarUrl)return;
      status("Removing profile picture…");
      avatarRemove.disabled=true;
      try{
        await removeExistingAvatarFiles();
        const saved=await client.from("profiles")
          .update({avatar_url:null,updated_at:new Date().toISOString()})
          .eq("id",user.id);
        if(saved.error)throw saved.error;
        showAvatar("");
        window.dispatchEvent(new CustomEvent("psd-profile-updated"));
        status("Profile picture removed.","success");
      }catch(error){
        console.error(error);
        status(error.message||"Profile picture could not be removed.","error");
        avatarRemove.disabled=false;
      }
    });

    form.addEventListener("submit",async function(event){
      event.preventDefault();

      const firstName=clean(first.value,80);
      const lastName=clean(last.value,80);
      const primaryEmail=clean(primary.value,320).toLowerCase();
      const secondEmail=clean(secondary.value,320).toLowerCase();
      const phoneNumber=clean(phone.value,32);

      if(!primaryEmail || !validOptionalEmail(primaryEmail)){
        status("Enter a valid primary email address.","error");
        return;
      }
      if(!validOptionalEmail(secondEmail)){
        status("Enter a valid second email address or leave it blank.","error");
        return;
      }
      if(secondEmail && secondEmail===primaryEmail){
        status("The second email should be different from your primary email.","error");
        return;
      }
      if(!validOptionalPhone(phoneNumber)){
        status("Enter a valid phone number or leave it blank.","error");
        return;
      }

      const button=form.querySelector('button[type="submit"]');
      button.disabled=true;
      status("Saving your account…");

      try{
        const saved=await client.from("profiles")
          .update({
            first_name:firstName||null,
            last_name:lastName||null,
            secondary_email:secondEmail||null,
            phone_number:phoneNumber||null,
            updated_at:new Date().toISOString()
          })
          .eq("id",user.id);

        if(saved.error)throw saved.error;

        if(primaryEmail!==String(user.email||"").toLowerCase()){
          const emailUpdate=await client.auth.updateUser({email:primaryEmail});
          if(emailUpdate.error)throw emailUpdate.error;
          status("Account saved. Check your email to confirm the new primary email address.","success");
        }else{
          status("My Account saved.","success");
        }

        window.dispatchEvent(new CustomEvent("psd-profile-updated"));
      }catch(error){
        console.error(error);
        status(error.message||"Account could not be saved.","error");
      }finally{
        button.disabled=false;
      }
    });

    await load();
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",function(){
      setTimeout(function(){init().catch(function(e){status(e.message,"error");});},0);
    });
  }else{
    setTimeout(function(){init().catch(function(e){status(e.message,"error");});},0);
  }
})();
