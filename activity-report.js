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

  function healthValue(id,value,state){const node=document.getElementById(id);node.textContent=value;node.className=state||"";}
  async function loadHealth(){
    healthValue("health-dashboard","Checking…","");healthValue("health-feeds","Checking…","");healthValue("health-failed","Checking…","");healthValue("health-workflow","Checking…","");
    const results=await Promise.all([
      fetch("dashboard_live.json",{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error();return r.json();}),
      fetch("technical_data.json",{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error();return r.json();}),
      fetch("status.json",{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error();return r.json();})
    ]).catch(function(){return null;});
    if(!results){["health-dashboard","health-feeds","health-failed","health-workflow"].forEach(function(id){healthValue(id,"Unavailable","bad");});return;}
    const dashboard=results[0]||{},technical=results[1]||{},status=results[2]||{},health=technical.health||{};
    healthValue("health-dashboard",dashboard.updated_ny||dashboard.updated_utc||"Available","good");
    healthValue("health-feeds",number(health.fresh_instruments)+" fresh",Number(health.fresh_instruments)>0?"good":"warn");
    const failures=Number(health.failed_without_fallback||0),stale=Number(health.preserved_stale_instruments||0);
    healthValue("health-failed",failures+" failed / "+stale+" stale",failures?"bad":stale?"warn":"good");
    healthValue("health-workflow",status.updated_ny||status.updated||status.updated_utc||"Available","good");
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
