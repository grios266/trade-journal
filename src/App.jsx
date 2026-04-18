import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── PASTE YOUR SUPABASE CREDENTIALS HERE ───────────────────────────────────
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const OPTION_STRATEGIES = [
  "Long Call","Long Put","Covered Call","Cash-Secured Put","Bull Call Spread",
  "Bear Put Spread","Bull Put Spread","Bear Call Spread","Iron Condor","Iron Butterfly",
  "Straddle","Strangle","Diagonal Spread","Calendar Spread","Jade Lizard",
  "Broken Wing Butterfly","PMCC (Poor Man's Covered Call)","Ratio Spread","Collar","Custom"
];

const initialForm = {
  type:"stock", date:new Date().toISOString().split("T")[0],
  ticker:"", side:"buy", qty:"", price:"", close_price:"", fees:"0",
  strategy:"Long Call", expiry:"", strike:"", option_type:"call",
  contracts:"", premium:"", close_premium:"", notes:"", status:"open",
  stop_loss:"", target:""
};

const fmt = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2}).format(n);
const pct = n => (n>=0?"+":"")+n.toFixed(2)+"%";
const fmtR = n => (n>=0?"+":"")+n.toFixed(2)+"R";

function calcPL(t) {
  const fees = parseFloat(t.fees)||0;
  if (t.type==="stock") {
    if (t.status==="open"||!t.close_price) return null;
    const cp=parseFloat(t.close_price),ep=parseFloat(t.price),q=parseFloat(t.qty);
    if (!cp||!ep||!q) return null;
    return t.side==="buy"?(cp-ep)*q-fees:(ep-cp)*q-fees;
  } else {
    if (t.status==="open"||!t.close_premium) return null;
    const cp=parseFloat(t.close_premium),ep=parseFloat(t.premium),c=parseFloat(t.contracts);
    if (!cp||!ep||!c) return null;
    return t.side==="buy"?(cp-ep)*c*100-fees:(ep-cp)*c*100-fees;
  }
}
function calcRisk(t) {
  const entry=parseFloat(t.type==="option"?t.premium:t.price);
  const stop=parseFloat(t.stop_loss);
  if (!entry||!stop) return null;
  const size=t.type==="stock"?(parseFloat(t.qty)||0):(parseFloat(t.contracts)||0)*100;
  if (!size) return null;
  return t.side==="buy"?(entry-stop)*size:(stop-entry)*size;
}
function calcReward(t) {
  const entry=parseFloat(t.type==="option"?t.premium:t.price);
  const tgt=parseFloat(t.target);
  if (!entry||!tgt) return null;
  const size=t.type==="stock"?(parseFloat(t.qty)||0):(parseFloat(t.contracts)||0)*100;
  if (!size) return null;
  return t.side==="buy"?(tgt-entry)*size:(entry-tgt)*size;
}
function calcRR(t) {
  const r=calcRisk(t),rw=calcReward(t);
  if (!r||!rw||r<=0) return null;
  return rw/r;
}
function calcRM(t) {
  const r=calcRisk(t),pl=calcPL(t);
  if (r===null||pl===null||r<=0) return null;
  return pl/r;
}

const TABS = ["Dashboard","Log Trade","Trade History","Risk/Reward"];

