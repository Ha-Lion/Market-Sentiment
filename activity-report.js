(function(){
  "use strict";

  const client = window.psdSupabase;
  if(!client) return;

  let currentReport = null;
  let currentDetailRows = [];

  function number(value){
    return Number(value || 0).toLocaleString();
  }

  function escapeCsv(value){
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function setStatus(message,type){
    const node = document.getElementById("activity-status");
    node.textContent = message || "";
    node.className = "activity-status" + (type ? " " + type : "");
  }

  function etDateString(date){
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone:"America/New_York",
      year:"numeric",
      month:"2-digit",
      day:"2-digit"
    }).formatToParts(date);
    const map = {};
    parts.forEach(function(part){ map[part.type] = part.value; });
    return map.year + "-" + map.month + "-" + map.day;
  }

  function addDays(iso,days){
    const date = new Date(iso + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0,10);
  }

  function monthStart(iso){
    return iso.slice(0,7) + "-01";
  }

  function previousMonthRange(today){
    const first = new Date(monthStart(today) + "T12:00:00Z");
    first.setUTCMonth(first.getUTCMonth() - 1);
    const start = first.toISOString().slice(0,10);
    const endDate = new Date(monthStart(today) + "T12:00:00Z");
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    return { start:start, end:endDate.toISOString().slice(0,10) };
  }

  function setRange(range){
    const today = etDateString(new Date());
    let start = addDays(today, -29);
    let end = today;

    if(range === "this-month"){
      start = monthStart(today);
    }else if(range === "last-month"){
      const previous = previousMonthRange(today);
      start = previous.start;
      end = previous.end;
    }else{
      const days = Math.max(1, Number(range || 30));
      start = addDays(today, -(days - 1));
    }

    document.getElementById("activity-start").value = start;
    document.getElementById("activity-end").value = end;

    document.querySelectorAll("[data-range]").forEach(function(button){
      button.classList.toggle("active", button.dataset.range === String(range));
    });
  }

  function fillEmpty(tbody,colspan,message){
    tbody.textContent = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = colspan;
    td.className = "activity-empty";
    td.textContent = message || "No activity was recorded for this period.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function renderTable(tbodyId,rows,columns){
    const tbody = document.getElementById(tbodyId);
    tbody.textContent = "";

    if(!rows || !rows.length){
      fillEmpty(tbody, columns.length);
      return;
    }

    rows.forEach(function(row){
      const tr = document.createElement("tr");
      columns.forEach(function(column){
        const td = document.createElement("td");
        const value = typeof column === "function" ? column(row) : row[column];
        td.textContent = value == null || value === "" ? "—" : value;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function renderRankList(id,rows,labelKey){
    const node = document.getElementById(id);
    node.textContent = "";

    if(!rows || !rows.length){
      const empty = document.createElement("div");
      empty.className = "activity-rank-row";
      empty.textContent = "No data";
      node.appendChild(empty);
      return;
    }

    rows.forEach(function(row){
      const line = document.createElement("div");
      line.className = "activity-rank-row";
      const label = document.createElement("span");
      label.textContent = row[labelKey] || "Unknown";
      const count = document.createElement("strong");
      count.textContent = number(row.count);
      line.appendChild(label);
      line.appendChild(count);
      node.appendChild(line);
    });
  }

  function voteNet(row){
    const bullish = Number(row.bullish || 0);
    const bearish = Number(row.bearish || 0);
    const difference = bullish - bearish;
    if(difference > 0) return "Bullish +" + number(difference);
    if(difference < 0) return "Bearish " + number(difference);
    return "Even";
  }

  function hourLabel(hour){
    const start = String(Number(hour || 0)).padStart(2,"0") + ":00";
    const end = String(Number(hour || 0)).padStart(2,"0") + ":59";
    return start + "–" + end;
  }

  function renderReport(report,details){
    currentReport = report || {};
    currentDetailRows = details || [];

    const summary = currentReport.summary || {};
    document.getElementById("summary-total").textContent = number(summary.total_activities);
    document.getElementById("summary-pageviews").textContent = number(summary.page_views);
    document.getElementById("summary-sessions").textContent = number(summary.sessions);
    document.getElementById("summary-votes").textContent = number(summary.votes);
    document.getElementById("summary-member").textContent = number(summary.member_activities);
    document.getElementById("summary-guest").textContent = number(summary.guest_activities);
    document.getElementById("summary-page").textContent = summary.most_used_page || "—";
    document.getElementById("summary-feature").textContent = summary.top_feature || "—";
    document.getElementById("summary-region").textContent = summary.top_region || "—";
    document.getElementById("summary-device").textContent =
      (summary.top_device || "—") + " / " + (summary.top_source || "—");

    document.getElementById("activity-generated").textContent =
      "Generated: " + (currentReport.generated_at_et || "—") + " ET";

    renderTable("monthly-body", currentReport.monthly || [], [
      "month",
      function(row){ return number(row.total); },
      function(row){ return number(row.member); },
      function(row){ return number(row.guest); },
      function(row){ return number(row.page_views); },
      function(row){ return number(row.sessions); },
      function(row){ return number(row.votes); }
    ]);

    renderTable("hourly-body", currentReport.hourly_et || [], [
      function(row){ return hourLabel(row.hour); },
      function(row){ return number(row.total); },
      function(row){ return number(row.page_views); },
      function(row){ return number(row.sessions); },
      function(row){ return number(row.votes); }
    ]);

    renderTable("votes-body", currentReport.votes || [], [
      "instrument",
      function(row){ return number(row.bullish); },
      function(row){ return number(row.bearish); },
      function(row){ return number(row.total); },
      voteNet
    ]);

    renderRankList("regions-list", currentReport.regions || [], "region");
    renderRankList("devices-list", currentReport.devices || [], "device");
    renderRankList("sources-list", currentReport.sources || [], "source");

    renderTable("pages-body", currentReport.pages || [], [
      "page",
      function(row){ return number(row.count); }
    ]);

    renderTable("features-body", currentReport.features || [], [
      "event",
      "feature",
      function(row){ return number(row.count); }
    ]);

    renderTable("activity-body", currentDetailRows, [
      "event_date_et",
      function(row){ return hourLabel(row.event_hour_et); },
      "visitor_type",
      "region_group",
      "device_type",
      "traffic_source",
      "page_path",
      "event_name",
      "feature_name",
      function(row){ return number(row.event_count); }
    ]);
  }

  async function requireOwner(){
    const sessionResult = await client.auth.getSession();
    const session = sessionResult.data && sessionResult.data.session;
    if(!session){
      window.location.replace("auth.html");
      return null;
    }

    const profile = await client
      .from("profiles")
      .select("is_admin")
      .eq("id",session.user.id)
      .single();

    if(profile.error || !profile.data || profile.data.is_admin !== true){
      throw new Error("Owner access is required.");
    }
    return session;
  }

  async function load(){
    setStatus("Loading privacy-safe report…");
    const session = await requireOwner();
    if(!session) return;

    const start = document.getElementById("activity-start").value;
    const end = document.getElementById("activity-end").value;

    const results = await Promise.all([
      client.rpc("ms_get_activity_dashboard_v2", {
        p_start_date:start,
        p_end_date:end
      }),
      client.rpc("ms_get_activity_detail_v2", {
        p_start_date:start,
        p_end_date:end,
        p_offset:0,
        p_limit:500
      })
    ]);

    if(results[0].error) throw results[0].error;
    if(results[1].error) throw results[1].error;

    renderReport(results[0].data || {}, results[1].data || []);
    setStatus("Report ready. All displayed data is aggregate.","success");
  }

  function addCsvSection(lines,title,headers,rows){
    lines.push(title);
    lines.push(headers.map(escapeCsv).join(","));
    (rows || []).forEach(function(row){
      lines.push(row.map(escapeCsv).join(","));
    });
    lines.push("");
  }

  function downloadSummary(){
    if(!currentReport){
      setStatus("Load the report before downloading.","error");
      return;
    }

    const summary = currentReport.summary || {};
    const lines = [];
    addCsvSection(lines,"REPORT INFORMATION",["field","value"],[
      ["generated_at_et",currentReport.generated_at_et || ""],
      ["start_date",currentReport.start_date || ""],
      ["end_date",currentReport.end_date || ""],
      ["retention_start_date",currentReport.retention_start_date || ""],
      ["privacy_note",currentReport.privacy_note || ""]
    ]);

    addCsvSection(lines,"SUMMARY",["metric","count_or_value"],[
      ["total_activities",summary.total_activities || 0],
      ["page_views",summary.page_views || 0],
      ["sessions",summary.sessions || 0],
      ["votes",summary.votes || 0],
      ["member_activities",summary.member_activities || 0],
      ["guest_activities",summary.guest_activities || 0],
      ["most_used_page",summary.most_used_page || ""],
      ["top_feature",summary.top_feature || ""],
      ["top_region",summary.top_region || ""],
      ["top_device",summary.top_device || ""],
      ["top_source",summary.top_source || ""]
    ]);

    addCsvSection(lines,"MONTHLY",["month","total","member","guest","page_views","sessions","votes"],
      (currentReport.monthly || []).map(function(row){
        return [row.month,row.total,row.member,row.guest,row.page_views,row.sessions,row.votes];
      })
    );

    addCsvSection(lines,"DAILY",["date","total","member","guest","page_views","sessions","votes"],
      (currentReport.daily || []).map(function(row){
        return [row.date,row.total,row.member,row.guest,row.page_views,row.sessions,row.votes];
      })
    );

    addCsvSection(lines,"VOTES",["instrument","bullish","bearish","other","total","net"],
      (currentReport.votes || []).map(function(row){
        return [row.instrument,row.bullish,row.bearish,row.other,row.total,voteNet(row)];
      })
    );

    addCsvSection(lines,"PAGES",["page","views"],
      (currentReport.pages || []).map(function(row){ return [row.page,row.count]; })
    );

    addCsvSection(lines,"FEATURES",["event","feature","count"],
      (currentReport.features || []).map(function(row){ return [row.event,row.feature,row.count]; })
    );

    addCsvSection(lines,"REGIONS",["broad_region","page_views"],
      (currentReport.regions || []).map(function(row){ return [row.region,row.count]; })
    );

    addCsvSection(lines,"DEVICES",["device_class","page_views"],
      (currentReport.devices || []).map(function(row){ return [row.device,row.count]; })
    );

    addCsvSection(lines,"SOURCES",["source_category","page_views"],
      (currentReport.sources || []).map(function(row){ return [row.source,row.count]; })
    );

    addCsvSection(lines,"EASTERN_TIME_HOURS",["hour_et","total","page_views","sessions","votes"],
      (currentReport.hourly_et || []).map(function(row){
        return [hourLabel(row.hour),row.total,row.page_views,row.sessions,row.votes];
      })
    );

    saveCsv(
      lines.join("\n"),
      "public-sentiment-activity-summary-" +
      document.getElementById("activity-start").value + "-to-" +
      document.getElementById("activity-end").value + ".csv"
    );
  }

  function saveCsv(content,filename){
    const blob = new Blob([content],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadDetailed(){
    setStatus("Preparing detailed CSV…");
    const session = await requireOwner();
    if(!session) return;

    const start = document.getElementById("activity-start").value;
    const end = document.getElementById("activity-end").value;
    const batchSize = 1000;
    const rows = [];
    let offset = 0;

    while(true){
      const result = await client.rpc("ms_get_activity_detail_v2", {
        p_start_date:start,
        p_end_date:end,
        p_offset:offset,
        p_limit:batchSize
      });
      if(result.error) throw result.error;

      const batch = result.data || [];
      rows.push.apply(rows,batch);
      if(batch.length < batchSize) break;
      offset += batchSize;

      if(rows.length >= 100000){
        setStatus("Detailed CSV was limited to 100,000 aggregate rows.","error");
        break;
      }
    }

    const headers = [
      "event_date_et","event_hour_et","visitor_type","region_group","device_type",
      "traffic_source","page_path","event_name","feature_name","event_count","updated_at"
    ];
    const lines = [headers.join(",")];
    rows.forEach(function(row){
      lines.push(headers.map(function(key){ return escapeCsv(row[key]); }).join(","));
    });

    saveCsv(
      lines.join("\n"),
      "public-sentiment-activity-detail-" + start + "-to-" + end + ".csv"
    );
    setStatus("Detailed CSV ready: " + number(rows.length) + " aggregate rows.","success");
  }

  const today = etDateString(new Date());
  document.getElementById("activity-start").max = today;
  document.getElementById("activity-end").max = today;

  const queryRange = new URLSearchParams(window.location.search).get("range");
  setRange(queryRange === "last-month" ? "last-month" : "30");

  document.querySelectorAll("[data-range]").forEach(function(button){
    button.addEventListener("click",function(){
      setRange(button.dataset.range);
      load().catch(function(error){
        renderReport({},[]);
        setStatus(error.message || "Report failed to load.","error");
      });
    });
  });

  document.getElementById("activity-refresh").addEventListener("click",function(){
    document.querySelectorAll("[data-range]").forEach(function(button){
      button.classList.remove("active");
    });
    load().catch(function(error){
      renderReport({},[]);
      setStatus(error.message || "Report failed to load.","error");
    });
  });

  document.getElementById("activity-summary-download").addEventListener("click",downloadSummary);
  document.getElementById("activity-detail-download").addEventListener("click",function(){
    downloadDetailed().catch(function(error){
      setStatus(error.message || "Detailed CSV failed.","error");
    });
  });

  load().catch(function(error){
    renderReport({},[]);
    setStatus(error.message || "Report failed to load.","error");
  });
})();
