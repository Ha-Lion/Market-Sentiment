// Australia Step 6 parsers — isolated; no production writes.
// Validate every source's dimensions and terms before enabling publication.
export function parseAbsCsv(input, dimensions, expectedFlow) {
  const rows = csv(input);
  const out = [];
  const keys = Object.keys(dimensions);
  if (!keys.length) throw Error("Missing exact ABS series dimensions");
  for (const r of rows) {
    if (!["DATAFLOW","TIME_PERIOD","OBS_VALUE",...keys].every(k=>Object.hasOwn(r,k))) throw Error("ABS schema changed");
    if (expectedFlow && !r.DATAFLOW.startsWith(expectedFlow+"(")) continue;
    if (keys.some(k=>r[k].split(":")[0]!==dimensions[k])) continue;
    if (!/^\d{4}(-Q[1-4]|-(0[1-9]|1[0-2]))$/.test(r.TIME_PERIOD)) throw Error("Bad ABS period");
    const value = numeric(r.OBS_VALUE);
    if (value === null) continue;
    out.push({period:r.TIME_PERIOD,value,unit:r.UNIT_MEASURE ?? null,status:r.OBS_STATUS ?? null});
  }
  if (!out.length || new Set(out.map(r=>r.period)).size!==out.length) throw Error("No unique observations");
  return out;
}
export function parseCftcTff(input, marketCode="232741") {
  const rows=csv(input), out=[];
  const fields=["CFTC_Contract_Market_Code","Report_Date_as_YYYY-MM-DD","Lev_Money_Positions_Long_All","Lev_Money_Positions_Short_All"];
  for(const r of rows) {
    if(!fields.every(k=>Object.hasOwn(r,k)))throw Error("TFF file layout changed");
    if(r.CFTC_Contract_Market_Code!==marketCode)continue;
    const l=numeric(r.Lev_Money_Positions_Long_All),s=numeric(r.Lev_Money_Positions_Short_All);
    if(l===null||s===null)continue;
    out.push({period:r["Report_Date_as_YYYY-MM-DD"],value:l-s,definition:"TFF leveraged funds futures-only"});
  }
  if(!out.length)throw Error("No verified CFTC market rows");
  return out;
}
function numeric(v) {
  if(v==null||["","NA","N/A","..","-"].includes(String(v).trim().toUpperCase()))return null;
  const s=String(v).trim().replaceAll(",","");
  if(!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s))throw Error("Invalid numeric value");
  const n=Number(s);
  if(!Number.isFinite(n))throw Error("Invalid number");
  return n;
}
function csv(text) {
  const lines=[];let field="",fields=[],quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){fields.push(field);field="";}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;fields.push(field);if(fields.some(x=>x!==""))lines.push(fields);fields=[];field="";}
    else field+=c;
  }
  if(quoted)throw Error("Malformed CSV");
  if(field||fields.length){fields.push(field);lines.push(fields);}
  const [headers,...data]=lines;if(!headers)throw Error("Empty CSV");
  return data.map(vals=>Object.fromEntries(headers.map((h,i)=>[h,vals[i]??""])));
}
