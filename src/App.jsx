import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── PASTE YOUR SUPABASE CREDENTIALS HERE ───────────────────────────────────
const SUPABASE_URL = "https://xddcxzancmbdzrtljjfb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkZGN4emFuY21iZHpydGxqamZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njg4MzUsImV4cCI6MjA5MjA0NDgzNX0.ZNRn_9yOHTXcrslU6AodTHTNJ2AeWlBrdIXa6U3Jcxo";
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
  const fees=parseFloat(t.fees)||0;
  if(t.type==="stock"){
    if(t.status==="open"||!t.close_price)return null;
    const cp=parseFloat(t.close_price),ep=parseFloat(t.price),q=parseFloat(t.qty);
    if(!cp||!ep||!q)return null;
    return t.side==="buy"?(cp-ep)*q-fees:(ep-cp)*q-fees;
  }else{
    if(t.status==="open"||!t.close_premium)return null;
    const cp=parseFloat(t.close_premium),ep=parseFloat(t.premium),c=parseFloat(t.contracts);
    if(!cp||!ep||!c)return null;
    return t.side==="buy"?(cp-ep)*c*100-fees:(ep-cp)*c*100-fees;
  }
}
function calcRisk(t){
  const entry=parseFloat(t.type==="option"?t.premium:t.price);
  const stop=parseFloat(t.stop_loss);
  if(!entry||!stop)return null;
  const size=t.type==="stock"?(parseFloat(t.qty)||0):(parseFloat(t.contracts)||0)*100;
  if(!size)return null;
  return t.side==="buy"?(entry-stop)*size:(stop-entry)*size;
}
function calcReward(t){
  const entry=parseFloat(t.type==="option"?t.premium:t.price);
  const tgt=parseFloat(t.target);
  if(!entry||!tgt)return null;
  const size=t.type==="stock"?(parseFloat(t.qty)||0):(parseFloat(t.contracts)||0)*100;
  if(!size)return null;
  return t.side==="buy"?(tgt-entry)*size:(entry-tgt)*size;
}
function calcRR(t){const r=calcRisk(t),rw=calcReward(t);if(!r||!rw||r<=0)return null;return rw/r;}
function calcRM(t){const r=calcRisk(t),pl=calcPL(t);if(r===null||pl===null||r<=0)return null;return pl/r;}

// ── SMALL HELPERS ──────────────────────────────────────────────────────────
function StatCard({label,value,cls}){
  return(
    <div style={{background:"#111827",border:"1px solid #1e2d4d",borderRadius:12,padding:"14px 16px"}}>
      <div style={{fontSize:10,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{label}</div>
      <div className={cls} style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"1.7rem",letterSpacing:"0.05em",lineHeight:1}}>{value}</div>
    </div>
  );
}

