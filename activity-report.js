(function(){
  "use strict";

  const client = window.psdSupabase;
  if(!client) return;

  let currentRows = [];

  function isoDate(date){
    return date.toISOString().slice(0,10);
  }

  function setStatus(message,type){
    const node=document.getElementById("activity-status");
    node.textContent=message||"";
    node.className="activity-status"+(type?" "+type:"");
  }

  function number(value){
    return Number(value||0).toLocaleString();
  }

  function escapeCsv(value){
    const text=String(value??"");
    return /[",\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;
  }

  function render(rows){
    currentRows=rows||[];
    const body=document.getElementById("activity-body");
    body.textContent="";

    let total=0,member=0,guest=0;
    const pages=new Map();

    currentRows.forEach(function(row){
      const count=Number(row.event_count||0);
      total+=count;
      if(row.visitor_type==="member") member+=count;
      else guest+=count;
      pages.set(row.page_path,(pages.get(row.page_path)||0)+count);

      const tr=document.createElement("tr");
      [row.event_date,row.visitor_type,row.page_path,row.event_name,row.feature_name||"",number(count)].forEach(function(value){
        const td=document.createElement("td");
        td.textContent=value;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    if(!currentRows.length){
      const tr=document.createElement("tr");
      const td=document.createElement("td");
      td.colSpan=6;
      td.textContent="No activity was recorded for this period.";
      tr.appendChild(td);
      body.appendChild(tr);
    }

    let topPage="—",topCount=-1;
    pages.forEach(function(count,page){if(count>topCount){topPage=page;topCount=count;}});
    document.getElementById("summary-total").textContent=number(total);
    document.getElementById("summary-member").textContent=number(member);
    document.getElementById("summary-guest").textContent=number(guest);
    document.getElementById("summary-page").textContent=topPage;
  }

  async function load(){
    setStatus("Loading report…");
    const start=document.getElementById("activity-start").value;
    const end=document.getElementById("activity-end").value;

    const sessionResult=await client.auth.getSession();
    const session=sessionResult.data&&sessionResult.data.session;
    if(!session){window.location.replace("auth.html");return;}

    const profile=await client.from("profiles").select("is_admin").eq("id",session.user.id).single();
    if(profile.error||!profile.data||profile.data.is_admin!==true){
      render([]);
      setStatus("Owner access is required.","error");
      return;
    }

    const result=await client.rpc("ms_get_usage_report",{
      p_start_date:start,
      p_end_date:end
    });

    if(result.error){render([]);setStatus(result.error.message,"error");return;}
    render(result.data||[]);
    setStatus("Report ready.","success");
  }

  function download(){
    if(!currentRows.length){setStatus("There is no activity to download.","error");return;}
    const headers=["event_date","visitor_type","page_path","event_name","feature_name","event_count","updated_at"];
    const lines=[headers.join(",")];
    currentRows.forEach(function(row){
      lines.push(headers.map(function(key){return escapeCsv(row[key]);}).join(","));
    });
    const blob=new Blob([lines.join("\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download="public-sentiment-activity-"+document.getElementById("activity-start").value+"-to-"+document.getElementById("activity-end").value+".csv";
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }

  const end=new Date();
  const start=new Date();start.setDate(start.getDate()-29);
  document.getElementById("activity-start").value=isoDate(start);
  document.getElementById("activity-end").value=isoDate(end);
  document.getElementById("activity-refresh").addEventListener("click",load);
  document.getElementById("activity-download").addEventListener("click",download);
  load().catch(function(error){setStatus(error.message,"error");});
})();
