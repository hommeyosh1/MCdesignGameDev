import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import {rateLimit} from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import pg from 'pg';
import {Resend} from 'resend';
import twilio from 'twilio';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const required=['DATABASE_URL','OTP_HMAC_SECRET','SESSION_SECRET','ADMIN_EMAIL','ADMIN_PASSWORD_HASH','BASE_URL'];
for(const key of required) if(!process.env[key]) throw new Error('Missing config: '+key);
const app=express(), pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const resend=process.env.RESEND_API_KEY?new Resend(process.env.RESEND_API_KEY):null;
const sms=process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN?twilio(process.env.TWILIO_ACCOUNT_SID,process.env.TWILIO_AUTH_TOKEN):null;
const base=new URL(process.env.BASE_URL);
app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:false}));app.use(express.json({limit:'12kb'}));app.use(cookieParser());
app.use('/api',rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:'draft-7',legacyHeaders:false}));
app.use('/api/admin/login',rateLimit({windowMs:15*60*1000,limit:6,standardHeaders:'draft-7',legacyHeaders:false}));
app.use((req,res,next)=>{if(req.method==='GET'||req.method==='HEAD')return next();const origin=req.get('origin');if(origin&&origin!==base.origin)return res.status(403).json({error:'Origin rejected'});next();});
const digest=(id,channel,code)=>crypto.createHmac('sha256',process.env.OTP_HMAC_SECRET).update(id+':'+channel+':'+code).digest('hex');
const safeEqual=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const cleanEmail=value=>String(value||'').trim().toLowerCase();
const cleanPhone=value=>String(value||'').replace(/[\s().-]/g,'');
const consentVersion='2026-10-18-v1';
const sendEmail=async(to,subject,html)=>{if(!resend||!process.env.FROM_EMAIL)throw Error('Email delivery is not configured');const out=await resend.emails.send({from:process.env.FROM_EMAIL,to,subject,html});if(out.error)throw Error(out.error.message||'Email failed')};
const sendSMS=async(to,body)=>{if(!sms)throw Error('SMS delivery is not configured');let args={to,body};if(process.env.TWILIO_MESSAGING_SERVICE_SID)args.messagingServiceSid=process.env.TWILIO_MESSAGING_SERVICE_SID;else if(process.env.TWILIO_FROM_NUMBER)args.from=process.env.TWILIO_FROM_NUMBER;else throw Error('SMS sender missing');return sms.messages.create(args)};
function issueToken(email){const expires=Date.now()+8*3600000;const data=Buffer.from(JSON.stringify({email,expires})).toString('base64url');const sig=crypto.createHmac('sha256',process.env.SESSION_SECRET).update(data).digest('base64url');return data+'.'+sig}
function getAdmin(req){try{const [data,sig]=String(req.cookies.admin||'').split('.');if(!data||!sig)return false;const expect=crypto.createHmac('sha256',process.env.SESSION_SECRET).update(data).digest('base64url');if(!safeEqual(sig,expect))return false;const value=JSON.parse(Buffer.from(data,'base64url'));return value.email===process.env.ADMIN_EMAIL&&value.expires>Date.now()}catch{return false}}
function adminOnly(req,res,next){if(!getAdmin(req))return res.status(401).json({error:'Admin login required'});next()}
app.post('/api/signup',async(req,res)=>{
 const email=cleanEmail(req.body.email),phone=cleanPhone(req.body.phone),emailConsent=req.body.emailConsent===true,smsConsent=req.body.smsConsent===true;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!emailConsent||!req.body.agreement)return res.status(400).json({error:'A valid email, consent, and agreement are required'});
 if(phone&&!/^\+[1-9]\d{7,14}$/.test(phone))return res.status(400).json({error:'Phone must use + country code, for example +14125550123'});
 if(smsConsent&&!phone)return res.status(400).json({error:'Enter a phone to opt in to SMS'});
 if(phone&&!smsConsent)return res.status(400).json({error:'Phone requires separate text-message consent'});
 if(!resend)return res.status(503).json({error:'Verification email is not configured'});
 if(phone&&!sms)return res.status(503).json({error:'Text verification is not configured'});
 const client=await pool.connect();let id,codes=[];
 try{
  await client.query('BEGIN');
  const found=await client.query('SELECT * FROM subscribers WHERE email=$1 FOR UPDATE',[email]);
  if(found.rows[0]?.email_verified_at){await client.query('ROLLBACK');return res.status(409).json({error:'This address is already registered. Contact the site owner to update preferences.'})}
  if(found.rows[0]?.id)id=found.rows[0].id;
  else {const inserted=await client.query('INSERT INTO subscribers(email,phone,consent_version,consent_source) VALUES($1,$2,$3,$4) RETURNING id',[email,phone||null,consentVersion,'web-signup']);id=inserted.rows[0].id;}
  if(found.rows[0])await client.query('UPDATE subscribers SET phone=$2,consent_version=$3 WHERE id=$1',[id,phone||null,consentVersion]);
  for(const channel of ['email',...(phone?['sms']:[])]){
    const code=String(crypto.randomInt(0,1000000)).padStart(6,'0');
    await client.query('INSERT INTO verifications(subscriber_id,channel,code_digest,expires_at) VALUES($1,$2,$3,now()+interval \'10 minutes\')',[id,channel,digest(id,channel,code)]);
    codes.push({channel,code});
  }
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');console.error(e);return res.status(400).json({error:'Unable to register. Check whether your email or phone is already in use.'})}finally{client.release()}
 try{for(const c of codes){if(c.channel==='email')await sendEmail(email,'Your Hommeyosh verification code','<p>Your verification code is <strong>'+c.code+'</strong>. It expires in 10 minutes.</p>');else await sendSMS(phone,'The Hommeyosh verification code: '+c.code+'. Expires in 10 minutes.');}}
 catch(e){console.error(e);return res.status(503).json({error:'Verification delivery failed. Please try again later.'})}
 res.json({message:'Codes sent. Verify each contact method selected.',email,channels:codes.map(x=>x.channel)});
});
app.post('/api/verify',async(req,res)=>{
 const email=cleanEmail(req.body.email),channel=req.body.channel,code=String(req.body.code||'');
 if(!['email','sms'].includes(channel)||!/^\d{6}$/.test(code))return res.status(400).json({error:'Invalid verification request'});
 const client=await pool.connect();
 try{await client.query('BEGIN');const user=await client.query('SELECT * FROM subscribers WHERE email=$1 FOR UPDATE',[email]);if(!user.rows[0]){await client.query('ROLLBACK');return res.status(400).json({error:'Invalid or expired code'})}
 const subscriber=user.rows[0],query=await client.query('SELECT * FROM verifications WHERE subscriber_id=$1 AND channel=$2 AND consumed_at IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE',[subscriber.id,channel]);
 const otp=query.rows[0];if(!otp||otp.attempts>=5||new Date(otp.expires_at)<=new Date()){await client.query('ROLLBACK');return res.status(400).json({error:'Invalid or expired code'})}
 if(!safeEqual(otp.code_digest,digest(subscriber.id,channel,code))){await client.query('UPDATE verifications SET attempts=attempts+1 WHERE id=$1',[otp.id]);await client.query('COMMIT');return res.status(400).json({error:'Invalid or expired code'})}
 await client.query('UPDATE verifications SET consumed_at=now() WHERE id=$1',[otp.id]);
 if(channel==='email')await client.query('UPDATE subscribers SET email_verified_at=now(),email_consent_at=now(),unsubscribed_email_at=NULL WHERE id=$1',[subscriber.id]);
 if(channel==='sms')await client.query('UPDATE subscribers SET phone_verified_at=now(),sms_consent_at=now(),unsubscribed_sms_at=NULL WHERE id=$1',[subscriber.id]);
 await client.query('INSERT INTO consent_events(subscriber_id,channel,event_type,consent_version,source) VALUES($1,$2,$3,$4,$5)',[subscriber.id,channel,'verified-opt-in',consentVersion,'web-signup']);
 await client.query('COMMIT');res.json({verified:true,channel});
 }catch(e){await client.query('ROLLBACK');console.error(e);res.status(500).json({error:'Verification failed'})}finally{client.release()}
});
app.post('/api/admin/login',async(req,res)=>{
 const email=cleanEmail(req.body.email),password=String(req.body.password||'');
 if(email!==cleanEmail(process.env.ADMIN_EMAIL)||!await bcrypt.compare(password,process.env.ADMIN_PASSWORD_HASH))return res.status(401).json({error:'Invalid login'});
 res.cookie('admin',issueToken(email),{httpOnly:true,secure:base.protocol==='https:',sameSite:'strict',path:'/',maxAge:8*3600000});res.json({ok:true});
});
app.post('/api/admin/logout',(req,res)=>{res.clearCookie('admin',{path:'/'});res.json({ok:true})});
app.get('/api/admin/subscribers',adminOnly,async(req,res)=>{
 const {rows}=await pool.query('SELECT id,email,phone,email_verified_at,phone_verified_at,email_consent_at,sms_consent_at,unsubscribed_email_at,unsubscribed_sms_at,created_at FROM subscribers ORDER BY created_at DESC LIMIT 500');res.json({subscribers:rows});
});
app.get('/api/admin/consent/:id',adminOnly,async(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id))return res.sendStatus(400);const {rows}=await pool.query('SELECT channel,event_type,consent_version,source,happened_at FROM consent_events WHERE subscriber_id=$1 ORDER BY happened_at DESC',[id]);res.json({events:rows})});
app.post('/api/admin/send',adminOnly,async(req,res)=>{
 if(process.env.ENABLE_CAMPAIGNS!=='true')return res.status(503).json({error:'Campaign sending is disabled until unsubscribe webhooks and compliance review are complete'});
 const {channel,subject,body}=req.body;if(!['email','sms'].includes(channel)||typeof body!=='string'||body.length<1||body.length>1400||typeof subject!=='string'||subject.length>180)return res.status(400).json({error:'Invalid message'});
 const field=channel==='email'?'email':'phone';const verified=channel==='email'?'email_verified_at':'phone_verified_at';const unsub=channel==='email'?'unsubscribed_email_at':'unsubscribed_sms_at';
 const {rows}=await pool.query('SELECT id,'+field+' AS destination FROM subscribers WHERE '+verified+' IS NOT NULL AND '+unsub+' IS NULL AND '+field+' IS NOT NULL');
 if(rows.length>500)return res.status(409).json({error:'Batch exceeds 500 recipients; use a background campaign queue'});
 if(channel==='email'&&!resend||channel==='sms'&&!sms)return res.status(503).json({error:'Delivery provider not configured'});
 const saved=await pool.query('INSERT INTO campaigns(subject,body,channel) VALUES($1,$2,$3) RETURNING id',[subject,body,channel]);const id=saved.rows[0].id;
 let sent=0,failed=0;
 for(const user of rows){
   try{
    if(channel==='email'){const safe=body.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n','<br>');await sendEmail(user.destination,subject,'<p>'+safe+'</p><p>To unsubscribe, reply to this email asking to be removed.</p>')}
    else await sendSMS(user.destination,body+' Reply STOP to opt out.');
    sent++;await pool.query('INSERT INTO deliveries(campaign_id,subscriber_id,status) VALUES($1,$2,$3)',[id,user.id,'sent']);
   }catch(e){failed++;await pool.query('INSERT INTO deliveries(campaign_id,subscriber_id,status,error) VALUES($1,$2,$3,$4)',[id,user.id,'failed',String(e.message).slice(0,500)])}
 }
 res.json({campaignId:id,sent,failed});
});
app.post('/api/admin/unsubscribe',adminOnly,async(req,res)=>{
 const id=Number(req.body.id),channel=req.body.channel;if(!Number.isSafeInteger(id)||!['email','sms'].includes(channel))return res.sendStatus(400);
 const column=channel==='email'?'unsubscribed_email_at':'unsubscribed_sms_at';
 const result=await pool.query('UPDATE subscribers SET '+column+'=now() WHERE id=$1 RETURNING id,consent_version',[id]);if(!result.rows[0])return res.sendStatus(404);
 await pool.query('INSERT INTO consent_events(subscriber_id,channel,event_type,consent_version,source) VALUES($1,$2,$3,$4,$5)',[id,channel,'unsubscribe',result.rows[0].consent_version,'admin']);res.json({ok:true});
});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');app.use(express.static(root,{extensions:['html'],index:'index.html'}));app.listen(process.env.PORT||3000,()=>console.log('Creator hub server ready'));