function RRBar({rr}) {
  if (!rr) return <span style={{color:"#475569"}}>—</span>;
  const color=rr>=2?"#10b981":rr>=1?"#f59e0b":"#ef4444";
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:70,height:6,background:"#1a2540",borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${Math.min((rr/10)*100,100)}%`,height:"100%",background:color,borderRadius:3}}/>
      </div>
      <span style={{color,fontSize:12,fontWeight:700}}>{rr.toFixed(2)}:1</span>
    </div>
  );
}

function Gauge({value,label,color}) {
  const r=34,circ=2*Math.PI*r;
  return (
    <div style={{textAlign:"center"}}>
      <svg width={84} height={84} viewBox="0 0 84 84">
        <circle cx={42} cy={42} r={r} fill="none" stroke="#1a2540" strokeWidth={7}/>
        <circle cx={42} cy={42} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={circ*0.3}
          strokeLinecap="round" transform="rotate(-90 42 42)"/>
        <text x={42} y={47} textAnchor="middle" fill={color} fontSize={12} fontWeight="700" fontFamily="'IBM Plex Mono'">{value}</text>
      </svg>
      <div style={{fontSize:10,color:"#64748b",letterSpacing:"0.08em",textTransform:"uppercase",marginTop:2}}>{label}</div>
    </div>
  );
}

// ─── AUTH SCREEN ─────────────────────────────────────────────────────────────
function AuthScreen({onAuth}) {
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [resetMode,setResetMode]=useState(false);

  const notConfigured = SUPABASE_URL==="YOUR_SUPABASE_URL";

  async function handleSubmit() {
    if (notConfigured) { setError("Please add your Supabase credentials first (see setup instructions)."); return; }
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (resetMode) {
        const {error:e} = await supabase.auth.resetPasswordForEmail(email);
        if (e) throw e;
        setSuccess("Password reset email sent! Check your inbox.");
        setResetMode(false);
      } else if (mode==="signup") {
        const {error:e} = await supabase.auth.signUp({email,password});
        if (e) throw e;
        setSuccess("Account created! Check your email to confirm, then log in.");
      } else {
        const {data,error:e} = await supabase.auth.signInWithPassword({email,password});
        if (e) throw e;
        onAuth(data.user);
      }
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{minHeight:"100vh",background:"#0a0e1a",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'IBM Plex Mono',monospace",padding:20}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');`}</style>
      <div style={{width:420,maxWidth:"100%"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:36,letterSpacing:4,color:"#3b82f6"}}><span style={{color:"#10b981"}}>◈</span> TRADE JOURNAL</div>
          <div style={{fontSize:12,color:"#475569",marginTop:4,letterSpacing:2}}>CLOUD SYNC ENABLED</div>
        </div>

        {notConfigured && (
          <div style={{background:"#1a1000",border:"1px solid #f59e0b",borderRadius:10,padding:"14px 18px",marginBottom:20,fontSize:12,color:"#f59e0b",lineHeight:1.7}}>
            ⚠️ <b>Setup required:</b> You need to add your Supabase URL and anon key to the top of this file. See the setup guide below.
          </div>
        )}

        <div style={{background:"#111827",border:"1px solid #1e2d4d",borderRadius:14,padding:28}}>
          {!resetMode && (
            <div style={{display:"flex",gap:0,marginBottom:24,background:"#0d1424",borderRadius:8,padding:4}}>
              {["login","signup"].map(m=>(
                <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"8px 0",border:"none",borderRadius:6,background:mode===m?"#1e3a5f":"transparent",color:mode===m?"#60a5fa":"#64748b",fontFamily:"inherit",fontSize:12,fontWeight:600,cursor:"pointer",letterSpacing:1,textTransform:"uppercase"}}>
                  {m==="login"?"Log In":"Sign Up"}
                </button>
              ))}
            </div>
          )}

          {resetMode && <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:3,color:"#f59e0b",marginBottom:20}}>RESET PASSWORD</div>}

          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,color:"#64748b",marginBottom:4,letterSpacing:"0.08em",textTransform:"uppercase"}}>Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@email.com"
              onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
              style={{width:"100%",background:"#0d1424",color:"#e2e8f0",border:"1px solid #1e2d4d",borderRadius:6,padding:"10px 14px",fontFamily:"inherit",fontSize:13,outline:"none"}}/>
          </div>
          {!resetMode && (
            <div style={{marginBottom:20}}>
              <label style={{display:"block",fontSize:11,color:"#64748b",marginBottom:4,letterSpacing:"0.08em",textTransform:"uppercase"}}>Password</label>
              <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="••••••••"
                onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
                style={{width:"100%",background:"#0d1424",color:"#e2e8f0",border:"1px solid #1e2d4d",borderRadius:6,padding:"10px 14px",fontFamily:"inherit",fontSize:13,outline:"none"}}/>
            </div>
          )}

          {error && <div style={{background:"#2d0a0a",border:"1px solid #dc2626",borderRadius:6,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#f87171"}}>{error}</div>}
          {success && <div style={{background:"#0a2d1a",border:"1px solid #059669",borderRadius:6,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#4ade80"}}>{success}</div>}

          <button onClick={handleSubmit} disabled={loading}
            style={{width:"100%",padding:"11px 0",background:loading?"#1e3a5f":"#2563eb",color:"#fff",border:"none",borderRadius:8,fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:loading?"not-allowed":"pointer",letterSpacing:1,textTransform:"uppercase"}}>
            {loading?"...":(resetMode?"Send Reset Email":mode==="login"?"Log In":"Create Account")}
          </button>

          <div style={{marginTop:16,textAlign:"center",fontSize:12,color:"#475569"}}>
            {!resetMode && mode==="login" && (
              <span style={{cursor:"pointer",color:"#64748b",textDecoration:"underline"}} onClick={()=>{setResetMode(true);setError("");}}>Forgot password?</span>
            )}
            {resetMode && (
              <span style={{cursor:"pointer",color:"#64748b",textDecoration:"underline"}} onClick={()=>{setResetMode(false);setError("");}}>← Back to login</span>
            )}
          </div>
        </div>

        {/* Setup instructions */}
        <div style={{marginTop:28,background:"#0d1424",border:"1px solid #1e2d4d",borderRadius:12,padding:20,fontSize:12,color:"#94a3b8",lineHeight:2}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:14,letterSpacing:3,color:"#64748b",marginBottom:12}}>SUPABASE SETUP GUIDE</div>
          <ol style={{paddingLeft:18,margin:0,lineHeight:2.2}}>
            <li>Go to <b style={{color:"#60a5fa"}}>supabase.com</b> → click <b>Start for free</b> → sign up</li>
            <li>Click <b>New Project</b>, give it a name (e.g. "TradeJournal"), set a password, pick a region close to you</li>
            <li>Wait ~1 min for it to launch, then go to <b>Project Settings → API</b></li>
            <li>Copy <b>Project URL</b> → paste it as <code style={{color:"#a78bfa"}}>SUPABASE_URL</code> at the top of this file</li>
            <li>Copy <b>anon / public key</b> → paste it as <code style={{color:"#a78bfa"}}>SUPABASE_ANON_KEY</code></li>
            <li>Go to <b>SQL Editor</b> in the left sidebar and run this query:</li>
          </ol>
          <pre style={{background:"#060b14",borderRadius:8,padding:14,marginTop:8,fontSize:11,color:"#4ade80",overflowX:"auto",lineHeight:1.6}}>{`create table trades (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  type text, date text, ticker text, side text,
  qty text, price text, close_price text, fees text,
  strategy text, expiry text, strike text,
  option_type text, contracts text, premium text,
  close_premium text, notes text, status text,
  stop_loss text, target text,
  created_at timestamptz default now()
);

alter table trades enable row level security;

create policy "Users manage own trades" on trades
  for all using (auth.uid() = user_id);`}</pre>
          <div style={{marginTop:12,color:"#64748b"}}>7. Click <b>Run</b> ✓ — then reload this app, sign up, and your trades will sync across all devices!</div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session,setSession]=useState(null);
  const [authChecked,setAuthChecked]=useState(false);
  const [trades,setTrades]=useState([]);
  const [dbLoading,setDbLoading]=useState(false);
  const [tab,setTab]=useState("Dashboard");
  const [form,setForm]=useState(initialForm);
  const [editId,setEditId]=useState(null);
  const [closeModal,setCloseModal]=useState(null);
  const [filterTicker,setFilterTicker]=useState("");
  const [filterType,setFilterType]=useState("all");
  const [filterStatus,setFilterStatus]=useState("all");
  const [sortCol,setSortCol]=useState("date");
  const [sortDir,setSortDir]=useState("desc");
  const [toast,setToast]=useState(null);
  const [planner,setPlanner]=useState({type:"stock",entry:"",stop:"",target:"",qty:"",contracts:"",side:"buy"});

  // Auth listener
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session:s}})=>{ setSession(s); setAuthChecked(true); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,s)=>{ setSession(s); setAuthChecked(true); });
    return ()=>subscription.unsubscribe();
  },[]);

  // Load trades when logged in
  useEffect(()=>{
    if (!session) { setTrades([]); return; }
    loadTrades();
  },[session]);

  async function loadTrades() {
    setDbLoading(true);
    const {data,error} = await supabase.from("trades").select("*").order("date",{ascending:false});
    if (!error && data) setTrades(data);
    setDbLoading(false);
  }

  function showToast(msg,type="success") {
    setToast({msg,type});
    setTimeout(()=>setToast(null),2800);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setTrades([]);
    setSession(null);
  }

  const stats = useMemo(()=>{
    const closed=trades.filter(t=>t.status==="closed");
    const plArr=closed.map(t=>calcPL(t)).filter(v=>v!==null);
    const totalPL=plArr.reduce((a,b)=>a+b,0);
    const wins=plArr.filter(v=>v>0);
    const losses=plArr.filter(v=>v<0);
    const winRate=plArr.length?(wins.length/plArr.length)*100:0;
    const avgWin=wins.length?wins.reduce((a,b)=>a+b,0)/wins.length:0;
    const avgLoss=losses.length?losses.reduce((a,b)=>a+b,0)/losses.length:0;
    const bestTrade=plArr.length?Math.max(...plArr):0;
    const worstTrade=plArr.length?Math.min(...plArr):0;
    const openTrades=trades.filter(t=>t.status==="open").length;
    const byTicker={};
    closed.forEach(t=>{
      const pl=calcPL(t); if(pl===null)return;
      if(!byTicker[t.ticker])byTicker[t.ticker]={pl:0,count:0};
      byTicker[t.ticker].pl+=pl; byTicker[t.ticker].count++;
    });
    const monthly={};
    closed.forEach(t=>{
      const pl=calcPL(t); if(pl===null)return;
      const mo=t.date.slice(0,7);
      monthly[mo]=(monthly[mo]||0)+pl;
    });
    const rMultiples=closed.map(t=>calcRM(t)).filter(v=>v!==null);
    const expectancy=rMultiples.length?rMultiples.reduce((a,b)=>a+b,0)/rMultiples.length:null;
    const rrValues=trades.map(t=>calcRR(t)).filter(v=>v!==null);
    const avgRR=rrValues.length?rrValues.reduce((a,b)=>a+b,0)/rrValues.length:null;
    return {totalPL,wins:wins.length,losses:losses.length,winRate,avgWin,avgLoss,bestTrade,worstTrade,openTrades,byTicker,monthly,total:trades.length,closed:closed.length,expectancy,avgRR,rMultiples};
  },[trades]);

  function handleForm(e){const{name,value}=e.target;setForm(f=>({...f,[name]:value}));}
  function handlePlanner(e){const{name,value}=e.target;setPlanner(p=>({...p,[name]:value}));}

  async function saveTrade() {
    if(!form.ticker){showToast("Ticker is required","error");return;}
    if(form.type==="stock"&&(!form.qty||!form.price)){showToast("Qty and price required","error");return;}
    if(form.type==="option"&&(!form.contracts||!form.premium)){showToast("Contracts and premium required","error");return;}
    const payload={...form,ticker:form.ticker.toUpperCase(),user_id:session.user.id};
    delete payload.id;
    if(editId){
      const{error}=await supabase.from("trades").update(payload).eq("id",editId);
      if(error){showToast("Save failed: "+error.message,"error");return;}
      showToast("Trade updated!");
    } else {
      const{error}=await supabase.from("trades").insert([payload]);
      if(error){showToast("Save failed: "+error.message,"error");return;}
      showToast("Trade logged!");
    }
    await loadTrades();
    setForm(initialForm); setEditId(null); setTab("Trade History");
  }

  async function deleteTrade(id){
    if(!window.confirm("Delete this trade?"))return;
    const{error}=await supabase.from("trades").delete().eq("id",id);
    if(error){showToast("Delete failed","error");return;}
    setTrades(ts=>ts.filter(t=>t.id!==id));
    showToast("Trade deleted","error");
  }

  function editTrade(trade){setForm(trade);setEditId(trade.id);setTab("Log Trade");}
  function closeTrade(trade){setCloseModal({...trade});}

  async function saveClose(){
    const payload={...closeModal,status:"closed"};
    delete payload.id; delete payload.user_id; delete payload.created_at;
    const{error}=await supabase.from("trades").update(payload).eq("id",closeModal.id);
    if(error){showToast("Save failed","error");return;}
    await loadTrades();
    setCloseModal(null);
    showToast("Trade closed & P&L recorded!");
  }

  const displayed=useMemo(()=>{
    let arr=trades.filter(t=>{
      if(filterTicker&&!t.ticker.includes(filterTicker.toUpperCase()))return false;
      if(filterType!=="all"&&t.type!==filterType)return false;
      if(filterStatus!=="all"&&t.status!==filterStatus)return false;
      return true;
    });
    arr.sort((a,b)=>{
      let va=a[sortCol],vb=b[sortCol];
      if(sortCol==="pl"){va=calcPL(a)??-Infinity;vb=calcPL(b)??-Infinity;}
      if(typeof va==="string")va=va.toLowerCase();
      if(typeof vb==="string")vb=vb.toLowerCase();
      return sortDir==="asc"?(va>vb?1:-1):(va<vb?1:-1);
    });
    return arr;
  },[trades,filterTicker,filterType,filterStatus,sortCol,sortDir]);

  function toggleSort(col){
    if(sortCol===col)setSortDir(d=>d==="asc"?"desc":"asc");
    else{setSortCol(col);setSortDir("desc");}
  }

  const pEntry=parseFloat(planner.entry),pStop=parseFloat(planner.stop),pTarget=parseFloat(planner.target);
  const pSize=planner.type==="option"?(parseFloat(planner.contracts)||0)*100:(parseFloat(planner.qty)||0);
  const pRisk=(pEntry&&pStop&&pSize)?Math.abs(planner.side==="buy"?(pEntry-pStop)*pSize:(pStop-pEntry)*pSize):null;
  const pReward=(pEntry&&pTarget&&pSize)?Math.abs(planner.side==="buy"?(pTarget-pEntry)*pSize:(pEntry-pTarget)*pSize):null;
  const pRR=(pRisk&&pReward&&pRisk>0)?pReward/pRisk:null;
  const pRiskPct=(pEntry&&pStop)?Math.abs((pStop-pEntry)/pEntry*100):null;
  const pRewardPct=(pEntry&&pTarget)?Math.abs((pTarget-pEntry)/pEntry*100):null;
  const breakEvenWR=pRR?(1/(1+pRR))*100:null;

  const rBuckets=useMemo(()=>{
    const rm=stats.rMultiples;
    return [
      {label:"< -2R",min:-Infinity,max:-2},
      {label:"-2 to -1R",min:-2,max:-1},
      {label:"-1 to 0R",min:-1,max:0},
      {label:"0 to 1R",min:0,max:1},
      {label:"1 to 2R",min:1,max:2},
      {label:"2 to 3R",min:2,max:3},
      {label:"> 3R",min:3,max:Infinity},
    ].map(b=>({...b,count:rm.filter(v=>v>=b.min&&v<b.max).length}));
  },[stats.rMultiples]);
  const maxBucket=Math.max(...rBuckets.map(b=>b.count),1);

  // ─── NOT YET AUTH CHECKED ───────────────────────────────────────────────────
  if(!authChecked) return (
    <div style={{minHeight:"100vh",background:"#0a0e1a",display:"flex",alignItems:"center",justifyContent:"center",color:"#64748b",fontFamily:"'IBM Plex Mono',monospace",fontSize:13}}>
      Loading...
    </div>
  );

  // ─── NOT LOGGED IN ──────────────────────────────────────────────────────────
  if(!session) return <AuthScreen onAuth={u=>setSession({user:u})}/>;

  // ─── MAIN APP ───────────────────────────────────────────────────────────────
  return (
    <div style={{fontFamily:"'IBM Plex Mono','Courier New',monospace",background:"#0a0e1a",minHeight:"100vh",color:"#e2e8f0"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:#0a0e1a;}
        ::-webkit-scrollbar-thumb{background:#2d3a5c;border-radius:3px;}
        input,select,textarea{background:#111827;color:#e2e8f0;border:1px solid #1e2d4d;border-radius:6px;padding:8px 12px;font-family:inherit;font-size:13px;outline:none;transition:border 0.2s;width:100%;}
        input:focus,select:focus,textarea:focus{border-color:#3b82f6;}
        label{display:block;font-size:11px;color:#64748b;margin-bottom:4px;letter-spacing:0.08em;text-transform:uppercase;}
        .btn{cursor:pointer;border:none;border-radius:6px;padding:9px 20px;font-family:inherit;font-size:13px;font-weight:600;transition:all 0.15s;letter-spacing:0.04em;}
        .btn-primary{background:#2563eb;color:#fff;}.btn-primary:hover{background:#1d4ed8;}
        .btn-success{background:#059669;color:#fff;}.btn-success:hover{background:#047857;}
        .btn-danger{background:#dc2626;color:#fff;font-size:12px;padding:6px 12px;}.btn-danger:hover{background:#b91c1c;}
        .btn-ghost{background:transparent;color:#94a3b8;border:1px solid #1e2d4d;}.btn-ghost:hover{border-color:#3b82f6;color:#3b82f6;}
        .btn-close{background:#0f172a;color:#10b981;border:1px solid #10b981;font-size:12px;padding:5px 11px;}.btn-close:hover{background:#10b981;color:#000;}
        .card{background:#111827;border:1px solid #1e2d4d;border-radius:12px;padding:20px;}
        .pos{color:#10b981;}.neg{color:#ef4444;}.neu{color:#94a3b8;}.warn{color:#f59e0b;}
        .tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;}
        .tag-open{background:#1e3a5f;color:#60a5fa;}.tag-closed{background:#14532d;color:#4ade80;}
        .tag-call{background:#14532d;color:#4ade80;}.tag-put{background:#4c0519;color:#f87171;}
        .tag-stock{background:#1e293b;color:#94a3b8;}.tag-option{background:#2d1b69;color:#a78bfa;}
        tr:hover td{background:#1a2540;}
        th{cursor:pointer;user-select:none;}th:hover{color:#60a5fa;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
        .toast{position:fixed;top:20px;right:20px;z-index:999;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:600;animation:fadeIn 0.2s ease;}
        .toast-success{background:#059669;color:#fff;}.toast-error{background:#dc2626;color:#fff;}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;display:flex;align-items:center;justify-content:center;}
        .modal{background:#111827;border:1px solid #2d3a5c;border-radius:14px;padding:28px;width:390px;max-width:95vw;}
        option{background:#111827;}
        table{border-collapse:collapse;width:100%;}
        th,td{text-align:left;padding:10px 12px;font-size:12px;border-bottom:1px solid #1a2540;}
        th{background:#0d1424;color:#64748b;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;}
        .stat-val{font-family:'Bebas Neue',sans-serif;font-size:2rem;letter-spacing:0.05em;}
      `}</style>

      {/* HEADER */}
      <div style={{background:"#060b14",borderBottom:"1px solid #1e2d4d",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:60,flexWrap:"wrap",gap:8}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:26,letterSpacing:3,color:"#3b82f6"}}>
          <span style={{color:"#10b981"}}>◈</span> TRADE JOURNAL
        </div>
        <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
          {TABS.map(t=>(
            <button key={t} className="btn btn-ghost" onClick={()=>setTab(t)}
              style={{background:tab===t?"#1e3a5f":"transparent",color:tab===t?"#60a5fa":"#64748b",borderColor:tab===t?"#3b82f6":"#1e2d4d",fontSize:11,padding:"6px 14px"}}>
              {t==="Risk/Reward"?"⚖ R/R":t}
            </button>
          ))}
          <div style={{width:1,height:24,background:"#1e2d4d",margin:"0 4px"}}/>
          <div style={{fontSize:11,color:"#475569",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{session.user.email}</div>
          {dbLoading && <span style={{fontSize:11,color:"#3b82f6"}}>↻ syncing</span>}
          <button className="btn btn-ghost" onClick={signOut} style={{fontSize:11,padding:"5px 12px",color:"#ef4444",borderColor:"#dc2626"}}>Sign Out</button>
        </div>
      </div>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div style={{padding:"28px 24px",maxWidth:1200,margin:"0 auto"}}>

        {/* ── DASHBOARD ── */}
        {tab==="Dashboard" && (
          <div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:4,color:"#64748b",marginBottom:20}}>PORTFOLIO OVERVIEW</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(165px, 1fr))",gap:14,marginBottom:24}}>
              {[
                {label:"Total P&L",value:fmt(stats.totalPL),cls:stats.totalPL>=0?"pos":"neg"},
                {label:"Win Rate",value:pct(stats.winRate),cls:stats.winRate>=50?"pos":"neg"},
                {label:"Wins / Losses",value:`${stats.wins} / ${stats.losses}`,cls:"neu"},
                {label:"Best Trade",value:fmt(stats.bestTrade),cls:"pos"},
                {label:"Worst Trade",value:fmt(stats.worstTrade),cls:"neg"},
                {label:"Open Trades",value:stats.openTrades,cls:"neu"},
                {label:"Avg Win",value:fmt(stats.avgWin),cls:"pos"},
                {label:"Avg Loss",value:fmt(stats.avgLoss),cls:"neg"},
                {label:"Expectancy",value:stats.expectancy!==null?fmtR(stats.expectancy):"—",cls:stats.expectancy>0?"pos":stats.expectancy<0?"neg":"neu"},
                {label:"Avg Planned R:R",value:stats.avgRR!==null?stats.avgRR.toFixed(2)+":1":"—",cls:stats.avgRR>=2?"pos":stats.avgRR>=1?"warn":"neg"},
              ].map(s=>(
                <div key={s.label} className="card" style={{padding:"16px 18px"}}>
                  <div style={{fontSize:10,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>{s.label}</div>
                  <div className={`stat-val ${s.cls}`}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div className="card">
                <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14}}>P&L by Ticker</div>
                {Object.keys(stats.byTicker).length===0
                  ?<div style={{color:"#475569",fontSize:13}}>No closed trades yet</div>
                  :Object.entries(stats.byTicker).sort((a,b)=>b[1].pl-a[1].pl).map(([tk,d])=>(
                    <div key={tk} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #1a2540"}}>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <span style={{fontWeight:600,fontSize:13}}>{tk}</span>
                        <span style={{fontSize:11,color:"#475569"}}>{d.count} trade{d.count!==1?"s":""}</span>
                      </div>
                      <span className={d.pl>=0?"pos":"neg"} style={{fontWeight:700,fontSize:14}}>{fmt(d.pl)}</span>
                    </div>
                  ))}
              </div>
              <div className="card">
                <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14}}>Monthly P&L</div>
                {Object.keys(stats.monthly).length===0
                  ?<div style={{color:"#475569",fontSize:13}}>No closed trades yet</div>
                  :Object.entries(stats.monthly).sort((a,b)=>b[0].localeCompare(a[0])).map(([mo,pl])=>(
                    <div key={mo} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #1a2540"}}>
                      <span style={{fontSize:13}}>{mo}</span>
                      <span className={pl>=0?"pos":"neg"} style={{fontWeight:700,fontSize:14}}>{fmt(pl)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── LOG TRADE ── */}
        {tab==="Log Trade" && (
          <div style={{maxWidth:680}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:4,color:"#64748b",marginBottom:20}}>
              {editId?"✏ EDIT TRADE":"◈ LOG NEW TRADE"}
            </div>
            <div className="card">
              <div style={{display:"flex",gap:8,marginBottom:22}}>
                {["stock","option"].map(t=>(
                  <button key={t} className="btn" onClick={()=>setForm(f=>({...f,type:t}))}
                    style={{background:form.type===t?(t==="stock"?"#1e293b":"#2d1b69"):"transparent",color:form.type===t?"#e2e8f0":"#475569",border:`1px solid ${form.type===t?"#3b82f6":"#1e2d4d"}`,textTransform:"uppercase",fontSize:12,letterSpacing:2,flex:1}}>
                    {t==="stock"?"📈 Stock":"⚡ Option"}
                  </button>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div><label>Date</label><input type="date" name="date" value={form.date} onChange={handleForm}/></div>
                <div><label>Ticker / Symbol</label><input name="ticker" value={form.ticker} onChange={handleForm} placeholder="AAPL" style={{textTransform:"uppercase"}}/></div>
                {form.type==="stock"?(<>
                  <div><label>Side</label><select name="side" value={form.side} onChange={handleForm}><option value="buy">Buy (Long)</option><option value="sell">Sell (Short)</option></select></div>
                  <div><label>Shares</label><input name="qty" type="number" value={form.qty} onChange={handleForm} placeholder="100"/></div>
                  <div><label>Entry Price</label><input name="price" type="number" value={form.price} onChange={handleForm} placeholder="150.00"/></div>
                  <div><label>Close Price (if closed)</label><input name="close_price" type="number" value={form.close_price} onChange={handleForm} placeholder="160.00"/></div>
                </>):(<>
                  <div><label>Strategy</label><select name="strategy" value={form.strategy} onChange={handleForm}>{OPTION_STRATEGIES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                  <div><label>Option Type</label><select name="option_type" value={form.option_type} onChange={handleForm}><option value="call">Call</option><option value="put">Put</option><option value="spread">Spread / Multi-leg</option></select></div>
                  <div><label>Side</label><select name="side" value={form.side} onChange={handleForm}><option value="buy">Buy</option><option value="sell">Sell</option></select></div>
                  <div><label>Expiry Date</label><input type="date" name="expiry" value={form.expiry} onChange={handleForm}/></div>
                  <div><label>Strike Price</label><input name="strike" type="number" value={form.strike} onChange={handleForm} placeholder="150"/></div>
                  <div><label>Contracts</label><input name="contracts" type="number" value={form.contracts} onChange={handleForm} placeholder="2"/></div>
                  <div><label>Premium (per contract)</label><input name="premium" type="number" value={form.premium} onChange={handleForm} placeholder="3.50"/></div>
                  <div><label>Close Premium (if closed)</label><input name="close_premium" type="number" value={form.close_premium} onChange={handleForm} placeholder="1.20"/></div>
                </>)}
                <div><label>Stop Loss</label><input name="stop_loss" type="number" value={form.stop_loss} onChange={handleForm} placeholder="145.00"/></div>
                <div><label>Price Target</label><input name="target" type="number" value={form.target} onChange={handleForm} placeholder="165.00"/></div>
                <div><label>Fees / Commission</label><input name="fees" type="number" value={form.fees} onChange={handleForm} placeholder="0.65"/></div>
                <div><label>Status</label><select name="status" value={form.status} onChange={handleForm}><option value="open">Open</option><option value="closed">Closed</option></select></div>
                <div style={{gridColumn:"1/-1"}}><label>Notes</label><textarea name="notes" value={form.notes} onChange={handleForm} rows={2} placeholder="Trade thesis, setup, market conditions..."/></div>
              </div>
              {(()=>{
                const rr=calcRR(form),risk=calcRisk(form),reward=calcReward(form);
                if(!rr)return null;
                return(
                  <div style={{marginTop:14,padding:"12px 16px",background:"#0d1424",borderRadius:8,display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
                    <div><div style={{fontSize:10,color:"#64748b",marginBottom:3}}>RISK</div><span className="neg" style={{fontWeight:700}}>{fmt(risk)}</span></div>
                    <div><div style={{fontSize:10,color:"#64748b",marginBottom:3}}>REWARD</div><span className="pos" style={{fontWeight:700}}>{fmt(reward)}</span></div>
                    <div><div style={{fontSize:10,color:"#64748b",marginBottom:3}}>R:R RATIO</div><span className={rr>=2?"pos":rr>=1?"warn":"neg"} style={{fontWeight:700}}>{rr.toFixed(2)}:1</span></div>
                    <div><div style={{fontSize:10,color:"#64748b",marginBottom:3}}>MIN WIN RATE</div><span className="neu" style={{fontWeight:700}}>{(1/(1+rr)*100).toFixed(1)}%</span></div>
                  </div>
                );
              })()}
              <div style={{display:"flex",gap:10,marginTop:20}}>
                <button className="btn btn-primary" onClick={saveTrade} style={{flex:1}}>{editId?"Update Trade":"Log Trade"}</button>
                {editId&&<button className="btn btn-ghost" onClick={()=>{setForm(initialForm);setEditId(null);}}>Cancel</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── TRADE HISTORY ── */}
        {tab==="Trade History" && (
          <div>
            <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap",alignItems:"flex-end"}}>
              <div style={{flex:"0 0 140px"}}><label>Ticker Filter</label><input value={filterTicker} onChange={e=>setFilterTicker(e.target.value)} placeholder="AAPL"/></div>
              <div style={{flex:"0 0 130px"}}><label>Type</label><select value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="all">All</option><option value="stock">Stocks</option><option value="option">Options</option></select></div>
              <div style={{flex:"0 0 130px"}}><label>Status</label><select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="all">All</option><option value="open">Open</option><option value="closed">Closed</option></select></div>
              <div style={{marginLeft:"auto",fontSize:12,color:"#64748b",alignSelf:"center"}}>{displayed.length} trade{displayed.length!==1?"s":""}</div>
            </div>
            <div className="card" style={{padding:0,overflow:"auto"}}>
              <table>
                <thead>
                  <tr>
                    {[["date","Date"],["ticker","Ticker"],["type","Type"],["side","Side"],["strategy","Details"],["status","Status"],["pl","P&L"]].map(([col,label])=>(
                      <th key={col} onClick={()=>toggleSort(col)}>{label} {sortCol===col?(sortDir==="asc"?"↑":"↓"):""}</th>
                    ))}
                    <th>R:R</th><th>R-Multiple</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.length===0&&(
                    <tr><td colSpan={10} style={{textAlign:"center",color:"#475569",padding:32}}>No trades found. Log your first trade!</td></tr>
                  )}
                  {displayed.map(t=>{
                    const pl=calcPL(t),rr=calcRR(t),rm=calcRM(t);
                    return(
                      <tr key={t.id}>
                        <td style={{color:"#64748b"}}>{t.date}</td>
                        <td style={{fontWeight:700}}>{t.ticker}</td>
                        <td><span className={`tag tag-${t.type}`}>{t.type}</span></td>
                        <td style={{textTransform:"uppercase",fontSize:11,color:t.side==="buy"?"#10b981":"#f87171"}}>{t.side}</td>
                        <td style={{maxWidth:170}}>
                          {t.type==="option"
                            ?<><span className={`tag tag-${t.option_type==="call"?"call":"put"}`}>{t.option_type}</span> <span style={{color:"#94a3b8",fontSize:11}}>{t.strategy}</span></>
                            :<span style={{fontSize:12,color:"#94a3b8"}}>{t.qty} sh@${t.price}</span>}
                        </td>
                        <td><span className={`tag tag-${t.status}`}>{t.status}</span></td>
                        <td style={{fontWeight:700}}>{pl===null?<span style={{color:"#475569"}}>—</span>:<span className={pl>=0?"pos":"neg"}>{fmt(pl)}</span>}</td>
                        <td><RRBar rr={rr}/></td>
                        <td style={{fontWeight:700}}>{rm===null?<span style={{color:"#475569"}}>—</span>:<span className={rm>=1?"pos":rm>=0?"warn":"neg"}>{fmtR(rm)}</span>}</td>
                        <td>
                          <div style={{display:"flex",gap:5}}>
                            {t.status==="open"&&<button className="btn btn-close" onClick={()=>closeTrade(t)}>Close</button>}
                            <button className="btn btn-ghost" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>editTrade(t)}>Edit</button>
                            <button className="btn btn-danger" onClick={()=>deleteTrade(t.id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── RISK / REWARD ── */}
        {tab==="Risk/Reward" && (
          <div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:4,color:"#64748b",marginBottom:20}}>⚖ RISK / REWARD TRACKER</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              <div>
                <div className="card" style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:16}}>Trade Planner</div>
                  <div style={{display:"flex",gap:8,marginBottom:14}}>
                    {["stock","option"].map(t=>(
                      <button key={t} className="btn" onClick={()=>setPlanner(p=>({...p,type:t}))}
                        style={{background:planner.type===t?"#1e293b":"transparent",color:planner.type===t?"#e2e8f0":"#475569",border:`1px solid ${planner.type===t?"#3b82f6":"#1e2d4d"}`,fontSize:11,flex:1,padding:"7px 0",letterSpacing:1}}>
                        {t==="stock"?"📈 Stock":"⚡ Option"}
                      </button>
                    ))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <div><label>Side</label><select name="side" value={planner.side} onChange={handlePlanner}><option value="buy">Buy / Long</option><option value="sell">Sell / Short</option></select></div>
                    <div><label>Entry Price</label><input name="entry" type="number" value={planner.entry} onChange={handlePlanner} placeholder="150.00"/></div>
                    <div><label>Stop Loss</label><input name="stop" type="number" value={planner.stop} onChange={handlePlanner} placeholder="145.00"/></div>
                    <div><label>Price Target</label><input name="target" type="number" value={planner.target} onChange={handlePlanner} placeholder="165.00"/></div>
                    {planner.type==="stock"
                      ?<div style={{gridColumn:"1/-1"}}><label>Shares</label><input name="qty" type="number" value={planner.qty} onChange={handlePlanner} placeholder="100"/></div>
                      :<div style={{gridColumn:"1/-1"}}><label>Contracts</label><input name="contracts" type="number" value={planner.contracts} onChange={handlePlanner} placeholder="2"/></div>}
                  </div>
                  <div style={{marginTop:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {[
                      {label:"Max Risk $",value:pRisk!==null?fmt(pRisk):"—",cls:"neg"},
                      {label:"Max Reward $",value:pReward!==null?fmt(pReward):"—",cls:"pos"},
                      {label:"Risk %",value:pRiskPct!==null?pRiskPct.toFixed(2)+"%":"—",cls:"neg"},
                      {label:"Reward %",value:pRewardPct!==null?pRewardPct.toFixed(2)+"%":"—",cls:"pos"},
                    ].map(item=>(
                      <div key={item.label} style={{background:"#0d1424",borderRadius:8,padding:"10px 14px"}}>
                        <div style={{fontSize:10,color:"#64748b",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.08em"}}>{item.label}</div>
                        <div className={item.cls} style={{fontWeight:700,fontSize:16}}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  {pRR!==null&&(
                    <div style={{marginTop:14,background:"#0d1424",borderRadius:10,padding:"16px 20px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <span style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase"}}>R:R Ratio</span>
                        <span style={{fontFamily:"'Bebas Neue'",fontSize:32,color:pRR>=2?"#10b981":pRR>=1?"#f59e0b":"#ef4444",letterSpacing:2}}>{pRR.toFixed(2)}:1</span>
                      </div>
                      <div style={{width:"100%",height:8,background:"#1a2540",borderRadius:4,overflow:"hidden"}}>
                        <div style={{width:`${Math.min((pRR/5)*100,100)}%`,height:"100%",background:pRR>=2?"#10b981":pRR>=1?"#f59e0b":"#ef4444",borderRadius:4,transition:"width 0.4s ease"}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:10,flexWrap:"wrap",gap:6}}>
                        <span style={{fontSize:11,color:"#94a3b8"}}>{pRR>=3?"🔥 Excellent setup":pRR>=2?"✅ Good setup":pRR>=1?"⚠️ Marginal setup":"❌ Poor — risk outweighs reward"}</span>
                        {breakEvenWR!==null&&<span style={{fontSize:11,color:"#64748b"}}>Min win rate: <b style={{color:"#e2e8f0"}}>{breakEvenWR.toFixed(1)}%</b></span>}
                      </div>
                    </div>
                  )}
                </div>
                <div className="card">
                  <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14}}>Position Sizing Guide</div>
                  {pRisk!==null&&pRisk>0?(
                    <div>
                      {[0.5,1,2,5].map(p=>{
                        const acct=pRisk/(p/100);
                        return(
                          <div key={p} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1a2540"}}>
                            <span style={{fontSize:12,color:"#64748b"}}>Risk {p}% of account</span>
                            <span style={{fontSize:13,fontWeight:600}}>Acct needed: <span style={{color:"#60a5fa"}}>{fmt(acct)}</span></span>
                          </div>
                        );
                      })}
                      <div style={{marginTop:10,fontSize:11,color:"#475569"}}>Based on {fmt(pRisk)} max risk</div>
                    </div>
                  ):<div style={{color:"#475569",fontSize:13}}>Enter entry, stop loss & size above.</div>}
                </div>
              </div>
              <div>
                <div className="card" style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:16}}>R-Multiple Analytics</div>
                  {stats.rMultiples.length===0
                    ?<div style={{color:"#475569",fontSize:13}}>Log trades with stop loss & target to see analytics.</div>
                    :(
                      <div>
                        <div style={{display:"flex",justifyContent:"space-around",marginBottom:18}}>
                          <Gauge value={stats.expectancy!==null?stats.expectancy.toFixed(2):"—"} label="Expectancy" color={stats.expectancy>0?"#10b981":"#ef4444"}/>
                          <Gauge value={stats.avgRR!==null?stats.avgRR.toFixed(1):"—"} label="Avg R:R" color={stats.avgRR>=2?"#10b981":stats.avgRR>=1?"#f59e0b":"#ef4444"}/>
                          <Gauge value={`${stats.winRate.toFixed(0)}%`} label="Win Rate" color={stats.winRate>=50?"#10b981":"#ef4444"}/>
                        </div>
                        <div style={{background:"#0d1424",borderRadius:8,padding:"12px 14px",fontSize:12,color:"#94a3b8",lineHeight:1.8}}>
                          {stats.expectancy!==null&&(
                            <span>Expectancy: <span className={stats.expectancy>0?"pos":"neg"} style={{fontWeight:700}}>{fmtR(stats.expectancy)}</span> — per 1R risked you expect to {stats.expectancy>0?"gain":"lose"} <b>{Math.abs(stats.expectancy).toFixed(2)}R</b>.
                            {stats.expectancy>=0.5?" 🔥 Strong edge.":stats.expectancy>=0?" ⚠️ Slight edge.":"❌ Negative expectancy — review strategy."}</span>
                          )}
                        </div>
                      </div>
                    )}
                </div>
                <div className="card" style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:16}}>R-Multiple Distribution</div>
                  {rBuckets.every(b=>b.count===0)
                    ?<div style={{color:"#475569",fontSize:13}}>No R-multiple data yet.</div>
                    :(
                      <div>
                        <div style={{display:"flex",alignItems:"flex-end",gap:4,height:100,marginBottom:6}}>
                          {rBuckets.map(b=>{
                            const h=(b.count/maxBucket)*90;
                            return(
                              <div key={b.label} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                {b.count>0&&<span style={{fontSize:10,color:"#94a3b8"}}>{b.count}</span>}
                                <div style={{width:"100%",height:h||3,background:b.max<=0?"#ef4444":"#10b981",borderRadius:"3px 3px 0 0",opacity:b.count===0?0.15:1}}/>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{display:"flex",gap:4}}>
                          {rBuckets.map(b=>(
                            <div key={b.label} style={{flex:1,fontSize:9,color:"#475569",textAlign:"center",lineHeight:1.3}}>{b.label}</div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
                <div className="card">
                  <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14}}>Open Trade Risk Monitor</div>
                  {trades.filter(t=>t.status==="open").length===0
                    ?<div style={{color:"#475569",fontSize:13}}>No open trades.</div>
                    :(
                      <div style={{overflow:"auto"}}>
                        <table>
                          <thead><tr><th>Ticker</th><th>Risk $</th><th>Reward $</th><th>R:R</th><th>Stop</th><th>Target</th></tr></thead>
                          <tbody>
                            {trades.filter(t=>t.status==="open").map(t=>{
                              const risk=calcRisk(t),reward=calcReward(t),rr=calcRR(t);
                              return(
                                <tr key={t.id}>
                                  <td style={{fontWeight:700}}>{t.ticker}</td>
                                  <td className="neg">{risk!==null?fmt(risk):"—"}</td>
                                  <td className="pos">{reward!==null?fmt(reward):"—"}</td>
                                  <td><RRBar rr={rr}/></td>
                                  <td style={{color:"#64748b"}}>{t.stop_loss?`$${t.stop_loss}`:"—"}</td>
                                  <td style={{color:"#64748b"}}>{t.target?`$${t.target}`:"—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CLOSE MODAL */}
      {closeModal&&(
        <div className="modal-bg" onClick={()=>setCloseModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:3,marginBottom:18,color:"#10b981"}}>CLOSE TRADE — {closeModal.ticker}</div>
            {closeModal.type==="stock"
              ?<div><label>Close / Exit Price</label><input type="number" value={closeModal.close_price||""} onChange={e=>setCloseModal(m=>({...m,close_price:e.target.value}))} placeholder="Exit price" autoFocus/></div>
              :<div><label>Close Premium (per contract)</label><input type="number" value={closeModal.close_premium||""} onChange={e=>setCloseModal(m=>({...m,close_premium:e.target.value}))} placeholder="Exit premium" autoFocus/></div>}
            <div style={{marginTop:12}}><label>Fees on Close</label><input type="number" value={closeModal.fees||"0"} onChange={e=>setCloseModal(m=>({...m,fees:e.target.value}))} placeholder="0.65"/></div>
            {(()=>{
              const preview={...closeModal,status:"closed"};
              const pl=calcPL(preview),rm=calcRM(preview);
              return pl!==null?(
                <div style={{marginTop:14,padding:"10px 14px",background:"#0d1424",borderRadius:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:rm!==null?6:0}}>
                    <span style={{fontSize:12,color:"#64748b"}}>Estimated P&L</span>
                    <span className={pl>=0?"pos":"neg"} style={{fontWeight:700}}>{fmt(pl)}</span>
                  </div>
                  {rm!==null&&(
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:12,color:"#64748b"}}>R-Multiple</span>
                      <span className={rm>=1?"pos":rm>=0?"warn":"neg"} style={{fontWeight:700}}>{fmtR(rm)}</span>
                    </div>
                  )}
                </div>
              ):null;
            })()}
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button className="btn btn-success" onClick={saveClose} style={{flex:1}}>Confirm Close</button>
              <button className="btn btn-ghost" onClick={()=>setCloseModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
