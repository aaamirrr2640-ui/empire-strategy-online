const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const PORT=process.env.PORT||3000;
const DATABASE_URL=process.env.DATABASE_URL||'';
const DB_FILE=path.join(__dirname,'db.json');
let localDb=fs.existsSync(DB_FILE)?JSON.parse(fs.readFileSync(DB_FILE,'utf8')):{users:{}};
let pgPool=null;

async function initDb(){
  if(!DATABASE_URL)return;
  const {Pool}=require('pg');
  pgPool=new Pool({connectionString:DATABASE_URL,ssl:{rejectUnauthorized:false}});
  await pgPool.query(`CREATE TABLE IF NOT EXISTS empire_users (username TEXT PRIMARY KEY, password TEXT NOT NULL, state JSONB, last_seen BIGINT NOT NULL DEFAULT 0)`);
}
function persistLocal(){fs.writeFileSync(DB_FILE,JSON.stringify(localDb,null,2))}
function hash(p,s){return crypto.scryptSync(String(p),s,64).toString('hex')}
function passHash(p){const s=crypto.randomBytes(16).toString('hex');return s+':'+hash(p,s)}
function check(p,x){const [s,h]=String(x||'').split(':');if(!s||!h)return false;const a=Buffer.from(hash(p,s),'hex'),b=Buffer.from(h,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function cleanState(s){if(!s||typeof s!=='object')return null;const x=JSON.parse(JSON.stringify(s));delete x.pass;delete x.name;return x}
function json(res,code,obj){const b=JSON.stringify(obj);res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Cache-Control':'no-store','Access-Control-Allow-Headers':'Content-Type'});res.end(b)}
function body(req){return new Promise((resolve,reject)=>{let d='';req.on('data',c=>{d+=c;if(d.length>8e6)req.destroy()});req.on('end',()=>{try{resolve(d?JSON.parse(d):{})}catch(e){reject(e)}})})}

async function getUser(name){
  if(pgPool){const r=await pgPool.query('SELECT username,password,state,last_seen FROM empire_users WHERE username=$1',[name]);return r.rows[0]||null}
  return localDb.users[name]||null;
}
async function createUser(name,password,state){
  const last=Date.now();
  if(pgPool){const r=await pgPool.query('INSERT INTO empire_users(username,password,state,last_seen) VALUES($1,$2,$3,$4) RETURNING username,password,state,last_seen',[name,password,state,last]);return r.rows[0]}
  localDb.users[name]={password,state,lastSeen:last};persistLocal();return localDb.users[name];
}
async function updateUser(name,state,lastSeen=Date.now()){
  if(pgPool){await pgPool.query('UPDATE empire_users SET state=$2,last_seen=$3 WHERE username=$1',[name,state,lastSeen]);return}
  if(localDb.users[name]){localDb.users[name].state=state;localDb.users[name].lastSeen=lastSeen;persistLocal()}
}
async function touchUser(name){
  if(pgPool){await pgPool.query('UPDATE empire_users SET last_seen=$2 WHERE username=$1',[name,Date.now()]);return}
  if(localDb.users[name]){localDb.users[name].lastSeen=Date.now();persistLocal()}
}
async function allUsers(){
  if(pgPool){const r=await pgPool.query('SELECT username,state,last_seen FROM empire_users ORDER BY last_seen DESC');return r.rows.map(x=>({name:x.username,state:x.state,lastSeen:Number(x.last_seen||0)}))}
  return Object.entries(localDb.users).map(([name,u])=>({name,state:u.state,lastSeen:u.lastSeen||0}));
}
async function publicWorld(){
  const users=await allUsers();
  const players=users.map(u=>({name:u.name,country:u.state?.country||'',lastSeen:u.lastSeen||0,level:u.state?.warRoom||1}));
  const statements=[];
  for(const u of users){for(const s of (u.state?.statements||[])){statements.push({...s,authorName:u.name,author:s.author||u.state?.country||u.name})}}
  statements.sort((a,b)=>(b.id||0)-(a.id||0));
  return {players,statements:statements.slice(0,200)};
}

const server=http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type'});return res.end()}
 try{
  if(req.url==='/api/health')return json(res,200,{ok:true,mode:pgPool?'postgres':'local'});
  if(req.url==='/api/register'&&req.method==='POST'){
   const b=await body(req),u=String(b.username||'').trim(),p=String(b.password||'');
   if(!u||u.length<2||p.length<3)return json(res,400,{error:'نام کاربری و رمز عبور معتبر وارد کنید.'});
   if(await getUser(u))return json(res,409,{error:'این نام کاربری قبلاً ثبت شده است.'});
   const state=cleanState(b.state);const user=await createUser(u,passHash(p),state);return json(res,200,{ok:true,state:user.state});
  }
  if(req.url==='/api/login'&&req.method==='POST'){
   const b=await body(req),u=String(b.username||'').trim(),p=String(b.password||''),user=await getUser(u);
   if(!user)return json(res,404,{error:'کاربر پیدا نشد.'});
   if(!check(p,user.password))return json(res,401,{error:'رمز عبور اشتباه است.'});
   if(b.country&&user.state){user.state.country=b.country;await updateUser(u,user.state)} else await touchUser(u);
   return json(res,200,{ok:true,state:user.state});
  }
  if(req.url==='/api/save'&&req.method==='POST'){
   const b=await body(req),u=String(b.username||'').trim(),user=await getUser(u);if(!user)return json(res,401,{error:'کاربر وجود ندارد.'});
   const s=cleanState(b.state);if(!s)return json(res,400,{error:'ذخیره نامعتبر است.'});await updateUser(u,s);return json(res,200,{ok:true});
  }
  if(req.url==='/api/world'&&req.method==='GET')return json(res,200,await publicWorld());
  let file=req.url==='/'?'/index.html':req.url.split('?')[0];
  const base=path.resolve(__dirname,'public'),fp=path.resolve(base,'.'+file);
  if(fp.startsWith(base+path.sep)&&fs.existsSync(fp)){const ext=path.extname(fp);const ct=ext==='.html'?'text/html; charset=utf-8':ext==='.css'?'text/css':ext==='.json'?'application/json':'application/javascript';res.writeHead(200,{'Content-Type':ct});return fs.createReadStream(fp).pipe(res)}
  return json(res,404,{error:'Not found'});
 }catch(e){console.error(e);return json(res,500,{error:'خطای سرور',detail:process.env.NODE_ENV==='production'?undefined:e.message})}
});

initDb().then(()=>server.listen(PORT,()=>console.log(`Empire online server running on port ${PORT} (${pgPool?'Postgres':'local'})`))).catch(e=>{console.error('Database init failed:',e);process.exit(1)});
