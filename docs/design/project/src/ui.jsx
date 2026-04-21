// Shared UI primitives — thin cosmetic recreations of @zstack/design components.
// Not production; enough for hi-fi mocks.

const { useState } = React;

const cn = (...xs) => xs.filter(Boolean).join(" ");

// ---------- Button ----------
function Button({ variant="primary", size="default", icon, loading, disabled, children, onClick, style }) {
  const variants = {
    primary:  { bg:"#005bd4", color:"#fff", hoverBg:"#0043b1", border:"0" },
    subtle:   { bg:"transparent", color:"#494b4e", hoverBg:"#ebedf0", border:"0" },
    outline:  { bg:"transparent", color:"#494b4e", hoverBg:"transparent", border:"1px dashed #c7c9cc" },
    danger:   { bg:"#db2e43", color:"#fff", hoverBg:"#b71f40", border:"0" },
    ghost:    { bg:"transparent", color:"#6f7174", hoverBg:"#f5f7fa", border:"0" },
    link:     { bg:"transparent", color:"#005bd4", hoverBg:"transparent", border:"0" },
  };
  const sizes = {
    default: { h:32, px:12, fs:14 },
    sm:      { h:28, px:8,  fs:12 },
    lg:      { h:40, px:16, fs:16 },
    icon:    { h:32, px:0,  w:32, fs:14 },
  };
  const v = variants[variant]; const s = sizes[size];
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  return (
    <button
      disabled={disabled || loading}
      onClick={onClick}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>{setHover(false);setActive(false)}}
      onMouseDown={()=>setActive(true)} onMouseUp={()=>setActive(false)}
      style={{
        height:s.h, padding:variant==="link"?0:`0 ${s.px}px`, width:s.w,
        background:hover?v.hoverBg:v.bg, color:v.color, border:v.border,
        borderRadius:2, font:`${variant==="primary"||variant==="danger"?500:400} ${s.fs}px/1 inherit`,
        cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1,
        display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
        transform:active&&variant!=="link"?"scale(0.97)":"none",
        transition:"all 150ms ease-out", whiteSpace:"nowrap",
        ...style,
      }}>
      {icon && <span style={{display:"inline-flex"}}>{icon}</span>}
      {children}
    </button>
  );
}

// ---------- Input ----------
function Input({ value, onChange, placeholder, invalid, disabled, style, icon }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{position:"relative", display:"inline-block", width:style?.width||"100%"}}>
      {icon && <span style={{position:"absolute",left:8,top:8,color:"#9b9da0"}}>{icon}</span>}
      <input value={value||""} onChange={e=>onChange&&onChange(e.target.value)} placeholder={placeholder}
        disabled={disabled} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
        style={{
          width:"100%", height:32, padding:icon?"0 12px 0 28px":"0 12px", boxSizing:"border-box",
          background:disabled?"#f5f7fa":"#fff",
          border:`1px solid ${invalid?"#f4454c":focus?"#005bd4":"#c7c9cc"}`,
          borderRadius:2, font:"14px inherit", color:disabled?"#9b9da0":"#494b4e",
          outline:"none",
          boxShadow:focus?`0 0 0 2px ${invalid?"#fff2ea":"#ecf5ff"}`:"none",
          ...style, width:"100%",
        }}/>
    </div>
  );
}

// ---------- State (icon+name) ----------
function State({ type="success", name }) {
  const map = {
    success:  { color:"#5aca49" },
    running:  { color:"#5aca49" },
    error:    { color:"#f4454c" },
    stopped:  { color:"#6f7174" },
    warning:  { color:"#ff9000" },
    paused:   { color:"#ff9000" },
    progress: { color:"#0076f7" },
    queue:    { color:"#9a45e4" },
    disabled: { color:"#9b9da0" },
  };
  const c = map[type] || map.success;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:6,color:"#494b4e"}}>
      <span style={{width:8,height:8,background:c.color,borderRadius:9999}}/>
      {name}
    </span>
  );
}

// ---------- StatusBadge ----------
function StatusBadge({ status="neutral", children }) {
  const map = {
    pending:"#9a45e4", inprogress:"#0076f7", positive:"#5aca49",
    danger:"#f4454c", alert:"#ff9000", neutral:"#6f7174",
  };
  return <span style={{background:map[status],color:"#fff",padding:"2px 8px",borderRadius:2,font:"500 12px inherit",display:"inline-block"}}>{children}</span>;
}

// ---------- Tag ----------
function Tag({ theme="blue", level="base", children }) {
  const pal = {
    blue:{bg:"#ceefff",fg:"#005bd4",strong:"#0076f7"},
    green:{bg:"#dffcc6",fg:"#3faf38",strong:"#5aca49"},
    red:{bg:"#ffe4d8",fg:"#db2e43",strong:"#f4454c"},
    yellow:{bg:"#fff1cc",fg:"#db7200",strong:"#ff9000"},
    purple:{bg:"#f4dafd",fg:"#7a35c3",strong:"#9a45e4"},
    teal:{bg:"#cdfcd9",fg:"#01a575",strong:"#00c782"},
    violet:{bg:"#e0dcff",fg:"#554fe0",strong:"#6a63ff"},
    lime:{bg:"#f3fcb0",fg:"#7e9800",strong:"#a9c608"},
  }[theme];
  if (level==="strong") return <span style={{background:pal.strong,color:"#fff",padding:"2px 8px",borderRadius:2,font:"14px inherit",display:"inline-block"}}>{children}</span>;
  return <span style={{background:pal.bg,color:pal.fg,padding:"2px 8px",borderRadius:2,font:"14px inherit",display:"inline-block"}}>{children}</span>;
}

// ---------- Card ----------
function Card({ title, extra, children, style }) {
  return (
    <div style={{background:"#fff",border:"1px solid #dbdde0",borderRadius:2,boxShadow:"0 1px 2px 0 rgba(0,0,0,0.05)",overflow:"hidden",...style}}>
      {title && (
        <div style={{height:48,padding:"0 16px",borderBottom:"1px solid #ebedf0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:16,fontWeight:600,color:"#191b1e"}}>{title}</div>
          {extra}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

// ---------- Tabs ----------
function Tabs({ items, value, onChange }) {
  return (
    <div style={{display:"flex",gap:20,borderBottom:"1px solid #dbdde0"}}>
      {items.map(it => (
        <div key={it.value} onClick={()=>onChange(it.value)}
          style={{padding:"8px 0",cursor:"pointer",fontSize:14,
            color:value===it.value?"#005bd4":"#6f7174",
            fontWeight:value===it.value?500:400,
            borderBottom:`2px solid ${value===it.value?"#005bd4":"transparent"}`,
            marginBottom:-1}}>{it.label}</div>
      ))}
    </div>
  );
}

// ---------- Field ----------
function Field({ label, children, width=140 }) {
  return (
    <>
      <div style={{color:"#9b9da0",font:"14px inherit",padding:"6px 0",width}}>{label}</div>
      <div style={{color:"#494b4e",font:"14px inherit",padding:"6px 0"}}>{children || <span style={{color:"#c7c9cc"}}>-</span>}</div>
    </>
  );
}

Object.assign(window, { Button, Input, State, StatusBadge, Tag, Card, Tabs, Field, cn });
