// Modern App shell — sidebar + topbar + command palette + tweaks
const { useState: usS, useEffect: usE, useMemo: usM, useRef: usR } = React;

const TWEAKS_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#6366f1",
  "density": "cozy",
  "nav": "sidebar",
  "style": "modern"
}/*EDITMODE-END*/;

const ACCENT_CHOICES = [
  { id:"indigo", color:"#6366f1" },
  { id:"violet", color:"#8b5cf6" },
  { id:"rose",   color:"#f43f5e" },
  { id:"emerald",color:"#10b981" },
  { id:"amber",  color:"#f59e0b" },
];

function applyTweaks(t){
  const r = document.documentElement;
  r.style.setProperty("--accent", t.accent);
  // auto-derive hover
  const hover = {"#6366f1":"#4f46e5","#8b5cf6":"#7c3aed","#f43f5e":"#e11d48","#10b981":"#059669","#f59e0b":"#d97706"}[t.accent] || t.accent;
  r.style.setProperty("--accent-hover", hover);
  document.body.dataset.density = t.density;
  document.body.dataset.nav = t.nav;
  document.body.dataset.style = t.style;
  if (t.density==="compact") {
    r.style.setProperty("--radius","6px");
    document.body.style.fontSize="12.5px";
  } else {
    r.style.setProperty("--radius","8px");
    document.body.style.fontSize="13.5px";
  }
}

