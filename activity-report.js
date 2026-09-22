(function(){
  "use strict";

  const client=window.psdSupabase;
  const gate=document.getElementById("admin-gate");
  const app=document.getElementById("admin-app");
  let report=null;
  let startDate="";
  let endDate="";
  let selectedDays=30;

  function number(value){return Number(value||0).toLocaleString();}
  function text(id,value){const node=document.getElementById(id);if(node)node.textContent=value==null?"—":value;}
  function setStatus(message,type){const node=document.getElementById("activity-status");node.textContent=message||"";node.className="admin-status"+(type?" "+type:"");}
  function escapeCsv(value){const valueText=String(value??"");return /[",\n]/.test(valueText)?'"'+valueText.replace(/"/g,'""')+'"':valueText;}

  function etDate(date){
    const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
    const map={};parts.forEach(function(part){map[part.type]=part.value;});
    return map.year+"-"+map.month+"-"+map.day;
  }

  function chooseRange(days){
    selectedDays=days;
    const end=etDate(new Date());
    const start=new Date(end+"T12:00:00Z");
    start.setUTCDate(start.getUTCDate()-(days-1));
    startDate=start.toISOString().slice(0,10);endDate=end;
    document.querySelectorAll("[data-range]").forEach(function(button){button.classList.toggle("active",Number(button.dataset.range)===days);});
    text("summary-new-period","Selected "+days+" days");
  }

  async function requireOwner(){
    if(!client)throw new Error("Account service is unavailable.");
    const sessionResult=await client.auth.getSession();
    const session=sessionResult.data&&sessionResult.data.session;
    if(!session){window.location.replace("auth.html");return null;}
    const profile=await client.from("profiles").select("is_admin").eq("id",session.user.id).single();
    if(profile.error||!profile.data||profile.data.is_admin!==true)throw new Error("Owner access is required.");
    return session;
  }

  function reveal(){document.body.classList.remove("admin-locked");gate.hidden=true;app.hidden=false;}
  function deny(error){
    gate.textContent=(error&&error.message)||"Owner access is required.";
    setTimeout(function(){window.location.replace("account.html");},1800);
  }

  function renderRows(id,rows,columns){
    const body=document.getElementById(id);body.textContent="";
    if(!rows||!rows.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=columns.length;td.className="empty";td.textContent="No activity for this period.";tr.appendChild(td);body.appendChild(tr);return;}
    rows.forEach(function(row){const tr=document.createElement("tr");columns.forEach(function(column){const td=document.createElement("td");const value=typeof column==="function"?column(row):row[column];td.textContent=value==null||value===""?"—":value;tr.appendChild(td);});body.appendChild(tr);});
  }

  function renderRanks(id,rows,key){
    const node=document.getElementById(id);node.textContent="";
    (rows||[]).slice(0,6).forEach(function(row){const line=document.createElement("div");line.className="rank-row";const label=document.createElement("span");label.textContent=row[key]||"Unknown";const count=document.createElement("strong");count.textContent=number(row.count);line.append(label,count);node.appendChild(line);});
    if(!node.children.length){const line=document.createElement("div");line.className="rank-row";line.textContent="No data";node.appendChild(line);}
  }

  function renderReport(data,accounts){
    report=data||{};const summary=report.summary||{};const total=Number(summary.total_activities||0);const members=Number(summary.member_activities||0);
    text("summary-pageviews",number(summary.page_views));text("summary-sessions",number(summary.sessions));text("summary-votes",number(summary.votes));
    text("summary-member-share",total?Math.round(members/total*100)+"%":"—");
    text("summary-accounts",number(accounts&&accounts.total_accounts));text("summary-new-accounts",number(accounts&&accounts.new_accounts));
    text("activity-generated",report.generated_at_et?"Updated "+report.generated_at_et+" ET":"");
    renderRows("pages-body",(report.pages||[]).slice(0,12),["page",function(row){return number(row.count);}]);
    renderRows("daily-body",(report.daily||[]).slice().reverse(),["date",function(row){return number(row.page_views);},function(row){return number(row.sessions);},function(row){return number(row.votes);}]);
    renderRows("votes-body",(report.votes||[]).slice(0,12),["instrument",function(row){return number(row.bullish);},function(row){return number(row.bearish);},function(row){return number(row.total);}]);
    renderRanks("sources-list",report.sources,"source");renderRanks("devices-list",report.devices,"device");renderRanks("regions-list",report.regions,"region");
  }

  function renderBanner(state){
    state=state||{};const enabled=state.maintenance===true;
    document.getElementById("banner-enabled").checked=enabled;
    document.getElementById("banner-message").value=state.message||"Website updates are in progress. Some information may be temporarily incomplete.";
    document.getElementById("banner-expected").value=state.expected_back||"";
    const pill=document.getElementById("banner-state");pill.textContent=enabled?"Banner ON":"Banner OFF";pill.className="state-pill "+(enabled?"on":"off");
    text("banner-saved",state.updated_at?"Last saved "+new Date(state.updated_at).toLocaleString():"");updatePreview();
  }

  function updatePreview(){
    const enabled=document.getElementById("banner-enabled").checked;
    const message=document.getElementById("banner-message").value.trim();
    const expected=document.getElementById("banner-expected").value.trim();
    const preview=document.getElementById("banner-preview");
    preview.textContent=enabled?"🛠️ "+message+(expected?" "+expected:""):"";
  }


  function xRefreshStatus(message,type){
    const node=document.getElementById("x-refresh-status");
    if(!node)return;

    node.textContent=message||"";
    node.className=
      "admin-status"+(type?" "+type:"");
  }

  function xScopePrefix(scope){
    return scope==="website"
      ? "x-website"
      : "x-private";
  }

  function xMode(scope){
    const prefix=xScopePrefix(scope);

    const selected=document.querySelector(
      'input[name="'+prefix+'-mode"]:checked'
    );

    return selected
      ? selected.value
      : "fixed_times";
  }

  function updateXModeVisibility(scope){
    const prefix=xScopePrefix(scope);
    const mode=xMode(scope);

    const fixed=document.getElementById(
      prefix+"-fixed-wrap"
    );

    const every=document.getElementById(
      prefix+"-every-wrap"
    );

    if(fixed){
      fixed.hidden=
        mode!=="fixed_times";
    }

    if(every){
      every.hidden=
        mode!=="every";
    }
  }

  function addXTimeRow(scope,value){
    const prefix=xScopePrefix(scope);
    const host=document.getElementById(
      prefix+"-times"
    );

    if(!host)return;

    const row=document.createElement("div");
    row.className="x-time-row";

    const label=document.createElement("label");

    const caption=document.createElement("span");
    caption.textContent="Update time";

    const input=document.createElement("input");
    input.type="time";
    input.className="x-fixed-time";
    input.value=value||"08:00";

    label.append(
      caption,
      input
    );

    const remove=document.createElement("button");
    remove.type="button";
    remove.className="x-remove-time";
    remove.textContent="?";
    remove.title="Remove this update time";
    remove.setAttribute(
      "aria-label",
      "Remove update time"
    );

    remove.addEventListener(
      "click",
      function(){

        const rows=host.querySelectorAll(
          ".x-time-row"
        );

        if(rows.length<=1){
          xRefreshStatus(
            "A fixed schedule needs at least one time.",
            "error"
          );
          return;
        }

        row.remove();
      }
    );

    row.append(
      label,
      remove
    );

    host.appendChild(row);
  }

  function renderXTimes(scope,times){
    const prefix=xScopePrefix(scope);

    const host=document.getElementById(
      prefix+"-times"
    );

    if(!host)return;

    host.replaceChildren();

    const values=
      Array.isArray(times)&&times.length
        ? times
        : ["08:00","16:00"];

    values.forEach(
      function(value){
        addXTimeRow(
          scope,
          value
        );
      }
    );
  }

  function collectXTimes(scope){
    const prefix=xScopePrefix(scope);

    return Array.from(
      document.querySelectorAll(
        "#"+prefix+"-times .x-fixed-time"
      )
    )
    .map(
      function(input){
        return input.value;
      }
    )
    .filter(Boolean);
  }

  function renderXScheduleGroup(
    scope,
    state
  ){
    state=state||{};

    const prefix=xScopePrefix(scope);

    const enabled=document.getElementById(
      prefix+"-enabled"
    );

    enabled.checked=
      state.enabled!==false;

    const mode=
      state.mode==="every"
        ? "every"
        : "fixed_times";

    const modeInput=document.querySelector(
      'input[name="'+prefix+'-mode"][value="'+mode+'"]'
    );

    if(modeInput){
      modeInput.checked=true;
    }

    renderXTimes(
      scope,
      state.schedule_times
    );

    const every=
      state.every||{};

    const everyValue=document.getElementById(
      prefix+"-every-value"
    );

    const everyUnit=document.getElementById(
      prefix+"-every-unit"
    );

    everyValue.value=
      Number(every.value)>=1
        ? Number(every.value)
        : 1;

    everyUnit.value=
      ["minutes","hours","days"].includes(
        every.unit
      )
        ? every.unit
        : "days";

    updateXModeVisibility(scope);
  }

  function renderXRefreshSettings(state){
    state=state||{};

    renderXScheduleGroup(
      "website",
      state.website||{}
    );

    renderXScheduleGroup(
      "private",
      state.private_account||{}
    );

    document.getElementById(
      "x-refresh-timezone"
    ).textContent=
      state.timezone||
      "America/New_York";

    const websiteEnabled=
      state.website &&
      state.website.enabled!==false;

    const privateEnabled=
      state.private_account &&
      state.private_account.enabled!==false;

    const enabled=
      websiteEnabled ||
      privateEnabled;

    const pill=document.getElementById(
      "x-refresh-state"
    );

    pill.textContent=
      enabled
        ? "X Updates ON"
        : "X Updates OFF";

    pill.className=
      "state-pill "+
      (enabled?"on":"off");

    const saved=document.getElementById(
      "x-refresh-saved"
    );

    saved.textContent=
      state.updated_at
        ? "Last saved "+
          new Date(
            state.updated_at
          ).toLocaleString()
        : "";
  }

  async function loadXRefreshSettings(){
    xRefreshStatus(
      "Loading X schedule?"
    );

    const result=await client.rpc(
      "ms_get_x_refresh_settings"
    );

    if(result.error){
      throw result.error;
    }

    renderXRefreshSettings(
      result.data||{}
    );

    xRefreshStatus(
      "X schedule ready",
      "success"
    );
  }

  function collectXScheduleGroup(scope){
    const prefix=xScopePrefix(scope);

    const mode=xMode(scope);

    const times=collectXTimes(scope);

    const everyValue=
      Number(
        document.getElementById(
          prefix+"-every-value"
        ).value
      );

    const everyUnit=
      document.getElementById(
        prefix+"-every-unit"
      ).value;

    if(
      mode==="fixed_times" &&
      !times.length
    ){
      throw new Error(
        "Fixed schedule needs at least one time."
      );
    }

    if(
      mode==="every" &&
      (
        !Number.isInteger(everyValue) ||
        everyValue<1
      )
    ){
      throw new Error(
        "Every schedule must be 1 or greater."
      );
    }

    return {
      enabled:
        document.getElementById(
          prefix+"-enabled"
        ).checked,

      mode:mode,

      schedule_times:times,

      every_value:
        Number.isInteger(everyValue) &&
        everyValue>=1
          ? everyValue
          : 1,

      every_unit:everyUnit
    };
  }

  async function saveXRefreshSettings(){
    const button=document.getElementById(
      "x-refresh-save"
    );

    let website;
    let privateAccount;

    try{
      website=
        collectXScheduleGroup(
          "website"
        );

      privateAccount=
        collectXScheduleGroup(
          "private"
        );
    }catch(error){
      xRefreshStatus(
        error.message,
        "error"
      );
      return;
    }

    button.disabled=true;
    button.textContent="Saving?";

    xRefreshStatus(
      "Saving X schedule?"
    );

    try{
      const result=await client.rpc(
        "ms_update_x_refresh_settings_v2",
        {
          p_website_enabled:
            website.enabled,

          p_website_mode:
            website.mode,

          p_website_schedule_times:
            website.schedule_times,

          p_website_every_value:
            website.every_value,

          p_website_every_unit:
            website.every_unit,

          p_private_enabled:
            privateAccount.enabled,

          p_private_mode:
            privateAccount.mode,

          p_private_schedule_times:
            privateAccount.schedule_times,

          p_private_every_value:
            privateAccount.every_value,

          p_private_every_unit:
            privateAccount.every_unit,

          p_timezone:
            "America/New_York"
        }
      );

      if(result.error){
        throw result.error;
      }

      renderXRefreshSettings(
        result.data||{}
      );

      xRefreshStatus(
        "X schedule saved.",
        "success"
      );

    }finally{
      button.disabled=false;
      button.textContent=
        "Save X schedule";
    }
  }

  function wireXScheduleControls(){
    ["website","private"].forEach(
      function(scope){

        const prefix=xScopePrefix(scope);

        document.querySelectorAll(
          'input[name="'+prefix+'-mode"]'
        ).forEach(
          function(input){

            input.addEventListener(
              "change",
              function(){
                updateXModeVisibility(
                  scope
                );
              }
            );
          }
        );
      }
    );

    document.querySelectorAll(
      "[data-x-add-time]"
    ).forEach(
      function(button){

        button.addEventListener(
          "click",
          function(){

            addXTimeRow(
              button.dataset.xAddTime,
              "08:00"
            );
          }
        );
      }
    );
  }



  // ==========================================================
  // UNIFIED ENGINE / AUTOMATION CONTROLS
  // ==========================================================

  function engineControlStatus(message,type){
    const node=document.getElementById("engine-control-status");
    if(!node)return;
    node.textContent=message||"";
    node.className="admin-status"+(type?" "+type:"");
  }

  function automationTimeHost(service){
    return document.getElementById(service+"-control-times");
  }

  function addAutomationTime(service,value){
    const host=automationTimeHost(service);
    if(!host)return;

    const row=document.createElement("div");
    row.className="automation-time-row";

    const input=document.createElement("input");
    input.type="time";
    input.className="automation-time-input";
    input.value=value||"08:00";

    const remove=document.createElement("button");
    remove.type="button";
    remove.className="automation-time-remove";
    remove.textContent="×";
    remove.title="Remove time";

    remove.addEventListener("click",function(){
      const rows=host.querySelectorAll(".automation-time-row");
      if(rows.length<=1){
        engineControlStatus(
          "At least one run time is required.",
          "error"
        );
        return;
      }
      row.remove();
    });

    row.append(input,remove);
    host.appendChild(row);
  }

  function renderAutomationTimes(service,times,fallback){
    const host=automationTimeHost(service);
    if(!host)return;

    host.replaceChildren();

    const values=
      Array.isArray(times)&&times.length
        ? times
        : fallback;

    values.forEach(function(value){
      addAutomationTime(service,value);
    });
  }

  function collectAutomationTimes(service){
    const host=automationTimeHost(service);
    if(!host)return [];

    return Array.from(
      host.querySelectorAll(".automation-time-input")
    )
    .map(function(input){return input.value;})
    .filter(Boolean)
    .sort();
  }

  function renderEngineControlSettings(state){
    state=state||{};

    const engine=state.engine||{};
    const ai=state.ai||{};
    const health=state.health||{};
    const bridge=state.bridge||{};

    document.getElementById("engine-control-enabled").checked=
      engine.enabled!==false;

    document.getElementById("engine-control-every").value=
      Number(engine.every_value)>=1
        ? Number(engine.every_value)
        : 2;

    document.getElementById("engine-control-minute").value=
      Number.isInteger(Number(engine.minute))
        ? Number(engine.minute)
        : 17;

    document.getElementById("ai-control-enabled").checked=
      ai.enabled!==false;

    document.getElementById("health-control-enabled").checked=
      health.enabled!==false;

    document.getElementById("bridge-control-enabled").checked=
      bridge.enabled!==false;

    renderAutomationTimes(
      "ai",
      ai.schedule_times,
      ["08:00","16:00"]
    );

    renderAutomationTimes(
      "health",
      health.schedule_times,
      ["18:30"]
    );

    renderAutomationTimes(
      "bridge",
      bridge.schedule_times,
      ["03:37","09:37","15:37","21:37"]
    );

    const pill=document.getElementById("engine-control-state");

    const enabledCount=[
      engine.enabled!==false,
      ai.enabled!==false,
      health.enabled!==false,
      bridge.enabled!==false
    ].filter(Boolean).length;

    pill.textContent=
      enabledCount===4
        ? "All ON"
        : enabledCount+" / 4 ON";

    pill.className=
      "state-pill "+(enabledCount?"on":"off");

    const saved=document.getElementById("engine-control-saved");

    saved.textContent=
      state.updated_at
        ? "Last saved "+
          new Date(state.updated_at).toLocaleString()
        : "";
  }

  async function loadEngineControlSettings(){
    engineControlStatus("Loading automation controls…");

    const result=await client.rpc(
      "ms_get_engine_control_settings_v1"
    );

    if(result.error)throw result.error;

    renderEngineControlSettings(result.data||{});

    engineControlStatus(
      "Automation controls ready",
      "success"
    );
  }


  function collectEngineControlSettings(){

    return {
      engine:{
        enabled:
          document.getElementById(
            "engine-control-enabled"
          ).checked,
        mode:"every",
        every_value:Number(
          document.getElementById(
            "engine-control-every"
          ).value
        ),
        every_unit:"hours",
        minute:Number(
          document.getElementById(
            "engine-control-minute"
          ).value
        )
      },

      ai:{
        enabled:
          document.getElementById(
            "ai-control-enabled"
          ).checked,
        mode:"fixed_times",
        schedule_times:
          collectAutomationTimes("ai")
      },

      health:{
        enabled:
          document.getElementById(
            "health-control-enabled"
          ).checked,
        mode:"fixed_times",
        schedule_times:
          collectAutomationTimes("health")
      },

      bridge:{
        enabled:
          document.getElementById(
            "bridge-control-enabled"
          ).checked,
        mode:"fixed_times",
        schedule_times:
          collectAutomationTimes("bridge")
      },

      timezone:"America/New_York"
    };
  }


  async function testEngineControlSettings(){

    const button=document.getElementById(
      "engine-control-test"
    );

    button.disabled=true;
    button.textContent="Testing…";

    engineControlStatus(
      "Testing secure schedule connection…"
    );

    try{

      const settings=
        collectEngineControlSettings();

      const result=await client.functions.invoke(
        "engine-control-center-sync",
        {
          body:{
            action:"preview",
            settings:settings
          }
        }
      );

      if(result.error)throw result.error;

      if(
        !result.data ||
        result.data.ok!==true
      ){
        throw new Error(
          result.data?.error||
          "Schedule test failed."
        );
      }

      const changed=
        result.data.summary?.changed_files||[];

      engineControlStatus(
        "Test passed. GitHub connection verified. "+
        changed.length+
        " workflow file(s) would change.",
        "success"
      );

    }finally{
      button.disabled=false;
      button.textContent="Test schedules";
    }
  }

  async function saveEngineControlSettings(){
    const button=document.getElementById(
      "engine-control-save"
    );

    const everyValue=Number(
      document.getElementById(
        "engine-control-every"
      ).value
    );

    const minute=Number(
      document.getElementById(
        "engine-control-minute"
      ).value
    );

    if(
      !Number.isInteger(everyValue) ||
      everyValue<1 ||
      everyValue>24
    ){
      engineControlStatus(
        "Engine interval must be between 1 and 24 hours.",
        "error"
      );
      return;
    }

    if(
      !Number.isInteger(minute) ||
      minute<0 ||
      minute>59
    ){
      engineControlStatus(
        "Engine minute must be between 0 and 59.",
        "error"
      );
      return;
    }

    const aiTimes=collectAutomationTimes("ai");
    const healthTimes=collectAutomationTimes("health");
    const bridgeTimes=collectAutomationTimes("bridge");

    if(!aiTimes.length||!healthTimes.length||!bridgeTimes.length){
      engineControlStatus(
        "Each fixed schedule needs at least one time.",
        "error"
      );
      return;
    }

    button.disabled=true;
    button.textContent="Saving…";
    engineControlStatus("Saving automation controls…");

    try{
      const settings={
        engine:{
          enabled:
            document.getElementById(
              "engine-control-enabled"
            ).checked,
          mode:"every",
          every_value:everyValue,
          every_unit:"hours",
          minute:minute
        },

        ai:{
          enabled:
            document.getElementById(
              "ai-control-enabled"
            ).checked,
          mode:"fixed_times",
          schedule_times:aiTimes
        },

        health:{
          enabled:
            document.getElementById(
              "health-control-enabled"
            ).checked,
          mode:"fixed_times",
          schedule_times:healthTimes
        },

        bridge:{
          enabled:
            document.getElementById(
              "bridge-control-enabled"
            ).checked,
          mode:"fixed_times",
          schedule_times:bridgeTimes
        },

        timezone:"America/New_York"
      };

      engineControlStatus(
        "Validating schedules…"
      );

      const preview=await client.functions.invoke(
        "engine-control-center-sync",
        {
          body:{
            action:"preview",
            settings:settings
          }
        }
      );

      if(preview.error)throw preview.error;

      if(
        !preview.data ||
        preview.data.ok!==true
      ){
        throw new Error(
          preview.data?.error||
          "Schedule validation failed."
        );
      }

      engineControlStatus(
        "Validation passed. Applying schedules…"
      );

      const result=await client.functions.invoke(
        "engine-control-center-sync",
        {
          body:{
            action:"apply",
            settings:settings
          }
        }
      );

      if(result.error)throw result.error;

      if(
        !result.data ||
        result.data.ok!==true
      ){
        throw new Error(
          result.data?.error||
          "Schedule update failed."
        );
      }

      renderEngineControlSettings(
        result.data.settings||settings
      );

      engineControlStatus(
        "Automation controls saved.",
        "success"
      );

    }finally{
      button.disabled=false;
      button.textContent="Save Engine Controls";
    }
  }

  function wireEngineControlSettings(){
    document.querySelectorAll(
      "[data-automation-add-time]"
    ).forEach(function(button){

      button.addEventListener(
        "click",
        function(){
          addAutomationTime(
            button.dataset.automationAddTime,
            "08:00"
          );
        }
      );
    });
  }


  async function loadReport(){
    setStatus("Loading…");
    const results=await Promise.all([
      client.rpc("ms_admin_activity_dashboard",{p_start_date:startDate,p_end_date:endDate}),
      client.rpc("ms_get_admin_control_state",{p_start_date:startDate,p_end_date:endDate})
    ]);
    if(results[0].error)throw results[0].error;if(results[1].error)throw results[1].error;
    const control=results[1].data||{};renderReport(results[0].data||{},control.accounts||{});renderBanner(control.site_status||{});setStatus("Ready","success");
  }

  function healthValue(id,value,state){const node=document.getElementById(id);if(!node)return;node.textContent=value;node.className=state||"";}

  function healthTimestamp(value){
    if(!value)return "";
    const text=String(value).replace(/ UTC$/i,"Z").replace(" ","T");
    const date=new Date(text);
    if(Number.isNaN(date.getTime()))return String(value);
    return new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(date)+" ET";
  }

  function freshnessState(value,maxGoodHours,maxWarnHours){
    if(!value)return "warn";
    const text=String(value).replace(/ UTC$/i,"Z").replace(" ","T");
    const date=new Date(text);if(Number.isNaN(date.getTime()))return "warn";
    const age=(Date.now()-date.getTime())/3600000;
    return age<=maxGoodHours?"good":age<=maxWarnHours?"warn":"bad";
  }

  async function healthJson(path){
    try{const response=await fetch(path,{cache:"no-cache"});if(!response.ok)throw new Error(String(response.status));return await response.json();}
    catch(_){return null;}
  }

  function healthStateClass(value){
    const state=String(value||"").toLowerCase();
    if(state==="healthy"||state==="ok"||state==="success")return "good";
    if(state==="critical"||state==="failed"||state==="failure"||state==="bad")return "bad";
    return "warn";
  }

  function healthStatusLabel(value){
    const state=String(value||"unknown").toLowerCase();
    if(state==="healthy")return "Healthy";
    if(state==="degraded")return "Degraded";
    if(state==="warning")return "Warning";
    if(state==="critical")return "Critical";
    return state==="unknown"?"Unknown":state.charAt(0).toUpperCase()+state.slice(1);
  }

  function healthRuntime(seconds){
    const total=Number(seconds);
    if(!Number.isFinite(total)||total<0)return "runtime unavailable";
    const mins=Math.floor(total/60),secs=Math.round(total%60);
    return mins?`${mins}m ${String(secs).padStart(2,"0")}s`:`${secs}s`;
  }


  function csvCell(value){
    const text=String(value==null?"":value).replace(/\r?\n/g," ").trim();
    return '"' + text.replace(/"/g,'""') + '"';
  }

  function issueHistoryTime(value){
    if(!value)return "";
    try{
      return new Date(value).toLocaleString("en-US",{
        timeZone:"America/New_York",
        year:"numeric",
        month:"2-digit",
        day:"2-digit",
        hour:"2-digit",
        minute:"2-digit",
        second:"2-digit",
        hour12:true,
        timeZoneName:"short"
      });
    }catch(_){
      return value;
    }
  }

  function exportEngineIssueHistoryCsv(history){
    const issues=Array.isArray(history&&history.issues)?history.issues:[];
    if(!issues.length)return;

    const rows=[[
      "Issue Qty",
      "Issue",
      "Component",
      "Severity",
      "Status",
      "Max Consecutive Runs",
      "Occurrence Date/Time ET",
      "Run ID",
      "Run URL",
      "Reason",
      "Details"
    ]];

    issues.forEach(function(issue){
      const occs=Array.isArray(issue.occurrences)?issue.occurrences:[];

      if(!occs.length){
        rows.push([
          Number(issue.total_occurrences||0),
          issue.label||issue.message||issue.key||"",
          issue.component||"",
          issue.severity||"",
          issue.status||"",
          Number(issue.max_consecutive_runs||0),
          issueHistoryTime(issue.last_seen_utc),
          "",
          "",
          "",
          ""
        ]);
        return;
      }

      occs.forEach(function(occ){
        let detail="";
        try{
          detail=occ.detail&&Object.keys(occ.detail).length
            ? JSON.stringify(occ.detail)
            : "";
        }catch(_){
          detail="";
        }

        rows.push([
          Number(issue.total_occurrences||0),
          issue.label||issue.message||issue.key||"",
          issue.component||"",
          issue.severity||"",
          issue.status||"",
          Number(issue.max_consecutive_runs||0),
          issueHistoryTime(occ.seen_utc),
          occ.run_id||"",
          occ.run_url||"",
          occ.reason||"",
          detail
        ]);
      });
    });

    const csv="\uFEFF"+rows.map(function(row){
      return row.map(csvCell).join(",");
    }).join("\r\n");

    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    const today=new Date().toISOString().slice(0,10);

    a.href=url;
    a.download="engine-v2-issue-history-"+today+".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(function(){
      URL.revokeObjectURL(url);
    },1000);
  }

  function ensureHealthCsvButton(history){
    const host=document.getElementById("health-history-list");
    if(!host)return;

    const details=host.closest("details");
    if(!details)return;

    const summary=details.querySelector("summary");
    if(!summary)return;

    let button=summary.querySelector("#health-export-csv");

    if(!button){
      button=document.createElement("button");
      button.type="button";
      button.id="health-export-csv";
      button.className="health-export-csv";
      button.textContent="Export CSV";
      button.title="Export 180-day Engine V2 issue history";

      button.addEventListener("click",function(event){
        event.preventDefault();
        event.stopPropagation();
        exportEngineIssueHistoryCsv(button._history);
      });

      summary.appendChild(button);
    }

    button._history=history;
    button.disabled=!(
      history &&
      Array.isArray(history.issues) &&
      history.issues.length
    );
  }

function renderHealthHistory(history){
      const host=document.getElementById("health-history-list");
      if(!host)return;
      host.replaceChildren();
    ensureHealthCsvButton(history);

      let issues=[];
      if(Array.isArray(history&&history.issues)){
        issues=history.issues.slice();
      }else if(Array.isArray(history&&history.events)){
        issues=history.events.map(function(event){
          return {
            key:event.key,
            component:event.component,
            severity:event.severity,
            label:event.message||event.code||"Engine issue",
            status:event.status||"recovered",
            total_occurrences:1,
            max_consecutive_runs:Number(event.consecutive_runs||1),
            first_seen_utc:event.first_seen_utc,
            last_seen_utc:event.last_seen_utc,
            occurrences:[{
              seen_utc:event.last_seen_utc||event.first_seen_utc,
              run_id:event.last_run_id||event.first_run_id,
              run_url:null,
              reason:event.message||"Recorded engine issue.",
              detail:{}
            }]
          };
        });
      }

      issues.sort(function(a,b){
        return Number(b.total_occurrences||0)-Number(a.total_occurrences||0) ||
          String(b.last_seen_utc||"").localeCompare(String(a.last_seen_utc||""));
      });

      if(!issues.length){
        const empty=document.createElement("div");
        empty.className="health-history-empty";
        empty.textContent="No recorded issues.";
        host.appendChild(empty);
        return;
      }

      issues.forEach(function(issue){
        const details=document.createElement("details");
        details.className="health-issue-group";

        const summary=document.createElement("summary");
        summary.className="health-issue-summary";

        const qty=document.createElement("strong");
        qty.className="health-issue-qty";
        qty.textContent=String(Number(issue.total_occurrences||0))+"x";

        const title=document.createElement("span");
        title.className="health-issue-title";
        title.textContent=issue.label||issue.message||issue.key||"Engine issue";

        const status=document.createElement("span");
        status.className="health-issue-status "+(issue.status==="active"?"active":"recovered");
        status.textContent=issue.status==="active"?"Active":"Recovered";

        summary.append(qty,title,status);

        const meta=document.createElement("div");
        meta.className="health-issue-meta";
        const last=issue.last_seen_utc?healthTimestamp(issue.last_seen_utc):"Unknown";
        const maxConsecutive=Number(issue.max_consecutive_runs||1);
        let extra="Last seen "+last+" • Max "+maxConsecutive+" consecutive run"+(maxConsecutive===1?"":"s");
        if(Number(issue.max_affected||0)>0){
          extra+=" • Max affected "+Number(issue.max_affected);
        }
        meta.textContent=extra;

        const occurrenceWrap=document.createElement("div");
        occurrenceWrap.className="health-occurrence-list";

        const occs=Array.isArray(issue.occurrences)?issue.occurrences.slice().reverse():[];
        occs.forEach(function(occ){
          const row=document.createElement("div");
          row.className="health-occurrence-row";

          const top=document.createElement("div");
          top.className="health-occurrence-top";

          const when=document.createElement("span");
          when.textContent=occ.seen_utc?healthTimestamp(occ.seen_utc):"Time unavailable";

          let run;
          if(occ.run_url){
            run=document.createElement("a");
            run.href=occ.run_url;
            run.target="_blank";
            run.rel="noopener";
            run.textContent=occ.run_id?"Run "+occ.run_id:"Open run";
          }else{
            run=document.createElement("span");
            run.textContent=occ.run_id?"Run "+occ.run_id:"";
          }
          top.append(when,run);

          const reason=document.createElement("div");
          reason.className="health-occurrence-reason";
          reason.textContent=occ.reason||"Recorded engine issue.";

          row.append(top,reason);
          occurrenceWrap.appendChild(row);
        });

        details.append(summary,meta,occurrenceWrap);
        host.appendChild(details);
      });
    }

  function operationalNumber(value){
    const number=Number(value);
    return Number.isFinite(number)?number:null;
  }

  function operationalAverage(values){
    const usable=values.filter(function(value){return Number.isFinite(value);});
    if(!usable.length)return null;
    return usable.reduce(function(total,value){return total+value;},0)/usable.length;
  }

  function operationalFormat(value,kind){
    if(!Number.isFinite(value))return "—";
    if(kind==="seconds")return value.toFixed(value>=100?0:1)+"s";
    if(kind==="percent")return value.toFixed(1)+"%";
    if(kind==="count")return Math.round(value).toLocaleString();
    return value.toFixed(1);
  }

  function operationalTrend(current,average,higherIsBetter){
    if(!Number.isFinite(current)||!Number.isFinite(average)){
      return {label:"No baseline",className:""};
    }

    if(average===0){
      if(current===0){
        return {label:"Stable",className:"good"};
      }

      return {
        label:"\u2191 from 0 vs 7d",
        className:higherIsBetter?"good":"warn"
      };
    }

    const delta=((current-average)/Math.abs(average))*100;

    if(Math.abs(delta)<5){
      return {label:"Stable",className:"good"};
    }

    const improving=higherIsBetter ? delta>0 : delta<0;

    return {
      label:(delta>0?"↑ ":"↓ ")+Math.abs(delta).toFixed(0)+"% vs 7d",
      className:improving?"good":"warn"
    };
  }

  function operationalTimestamp(value){
    const raw=String(value||"").trim();
    if(!raw)return null;

    let normalized=raw;

    if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/.test(raw)){
      normalized=raw.replace(" ","T").replace(" UTC","Z");
    }

    const stamp=Date.parse(normalized);
    return Number.isFinite(stamp)?stamp:null;
  }

  function operationalWindow(records,days){
    if(!records.length)return [];

    const latest=operationalTimestamp(records[records.length-1].updated_utc);
    if(latest===null)return records;

    const cutoff=latest-(days*24*60*60*1000);

    return records.filter(function(record){
      const stamp=operationalTimestamp(record.updated_utc);
      return stamp!==null&&stamp>=cutoff&&stamp<=latest;
    });
  }

  function operationalSparkline(values){
    const usable=values.map(function(value){
      return Number.isFinite(value)?value:null;
    });

    const finite=usable.filter(function(value){return value!==null;});
    if(finite.length<2){
      return '<div class="operational-spark-empty">Not enough history yet</div>';
    }

    const width=220,height=48,pad=3;
    const min=Math.min.apply(null,finite);
    const max=Math.max.apply(null,finite);
    const span=max-min||1;
    const step=(width-(pad*2))/Math.max(1,usable.length-1);

    const points=[];
    usable.forEach(function(value,index){
      if(value===null)return;
      const x=pad+(index*step);
      const y=height-pad-((value-min)/span)*(height-(pad*2));
      points.push(x.toFixed(1)+","+y.toFixed(1));
    });

    return '<svg class="operational-spark" viewBox="0 0 '+width+' '+height+
      '" preserveAspectRatio="none" aria-hidden="true">'+
      '<polyline points="'+points.join(" ")+'" fill="none" '+
      'stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>'+
      '</svg>';
  }

  function operationalMetricCard(config,records){
    const values=records.map(function(record){
      try{return operationalNumber(config.value(record));}
      catch(error){return null;}
    });

    const current=values.length?values[values.length-1]:null;

    const records7=operationalWindow(records,7);
    const values7=records7.map(function(record){
      try{return operationalNumber(config.value(record));}
      catch(error){return null;}
    });

    const average7=operationalAverage(values7);
    const average30=operationalAverage(values);
    const trend=operationalTrend(current,average7,config.higherIsBetter);

    return ''+
      '<article class="operational-metric">'+
        '<div class="operational-metric-title">'+config.label+'</div>'+
        '<div class="operational-metric-current">'+
          operationalFormat(current,config.kind)+
        '</div>'+
        '<div class="operational-metric-stats">'+
          '<span>7d avg <strong>'+operationalFormat(average7,config.kind)+'</strong></span>'+
          '<span>30d avg <strong>'+operationalFormat(average30,config.kind)+'</strong></span>'+
        '</div>'+
        '<div class="operational-trend '+trend.className+'">'+trend.label+'</div>'+
        operationalSparkline(values)+
      '</article>';
  }

  function renderOperationalHistory(payload){
    const host=document.getElementById("operational-history-grid");
    const meta=document.getElementById("operational-history-meta");
    const diagnostics=document.getElementById("operational-diagnostics-body");

    if(!host||!meta||!diagnostics)return;

    const records=payload&&Array.isArray(payload.records)?payload.records:[];

    if(!records.length){
      host.innerHTML='<div class="operational-empty">Operational history will appear after the next Engine production run.</div>';
      diagnostics.textContent="No operational history is available yet.";
      meta.textContent="Waiting for production history";
      return;
    }

    const metrics=[
      {
        label:"Engine runtime",
        kind:"seconds",
        higherIsBetter:false,
        value:function(record){return record.runtime&&record.runtime.engine_seconds;}
      },
      {
        label:"Source collection",
        kind:"seconds",
        higherIsBetter:false,
        value:function(record){return record.runtime&&record.runtime.source_collection_seconds;}
      },
      {
        label:"Fresh PSI coverage",
        kind:"percent",
        higherIsBetter:true,
        value:function(record){
          const coverage=record.psi_coverage||{};
          const total=operationalNumber(coverage.assets_total);
          const fresh=operationalNumber(coverage.fresh_total);
          return total&&fresh!==null?(fresh/total)*100:null;
        }
      },
      {
        label:"Working sources",
        kind:"count",
        higherIsBetter:true,
        value:function(record){return record.sources&&record.sources.working;}
      },
      {
        label:"Date recovery",
        kind:"percent",
        higherIsBetter:true,
        value:function(record){
          const rate=record.evidence_quality&&record.evidence_quality.article_date_recovery_rate;
          const value=operationalNumber(rate);
          return value===null?null:value*100;
        }
      },
      {
        label:"Feed failures",
        kind:"count",
        higherIsBetter:false,
        value:function(record){
          return record.technical_feeds&&record.technical_feeds.failed_without_fallback;
        }
      }
    ];

    host.innerHTML=metrics.map(function(metric){
      return operationalMetricCard(metric,records);
    }).join("");

    const latest=records[records.length-1]||{};
    const coverage=latest.psi_coverage||{};
    const fallback=latest.fallback_diagnostics||{};
    const workload=latest.workload||{};
    const sources=latest.sources||{};

    diagnostics.innerHTML=
      '<div><span>Latest run</span><strong>'+
        (latest.updated_utc?healthTimestamp(latest.updated_utc):"Unknown")+
      '</strong></div>'+
      '<div><span>Fresh PSI assets</span><strong>'+
        operationalFormat(operationalNumber(coverage.fresh_total),"count")+
        ' / '+operationalFormat(operationalNumber(coverage.assets_total),"count")+
      '</strong></div>'+
      '<div><span>Prior fallback</span><strong>'+
        operationalFormat(operationalNumber(coverage.prior_fallback),"count")+
      '</strong></div>'+
      '<div><span>Outside 48h</span><strong>'+
        operationalFormat(operationalNumber(fallback.outside_48h_window),"count")+
      '</strong></div>'+
      '<div><span>Unknown dates</span><strong>'+
        operationalFormat(operationalNumber(fallback.unknown_publication_date),"count")+
      '</strong></div>'+
      '<div><span>Planned requests</span><strong>'+
        operationalFormat(operationalNumber(workload.planned_request_opportunities),"count")+
      '</strong></div>'+
      '<div><span>Failed sources</span><strong>'+
        operationalFormat(operationalNumber(sources.failed),"count")+
      '</strong></div>'+
      '<div><span>History retained</span><strong>'+
        records.length+' run'+(records.length===1?"":"s")+
      '</strong></div>';

    meta.textContent=
      records.length+" retained run"+(records.length===1?"":"s")+
      " • 30-day rolling history";
  }

  async function loadOperationalHistory(){
    const payload=await healthJson("engine_operational_history.json");
    renderOperationalHistory(payload);
  }

  async function loadLegacyHealth(){
    const results=await Promise.all([
      healthJson("status.json"),
      healthJson("technical_data.json"),
      healthJson("ai_status.json")
    ]);
    const status=results[0]||{},technical=results[1]||{},ai=results[2]||{};
    const technicalHealth=technical.health||{};

    const engineFreshStamp=technical.updated_utc||status.updated_utc||"";
    const engineDisplay=status.updated_ny||status.updated||status.updated_utc||technical.updated_utc||"";
    const coreState=engineFreshStamp?freshnessState(engineFreshStamp,8,18):"warn";

    healthValue("health-overall",coreState==="good"?"Healthy":"Monitoring data unavailable",coreState);
    healthValue("health-run",engineDisplay?(String(engineDisplay).includes("NY Time")?engineDisplay:healthTimestamp(engineDisplay)):"Unavailable",coreState);

    const fresh=Number(technicalHealth.fresh_instruments||0);
    const failures=Number(technicalHealth.failed_without_fallback||0);
    const stale=Number(technicalHealth.preserved_stale_instruments||0);
    healthValue("health-data",`${fresh} fresh • ${failures} failed • ${stale} stale`,failures?"bad":stale||!fresh?"warn":"good");

    const aiState=String(ai.status||"unknown").toLowerCase();
    const provider=ai.active_provider||"—";
    healthValue("health-ai",`${healthStatusLabel(aiState)}${provider!=="—"?` • ${provider}`:""}`,healthStateClass(aiState));

    renderHealthHistory(null);
  }

  async function loadHealth(){
    ["health-overall","health-run","health-data","health-ai"].forEach(function(id){
      healthValue(id,"Checking…","");
    });

    const alertBox=document.getElementById("health-active-alert");
    const alertText=document.getElementById("health-alert-text");
    if(alertBox)alertBox.hidden=true;
    if(alertText)alertText.textContent="";

    const results=await Promise.all([
      healthJson("engine_health.json"),
      healthJson("engine_failure_log.json"),
      healthJson("engine_issue_history.json")
    ]);
    const health=results[0],log=results[1],history=results[2];

    if(!health){
      await loadLegacyHealth();
      return;
    }

    const overall=String(health.overall_status||"unknown").toLowerCase();
    healthValue("health-overall",healthStatusLabel(overall),healthStateClass(overall));

    const workflow=health.workflow||{};
    const completed=workflow.completed_at||health.updated_utc||"";
    healthValue(
      "health-run",
      `${completed?healthTimestamp(completed):"Time unavailable"} • ${healthRuntime(workflow.runtime_seconds)}`,
      healthStateClass(workflow.conclusion||overall)
    );

    const components=health.components||{};
    const core=components.core_data||{};
    const feeds=components.technical_feeds||{};
    const fresh=Number(feeds.fresh_instruments||0);
    const failed=Number(feeds.failed_without_fallback||0);
    const stale=Number(feeds.preserved_stale_instruments||0);
    healthValue(
      "health-data",
      `${healthStatusLabel(core.status||"unknown")} core • ${fresh} fresh / ${failed} failed / ${stale} stale`,
      healthStateClass(failed>0?"critical":stale>0?"degraded":feeds.status||core.status||"unknown")
    );

    const ai=components.ai||{};
    const aiStatus=String(ai.status||"unknown").toLowerCase();
    const aiParts=[healthStatusLabel(aiStatus)];
    if(ai.provider&&ai.provider!=="—")aiParts.push(ai.provider);
    if(ai.market_pulse_ai_status==="failed")aiParts.push("Market Pulse fallback");
    healthValue("health-ai",aiParts.join(" • "),healthStateClass(aiStatus));

    const alerts=Array.isArray(health.active_alerts)?health.active_alerts:[];
    if(alertBox&&alertText&&alerts.length){
      const first=alerts[0]||{};
      const repeat=Number(first.consecutive_runs||1);
      alertText.textContent=(alerts.length>1?`${alerts.length} alerts • `:"")+
        (first.message||"Engine issue detected.")+
        (repeat>1?` • ${repeat} consecutive runs`:"");
      alertBox.className="health-active-alert "+healthStateClass(first.severity);
      alertBox.hidden=false;
    }

    renderHealthHistory(history||log);
  }

  async function saveBanner(){
    const button=document.getElementById("banner-save");const enabled=document.getElementById("banner-enabled").checked;const message=document.getElementById("banner-message").value.trim();const expected=document.getElementById("banner-expected").value.trim();
    if(enabled&&!message){setStatus("Enter a banner message before turning it on.","error");return;}
    button.disabled=true;button.textContent="Saving…";
    try{
      const result=await client.rpc("ms_update_site_status",{p_maintenance:enabled,p_message:message,p_expected_back:expected});
      if(result.error)throw result.error;renderBanner(result.data||{});setStatus(enabled?"Banner is now visible across the website.":"Banner has been removed.","success");
    }finally{button.disabled=false;button.textContent="Save banner";}
  }

  function downloadCsv(){
    if(!report)return;const rows=[["start_date",startDate],["end_date",endDate],["page_views",report.summary&&report.summary.page_views||0],["sessions",report.summary&&report.summary.sessions||0],["votes",report.summary&&report.summary.votes||0],[""],["page","views"]];
    (report.pages||[]).forEach(function(row){rows.push([row.page,row.count]);});
    const csv=rows.map(function(row){return row.map(escapeCsv).join(",");}).join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="website-summary-"+startDate+"-to-"+endDate+".csv";document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  }

  async function initialize(){
    try{
      const session=await requireOwner();if(!session)return;reveal();chooseRange(30);await Promise.all([loadReport(),loadHealth(),loadOperationalHistory(),loadXRefreshSettings(),loadEngineControlSettings()]);
    }catch(error){deny(error);}
  }

  document.querySelectorAll("[data-range]").forEach(function(button){button.addEventListener("click",function(){chooseRange(Number(button.dataset.range));loadReport().catch(function(error){setStatus(error.message||"Report failed.","error");});});});
  ["banner-enabled","banner-message","banner-expected"].forEach(function(id){document.getElementById(id).addEventListener("input",updatePreview);});
  document.getElementById("activity-refresh").addEventListener("click",function(){loadReport().catch(function(error){setStatus(error.message||"Report failed.","error");});});
  document.getElementById("activity-summary-download").addEventListener("click",downloadCsv);
  document.getElementById("health-refresh").addEventListener("click",loadHealth);
  document.getElementById("operational-history-refresh").addEventListener("click",loadOperationalHistory);
  document.getElementById("banner-save").addEventListener("click",function(){saveBanner().catch(function(error){setStatus(error.message||"Banner could not be saved.","error");});});
  document.getElementById("x-refresh-save").addEventListener("click",function(){
    saveXRefreshSettings().catch(function(error){
      xRefreshStatus(
        error.message||"X schedule could not be saved.",
        "error"
      );
    });
  });



  document.getElementById("engine-control-test")
    .addEventListener("click",function(){
      testEngineControlSettings()
        .catch(function(error){
          engineControlStatus(
            error.message||
            "Schedule connection test failed.",
            "error"
          );
        });
    });

  document.getElementById("engine-control-save")
    .addEventListener("click",function(){
      saveEngineControlSettings()
        .catch(function(error){
          engineControlStatus(
            error.message||
            "Automation controls could not be saved.",
            "error"
          );
        });
    });

  document.getElementById("admin-signout").addEventListener("click",async function(){await client.auth.signOut({scope:"local"});window.location.replace("index.html");});

  wireEngineControlSettings();

  wireXScheduleControls();

  initialize();
})();