function RRBar({rr}){
  if(!rr)return<span style={{color:"#475569"}}>—</span>;
  const color=rr>=2?"#10b981":rr>=1?"#f59e0b":"#ef4444";
  return(
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{width:50,height:5,background:"#1a2540",borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${Math.min((rr/10)*100,100)}%`,height:"100%",background:color,borderRadius:3}}/>
      </div>
      <span style={{color,fontSize:11,fontWeight:700}}>{rr.toFixed(1)}:1</span>
    </div>
  );
}

function Tag({type,children}){
  const styles={
    open:{background:"#1e3a5f",color:"#60a5fa"},
    closed:{background:"#14532d",color:"#4ade80"},
    call:{background:"#14532d",color:"#4ade80"},
    put:{background:"#4c0519",color:"#f87171"},
    stock:{background:"#1e293b",color:"#94a3b8"},
    option:{background:"#2d1b69",color:"#a78bfa"},
  };
  const s=styles[type]||styles.stock;
  return<span style={{...s,display:"inline-block",padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:700}}>{children}</span>;
}

// ── AUTH SCREEN ────────────────────────────────────────────────────────────
function AuthScreen({onAuth}){
  const[mode,setMode]=useState("login");
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  const[success,setSuccess]=useState("");
  const[resetMode,setResetMode]=useState(false);
  const notConfigured=SUPABASE_URL==="YOUR_SUPABASE_URL";

  async function handleSubmit(){
    if(notConfigured){setError("Add your Supabase credentials first.");return;}
    setError("");setSuccess("");setLoading(true);
    try{
      if(resetMode){
        const{error:e}=await supabase.auth.resetPasswordForEmail(email);
        if(e)throw e;
        setSuccess("Reset email sent! Check your inbox.");setResetMode(false);
      }else if(mode==="signup"){
        const{error:e}=await supabase.auth.signUp({email,password});
        if(e)throw e;
        setSuccess("Account created! Check your email to confirm, then log in.");
      }else{
        const{data,error:e}=await supabase.auth.signInWithPassword({email,password});
        if(e)throw e;
        onAuth(data.user);
      }
    }catch(e){setError(e.message);}
    setLoading(false);
  }

  return(
    <div style={{minHeight:"100vh",background:"#0a0e1a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'IBM Plex Mono',monospace",padding:"20px 16px"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');*{box-sizing:border-box;}`}</style>
      <div style={{width:"100%",maxWidth:440}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:32,letterSpacing:4,color:"#3b82f6"}}><span style={{color:"#10b981"}}>◈</span> TRADE JOURNAL</div>
          <div style={{fontSize:11,color:"#475569",marginTop:4,letterSpacing:2}}>CLOUD SYNC ENABLED</div>
        </div>
        {notConfigured&&<div style={{background:"#1a1000",border:"1px solid #f59e0b",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:12,color:"#f59e0b",lineHeight:1.6}}>⚠️ <b>Setup required:</b> Add your Supabase credentials to App.jsx.</div>}
        <div style={{background:"#111827",border:"1px solid #1e2d4d",borderRadius:14,padding:"24px 20px"}}>
          {!resetMode&&(
            <div style={{display:"flex",marginBottom:20,background:"#0d1424",borderRadius:8,padding:3}}>
              {["login","signup"].map(m=>(
                <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"10px 0",border:"none",borderRadius:6,background:mode===m?"#1e3a5f":"transparent",color:mode===m?"#60a5fa":"#64748b",fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer",letterSpacing:1,textTransform:"uppercase"}}>
                  {m==="login"?"Log In":"Sign Up"}
                </button>
              ))}
            </div>
          )}
          {resetMode&&<div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:3,color:"#f59e0b",marginBottom:20}}>RESET PASSWORD</div>}
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,color:"#64748b",marginBottom:5,letterSpacing:"0.08em",textTransform:"uppercase"}}>Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@email.com" onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
              style={{width:"100%",background:"#0d1424",color:"#e2e8f0",border:"1px solid #1e2d4d",borderRadius:8,padding:"13px 14px",fontFamily:"inherit",fontSize:15,outline:"none"}}/>
          </div>
          {!resetMode&&(
            <div style={{marginBottom:20}}>
              <label style={{display:"block",fontSize:11,color:"#64748b",marginBottom:5,letterSpacing:"0.08em",textTransform:"uppercase"}}>Password</label>
              <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
                style={{width:"100%",background:"#0d1424",color:"#e2e8f0",border:"1px solid #1e2d4d",borderRadius:8,padding:"13px 14px",fontFamily:"inherit",fontSize:15,outline:"none"}}/>
            </div>
          )}
          {error&&<div style={{background:"#2d0a0a",border:"1px solid #dc2626",borderRadius:6,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#f87171"}}>{error}</div>}
          {success&&<div style={{background:"#0a2d1a",border:"1px solid #059669",borderRadius:6,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#4ade80"}}>{success}</div>}
          <button onClick={handleSubmit} disabled={loading}
            style={{width:"100%",padding:"14px 0",background:loading?"#1e3a5f":"#2563eb",color:"#fff",border:"none",borderRadius:8,fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",letterSpacing:1,textTransform:"uppercase"}}>
            {loading?"...":(resetMode?"Send Reset Email":mode==="login"?"Log In":"Create Account")}
          </button>
          <div style={{marginTop:14,textAlign:"center",fontSize:12,color:"#475569"}}>
            {!resetMode&&mode==="login"&&<span style={{cursor:"pointer",color:"#64748b",textDecoration:"underline"}} onClick={()=>{setResetMode(true);setError("");}}>Forgot password?</span>}
            {resetMode&&<span style={{cursor:"pointer",color:"#64748b",textDecoration:"underline"}} onClick={()=>{setResetMode(false);setError("");}}>← Back to login</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────
export default function App(){
  const[session,setSession]=useState(null);
  const[authChecked,setAuthChecked]=useState(false);
  const[trades,setTrades]=useState([]);
  const[dbLoading,setDbLoading]=useState(false);
  const[tab,setTab]=useState("Dashboard");
  const[form,setForm]=useState(initialForm);
  const[editId,setEditId]=useState(null);
  const[closeModal,setCloseModal]=useState(null);
  const[filterTicker,setFilterTicker]=useState("");
  const[filterType,setFilterType]=useState("all");
  const[filterStatus,setFilterStatus]=useState("all");
  const[toast,setToast]=useState(null);
  const[planner,setPlanner]=useState({type:"stock",entry:"",stop:"",target:"",qty:"",contracts:"",side:"buy",optionType:"call",strategy:"Long Call",strike:"",expiry:""});
  const[showSignOut,setShowSignOut]=useState(false);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session:s}})=>{setSession(s);setAuthChecked(true);});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>{setSession(s);setAuthChecked(true);});
    return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{if(!session){setTrades([]);return;}loadTrades();},[session]);

  async function loadTrades(){
    setDbLoading(true);
    const{data,error}=await supabase.from("trades").select("*").order("date",{ascending:false});
    if(!error&&data)setTrades(data);
    setDbLoading(false);
  }

  function showToast(msg,type="success"){setToast({msg,type});setTimeout(()=>setToast(null),2800);}
  async function signOut(){await supabase.auth.signOut();setTrades([]);setSession(null);}

  const stats=useMemo(()=>{
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
    closed.forEach(t=>{const pl=calcPL(t);if(pl===null)return;if(!byTicker[t.ticker])byTicker[t.ticker]={pl:0,count:0};byTicker[t.ticker].pl+=pl;byTicker[t.ticker].count++;});
    const monthly={};
    closed.forEach(t=>{const pl=calcPL(t);if(pl===null)return;const mo=t.date.slice(0,7);monthly[mo]=(monthly[mo]||0)+pl;});
    const rMultiples=closed.map(t=>calcRM(t)).filter(v=>v!==null);
    const expectancy=rMultiples.length?rMultiples.reduce((a,b)=>a+b,0)/rMultiples.length:null;
    const rrValues=trades.map(t=>calcRR(t)).filter(v=>v!==null);
    const avgRR=rrValues.length?rrValues.reduce((a,b)=>a+b,0)/rrValues.length:null;
    return{totalPL,wins:wins.length,losses:losses.length,winRate,avgWin,avgLoss,bestTrade,worstTrade,openTrades,byTicker,monthly,total:trades.length,closed:closed.length,expectancy,avgRR,rMultiples};
  },[trades]);

  function hf(e){const{name,value}=e.target;setForm(f=>({...f,[name]:value}));}
  function hp(e){const{name,value}=e.target;setPlanner(p=>({...p,[name]:value}));}

  async function saveTrade(){
    if(!form.ticker){showToast("Ticker is required","error");return;}
    if(form.type==="stock"&&(!form.qty||!form.price)){showToast("Qty and price required","error");return;}
    if(form.type==="option"&&(!form.contracts||!form.premium)){showToast("Contracts and premium required","error");return;}
    const payload={...form,ticker:form.ticker.toUpperCase(),user_id:session.user.id};
    delete payload.id;
    if(editId){
      const{error}=await supabase.from("trades").update(payload).eq("id",editId);
      if(error){showToast("Save failed: "+error.message,"error");return;}
      showToast("Trade updated!");
    }else{
      const{error}=await supabase.from("trades").insert([payload]);
      if(error){showToast("Save failed: "+error.message,"error");return;}
      showToast("Trade logged!");
    }
    await loadTrades();setForm(initialForm);setEditId(null);setTab("History");
  }

  async function deleteTrade(id){
    if(!window.confirm("Delete this trade?"))return;
    const{error}=await supabase.from("trades").delete().eq("id",id);
    if(error){showToast("Delete failed","error");return;}
    setTrades(ts=>ts.filter(t=>t.id!==id));showToast("Deleted","error");
  }

  function editTrade(trade){setForm(trade);setEditId(trade.id);setTab("Log");}
  function closeTrade(trade){setCloseModal({...trade});}

  async function saveClose(){
    const payload={...closeModal,status:"closed"};
    delete payload.id;delete payload.user_id;delete payload.created_at;
    const{error}=await supabase.from("trades").update(payload).eq("id",closeModal.id);
    if(error){showToast("Save failed","error");return;}
    await loadTrades();setCloseModal(null);showToast("Trade closed!");
  }

  const displayed=useMemo(()=>{
    return trades.filter(t=>{
      if(filterTicker&&!t.ticker.includes(filterTicker.toUpperCase()))return false;
      if(filterType!=="all"&&t.type!==filterType)return false;
      if(filterStatus!=="all"&&t.status!==filterStatus)return false;
      return true;
    }).sort((a,b)=>b.date.localeCompare(a.date));
  },[trades,filterTicker,filterType,filterStatus]);

  // planner calcs
  const pE=parseFloat(planner.entry),pS=parseFloat(planner.stop),pT=parseFloat(planner.target);
  const pSize=planner.type==="option"?(parseFloat(planner.contracts)||0)*100:(parseFloat(planner.qty)||0);
  const pRisk=(pE&&pS&&pSize)?Math.abs(planner.side==="buy"?(pE-pS)*pSize:(pS-pE)*pSize):null;
  const pReward=(pE&&pT&&pSize)?Math.abs(planner.side==="buy"?(pT-pE)*pSize:(pE-pT)*pSize):null;
  const pRR=(pRisk&&pReward&&pRisk>0)?pReward/pRisk:null;
  const pRiskPct=(pE&&pS)?Math.abs((pS-pE)/pE*100):null;
  const pRewardPct=(pE&&pT)?Math.abs((pT-pE)/pE*100):null;
  const breakEvenWR=pRR?(1/(1+pRR))*100:null;

  const rBuckets=useMemo(()=>[
    {label:"<-2R",min:-Infinity,max:-2},{label:"-2 to -1R",min:-2,max:-1},{label:"-1 to 0R",min:-1,max:0},
    {label:"0-1R",min:0,max:1},{label:"1-2R",min:1,max:2},{label:"2-3R",min:2,max:3},{label:">3R",min:3,max:Infinity},
  ].map(b=>({...b,count:stats.rMultiples.filter(v=>v>=b.min&&v<b.max).length})),[stats.rMultiples]);
  const maxBucket=Math.max(...rBuckets.map(b=>b.count),1);

  if(!authChecked)return<div style={{minHeight:"100vh",background:"#0a0e1a",display:"flex",alignItems:"center",justifyContent:"center",color:"#64748b",fontFamily:"'IBM Plex Mono',monospace",fontSize:13}}>Loading...</div>;
  if(!session)return<AuthScreen onAuth={u=>setSession({user:u})}/>;

  const TABS=[
    {id:"Dashboard",icon:"◈",label:"Dashboard"},
    {id:"Log",icon:"+",label:"Log Trade"},
    {id:"History",icon:"☰",label:"History"},
    {id:"RR",icon:"⚖",label:"R/R"},
  ];

  return(
    <div style={{fontFamily:"'IBM Plex Mono','Courier New',monospace",background:"#0a0e1a",minHeight:"100vh",color:"#e2e8f0",paddingBottom:70}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#0a0e1a;}
        ::-webkit-scrollbar-thumb{background:#2d3a5c;border-radius:2px;}
        input,select,textarea{background:#111827;color:#e2e8f0;border:1px solid #1e2d4d;border-radius:8px;padding:12px 14px;font-family:inherit;font-size:15px;outline:none;transition:border 0.2s;width:100%;-webkit-appearance:none;appearance:none;}
        select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px;}
        input:focus,select:focus,textarea:focus{border-color:#3b82f6;}
        label{display:block;font-size:11px;color:#64748b;margin-bottom:5px;letter-spacing:0.08em;text-transform:uppercase;}
        .field{margin-bottom:14px;}
        .btn{cursor:pointer;border:none;border-radius:8px;padding:14px 20px;font-family:inherit;font-size:14px;font-weight:600;transition:all 0.15s;letter-spacing:0.04em;touch-action:manipulation;}
        .btn-primary{background:#2563eb;color:#fff;}
        .btn-success{background:#059669;color:#fff;}
        .btn-danger{background:#dc2626;color:#fff;font-size:12px;padding:9px 14px;}
        .btn-ghost{background:transparent;color:#94a3b8;border:1px solid #1e2d4d;}
        .btn-close-trade{background:#0f172a;color:#10b981;border:1px solid #10b981;font-size:12px;padding:8px 14px;border-radius:6px;cursor:pointer;font-family:inherit;font-weight:600;touch-action:manipulation;}
        .card{background:#111827;border:1px solid #1e2d4d;border-radius:12px;padding:16px;}
        .pos{color:#10b981;}.neg{color:#ef4444;}.neu{color:#94a3b8;}.warn{color:#f59e0b;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
        .toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:999;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:600;animation:fadeIn 0.2s ease;white-space:nowrap;}
        .toast-success{background:#059669;color:#fff;}.toast-error{background:#dc2626;color:#fff;}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100;display:flex;align-items:flex-end;justify-content:center;}
        .modal{background:#111827;border:1px solid #2d3a5c;border-radius:16px 16px 0 0;padding:24px 20px 36px;width:100%;max-width:520px;}
        option{background:#111827;}
        .section-title{font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:4px;color:#64748b;margin-bottom:16px;}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .trade-card{background:#111827;border:1px solid #1e2d4d;border-radius:12px;padding:14px;margin-bottom:10px;}
        .trade-card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
        .trade-card-actions{display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #1a2540;}
        @media(min-width:768px){
          .two-col-desktop{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
          .modal{border-radius:14px;margin:auto;max-width:420px;}
          .modal-bg{align-items:center;}
        }
      `}</style>

      {/* HEADER */}
      <div style={{background:"#060b14",borderBottom:"1px solid #1e2d4d",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,position:"sticky",top:0,zIndex:50}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:3,color:"#3b82f6"}}>
          <span style={{color:"#10b981"}}>◈</span> TRADE JOURNAL
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {dbLoading&&<span style={{fontSize:11,color:"#3b82f6"}}>↻</span>}
          <button onClick={()=>setShowSignOut(s=>!s)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"#1e3a5f",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#60a5fa",fontWeight:700}}>
              {session.user.email[0].toUpperCase()}
            </div>
          </button>
          {showSignOut&&(
            <div style={{position:"absolute",top:52,right:12,background:"#111827",border:"1px solid #1e2d4d",borderRadius:8,padding:"8px 0",zIndex:200,minWidth:160}}>
              <div style={{padding:"6px 16px",fontSize:11,color:"#475569",borderBottom:"1px solid #1e2d4d",marginBottom:4}}>{session.user.email}</div>
              <button onClick={signOut} style={{display:"block",width:"100%",textAlign:"left",padding:"8px 16px",background:"none",border:"none",color:"#ef4444",fontFamily:"inherit",fontSize:13,cursor:"pointer"}}>Sign Out</button>
            </div>
          )}
        </div>
      </div>

      {toast&&<div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* CONTENT */}
      <div style={{padding:"16px",maxWidth:800,margin:"0 auto"}}>

        {/* ── DASHBOARD ── */}
        {tab==="Dashboard"&&(
          <div>
            <div className="section-title">PORTFOLIO OVERVIEW</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <StatCard label="Total P&L" value={fmt(stats.totalPL)} cls={stats.totalPL>=0?"pos":"neg"}/>
              <StatCard label="Win Rate" value={pct(stats.winRate)} cls={stats.winRate>=50?"pos":"neg"}/>
              <StatCard label="Wins / Losses" value={`${stats.wins} / ${stats.losses}`} cls="neu"/>
              <StatCard label="Open Trades" value={stats.openTrades} cls="neu"/>
              <StatCard label="Best Trade" value={fmt(stats.bestTrade)} cls="pos"/>
              <StatCard label="Worst Trade" value={fmt(stats.worstTrade)} cls="neg"/>
              <StatCard label="Avg Win" value={fmt(stats.avgWin)} cls="pos"/>
              <StatCard label="Avg Loss" value={fmt(stats.avgLoss)} cls="neg"/>
              <StatCard label="Expectancy" value={stats.expectancy!==null?fmtR(stats.expectancy):"—"} cls={stats.expectancy>0?"pos":stats.expectancy<0?"neg":"neu"}/>
              <StatCard label="Avg R:R" value={stats.avgRR!==null?stats.avgRR.toFixed(2)+":1":"—"} cls={stats.avgRR>=2?"pos":stats.avgRR>=1?"warn":"neg"}/>
            </div>

            <div className="card" style={{marginBottom:12}}>
              <div className="section-title" style={{marginBottom:12}}>P&L BY TICKER</div>
              {Object.keys(stats.byTicker).length===0
                ?<div style={{color:"#475569",fontSize:13}}>No closed trades yet</div>
                :Object.entries(stats.byTicker).sort((a,b)=>b[1].pl-a[1].pl).map(([tk,d])=>(
                  <div key={tk} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #1a2540"}}>
                    <div>
                      <span style={{fontWeight:700,fontSize:14}}>{tk}</span>
                      <span style={{fontSize:11,color:"#475569",marginLeft:8}}>{d.count} trade{d.count!==1?"s":""}</span>
                    </div>
                    <span className={d.pl>=0?"pos":"neg"} style={{fontWeight:700,fontSize:15}}>{fmt(d.pl)}</span>
                  </div>
                ))}
            </div>

            <div className="card">
              <div className="section-title" style={{marginBottom:12}}>MONTHLY P&L</div>
              {Object.keys(stats.monthly).length===0
                ?<div style={{color:"#475569",fontSize:13}}>No closed trades yet</div>
                :Object.entries(stats.monthly).sort((a,b)=>b[0].localeCompare(a[0])).map(([mo,pl])=>(
                  <div key={mo} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #1a2540"}}>
                    <span style={{fontSize:13}}>{mo}</span>
                    <span className={pl>=0?"pos":"neg"} style={{fontWeight:700,fontSize:15}}>{fmt(pl)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── LOG TRADE ── */}
        {tab==="Log"&&(
          <div>
            <div className="section-title">{editId?"✏ EDIT TRADE":"◈ LOG NEW TRADE"}</div>
            <div className="card">
              {/* Type toggle */}
              <div style={{display:"flex",gap:8,marginBottom:20}}>
                {["stock","option"].map(t=>(
                  <button key={t} className="btn" onClick={()=>setForm(f=>({...f,type:t}))}
                    style={{flex:1,background:form.type===t?(t==="stock"?"#0f2040":"#1a0f40"):"transparent",color:form.type===t?(t==="stock"?"#60a5fa":"#a78bfa"):"#475569",border:`2px solid ${form.type===t?(t==="stock"?"#3b82f6":"#a78bfa"):"#1e2d4d"}`,fontSize:13,letterSpacing:1,padding:"12px 0"}}>
                    {t==="stock"?"📈 STOCK":"⚡ OPTION"}
                  </button>
                ))}
              </div>

              <div className="two-col">
                <div className="field"><label>Date</label><input type="date" name="date" value={form.date} onChange={hf}/></div>
                <div className="field"><label>Ticker</label><input name="ticker" value={form.ticker} onChange={hf} placeholder="AAPL" style={{textTransform:"uppercase"}}/></div>
              </div>

              {form.type==="stock"?(
                <>
                  <div className="two-col">
                    <div className="field"><label>Side</label><select name="side" value={form.side} onChange={hf}><option value="buy">Buy (Long)</option><option value="sell">Sell (Short)</option></select></div>
                    <div className="field"><label>Shares</label><input name="qty" type="number" value={form.qty} onChange={hf} placeholder="100"/></div>
                  </div>
                  <div className="two-col">
                    <div className="field"><label>Entry Price</label><input name="price" type="number" value={form.price} onChange={hf} placeholder="150.00"/></div>
                    <div className="field"><label>Close Price</label><input name="close_price" type="number" value={form.close_price} onChange={hf} placeholder="160.00"/></div>
                  </div>
                </>
              ):(
                <>
                  <div className="field"><label>Strategy</label><select name="strategy" value={form.strategy} onChange={hf}>{OPTION_STRATEGIES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                  <div className="two-col">
                    <div className="field"><label>Option Type</label><select name="option_type" value={form.option_type} onChange={hf}><option value="call">Call</option><option value="put">Put</option><option value="spread">Spread</option></select></div>
                    <div className="field"><label>Side</label><select name="side" value={form.side} onChange={hf}><option value="buy">Buy</option><option value="sell">Sell</option></select></div>
                  </div>
                  <div className="two-col">
                    <div className="field"><label>Strike Price</label><input name="strike" type="number" value={form.strike} onChange={hf} placeholder="150"/></div>
                    <div className="field"><label>Expiry Date</label><input type="date" name="expiry" value={form.expiry} onChange={hf}/></div>
                  </div>
                  <div className="two-col">
                    <div className="field"><label>Contracts</label><input name="contracts" type="number" value={form.contracts} onChange={hf} placeholder="2"/></div>
                    <div className="field"><label>Premium/contract</label><input name="premium" type="number" value={form.premium} onChange={hf} placeholder="3.50"/></div>
                  </div>
                  <div className="field"><label>Close Premium/contract</label><input name="close_premium" type="number" value={form.close_premium} onChange={hf} placeholder="1.20"/></div>
                </>
              )}

              <div className="two-col">
                <div className="field">
                  <label>Stop Loss{form.type==="option"&&<span style={{color:"#a78bfa",fontWeight:400}}> (premium)</span>}</label>
                  <input name="stop_loss" type="number" value={form.stop_loss} onChange={hf} placeholder={form.type==="option"?"1.75":"145.00"}/>
                  {form.type==="option"&&<div style={{fontSize:10,color:"#64748b",marginTop:4}}>Exit premium level</div>}
                </div>
                <div className="field">
                  <label>Target{form.type==="option"&&<span style={{color:"#a78bfa",fontWeight:400}}> (premium)</span>}</label>
                  <input name="target" type="number" value={form.target} onChange={hf} placeholder={form.type==="option"?"7.00":"165.00"}/>
                  {form.type==="option"&&<div style={{fontSize:10,color:"#64748b",marginTop:4}}>Take profit premium</div>}
                </div>
              </div>

              <div className="two-col">
                <div className="field"><label>Fees</label><input name="fees" type="number" value={form.fees} onChange={hf} placeholder="0.65"/></div>
                <div className="field"><label>Status</label><select name="status" value={form.status} onChange={hf}><option value="open">Open</option><option value="closed">Closed</option></select></div>
              </div>
              <div className="field"><label>Notes</label><textarea name="notes" value={form.notes} onChange={hf} rows={3} placeholder="Trade thesis, setup, market conditions..."/></div>

              {/* Live R:R preview */}
              {(()=>{const rr=calcRR(form),risk=calcRisk(form),reward=calcReward(form);if(!rr)return null;return(
                <div style={{marginBottom:14,padding:"12px 14px",background:"#0d1424",borderRadius:8,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>RISK</div><span className="neg" style={{fontWeight:700}}>{fmt(risk)}</span></div>
                  <div><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>REWARD</div><span className="pos" style={{fontWeight:700}}>{fmt(reward)}</span></div>
                  <div><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>R:R RATIO</div><span className={rr>=2?"pos":rr>=1?"warn":"neg"} style={{fontWeight:700}}>{rr.toFixed(2)}:1</span></div>
                  <div><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>MIN WIN RATE</div><span className="neu" style={{fontWeight:700}}>{(1/(1+rr)*100).toFixed(1)}%</span></div>
                </div>
              );})()}

              <div style={{display:"flex",gap:10}}>
                <button className="btn btn-primary" onClick={saveTrade} style={{flex:1}}>{editId?"Update Trade":"Log Trade"}</button>
                {editId&&<button className="btn btn-ghost" onClick={()=>{setForm(initialForm);setEditId(null);}}>Cancel</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── TRADE HISTORY ── */}
        {tab==="History"&&(
          <div>
            <div className="section-title">TRADE HISTORY</div>
            {/* Filters */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
              <div><label>Ticker</label><input value={filterTicker} onChange={e=>setFilterTicker(e.target.value)} placeholder="AAPL" style={{fontSize:13,padding:"10px 10px"}}/></div>
              <div><label>Type</label><select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{fontSize:13,padding:"10px 10px"}}><option value="all">All</option><option value="stock">Stock</option><option value="option">Option</option></select></div>
              <div><label>Status</label><select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{fontSize:13,padding:"10px 10px"}}><option value="all">All</option><option value="open">Open</option><option value="closed">Closed</option></select></div>
            </div>
            <div style={{fontSize:11,color:"#475569",marginBottom:10}}>{displayed.length} trade{displayed.length!==1?"s":""}</div>

            {displayed.length===0&&<div style={{color:"#475569",fontSize:13,textAlign:"center",padding:32}}>No trades found. Log your first trade!</div>}

            {/* Mobile trade cards */}
            {displayed.map(t=>{
              const pl=calcPL(t),rr=calcRR(t),rm=calcRM(t);
              return(
                <div key={t.id} className="trade-card">
                  <div className="trade-card-header">
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontWeight:700,fontSize:16}}>{t.ticker}</span>
                      <Tag type={t.type}>{t.type}</Tag>
                      <Tag type={t.status}>{t.status}</Tag>
                    </div>
                    <span style={{fontSize:12,color:"#64748b"}}>{t.date}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:6}}>
                    <div>
                      <div style={{fontSize:10,color:"#64748b",marginBottom:2}}>SIDE</div>
                      <span style={{fontSize:12,fontWeight:600,color:t.side==="buy"?"#10b981":"#f87171",textTransform:"uppercase"}}>{t.side}</span>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:"#64748b",marginBottom:2}}>P&L</div>
                      {pl===null?<span style={{color:"#475569",fontSize:12}}>Open</span>:<span className={pl>=0?"pos":"neg"} style={{fontWeight:700,fontSize:13}}>{fmt(pl)}</span>}
                    </div>
                    <div>
                      <div style={{fontSize:10,color:"#64748b",marginBottom:2}}>R-MULT</div>
                      {rm===null?<span style={{color:"#475569",fontSize:12}}>—</span>:<span className={rm>=1?"pos":rm>=0?"warn":"neg"} style={{fontWeight:700,fontSize:13}}>{fmtR(rm)}</span>}
                    </div>
                  </div>
                  {t.type==="option"&&(
                    <div style={{fontSize:11,color:"#94a3b8",marginBottom:4}}>
                      {t.strategy} · {t.option_type} @ ${t.strike} · exp {t.expiry}
                    </div>
                  )}
                  {t.type==="stock"&&(
                    <div style={{fontSize:11,color:"#94a3b8",marginBottom:4}}>
                      {t.qty} shares @ ${t.price}
                    </div>
                  )}
                  {rr&&<div style={{marginBottom:4}}><RRBar rr={rr}/></div>}
                  <div className="trade-card-actions">
                    {t.status==="open"&&<button className="btn-close-trade" onClick={()=>closeTrade(t)}>Close Trade</button>}
                    <button onClick={()=>editTrade(t)} style={{background:"transparent",border:"1px solid #1e2d4d",color:"#94a3b8",borderRadius:6,padding:"8px 14px",fontFamily:"inherit",fontSize:12,cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>deleteTrade(t.id)} style={{background:"transparent",border:"1px solid #dc2626",color:"#ef4444",borderRadius:6,padding:"8px 12px",fontFamily:"inherit",fontSize:12,cursor:"pointer",marginLeft:"auto"}}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── RISK / REWARD ── */}
        {tab==="RR"&&(
          <div>
            <div className="section-title">⚖ RISK / REWARD</div>

            {/* Planner */}
            <div className="card" style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14}}>Trade Planner</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <button onClick={()=>setPlanner(p=>({...p,type:"stock"}))}
                  style={{flex:1,padding:"12px 0",border:`2px solid ${planner.type==="stock"?"#3b82f6":"#1e2d4d"}`,borderRadius:8,background:planner.type==="stock"?"#0f2040":"transparent",color:planner.type==="stock"?"#60a5fa":"#475569",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  📈 STOCK
                </button>
                <button onClick={()=>setPlanner(p=>({...p,type:"option"}))}
                  style={{flex:1,padding:"12px 0",border:`2px solid ${planner.type==="option"?"#a78bfa":"#1e2d4d"}`,borderRadius:8,background:planner.type==="option"?"#1a0f40":"transparent",color:planner.type==="option"?"#a78bfa":"#475569",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  ⚡ OPTION
                </button>
              </div>

              {planner.type==="stock"&&(
                <>
                  <div style={{fontSize:10,color:"#3b82f6",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10,paddingBottom:6,borderBottom:"1px solid #0f2040"}}>📈 Stock Parameters</div>
                  <div className="two-col">
                    <div className="field"><label>Side</label><select name="side" value={planner.side} onChange={hp}><option value="buy">Buy / Long</option><option value="sell">Sell / Short</option></select></div>
                    <div className="field"><label>Shares</label><input name="qty" type="number" value={planner.qty} onChange={hp} placeholder="100"/></div>
                    <div className="field"><label>Entry ($)</label><input name="entry" type="number" value={planner.entry} onChange={hp} placeholder="150.00"/></div>
                    <div className="field"><label>Stop Loss ($)</label><input name="stop" type="number" value={planner.stop} onChange={hp} placeholder="145.00"/></div>
                  </div>
                  <div className="field"><label>Target ($)</label><input name="target" type="number" value={planner.target} onChange={hp} placeholder="165.00"/></div>
                </>
              )}

              {planner.type==="option"&&(
                <>
                  <div style={{fontSize:10,color:"#a78bfa",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10,paddingBottom:6,borderBottom:"1px solid #1a0f40"}}>⚡ Option Parameters</div>
                  <div className="two-col">
                    <div className="field"><label>Option Type</label><select name="optionType" value={planner.optionType||"call"} onChange={hp}><option value="call">Call</option><option value="put">Put</option><option value="spread">Spread</option></select></div>
                    <div className="field"><label>Side</label><select name="side" value={planner.side} onChange={hp}><option value="buy">Buy</option><option value="sell">Sell</option></select></div>
                  </div>
                  <div className="field"><label>Strategy</label><select name="strategy" value={planner.strategy||"Long Call"} onChange={hp}>{OPTION_STRATEGIES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                  <div className="two-col">
                    <div className="field"><label>Contracts</label><input name="contracts" type="number" value={planner.contracts} onChange={hp} placeholder="2"/></div>
                    <div className="field"><label>Strike ($)</label><input name="strike" type="number" value={planner.strike||""} onChange={hp} placeholder="150"/></div>
                  </div>
                  <div className="field"><label>Expiry</label><input name="expiry" type="date" value={planner.expiry||""} onChange={hp}/></div>
                  <div className="two-col">
                    <div className="field"><label>Entry Premium</label><input name="entry" type="number" value={planner.entry} onChange={hp} placeholder="3.50"/></div>
                    <div className="field"><label>Stop Premium</label><input name="stop" type="number" value={planner.stop} onChange={hp} placeholder="1.50"/></div>
                  </div>
                  <div className="field"><label>Target Premium</label><input name="target" type="number" value={planner.target} onChange={hp} placeholder="7.00"/></div>
                  {planner.strike&&planner.expiry&&<div style={{padding:"8px 12px",background:"#0d1424",borderRadius:6,fontSize:11,color:"#a78bfa",marginBottom:12}}>{(planner.optionType||"call").toUpperCase()} @ ${planner.strike} · exp {planner.expiry}</div>}
                </>
              )}

              {/* Results */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
                {[
                  {label:"Max Risk $",value:pRisk!==null?fmt(pRisk):"—",cls:"neg"},
                  {label:"Max Reward $",value:pReward!==null?fmt(pReward):"—",cls:"pos"},
                  {label:"Risk %",value:pRiskPct!==null?pRiskPct.toFixed(2)+"%":"—",cls:"neg"},
                  {label:"Reward %",value:pRewardPct!==null?pRewardPct.toFixed(2)+"%":"—",cls:"pos"},
                ].map(item=>(
                  <div key={item.label} style={{background:"#0d1424",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:"#64748b",marginBottom:3,textTransform:"uppercase",letterSpacing:"0.06em"}}>{item.label}</div>
                    <div className={item.cls} style={{fontWeight:700,fontSize:15}}>{item.value}</div>
                  </div>
                ))}
              </div>

              {pRR!==null&&(
                <div style={{marginTop:12,background:"#0d1424",borderRadius:10,padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:11,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em"}}>R:R Ratio</span>
                    <span style={{fontFamily:"'Bebas Neue'",fontSize:30,color:pRR>=2?"#10b981":pRR>=1?"#f59e0b":"#ef4444",letterSpacing:2}}>{pRR.toFixed(2)}:1</span>
                  </div>
                  <div style={{width:"100%",height:8,background:"#1a2540",borderRadius:4,overflow:"hidden",marginBottom:8}}>
                    <div style={{width:`${Math.min((pRR/5)*100,100)}%`,height:"100%",background:pRR>=2?"#10b981":pRR>=1?"#f59e0b":"#ef4444",borderRadius:4}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:4}}>
                    <span style={{fontSize:11,color:"#94a3b8"}}>{pRR>=3?"🔥 Excellent":pRR>=2?"✅ Good":pRR>=1?"⚠️ Marginal":"❌ Poor setup"}</span>
                    {breakEvenWR!==null&&<span style={{fontSize:11,color:"#64748b"}}>Min win rate: <b style={{color:"#e2e8f0"}}>{breakEvenWR.toFixed(1)}%</b></span>}
                  </div>
                </div>
              )}
            </div>

            {/* Position sizing */}
            <div className="card" style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>Position Sizing Guide</div>
              {pRisk!==null&&pRisk>0?(
                <div>
                  {[0.5,1,2,5,10].map(p=>{
                    const acct=pRisk/(p/100);
                    return(
                      <div key={p} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #1a2540"}}>
                        <span style={{fontSize:13,color:p===10?"#f59e0b":"#64748b",fontWeight:p===10?700:400}}>Risk {p}% {p===10?"⚠️":""}</span>
                        <span style={{fontSize:13,fontWeight:600,color:p===10?"#f59e0b":"#60a5fa"}}>{fmt(acct)}</span>
                      </div>
                    );
                  })}
                  <div style={{marginTop:8,fontSize:11,color:"#475569"}}>Based on {fmt(pRisk)} max risk</div>
                </div>
              ):<div style={{color:"#475569",fontSize:13}}>Enter entry, stop loss & size above to calculate.</div>}
            </div>

            {/* R-Multiple Analytics */}
            <div className="card" style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>R-Multiple Analytics</div>
              {stats.rMultiples.length===0
                ?<div style={{color:"#475569",fontSize:13}}>Log trades with stop & target to see analytics.</div>
                :(
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                      {[
                        {label:"Expectancy",value:stats.expectancy!==null?fmtR(stats.expectancy):"—",cls:stats.expectancy>0?"pos":"neg"},
                        {label:"Avg R:R",value:stats.avgRR!==null?stats.avgRR.toFixed(1)+":1":"—",cls:stats.avgRR>=2?"pos":stats.avgRR>=1?"warn":"neg"},
                        {label:"Win Rate",value:pct(stats.winRate),cls:stats.winRate>=50?"pos":"neg"},
                      ].map(s=>(
                        <div key={s.label} style={{background:"#0d1424",borderRadius:8,padding:"10px 10px",textAlign:"center"}}>
                          <div style={{fontSize:9,color:"#64748b",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</div>
                          <div className={s.cls} style={{fontWeight:700,fontSize:14}}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                    {stats.expectancy!==null&&(
                      <div style={{background:"#0d1424",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#94a3b8",lineHeight:1.7}}>
                        Per 1R risked you expect to {stats.expectancy>0?"gain":"lose"} <b style={{color:"#e2e8f0"}}>{Math.abs(stats.expectancy).toFixed(2)}R</b>.
                        {stats.expectancy>=0.5?" 🔥 Strong edge.":stats.expectancy>=0?" ⚠️ Slight edge.":" ❌ Negative expectancy."}
                      </div>
                    )}
                  </div>
                )}
            </div>

            {/* R distribution */}
            <div className="card" style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>R-Multiple Distribution</div>
              {rBuckets.every(b=>b.count===0)
                ?<div style={{color:"#475569",fontSize:13}}>No R-multiple data yet.</div>
                :(
                  <div>
                    <div style={{display:"flex",alignItems:"flex-end",gap:3,height:90,marginBottom:5}}>
                      {rBuckets.map(b=>{
                        const h=(b.count/maxBucket)*80;
                        return(
                          <div key={b.label} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                            {b.count>0&&<span style={{fontSize:9,color:"#94a3b8"}}>{b.count}</span>}
                            <div style={{width:"100%",height:h||2,background:b.max<=0?"#ef4444":"#10b981",borderRadius:"2px 2px 0 0",opacity:b.count===0?0.15:1}}/>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{display:"flex",gap:3}}>
                      {rBuckets.map(b=><div key={b.label} style={{flex:1,fontSize:8,color:"#475569",textAlign:"center",lineHeight:1.2}}>{b.label}</div>)}
                    </div>
                  </div>
                )}
            </div>

            {/* Open trade monitor */}
            <div className="card">
              <div style={{fontSize:11,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>Open Trade Risk Monitor</div>
              {trades.filter(t=>t.status==="open").length===0
                ?<div style={{color:"#475569",fontSize:13}}>No open trades.</div>
                :trades.filter(t=>t.status==="open").map(t=>{
                  const risk=calcRisk(t),reward=calcReward(t),rr=calcRR(t);
                  return(
                    <div key={t.id} style={{padding:"10px 0",borderBottom:"1px solid #1a2540"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                        <span style={{fontWeight:700,fontSize:14}}>{t.ticker}</span>
                        <RRBar rr={rr}/>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                        <div><div style={{fontSize:9,color:"#64748b",marginBottom:2}}>RISK</div><span className="neg" style={{fontSize:12,fontWeight:600}}>{risk!==null?fmt(risk):"—"}</span></div>
                        <div><div style={{fontSize:9,color:"#64748b",marginBottom:2}}>REWARD</div><span className="pos" style={{fontSize:12,fontWeight:600}}>{reward!==null?fmt(reward):"—"}</span></div>
                        <div><div style={{fontSize:9,color:"#64748b",marginBottom:2}}>STOP</div><span style={{fontSize:12,color:"#94a3b8"}}>{t.stop_loss?`$${t.stop_loss}`:"—"}</span></div>
                        <div><div style={{fontSize:9,color:"#64748b",marginBottom:2}}>TARGET</div><span style={{fontSize:12,color:"#94a3b8"}}>{t.target?`$${t.target}`:"—"}</span></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#060b14",borderTop:"1px solid #1e2d4d",display:"flex",zIndex:50,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,padding:"10px 0 8px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,color:tab===t.id?"#3b82f6":"#475569",fontFamily:"inherit",transition:"color 0.15s",touchAction:"manipulation"}}>
            <span style={{fontSize:t.id==="Log"?22:16,fontWeight:t.id==="Log"?700:400,lineHeight:1}}>{t.icon}</span>
            <span style={{fontSize:9,letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:tab===t.id?700:400}}>{t.label}</span>
            {tab===t.id&&<div style={{width:20,height:2,background:"#3b82f6",borderRadius:1,marginTop:1}}/>}
          </button>
        ))}
      </div>

      {/* CLOSE TRADE MODAL */}
      {closeModal&&(
        <div className="modal-bg" onClick={()=>setCloseModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:3,marginBottom:18,color:"#10b981"}}>CLOSE — {closeModal.ticker}</div>
            <div className="field">
              {closeModal.type==="stock"
                ?<><label>Close / Exit Price</label><input type="number" value={closeModal.close_price||""} onChange={e=>setCloseModal(m=>({...m,close_price:e.target.value}))} placeholder="Exit price" autoFocus/></>
                :<><label>Close Premium (per contract)</label><input type="number" value={closeModal.close_premium||""} onChange={e=>setCloseModal(m=>({...m,close_premium:e.target.value}))} placeholder="Exit premium" autoFocus/></>}
            </div>
            <div className="field"><label>Fees on Close</label><input type="number" value={closeModal.fees||"0"} onChange={e=>setCloseModal(m=>({...m,fees:e.target.value}))} placeholder="0.65"/></div>
            {(()=>{
              const preview={...closeModal,status:"closed"};
              const pl=calcPL(preview),rm=calcRM(preview);
              return pl!==null?(
                <div style={{marginBottom:16,padding:"12px 14px",background:"#0d1424",borderRadius:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:rm!==null?6:0}}>
                    <span style={{fontSize:12,color:"#64748b"}}>Estimated P&L</span>
                    <span className={pl>=0?"pos":"neg"} style={{fontWeight:700,fontSize:15}}>{fmt(pl)}</span>
                  </div>
                  {rm!==null&&<div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:12,color:"#64748b"}}>R-Multiple</span>
                    <span className={rm>=1?"pos":rm>=0?"warn":"neg"} style={{fontWeight:700}}>{fmtR(rm)}</span>
                  </div>}
                </div>
              ):null;
            })()}
            <div style={{display:"flex",gap:10}}>
              <button className="btn btn-success" onClick={saveClose} style={{flex:1,fontSize:15}}>Confirm Close</button>
              <button className="btn btn-ghost" onClick={()=>setCloseModal(null)} style={{padding:"14px 18px"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
