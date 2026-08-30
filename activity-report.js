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

  function renderHealthHistory(log){
    const host=document.getElementById("health-history-list");
    if(!host)return;
    host.replaceChildren();

    const events=Array.isArray(log&&log.events)?log.events.slice():[];
    events.sort(function(a,b){
      return String(b.last_seen_utc||b.first_seen_utc||"").localeCompare(String(a.last_seen_utc||a.first_seen_utc||""));
    });

    if(!events.length){
      const empty=document.createElement("div");
      empty.className="health-history-empty";
      empty.textContent="No recorded issues.";
      host.appendChild(empty);
      return;
    }

    events.slice(0,8).forEach(function(event){
      const row=document.createElement("div");
      row.className="health-history-row";

      const top=document.createElement("div");
      top.className="health-history-top";

      const name=document.createElement("strong");
      name.textContent=(event.component||"System")+" • "+(event.status==="recovered"?"Recovered":healthStatusLabel(event.severity));

      const when=document.createElement("span");
      const stamp=event.recovered_utc||event.last_seen_utc||event.first_seen_utc||"";
      when.textContent=stamp?healthTimestamp(stamp):"";

      top.append(name,when);

      const message=document.createElement("div");
      message.className="health-history-message";
      message.textContent=event.message||"Recorded engine issue.";

      const meta=document.createElement("small");
      const runs=Number(event.consecutive_runs||1);
      meta.textContent=runs>1?`${runs} consecutive runs`:"1 run";

      row.append(top,message,meta);
      host.appendChild(row);
    });
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
      healthJson("engine_failure_log.json")
    ]);
    const health=results[0],log=results[1];

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

    renderHealthHistory(log);
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
      const session=await requireOwner();if(!session)return;reveal();chooseRange(30);await Promise.all([loadReport(),loadHealth()]);
    }catch(error){deny(error);}
  }

  document.querySelectorAll("[data-range]").forEach(function(button){button.addEventListener("click",function(){chooseRange(Number(button.dataset.range));loadReport().catch(function(error){setStatus(error.message||"Report failed.","error");});});});
  ["banner-enabled","banner-message","banner-expected"].forEach(function(id){document.getElementById(id).addEventListener("input",updatePreview);});
  document.getElementById("activity-refresh").addEventListener("click",function(){loadReport().catch(function(error){setStatus(error.message||"Report failed.","error");});});
  document.getElementById("activity-summary-download").addEventListener("click",downloadCsv);
  document.getElementById("health-refresh").addEventListener("click",loadHealth);
  document.getElementById("banner-save").addEventListener("click",function(){saveBanner().catch(function(error){setStatus(error.message||"Banner could not be saved.","error");});});
  document.getElementById("admin-signout").addEventListener("click",async function(){await client.auth.signOut({scope:"local"});window.location.replace("index.html");});

  initialize();
})();
