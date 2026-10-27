/**
 * The Hommeyosh GC Drawing — free Google Apps Script receiver
 * Add this code to Extensions > Apps Script from the private Entries spreadsheet.
 * Deploy as a web app: execute as you; access: anyone.
 *
 * IMPORTANT: This is a public entry receiver, not a private read API.
 * Use Google Forms or a stronger authenticated backend if bot protection,
 * verified consent, or high-volume traffic is needed.
 */
const SHEET_NAME = 'Entries';
const ACCEPTING_ENTRIES = true;
// Weekly entry window: Thursday 11:00 PM through Saturday 8:59:59 AM, New York time.
function windowState(now) {
  now = now || new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',
    weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  const weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday);
  const minutes=Number(parts.hour)*60+Number(parts.minute);
  const open=(weekday===4&&minutes>=23*60)||(weekday===5)||(weekday===6&&minutes<9*60);
  // Saturday's calendar date identifies the entire Thursday–Saturday drawing.
  const offset=(6-weekday+7)%7;
  const saturday=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)+offset));
  const drawingId='GASP-'+Utilities.formatDate(saturday,'UTC','yyyy-MM-dd');
  return {open, drawingId};
}
const MAX_ANSWER = 300;

function output(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { const w=windowState(); return output({ok:true,acceptingEntries:ACCEPTING_ENTRIES&&w.open,drawingId:w.drawingId}); }
function doPost(e) {
  if (!ACCEPTING_ENTRIES || !windowState().open) return output({ok:false,error:'Entries are closed. Open Thursday at 11 PM Eastern; close Saturday at 9 AM Eastern.'});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return output({ok:false,error:'Please retry shortly.'});
  try {
    const weekly=windowState();
    if (!weekly.open) return output({ok:false,error:'Drawing entries are closed.'});
    const p = JSON.parse((e.postData && e.postData.contents) || '{}');
    const s = x => String(x == null ? '' : x).trim();
    const name=s(p.name),email=s(p.email).toLowerCase(), phone=s(p.phone);
    const egg1=s(p.egg1),egg2=s(p.egg2), egg3=s(p.egg3);
    const delivery=s(p.delivery);
    if (name.length<2 || name.length>120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || !egg1 || !egg2 || egg1.length>MAX_ANSWER || egg2.length>MAX_ANSWER || egg3.length>MAX_ANSWER)
      return output({ok:false,error:'Please complete the required fields.'});
    if (!p.drawingEmailConsent || (phone && !p.drawingTextConsent)) return output({ok:false,error:'Required notification permission missing.'});
    if (!['Mail','Email'].includes(delivery)) return output({ok:false,error:'Invalid delivery preference.'});
    const street=s(p.street),unit=s(p.apt),city=s(p.city),state=s(p.state),postal=s(p.postal);
    if (delivery==='Mail' && (!street||!city||!state||!postal)) return output({ok:false,error:'Please supply your mailing address.'});
    const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const values=sh.getDataRange().getValues();
    if (values.slice(1).some(row=>s(row[1])===weekly.drawingId&&s(row[4]).toLowerCase()===email)) return output({ok:false,error:'This email is already entered for this drawing.'});
    const safe = x => /^[=+\-@]/.test(x) ? "'"+x : x; // Prevent formula injection
    const now=new Date(),entryId=Utilities.getUuid();
    sh.appendRow([now,weekly.drawingId,entryId,safe(name),safe(email),safe(phone),delivery,safe(street),safe(unit),safe(city),safe(state),safe(postal),safe(egg1),safe(egg2),safe(egg3),true,!!p.drawingTextConsent,!!p.promoConsent,now,'Eligible','']);
    return output({ok:true,message:'Entry received',entryId});
  } catch(err) {
    console.error(err);
    return output({ok:false,error:'Entry could not be saved. Please try again.'});
  } finally { lock.releaseLock(); }
}
/** Run privately from the Apps Script editor to draw one random eligible entry. */
function drawWinner() {
  const weekly=windowState();
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data=sh.getDataRange().getValues();
  const eligible=[];
  for(let i=1;i<data.length;i++) if(data[i][1]===weekly.drawingId && data[i][19]==='Eligible') eligible.push(i+1);
  if(!eligible.length) throw Error('No eligible entries for '+weekly.drawingId);
  if(data.slice(1).some(r=>r[1]===weekly.drawingId && r[20]==='Winner')) throw Error('A winner already exists for this drawing');
  const chosen=eligible[Math.floor(Math.random()*eligible.length)];
  sh.getRange(chosen,21).setValue('Winner');
  console.log('Winner at sheet row '+chosen+'. Notify privately.');
}