// Canada Iteration 26 V3.0 - staging-only HTML/JS contract checks.
// Usage: node qa/ca-display-contract-b26-v3.0.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../economic-calendar.html', import.meta.url),'utf8');
const js=readFileSync(new URL('../watchlist-economic-events.js', import.meta.url),'utf8');
const check=(n,v)=>{assert.ok(v,n);console.log('PASS '+n);};
check('CA country table',html.includes('CA:{name:"CA",flag:"🇨🇦"}'));
check('CA settings',html.includes('if(code==="CA") return "CA";'));
check('CA display',html.includes('(code==="AU" || code==="CA") ? code : name'));
check('CA no duplicated row label',html.includes('c.code==="GB"||c.code==="AU"||c.code==="CA"?"":" "+esc(c.name)'));
check('CA watchlist',js.includes('CA:"CA"'));
check('No full Canadian watchlist label',!js.includes('CA:"Canada"'));
check('US unchanged',html.includes('US:{name:"United States",flag:"🇺🇸"}'));
check('UK unchanged',html.includes('UK:{name:"United Kingdom",flag:"🇬🇧"}'));
check('AU unchanged',html.includes('AU:{name:"Australia",flag:"🇦🇺"}'));
check('Calendar CSV path preserved',html.includes('economic-calendar.csv'));
check('Feed link preserved',html.includes('https://fupexuonvzakoguucglk.supabase.co/functions/v1/economic-calendar-feed'));
console.log('CA V3.0 static checks passed');
