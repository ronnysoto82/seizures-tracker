import { useState, useMemo, useEffect } from "react";

// ── Supabase client (CDN, no npm needed) ──────────────────────────
const SUPA_URL = "https://xmvuoksikudkpjhoykvo.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdnVva3Npa3Vka3BqaG95a3ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNjM0OTMsImV4cCI6MjA5NzYzOTQ5M30.hZZfpbkTNVx4Y4NON82vyGH9xXYFbyD8RCsqSPZVyQA";

async function supaFetch(path, opts = {}) {
  const { method = "GET", body, token } = opts;
  const headers = {
    "apikey": SUPA_KEY,
    "Content-Type": "application/json",
    "Prefer": method === "POST" ? "return=representation" : undefined,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${SUPA_URL}${path}`, {
    method,
    headers: Object.fromEntries(Object.entries(headers).filter(([,v]) => v)),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function signIn(email, password) {
  const data = await supaFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  return data;
}

async function signUp(email, password) {
  return supaFetch("/auth/v1/signup", { method:"POST", body:{ email, password } });
}

async function signOut(token) {
  return supaFetch("/auth/v1/logout", { method:"POST", token });
}

// DB helpers
const db = {
  async getSeizures(token) {
    return supaFetch("/rest/v1/seizures?select=*&order=date.desc,time.desc", { token });
  },
  async addSeizure(token, userId, data) {
    return supaFetch("/rest/v1/seizures", { method:"POST", token,
      body:{ user_id:userId, date:data.date, time:data.time, duration:data.duration, activity:data.activity, notes:data.notes } });
  },
  async deleteSeizure(token, id) {
    return supaFetch(`/rest/v1/seizures?id=eq.${id}`, { method:"DELETE", token });
  },
  async getMeds(token) {
    return supaFetch("/rest/v1/medications?select=*&order=created_at.asc", { token });
  },
  async addMed(token, userId, data) {
    return supaFetch("/rest/v1/medications", { method:"POST", token,
      body:{ user_id:userId, name:data.name, dose:data.dose, schedule:data.schedule, photo:data.photo||null,
             dose_history:JSON.stringify([{dose:data.dose, date:fmtDate(new Date())}]) } });
  },
  async updateMed(token, id, patch) {
    return supaFetch(`/rest/v1/medications?id=eq.${id}`, { method:"PATCH", token, body:patch });
  },
};

// ── Design tokens ─────────────────────────────────────────────────
const C = {
  bg:"#0F1623", surface:"#1A2233", card:"#1F2A3C", border:"#2A3650",
  teal:"#4EC9B0", tealDim:"#2A6357", red:"#E05C5C", redDim:"#5C2626",
  gold:"#F0C060", text:"#E8EDF5", muted:"#7A8BA8", white:"#FFFFFF",
};

const PAD = (n) => String(n).padStart(2,"0");
const fmtDate = (d) => `${d.getFullYear()}-${PAD(d.getMonth()+1)}-${PAD(d.getDate())}`;
const fmtTime = (d) => `${PAD(d.getHours())}:${PAD(d.getMinutes())}`;
const MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const fmtDateDisplay = (iso) => { const [y,m,d] = iso.split("-"); return `${d}-${MON3[+m-1]}-${y.slice(2)}`; };
const parseDuration = (str) => { const n = parseInt(str,10); return isNaN(n)||n<0?0:n; };

// ── Shared UI ─────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"flex-end",zIndex:100 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.surface,borderRadius:"20px 20px 0 0",width:"100%",padding:"24px 20px 32px",maxHeight:"88vh",overflowY:"auto" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
          <span style={{ fontWeight:700,fontSize:18,color:C.text }}>{title}</span>
          <button onClick={onClose} style={{ background:C.card,border:"none",color:C.muted,borderRadius:99,width:32,height:32,cursor:"pointer",fontSize:18 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:12,color:C.muted,marginBottom:6,fontWeight:600,letterSpacing:".04em",textTransform:"uppercase" }}>{label}</div>
      {children}
    </div>
  );
}
const inputStyle = { width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:15,padding:"10px 12px",boxSizing:"border-box",outline:"none" };
function Input(props) { return <input style={inputStyle} {...props} />; }
function Select({ value, onChange, options }) {
  return <select value={value} onChange={onChange} style={{...inputStyle,appearance:"none"}}>{options.map(o=><option key={o}>{o}</option>)}</select>;
}
function Btn({ onClick, children, variant="primary", disabled=false }) {
  const bg = variant==="danger"?C.red:variant==="ghost"?C.card:C.teal;
  const col = variant==="ghost"?C.text:"#0F1623";
  return <button onClick={onClick} disabled={disabled} style={{ background:bg,color:col,border:"none",borderRadius:12,padding:"13px 20px",fontWeight:700,fontSize:15,cursor:"pointer",width:"100%",opacity:disabled?0.5:1 }}>{children}</button>;
}
function Spinner() {
  return <div style={{ display:"flex",justifyContent:"center",padding:40 }}><div style={{ width:32,height:32,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.teal}`,borderRadius:"50%",animation:"spin 0.8s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
}

// ── Login screen ──────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit() {
    setError(""); setSuccess("");
    if (!email || !password) { setError("Please enter email and password."); return; }
    setLoading(true);
    try {
      if (mode === "login") {
        const data = await signIn(email, password);
        if (data?.access_token) onLogin(data);
        else setError("Invalid email or password.");
      } else {
        await signUp(email, password);
        setSuccess("Account created! Check your email to confirm, then log in.");
        setMode("login");
      }
    } catch(e) {
      setError(e.message || "Something went wrong.");
    }
    setLoading(false);
  }

  return (
    <div style={{ background:C.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 24px",fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div style={{ marginBottom:32,textAlign:"center" }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:12 }}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        <div style={{ fontSize:24,fontWeight:800,color:C.text }}>Seizure Tracker</div>
        <div style={{ fontSize:13,color:C.muted,marginTop:4 }}>{mode==="login"?"Sign in to continue":"Create your account"}</div>
      </div>

      <div style={{ width:"100%",maxWidth:380,background:C.surface,borderRadius:20,padding:24,border:`1px solid ${C.border}` }}>
        {error && <div style={{ background:C.redDim,border:`1px solid ${C.red}`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:C.red }}>{error}</div>}
        {success && <div style={{ background:C.tealDim,border:`1px solid ${C.teal}`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:C.teal }}>{success}</div>}
        <Field label="Email"><Input type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} /></Field>
        <Field label="Password"><Input type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} /></Field>
        <div style={{ marginTop:8 }}>
          <Btn onClick={handleSubmit} disabled={loading}>{loading ? "Please wait…" : mode==="login" ? "Sign in" : "Create account"}</Btn>
        </div>
        <button onClick={() => { setMode(m=>m==="login"?"signup":"login"); setError(""); setSuccess(""); }}
          style={{ marginTop:16,width:"100%",background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer" }}>
          {mode==="login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

// ── SeizureFreeTimer ──────────────────────────────────────────────
function SeizureFreeTimer({ seizures }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(id); }, []);
  const lastSeizure = useMemo(() => {
    if (!seizures.length) return null;
    return seizures.reduce((l,s) => { const dt=s.date+"T"+s.time; return dt>l?dt:l; }, "");
  }, [seizures]);
  const { days,hours,mins,secs,hasRecord } = useMemo(() => {
    if (!lastSeizure) return {days:0,hours:0,mins:0,secs:0,hasRecord:false};
    const diff = Math.max(0,Math.floor((now-new Date(lastSeizure))/1000));
    return {hasRecord:true,days:Math.floor(diff/86400),hours:Math.floor((diff%86400)/3600),mins:Math.floor((diff%3600)/60),secs:diff%60};
  }, [lastSeizure,now]);
  const accent = days>=30?C.teal:days>=7?C.gold:C.red;
  return (
    <div style={{ margin:"12px 16px 0",background:C.card,borderRadius:16,border:`1px solid ${accent}44`,padding:"14px 16px" }}>
      <div style={{ fontSize:11,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:10 }}>Seizure-free</div>
      {!hasRecord ? <div style={{ fontSize:13,color:C.muted }}>No seizures recorded yet.</div>
        : <div style={{ display:"flex",gap:8 }}>
            {[{val:days,unit:"days"},{val:hours,unit:"hrs"},{val:mins,unit:"min"},{val:secs,unit:"sec"}].map(({val,unit})=>(
              <div key={unit} style={{ textAlign:"center",flex:1 }}>
                <div style={{ fontSize:26,fontWeight:800,color:accent,lineHeight:1 }}>{PAD(val)}</div>
                <div style={{ fontSize:10,color:C.muted,marginTop:3 }}>{unit}</div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── StatsBar ──────────────────────────────────────────────────────
function StatsBar({ seizures }) {
  const last7  = useMemo(()=>{ const c=new Date(); c.setDate(c.getDate()-7);  return seizures.filter(s=>s.date>=fmtDate(c)).length; },[seizures]);
  const last30 = useMemo(()=>{ const c=new Date(); c.setDate(c.getDate()-30); return seizures.filter(s=>s.date>=fmtDate(c)).length; },[seizures]);
  const avgDur = useMemo(()=>{ if(!seizures.length)return 0; return Math.round(seizures.reduce((a,s)=>a+s.duration,0)/seizures.length); },[seizures]);
  return (
    <div style={{ display:"flex",gap:10,padding:"12px 16px 4px" }}>
      {[{label:"Last 7 days",value:last7,unit:"seizures",color:C.teal},{label:"Last 30 days",value:last30,unit:"seizures",color:C.red},{label:"Avg duration",value:avgDur,unit:"seconds",color:C.gold}].map(({label,value,unit,color})=>(
        <div key={label} style={{ flex:1,background:C.card,borderRadius:12,padding:"10px 8px",textAlign:"center",border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:20,fontWeight:800,color }}>{value}</div>
          <div style={{ fontSize:10,color:C.muted,lineHeight:1.3 }}>{unit}<br/>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── LogView ───────────────────────────────────────────────────────
function LogView({ seizures, onAdd, onDelete, loading }) {
  const now = new Date();
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date:fmtDate(now), time:fmtTime(now), duration:"", activity:"Sleeping", notes:"" });
  const sorted = [...seizures].sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));

  async function submit() {
    if (!form.duration) return;
    setSaving(true);
    await onAdd({...form, duration:parseDuration(form.duration)});
    setSaving(false);
    setShowForm(false);
    setForm({ date:fmtDate(new Date()), time:fmtTime(new Date()), duration:"", activity:"Sleeping", notes:"" });
    setToast(true);
    setTimeout(()=>setToast(false),3000);
  }

  return (
    <div style={{ padding:"0 0 80px" }}>
      {toast && <div style={{ position:"fixed",top:70,left:"50%",transform:"translateX(-50%)",background:C.teal,color:"#0F1623",borderRadius:12,padding:"12px 20px",fontWeight:700,fontSize:14,zIndex:200,boxShadow:"0 4px 20px rgba(0,0,0,.4)" }}>✓ Seizure logged</div>}
      <SeizureFreeTimer seizures={seizures} />
      <StatsBar seizures={seizures} />
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px 12px" }}>
        <div style={{ fontSize:18,fontWeight:800,color:C.text }}>Recent seizures</div>
        <button onClick={()=>setShowForm(true)} style={{ background:C.teal,border:"none",borderRadius:99,width:40,height:40,fontSize:22,cursor:"pointer",color:"#0F1623",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
      </div>
      {loading ? <Spinner /> : sorted.length===0
        ? <div style={{ textAlign:"center",color:C.muted,padding:"40px 20px" }}><div style={{ fontSize:40,marginBottom:12 }}>📋</div><div>No seizures recorded yet.</div></div>
        : <div style={{ padding:"0 16px" }}>
            {sorted.map(s=>(
              <div key={s.id} onClick={()=>setDetail(s)} style={{ background:C.card,borderRadius:14,padding:"14px 16px",marginBottom:10,cursor:"pointer",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:14 }}>
                <div style={{ background:C.redDim,borderRadius:10,padding:"8px 10px",minWidth:56,textAlign:"center" }}>
                  <div style={{ fontSize:11,color:C.red,fontWeight:700 }}>{fmtDateDisplay(s.date)}</div>
                  <div style={{ fontSize:13,color:C.red,fontWeight:800 }}>{s.time}</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700,color:C.text,fontSize:15 }}>{s.activity||"Unknown"}</div>
                  <div style={{ fontSize:13,color:C.muted,marginTop:2 }}>{s.duration}s duration</div>
                </div>
                <div style={{ color:C.border,fontSize:18 }}>›</div>
              </div>
            ))}
          </div>
      }
      {showForm && (
        <Modal title="Log Seizure" onClose={()=>setShowForm(false)}>
          <Field label="Date"><Input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} /></Field>
          <Field label="Time"><Input type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})} /></Field>
          <Field label="Duration (seconds) *"><Input type="number" placeholder="e.g. 45" value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})} /></Field>
          <Field label="Activity *"><Select value={form.activity} onChange={e=>setForm({...form,activity:e.target.value})} options={["Sleeping","Resting","Watching TV","Reading","Eating","Walking","Exercising","Working","Driving","Showering","Unknown"]} /></Field>
          <Field label="Notes (optional)"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={{...inputStyle,height:72,resize:"none",fontFamily:"inherit"}} placeholder="Triggers, postictal state, etc." /></Field>
          <Btn onClick={submit} disabled={saving}>{saving?"Saving…":"Save Seizure"}</Btn>
        </Modal>
      )}
      {detail && (
        <Modal title="Seizure Details" onClose={()=>setDetail(null)}>
          <div style={{ background:C.card,borderRadius:12,padding:16,marginBottom:16 }}>
            {[["Date",fmtDateDisplay(detail.date)],["Time",detail.time],["Duration",`${detail.duration} seconds`],["Activity",detail.activity||"Not recorded"],...(detail.notes?[["Notes",detail.notes]]:[])].map(([k,v])=>(
              <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}` }}>
                <span style={{ color:C.muted,fontSize:13 }}>{k}</span>
                <span style={{ color:C.text,fontSize:13,fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>
          <Btn variant="danger" onClick={()=>{ onDelete(detail.id); setDetail(null); }}>Delete Record</Btn>
        </Modal>
      )}
    </div>
  );
}

// ── CalendarView ──────────────────────────────────────────────────
function CalendarView({ seizures }) {
  const [cursor,setCursor] = useState(new Date());
  const [picked,setPicked] = useState(null);
  const year=cursor.getFullYear(), month=cursor.getMonth();
  const firstDay=new Date(year,month,1).getDay(), daysInMonth=new Date(year,month+1,0).getDate();
  const todayStr=fmtDate(new Date());
  const seizedDates = useMemo(()=>{ const m={}; seizures.forEach(s=>{ if(!m[s.date])m[s.date]=[]; m[s.date].push(s); }); return m; },[seizures]);
  const cells=[]; for(let i=0;i<firstDay;i++)cells.push(null); for(let i=1;i<=daysInMonth;i++)cells.push(i);
  return (
    <div style={{ padding:"0 0 80px" }}>
      <div style={{ padding:"20px 20px 12px" }}>
        <div style={{ fontSize:22,fontWeight:800,color:C.text }}>Calendar</div>
        <div style={{ fontSize:13,color:C.muted }}>{seizures.filter(s=>s.date.startsWith(`${year}-${PAD(month+1)}`)).length} seizures this month</div>
      </div>
      <div style={{ background:C.card,margin:"0 16px",borderRadius:16,padding:16 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
          <button onClick={()=>{ const d=new Date(cursor); d.setMonth(d.getMonth()-1); setCursor(d); setPicked(null); }} style={{ background:"none",border:"none",color:C.teal,fontSize:22,cursor:"pointer" }}>‹</button>
          <span style={{ fontWeight:700,color:C.text,fontSize:16 }}>{MONTHS[month]} {year}</span>
          <button onClick={()=>{ const d=new Date(cursor); d.setMonth(d.getMonth()+1); setCursor(d); setPicked(null); }} style={{ background:"none",border:"none",color:C.teal,fontSize:22,cursor:"pointer" }}>›</button>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4 }}>
          {DAYS.map(d=><div key={d} style={{ textAlign:"center",fontSize:11,fontWeight:700,color:C.muted,paddingBottom:6 }}>{d}</div>)}
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3 }}>
          {cells.map((day,i)=>{ if(!day)return <div key={`e${i}`}/>; const ds=`${year}-${PAD(month+1)}-${PAD(day)}`; const ev=seizedDates[ds]||[]; const isToday=ds===todayStr; const isPicked=picked===ds; return (
            <div key={ds} onClick={()=>setPicked(isPicked?null:ds)} style={{ borderRadius:8,padding:"6px 2px",textAlign:"center",cursor:"pointer",background:isPicked?C.tealDim:isToday?C.border:"transparent",border:isToday?`1px solid ${C.teal}`:"1px solid transparent" }}>
              <div style={{ fontSize:13,color:isPicked?C.teal:isToday?C.teal:C.text,fontWeight:isToday?700:400 }}>{day}</div>
              {ev.length>0&&<div style={{ display:"flex",justifyContent:"center",gap:2,marginTop:3 }}>{ev.slice(0,3).map((_,ii)=><div key={ii} style={{ width:5,height:5,borderRadius:99,background:C.red }}/>)}</div>}
            </div>
          );})}
        </div>
      </div>
      {picked&&seizedDates[picked]&&<div style={{ margin:"16px 16px 0" }}><div style={{ fontSize:13,color:C.muted,marginBottom:8,fontWeight:600 }}>{fmtDateDisplay(picked)} — {seizedDates[picked].length} seizure{seizedDates[picked].length>1?"s":""}</div>{seizedDates[picked].map(s=><div key={s.id} style={{ background:C.card,borderRadius:12,padding:"12px 14px",marginBottom:8,border:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between" }}><span style={{ color:C.text,fontWeight:600 }}>{s.activity||"Unknown"}</span><span style={{ color:C.muted,fontSize:13 }}>{s.time} · {s.duration}s</span></div>)}</div>}
      {picked&&!seizedDates[picked]&&<div style={{ textAlign:"center",color:C.muted,padding:"24px",fontSize:13 }}>No seizures on {fmtDateDisplay(picked)}</div>}
    </div>
  );
}

// ── TrendsView ────────────────────────────────────────────────────
function TrendsView({ seizures }) {
  const weeklyData = useMemo(()=>{ const w=[]; for(let i=11;i>=0;i--){ const s=new Date(); s.setDate(s.getDate()-i*7-6); const e=new Date(); e.setDate(e.getDate()-i*7); const count=seizures.filter(x=>x.date>=fmtDate(s)&&x.date<=fmtDate(e)).length; w.push({label:MON3[s.getMonth()],count}); } return w; },[seizures]);
  const maxWeek=Math.max(1,...weeklyData.map(w=>w.count));
  const timeOfDay=useMemo(()=>{ const b={Night:0,Morning:0,Afternoon:0,Evening:0}; seizures.forEach(s=>{ const h=parseInt(s.time.split(":")[0],10); if(h<6)b.Night++;else if(h<12)b.Morning++;else if(h<18)b.Afternoon++;else b.Evening++; }); return Object.entries(b); },[seizures]);
  const maxTod=Math.max(1,...timeOfDay.map(([,v])=>v));
  const activityData=useMemo(()=>{ const c={}; seizures.forEach(s=>{ const a=s.activity||"Unknown"; c[a]=(c[a]||0)+1; }); return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5); },[seizures]);
  const maxAct=Math.max(1,...activityData.map(([,v])=>v));
  const mom=useMemo(()=>{ const n=new Date(); const tm=`${n.getFullYear()}-${PAD(n.getMonth()+1)}`; const ld=new Date(n.getFullYear(),n.getMonth()-1,1); const lm=`${ld.getFullYear()}-${PAD(ld.getMonth()+1)}`; const tc=seizures.filter(s=>s.date.startsWith(tm)).length; const lc=seizures.filter(s=>s.date.startsWith(lm)).length; return {thisCount:tc,lastCount:lc,diff:tc-lc}; },[seizures]);
  const Section=({title,children})=>(<div style={{ margin:"0 16px 16px",background:C.card,borderRadius:16,padding:"14px 16px",border:`1px solid ${C.border}` }}><div style={{ fontSize:11,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:14 }}>{title}</div>{children}</div>);
  return (
    <div style={{ padding:"0 0 80px" }}>
      <div style={{ padding:"20px 20px 12px" }}><div style={{ fontSize:22,fontWeight:800,color:C.text }}>Trends</div><div style={{ fontSize:13,color:C.muted }}>{seizures.length} seizures total</div></div>
      {seizures.length===0?<div style={{ textAlign:"center",color:C.muted,padding:"60px 20px" }}><div style={{ fontSize:40,marginBottom:12 }}>📈</div><div>No data yet.</div></div>:<>
        <Section title="This month vs last month">
          <div style={{ display:"flex",gap:12 }}>{[["Last month",mom.lastCount,C.muted],["This month",mom.thisCount,mom.diff>0?C.red:mom.diff<0?C.teal:C.gold]].map(([l,v,c])=><div key={l} style={{ flex:1,background:C.surface,borderRadius:12,padding:12,textAlign:"center" }}><div style={{ fontSize:28,fontWeight:800,color:c }}>{v}</div><div style={{ fontSize:11,color:C.muted,marginTop:2 }}>{l}</div></div>)}</div>
          {mom.diff!==0&&<div style={{ marginTop:10,fontSize:13,color:mom.diff>0?C.red:C.teal,fontWeight:600,textAlign:"center" }}>{mom.diff>0?`▲ ${mom.diff} more than last month`:`▼ ${Math.abs(mom.diff)} fewer than last month`}</div>}
        </Section>
        <Section title="Weekly (last 12 weeks)">
          <div style={{ display:"flex",alignItems:"flex-end",gap:4,height:80 }}>{weeklyData.map((w,i)=>{ const h=Math.max(4,Math.round((w.count/maxWeek)*72)); return <div key={i} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>{w.count>0&&<div style={{ fontSize:9,color:C.muted }}>{w.count}</div>}<div style={{ width:"100%",height:h,background:i===weeklyData.length-1?C.red:C.border,borderRadius:4,minHeight:4 }}/></div>; })}</div>
          <div style={{ display:"flex",justifyContent:"space-between",marginTop:6 }}><span style={{ fontSize:9,color:C.muted }}>{weeklyData[0].label}</span><span style={{ fontSize:9,color:C.red,fontWeight:700 }}>Now</span></div>
        </Section>
        <Section title="Time of day">{timeOfDay.map(([l,c])=><div key={l} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}><div style={{ fontSize:12,color:C.muted,width:72,flexShrink:0 }}>{l}</div><div style={{ flex:1,background:C.surface,borderRadius:99,height:8,overflow:"hidden" }}><div style={{ height:"100%",width:`${(c/maxTod)*100}%`,background:C.gold,borderRadius:99 }}/></div><div style={{ fontSize:12,color:C.text,fontWeight:700,width:20,textAlign:"right" }}>{c}</div></div>)}</Section>
        {activityData.length>0&&<Section title="Activity at onset">{activityData.map(([l,c])=><div key={l} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}><div style={{ fontSize:12,color:C.muted,width:100,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{l}</div><div style={{ flex:1,background:C.surface,borderRadius:99,height:8,overflow:"hidden" }}><div style={{ height:"100%",width:`${(c/maxAct)*100}%`,background:C.teal,borderRadius:99 }}/></div><div style={{ fontSize:12,color:C.text,fontWeight:700,width:20,textAlign:"right" }}>{c}</div></div>)}</Section>}
        <Section title="Avg duration (seconds)">{(()=>{ const avg=seizures.length?Math.round(seizures.reduce((a,s)=>a+s.duration,0)/seizures.length):0; const max=Math.max(...seizures.map(s=>s.duration)); const min=Math.min(...seizures.map(s=>s.duration)); return <div style={{ display:"flex",gap:10 }}>{[["Min",min,C.teal],["Avg",avg,C.gold],["Max",max,C.red]].map(([l,v,c])=><div key={l} style={{ flex:1,background:C.surface,borderRadius:12,padding:10,textAlign:"center" }}><div style={{ fontSize:22,fontWeight:800,color:c }}>{v}s</div><div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{l}</div></div>)}</div>; })()}</Section>
      </>}
    </div>
  );
}

// ── MedView ───────────────────────────────────────────────────────
function MedView({ meds, onAdd, onArchive, onRestore, onChangeDose, onUpdatePhoto, onEdit, loading }) {
  const [showForm,setShowForm]=useState(false);
  const [historyMed,setHistoryMed]=useState(null);
  const [changeDoseMed,setChangeDoseMed]=useState(null);
  const [editMed,setEditMed]=useState(null);
  const [confirmArchive,setConfirmArchive]=useState(null);
  const [showArchived,setShowArchived]=useState(false);
  const [newDose,setNewDose]=useState("");
  const [form,setForm]=useState({name:"",dose:"",schedule:"AM",photo:null});
  const [editForm,setEditForm]=useState({name:"",dose:"",schedule:"AM"});
  const [saving,setSaving]=useState(false);
  const active=meds.filter(m=>!m.archived), archived=meds.filter(m=>m.archived);
  const SCHEDULES=["AM","PM","AM & PM","With meals","As needed"];
  const parseMg=str=>parseFloat(str)||0;
  function doseTag(prev,curr){ const p=parseMg(prev),c=parseMg(curr); if(c>p)return{label:"↑ Increased",color:C.red}; if(c<p)return{label:"↓ Decreased",color:C.teal}; return{label:"~ Changed",color:C.gold}; }

  async function submit(){ if(!form.name||!form.dose)return; setSaving(true); await onAdd({...form}); setSaving(false); setShowForm(false); setForm({name:"",dose:"",schedule:"AM",photo:null}); }
  async function submitEdit(){ if(!editForm.name||!editForm.dose)return; setSaving(true); await onEdit(editMed.id,editForm); setSaving(false); setEditMed(null); }
  async function submitDoseChange(){ if(!newDose.trim())return; setSaving(true); await onChangeDose(changeDoseMed.id,newDose.trim()); setSaving(false); setChangeDoseMed(null); setNewDose(""); }
  function handlePhoto(e,medId){ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>onUpdatePhoto(medId,ev.target.result); r.readAsDataURL(f); }
  function handleFormPhoto(e){ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>setForm(x=>({...x,photo:ev.target.result})); r.readAsDataURL(f); }

  const palette=[C.teal,C.gold,"#A78BFA","#FB923C","#34D399","#F472B6"];
  const medColors={}; let ci=0; meds.forEach(m=>{ if(!medColors[m.name])medColors[m.name]=palette[ci++%palette.length]; });

  function MedCard({m,isArchived}){
    const dh = Array.isArray(m.dose_history) ? m.dose_history : (typeof m.dose_history==="string"?JSON.parse(m.dose_history||"[]"):[]);
    return (
      <div style={{ background:C.card,borderRadius:14,padding:"14px 16px",marginBottom:10,border:`1px solid ${isArchived?C.border+"88":C.border}`,display:"flex",gap:12,alignItems:"flex-start",opacity:isArchived?0.7:1 }}>
        <div style={{ position:"relative",width:56,height:56,flexShrink:0 }}>
          {m.photo?<img src={m.photo} alt={m.name} style={{ width:56,height:56,borderRadius:10,objectFit:"cover",border:`1px solid ${C.border}`,display:"block" }}/>:<div style={{ width:56,height:56,borderRadius:10,background:C.surface,border:`1px dashed ${C.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2 }}><span style={{ fontSize:18 }}>📷</span><span style={{ fontSize:9,color:C.muted }}>Add</span></div>}
          {!isArchived&&<input type="file" accept="image/*" onChange={e=>handlePhoto(e,m.id)} style={{ position:"absolute",inset:0,width:"100%",height:"100%",opacity:0,cursor:"pointer",fontSize:0 }}/>}
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:"flex",alignItems:"flex-start" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700,color:isArchived?C.muted:C.text,fontSize:15 }}>{m.name}</div>
              <div style={{ fontSize:13,color:C.muted,marginTop:2 }}>{isArchived?<span style={{ fontStyle:"italic" }}>Stopped {m.archived_date?fmtDateDisplay(m.archived_date):""}</span>:`${m.dose} · ${m.schedule}`}</div>
            </div>
            {isArchived?<button onClick={()=>onRestore(m.id)} style={{ background:"none",border:`1px solid ${C.teal}`,color:C.teal,cursor:"pointer",fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:8 }}>Restore</button>
              :<button onClick={()=>setConfirmArchive(m)} style={{ background:"none",border:"none",color:C.border,cursor:"pointer",fontSize:18,padding:"0 0 0 4px" }}>×</button>}
          </div>
          <div style={{ display:"flex",gap:6,marginTop:10 }}>
            {!isArchived&&<button onClick={()=>{ setEditMed(m); setEditForm({name:m.name,dose:m.dose,schedule:m.schedule}); }} style={{ flex:1,background:C.border,border:"none",borderRadius:8,color:C.text,fontSize:11,fontWeight:600,padding:"6px 0",cursor:"pointer" }}>Edit</button>}
            {!isArchived&&<button onClick={()=>{ setChangeDoseMed(m); setNewDose(m.dose); }} style={{ flex:1,background:C.border,border:"none",borderRadius:8,color:C.text,fontSize:11,fontWeight:600,padding:"6px 0",cursor:"pointer" }}>Change dose</button>}
            <button onClick={()=>setHistoryMed({...m,dose_history:dh})} style={{ flex:1,background:C.border,border:"none",borderRadius:8,color:C.text,fontSize:11,fontWeight:600,padding:"6px 0",cursor:"pointer" }}>History</button>
          </div>
        </div>
      </div>
    );
  }

  // Combined timeline
  const timelineEvents = useMemo(()=>{
    const events=[];
    meds.forEach(m=>{
      const dh=Array.isArray(m.dose_history)?m.dose_history:(typeof m.dose_history==="string"?JSON.parse(m.dose_history||"[]"):[]);
      dh.forEach((entry,i)=>{ const prev=dh[i-1]; let change=null; if(prev){ const p=parseMg(prev.dose),c=parseMg(entry.dose); change=c>p?{label:"↑ Increased",color:C.red}:c<p?{label:"↓ Decreased",color:C.teal}:{label:"~ Changed",color:C.gold}; } events.push({medName:m.name,dose:entry.dose,date:entry.date,change}); });
      if(m.archived&&m.archived_date) events.push({medName:m.name,dose:null,date:m.archived_date,change:{label:"⊘ Stopped",color:C.muted}});
    });
    return events.sort((a,b)=>b.date.localeCompare(a.date));
  },[meds]);

  return (
    <div style={{ padding:"0 0 80px" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 20px 12px" }}>
        <div><div style={{ fontSize:22,fontWeight:800,color:C.text }}>Medications</div><div style={{ fontSize:13,color:C.muted }}>{active.length} active · {archived.length} past</div></div>
        <button onClick={()=>setShowForm(true)} style={{ background:C.teal,border:"none",borderRadius:99,width:44,height:44,fontSize:24,cursor:"pointer",color:"#0F1623",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
      </div>
      <div style={{ padding:"0 16px" }}>
        {loading?<Spinner/>:active.length===0&&<div style={{ textAlign:"center",color:C.muted,padding:"40px 0" }}><div style={{ fontSize:36,marginBottom:10 }}>💊</div><div>No active medications.</div></div>}
        {active.map(m=><MedCard key={m.id} m={m} isArchived={false}/>)}
        {archived.length>0&&<>
          <button onClick={()=>setShowArchived(s=>!s)} style={{ width:"100%",background:"none",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontSize:13,fontWeight:600,padding:"10px",cursor:"pointer",marginBottom:10 }}>{showArchived?"▲":"▼"} Past medications ({archived.length})</button>
          {showArchived&&archived.map(m=><MedCard key={m.id} m={m} isArchived={true}/>)}
        </>}
        {timelineEvents.length>0&&<>
          <div style={{ fontSize:11,color:C.muted,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",margin:"16px 0 12px" }}>Medication timeline</div>
          <div style={{ position:"relative" }}>
            <div style={{ position:"absolute",left:7,top:0,bottom:0,width:2,background:C.border,borderRadius:99 }}/>
            {timelineEvents.map((e,i)=>(
              <div key={i} style={{ display:"flex",gap:14,marginBottom:14,position:"relative" }}>
                <div style={{ width:16,height:16,borderRadius:99,background:medColors[e.medName]||C.teal,flexShrink:0,marginTop:2,zIndex:1,border:`2px solid ${C.card}` }}/>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                    <div><div style={{ fontWeight:700,color:C.text,fontSize:13 }}>{e.medName}</div>{e.dose&&<div style={{ fontSize:12,color:C.muted,marginTop:1 }}>{e.dose}</div>}</div>
                    <div style={{ textAlign:"right" }}>{e.change&&<div style={{ fontSize:11,fontWeight:700,color:e.change.color,background:e.change.color+"22",borderRadius:99,padding:"2px 8px",marginBottom:3 }}>{e.change.label}</div>}<div style={{ fontSize:11,color:C.muted }}>{fmtDateDisplay(e.date)}</div></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>}
      </div>

      {showForm&&<Modal title="Add Medication" onClose={()=>setShowForm(false)}>
        <Field label="Photo (optional)"><div style={{ display:"flex",alignItems:"center",gap:12 }}>{form.photo&&<img src={form.photo} alt="preview" style={{ width:64,height:64,borderRadius:10,objectFit:"cover",border:`1px solid ${C.border}`,flexShrink:0 }}/>}<div style={{ position:"relative",display:"inline-block" }}><div style={{ background:C.card,border:`1px dashed ${C.border}`,borderRadius:10,color:C.muted,fontSize:13,fontWeight:600,padding:"10px 16px",pointerEvents:"none" }}>{form.photo?"📷  Change photo":"📷  Upload photo"}</div><input type="file" accept="image/*" onChange={handleFormPhoto} style={{ position:"absolute",inset:0,width:"100%",height:"100%",opacity:0,cursor:"pointer",fontSize:0 }}/></div></div></Field>
        <Field label="Medication Name *"><Input placeholder="e.g. Levetiracetam" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
        <Field label="Dose *"><Input placeholder="e.g. 500mg" value={form.dose} onChange={e=>setForm({...form,dose:e.target.value})}/></Field>
        <Field label="Schedule"><Select value={form.schedule} onChange={e=>setForm({...form,schedule:e.target.value})} options={SCHEDULES}/></Field>
        <Btn onClick={submit} disabled={saving}>{saving?"Saving…":"Add Medication"}</Btn>
      </Modal>}
      {confirmArchive&&<Modal title="Stop medication?" onClose={()=>setConfirmArchive(null)}>
        <div style={{ background:C.card,borderRadius:10,padding:"12px 14px",marginBottom:20,fontSize:14,color:C.muted }}>Mark <span style={{ color:C.text,fontWeight:700 }}>{confirmArchive.name}</span> as stopped? It will be kept in Past medications with its full history.</div>
        <div style={{ display:"flex",gap:10 }}><Btn variant="ghost" onClick={()=>setConfirmArchive(null)}>Cancel</Btn><Btn variant="danger" onClick={()=>{ onArchive(confirmArchive.id); setConfirmArchive(null); }}>Stop medication</Btn></div>
      </Modal>}
      {editMed&&<Modal title={`Edit — ${editMed.name}`} onClose={()=>setEditMed(null)}>
        <Field label="Medication Name *"><Input value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})}/></Field>
        <Field label="Dose *"><Input value={editForm.dose} onChange={e=>setEditForm({...editForm,dose:e.target.value})}/></Field>
        <Field label="Schedule"><Select value={editForm.schedule} onChange={e=>setEditForm({...editForm,schedule:e.target.value})} options={SCHEDULES}/></Field>
        <Btn onClick={submitEdit} disabled={saving}>{saving?"Saving…":"Save Changes"}</Btn>
      </Modal>}
      {changeDoseMed&&<Modal title={`Change dose — ${changeDoseMed.name}`} onClose={()=>setChangeDoseMed(null)}>
        <div style={{ background:C.card,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:C.muted }}>Current dose: <span style={{ color:C.text,fontWeight:700 }}>{changeDoseMed.dose}</span></div>
        <Field label="New Dose *"><Input placeholder="e.g. 750mg" value={newDose} onChange={e=>setNewDose(e.target.value)}/></Field>
        <Btn onClick={submitDoseChange} disabled={saving}>{saving?"Saving…":"Save Change"}</Btn>
      </Modal>}
      {historyMed&&<Modal title={`Dose history — ${historyMed.name}`} onClose={()=>setHistoryMed(null)}>
        {(!historyMed.dose_history||historyMed.dose_history.length===0)?<div style={{ textAlign:"center",color:C.muted,padding:"24px 0" }}>No history yet.</div>
          :historyMed.dose_history.map((entry,i)=>{ const prev=historyMed.dose_history[i-1]; const tag=prev?doseTag(prev.dose,entry.dose):null; return (
            <div key={i} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}` }}>
              <div><div style={{ fontWeight:700,color:C.text,fontSize:15 }}>{entry.dose}</div><div style={{ fontSize:12,color:C.muted,marginTop:2 }}>{fmtDateDisplay(entry.date)}</div></div>
              {tag&&<span style={{ fontSize:11,fontWeight:700,color:tag.color,background:tag.color+"22",borderRadius:99,padding:"3px 10px" }}>{tag.label}</span>}
            </div>
          );})}
      </Modal>}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const [session,setSession] = useState(null);
  const [tab,setTab] = useState("log");
  const [seizures,setSeizures] = useState([]);
  const [meds,setMeds] = useState([]);
  const [loadingSeizures,setLoadingSeizures] = useState(false);
  const [loadingMeds,setLoadingMeds] = useState(false);

  const token = session?.access_token;
  const userId = session?.user?.id;

  // Load data on login
  useEffect(()=>{
    if(!token) return;
    setLoadingSeizures(true);
    db.getSeizures(token).then(data=>{ setSeizures(data||[]); setLoadingSeizures(false); });
    setLoadingMeds(true);
    db.getMeds(token).then(data=>{ setMeds((data||[]).map(m=>({...m,dose_history:typeof m.dose_history==="string"?JSON.parse(m.dose_history||"[]"):m.dose_history||[]}))); setLoadingMeds(false); });
  },[token]);

  async function addSeizure(data) {
    const rows = await db.addSeizure(token, userId, data);
    if(rows?.[0]) setSeizures(p=>[rows[0],...p]);
  }
  async function deleteSeizure(id) {
    await db.deleteSeizure(token, id);
    setSeizures(p=>p.filter(s=>s.id!==id));
  }
  async function addMed(data) {
    const rows = await db.addMed(token, userId, data);
    if(rows?.[0]) setMeds(p=>[...p,{...rows[0],dose_history:JSON.parse(rows[0].dose_history||"[]")}]);
  }
  async function archiveMed(id) {
    const patch = {archived:true, archived_date:fmtDate(new Date())};
    await db.updateMed(token, id, patch);
    setMeds(p=>p.map(m=>m.id===id?{...m,...patch}:m));
  }
  async function restoreMed(id) {
    const patch = {archived:false, archived_date:null};
    await db.updateMed(token, id, patch);
    setMeds(p=>p.map(m=>m.id===id?{...m,...patch}:m));
  }
  async function changeDose(id, newDose) {
    const med = meds.find(m=>m.id===id);
    const dh = [...(med.dose_history||[]), {dose:newDose, date:fmtDate(new Date())}];
    await db.updateMed(token, id, {dose:newDose, dose_history:JSON.stringify(dh)});
    setMeds(p=>p.map(m=>m.id===id?{...m,dose:newDose,dose_history:dh}:m));
  }
  async function updateMedPhoto(id, url) {
    await db.updateMed(token, id, {photo:url});
    setMeds(p=>p.map(m=>m.id===id?{...m,photo:url}:m));
  }
  async function updateMed(id, data) {
    await db.updateMed(token, id, data);
    setMeds(p=>p.map(m=>m.id===id?{...m,...data}:m));
  }
  async function handleSignOut() {
    await signOut(token).catch(()=>{});
    setSession(null); setSeizures([]); setMeds([]);
  }

  if(!session) return <LoginScreen onLogin={setSession} />;

  const tabs=[{id:"log",icon:"📋",label:"Log"},{id:"calendar",icon:"📅",label:"Calendar"},{id:"trends",icon:"📈",label:"Trends"},{id:"meds",icon:"💊",label:"Meds"}];

  return (
    <div style={{ background:C.bg,minHeight:"100vh",maxWidth:420,margin:"0 auto",fontFamily:"'Inter',system-ui,sans-serif",color:C.text }}>
      <div style={{ background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"14px 20px 10px",display:"flex",alignItems:"center",gap:8 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        <span style={{ fontSize:14,fontWeight:700,color:C.text }}>Seizure Tracker</span>
        <button onClick={handleSignOut} style={{ marginLeft:"auto",background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer" }}>Sign out</button>
      </div>
      <div style={{ overflowY:"auto",height:"calc(100vh - 130px)" }}>
        {tab==="log"&&<LogView seizures={seizures} onAdd={addSeizure} onDelete={deleteSeizure} loading={loadingSeizures}/>}
        {tab==="calendar"&&<CalendarView seizures={seizures}/>}
        {tab==="trends"&&<TrendsView seizures={seizures}/>}
        {tab==="meds"&&<MedView meds={meds} onAdd={addMed} onArchive={archiveMed} onRestore={restoreMed} onChangeDose={changeDose} onUpdatePhoto={updateMedPhoto} onEdit={updateMed} loading={loadingMeds}/>}
      </div>
      <div style={{ position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:420,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",padding:"10px 0 16px" }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,opacity:tab===t.id?1:0.45 }}>
            <span style={{ fontSize:22 }}>{t.icon}</span>
            <span style={{ fontSize:11,fontWeight:700,color:tab===t.id?C.teal:C.muted }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