function App() {
  const [screen, setScreen] = useLocalState("hive.screen", "story");
  const [storyId, setStoryId] = useLocalState("hive.story", "HIV-142");
  const [tweaks, setTweaks] = useLocalState("hive.tweaks", TWEAKS_DEFAULTS);
  const [tweaksOpen, setTweaksOpen] = usS(false);
  const [cmd, setCmd] = usS(false);
  const [cmdQ, setCmdQ] = usS("");

  usE(()=>applyTweaks(tweaks), [tweaks]);

  // Edit mode wiring
  usE(()=>{
    function onMsg(e){
      if (e.data?.type==="__activate_edit_mode") setTweaksOpen(true);
      if (e.data?.type==="__deactivate_edit_mode") setTweaksOpen(false);
    }
    window.addEventListener("message", onMsg);
    window.parent.postMessage({type:"__edit_mode_available"}, "*");
    return ()=>window.removeEventListener("message", onMsg);
  }, []);

  // Keyboard
  usE(()=>{
    function onKey(e){
      if ((e.metaKey||e.ctrlKey) && e.key==="k") { e.preventDefault(); setCmd(c=>!c); }
      if (e.key==="Escape") setCmd(false);
    }
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  }, []);

  function updateTweak(key,val){
    const next = { ...tweaks, [key]:val };
    setTweaks(next);
    window.parent.postMessage({type:"__edit_mode_set_keys", edits:{[key]:val}}, "*");
  }

  const selectStory = (id)=>{ setStoryId(id); setScreen("story"); };

  const nav = tweaks.nav;

  return (
    <div style={{display:"flex",flexDirection: nav==="topbar"?"column":"row",height:"100%",background:"var(--bg)"}}>
      {nav==="sidebar" ? <Sidebar screen={screen} setScreen={setScreen} onOpenCmd={()=>setCmd(true)}/> : <Topbar screen={screen} setScreen={setScreen} onOpenCmd={()=>setCmd(true)}/>}
      <main style={{flex:1,minWidth:0,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <TopMeta screen={screen} storyId={storyId}/>
        <div style={{flex:1,minHeight:0,overflow:"hidden"}}>
          {screen==="story" && <CurrentStoryScreen storyId={storyId} onSelectStory={selectStory}/>}
          {screen==="board" && <BoardScreen onSelectStory={selectStory}/>}
          {screen==="backlog" && <BacklogScreen onSelectStory={selectStory}/>}
          {screen==="stream" && <TeamStreamScreen/>}
          {screen==="members" && <MembersScreen/>}
          {screen==="compute" && <ComputeScreen/>}
          {screen==="overview" && <OverviewScreen/>}
          {screen==="connect" && <ConnectScreen/>}
        </div>
      </main>

      {tweaksOpen && <TweaksPanel tweaks={tweaks} update={updateTweak} onClose={()=>setTweaksOpen(false)}/>}
      {cmd && <CommandPalette query={cmdQ} setQuery={setCmdQ} onClose={()=>{setCmd(false);setCmdQ("");}} onSelectStory={selectStory} onSelectScreen={(id)=>{setScreen(id);setCmd(false);}}/>}
    </div>
  );
}

// === Sidebar ===
const NAV_ITEMS = [
  { id:"story",    label:"Current story", icon:"sparkle" },
  { id:"board",    label:"Board",         icon:"columns" },
  { id:"backlog",  label:"Backlog",       icon:"inbox",  badgeKey:"unclaimed" },
  { id:"stream",   label:"Team stream",   icon:"terminal", live:true },
  { id:"members",  label:"Members",       icon:"users" },
  { id:"compute",  label:"Compute",       icon:"cpu" },
  { id:"overview", label:"Overview",      icon:"chart" },
  { id:"connect",  label:"Connect",       icon:"plug" },
];

function Sidebar({ screen, setScreen, onOpenCmd }) {
  const unclaimed = STORIES.filter(s=>s.status==="todo" && !s.assignee).length;
  return (
    <aside style={{width:232,flexShrink:0,background:"var(--surface)",borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",padding:"14px 0"}}>
      {/* Workspace */}
      <div style={{padding:"0 14px 12px"}}>
        <button style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"transparent",border:"1px solid transparent",borderRadius:"var(--radius-sm)",cursor:"pointer",textAlign:"left"}}>
          <div style={{width:26,height:26,borderRadius:7,background:"linear-gradient(135deg,var(--accent),#8b5cf6)",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="#fff"><path d="M7 1 2 4v6l5 3 5-3V4L7 1Zm0 2 3 1.8v3.4L7 10 4 8.2V4.8L7 3Z"/></svg>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{font:"600 13px/1.2 var(--font)"}}>Acme Cloud</div>
            <div style={{font:"400 11px/1 var(--font)",color:"var(--fg-3)",marginTop:2}}>Sprint 24</div>
          </div>
          <Icon name="chevronD" size={13} color="var(--fg-3)"/>
        </button>
      </div>

      {/* Search / Cmd-K */}
      <div style={{padding:"0 14px 10px"}}>
        <button onClick={onOpenCmd} style={{width:"100%",padding:"7px 10px",background:"var(--bg-2)",border:"1px solid transparent",borderRadius:"var(--radius-sm)",cursor:"pointer",display:"flex",alignItems:"center",gap:8,color:"var(--fg-3)",font:"400 12.5px/1 var(--font)"}}>
          <Icon name="search" size={13}/>
          <span style={{flex:1,textAlign:"left"}}>Search or jump…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      {/* Nav */}
      <nav style={{flex:1,padding:"4px 8px",display:"flex",flexDirection:"column",gap:1,overflow:"auto"}}>
        {NAV_ITEMS.map(item=>{
          const active = screen===item.id;
          return (
            <button key={item.id} onClick={()=>setScreen(item.id)} style={{
              padding:"7px 10px",background: active?"var(--bg-2)":"transparent",
              border:"none",borderRadius:"var(--radius-sm)",cursor:"pointer",
              display:"flex",alignItems:"center",gap:10,color: active?"var(--fg)":"var(--fg-2)",
              font:`${active?"500":"400"} 13px/1 var(--font)`,textAlign:"left",
              transition:"background 100ms",
            }}>
              <Icon name={item.icon} size={15} color={active?"var(--accent)":"var(--fg-3)"}/>
              <span style={{flex:1}}>{item.label}</span>
              {item.live && <LiveDot size={6}/>}
              {item.badgeKey==="unclaimed" && unclaimed>0 && <span style={{padding:"1px 6px",background:"var(--bg-2)",borderRadius:10,font:"500 10.5px/1.5 var(--mono)",color:"var(--fg-3)"}}>{unclaimed}</span>}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{padding:"10px 14px",borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
        <Avatar user={TEAM[0]} size={28} dot/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{font:"500 12.5px/1.2 var(--font)"}}>{TEAM[0].name}</div>
          <div style={{font:"400 11px/1 var(--font)",color:"var(--fg-3)",marginTop:2,display:"inline-flex",alignItems:"center",gap:4}}>
            <LiveDot size={5}/>Online · mbp-m3-max
          </div>
        </div>
        <button style={{width:26,height:26,borderRadius:5,border:"none",background:"transparent",color:"var(--fg-3)",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}><Icon name="settings" size={14}/></button>
      </div>
    </aside>
  );
}

// === Topbar variant ===
function Topbar({ screen, setScreen, onOpenCmd }) {
  return (
    <header style={{height:52,flexShrink:0,background:"var(--surface)",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",padding:"0 16px",gap:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:26,height:26,borderRadius:7,background:"linear-gradient(135deg,var(--accent),#8b5cf6)",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="#fff"><path d="M7 1 2 4v6l5 3 5-3V4L7 1Zm0 2 3 1.8v3.4L7 10 4 8.2V4.8L7 3Z"/></svg>
        </div>
        <span style={{font:"600 14px/1 var(--font)"}}>Hive</span>
        <span style={{color:"var(--fg-4)"}}>/</span>
        <span style={{font:"500 13px/1 var(--font)",color:"var(--fg-2)"}}>Acme Cloud</span>
      </div>
      <nav style={{display:"flex",gap:2,flex:1,overflow:"auto"}}>
        {NAV_ITEMS.map(item=>{
          const active = screen===item.id;
          return (
            <button key={item.id} onClick={()=>setScreen(item.id)} style={{
              padding:"7px 12px",background: active?"var(--bg-2)":"transparent",
              border:"none",borderRadius:"var(--radius-sm)",cursor:"pointer",
              display:"inline-flex",alignItems:"center",gap:7,color: active?"var(--fg)":"var(--fg-2)",
              font:`${active?"500":"400"} 12.5px/1 var(--font)`,whiteSpace:"nowrap",
            }}>
              <Icon name={item.icon} size={14} color={active?"var(--accent)":"var(--fg-3)"}/>
              {item.label}
              {item.live && <LiveDot size={5}/>}
            </button>
          );
        })}
      </nav>
      <button onClick={onOpenCmd} style={{padding:"7px 10px",background:"var(--bg-2)",border:"1px solid transparent",borderRadius:"var(--radius-sm)",cursor:"pointer",display:"flex",alignItems:"center",gap:8,color:"var(--fg-3)",font:"400 12px/1 var(--font)"}}>
        <Icon name="search" size={13}/> <span>Search</span> <Kbd>⌘K</Kbd>
      </button>
      <Avatar user={TEAM[0]} size={26} dot/>
    </header>
  );
}

// === Top meta bar per screen ===
function TopMeta({ screen, storyId }) {
  const crumbs = {
    story:    ["Stories", "HIV-142"],
    board:    ["Board"],
    backlog:  ["Backlog"],
    stream:   ["Team stream"],
    members:  ["Members"],
    compute:  ["Compute"],
    overview: ["Overview"],
    connect:  ["Connect machine"],
  }[screen] || [];
  return (
    <div style={{height:38,flexShrink:0,borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",padding:"0 24px",gap:10,background:"var(--surface)"}}>
      <div style={{display:"flex",alignItems:"center",gap:7,flex:1,minWidth:0,overflow:"hidden"}}>
        {crumbs.map((c,i)=>(
          <React.Fragment key={i}>
            {i>0 && <Icon name="chevron" size={12} color="var(--fg-4)"/>}
            <span style={{font:`${i===crumbs.length-1?"500":"400"} 12.5px/1 var(--font)`,color: i===crumbs.length-1?"var(--fg)":"var(--fg-3)",whiteSpace:"nowrap"}}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{display:"flex",alignItems:"center",gap:6,font:"500 11.5px/1 var(--font)",color:"var(--fg-3)"}}>
          <LiveDot size={5}/>{Object.values(SESSIONS).filter(s=>s.status==="running"||s.status==="thinking").length} live
        </div>
        <AvatarStack users={TEAM.filter(u=>u.status==="active")} size={22}/>
        <div style={{width:1,height:18,background:"var(--border)"}}/>
        <button style={{width:28,height:28,borderRadius:"var(--radius-sm)",border:"none",background:"transparent",cursor:"pointer",color:"var(--fg-3)",display:"inline-flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
          <Icon name="bell" size={15}/>
          <span style={{position:"absolute",top:5,right:6,width:6,height:6,background:"var(--danger)",borderRadius:"50%",boxShadow:"0 0 0 2px var(--surface)"}}/>
        </button>
        <Button variant="primary" size="sm" icon={<Icon name="plus" size={12}/>}>New</Button>
      </div>
    </div>
  );
}

// === Tweaks panel ===
function TweaksPanel({ tweaks, update, onClose }) {
  return (
    <div style={{position:"fixed",right:20,bottom:20,width:320,background:"var(--surface)",border:"1px solid var(--border-2)",borderRadius:"var(--radius-lg)",boxShadow:"var(--shadow-lg)",zIndex:50}} className="fade-in">
      <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--border)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Icon name="sparkle" size={14} color="var(--accent)"/>
          <span style={{font:"600 13px/1 var(--font)"}}>Tweaks</span>
        </div>
        <button onClick={onClose} style={{width:22,height:22,border:"none",background:"transparent",cursor:"pointer",color:"var(--fg-3)",borderRadius:5,display:"inline-flex",alignItems:"center",justifyContent:"center"}}><Icon name="x" size={14}/></button>
      </div>
      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:18}}>
        <TweakRow label="Accent">
          <div style={{display:"flex",gap:8}}>
            {ACCENT_CHOICES.map(c=>(
              <button key={c.id} onClick={()=>update("accent", c.color)} style={{
                width:24,height:24,borderRadius:"50%",background:c.color,border:"none",cursor:"pointer",
                boxShadow:tweaks.accent===c.color?`0 0 0 2px var(--surface), 0 0 0 3.5px ${c.color}`:"none",
                transition:"box-shadow 120ms",
              }}/>
            ))}
          </div>
        </TweakRow>
        <TweakRow label="Density">
          <Seg value={tweaks.density} onChange={v=>update("density",v)} options={[{id:"compact",label:"Compact"},{id:"cozy",label:"Cozy"}]}/>
        </TweakRow>
        <TweakRow label="Navigation">
          <Seg value={tweaks.nav} onChange={v=>update("nav",v)} options={[{id:"sidebar",label:"Sidebar"},{id:"topbar",label:"Topbar"}]}/>
        </TweakRow>
        <TweakRow label="Visual style">
          <Seg value={tweaks.style} onChange={v=>update("style",v)} options={[{id:"modern",label:"Modern"},{id:"terminal",label:"Terminal"},{id:"enterprise",label:"Enterprise"}]}/>
        </TweakRow>
      </div>
    </div>
  );
}
function TweakRow({ label, children }) {
  return (
    <div>
      <div style={{font:"500 11.5px/1 var(--font)",color:"var(--fg-3)",textTransform:"uppercase",letterSpacing:0.4,marginBottom:8}}>{label}</div>
      {children}
    </div>
  );
}
function Seg({ value, onChange, options }) {
  return (
    <div style={{display:"inline-flex",padding:2,background:"var(--bg-2)",borderRadius:"var(--radius-sm)"}}>
      {options.map(o=>(
        <button key={o.id} onClick={()=>onChange(o.id)} style={{
          flex:"1 1 auto",padding:"5px 10px",border:"none",cursor:"pointer",font:"500 12px/1 var(--font)",
          background: value===o.id?"var(--surface)":"transparent",color: value===o.id?"var(--fg)":"var(--fg-3)",
          borderRadius:5,boxShadow: value===o.id?"var(--shadow-sm)":"none",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

// === Command palette ===
function CommandPalette({ query, setQuery, onClose, onSelectStory, onSelectScreen }) {
  const q = query.toLowerCase();
  const stories = STORIES.filter(s=> s.id.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)).slice(0,6);
  const screens = NAV_ITEMS.filter(n=> n.label.toLowerCase().includes(q));
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:100,display:"flex",justifyContent:"center",paddingTop:"12vh"}}>
      <div onClick={e=>e.stopPropagation()} className="fade-in" style={{width:580,maxWidth:"90vw",height:"fit-content",background:"var(--surface)",border:"1px solid var(--border-2)",borderRadius:"var(--radius-lg)",boxShadow:"var(--shadow-lg)",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 18px",borderBottom:"1px solid var(--border)"}}>
          <Icon name="search" size={16} color="var(--fg-3)"/>
          <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search stories, members, screens…" style={{flex:1,border:"none",outline:"none",background:"transparent",font:"400 14px/1 var(--font)"}}/>
          <Kbd>Esc</Kbd>
        </div>
        <div style={{maxHeight:"50vh",overflow:"auto",padding:"8px 0"}}>
          {screens.length>0 && <>
            <Section title="Jump to"/>
            {screens.map(s=>(
              <CmdRow key={s.id} icon={s.icon} title={s.label} onClick={()=>onSelectScreen(s.id)}/>
            ))}
          </>}
          {stories.length>0 && <>
            <Section title="Stories"/>
            {stories.map(s=>(
              <CmdRow key={s.id} icon="sparkle" title={s.title} subtitle={s.id} onClick={()=>{onSelectStory(s.id);onClose();}}/>
            ))}
          </>}
          {screens.length===0 && stories.length===0 && <div style={{padding:"24px 18px",font:"400 13px/1.4 var(--font)",color:"var(--fg-3)",textAlign:"center"}}>No results</div>}
        </div>
      </div>
    </div>
  );
}
function Section({ title }) { return <div style={{padding:"6px 18px 4px",font:"600 11px/1 var(--font)",color:"var(--fg-3)",letterSpacing:0.4,textTransform:"uppercase"}}>{title}</div>; }
function CmdRow({ icon, title, subtitle, onClick }) {
  return (
    <button onClick={onClick} style={{width:"100%",padding:"9px 18px",border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}
      onMouseEnter={e=>e.currentTarget.style.background="var(--bg-2)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <Icon name={icon} size={15} color="var(--fg-3)"/>
      <span style={{flex:1,font:"500 13px/1.3 var(--font)",color:"var(--fg)"}}>{title}</span>
      {subtitle && <span style={{font:"500 11.5px/1 var(--mono)",color:"var(--fg-3)"}}>{subtitle}</span>}
    </button>
  );
}

Object.assign(window, { App });
