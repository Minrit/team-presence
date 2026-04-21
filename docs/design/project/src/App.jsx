// App shell — navigation, top bar, routing, tweaks

const { useState: useStateA, useEffect: useEffectA } = React;

const NAV = [
  { id:"story",     icon:"edit",       label:"Current story", primary:true },
  { id:"backlog",   icon:"add",        label:"Backlog" },
  { id:"kanban",    icon:"dashboard",  label:"Board" },
  { id:"team",      icon:"user",       label:"Team stream" },
  { id:"member",    icon:"vm",         label:"Members" },
  { id:"overview",  icon:"cluster",    label:"Overview" },
  { id:"compute",   icon:"hardware",   label:"Compute" },
  { id:"onboarding",icon:"download",   label:"Connect" },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "visualStyle": "enterprise",
  "density": "cozy",
  "navStyle": "sidebar",
  "showCommandPalette": false,
  "accent": "#005bd4"
}/*EDITMODE-END*/;

function App() {
  const [route, setRoute] = useStateA(() => {
    try { return localStorage.getItem("hive:route") || "story"; } catch { return "story"; }
  });
  const [storyId, setStoryId] = useStateA(() => {
    try { return localStorage.getItem("hive:story") || "HIV-142"; } catch { return "HIV-142"; }
  });
  const [memberId, setMemberId] = useStateA("u2");
  const [tweaks, setTweaks] = useStateA(TWEAK_DEFAULTS);
  const [tweaksOn, setTweaksOn] = useStateA(false);
  const [cmdOpen, setCmdOpen] = useStateA(false);

  useEffectA(() => { try { localStorage.setItem("hive:route", route); } catch {} }, [route]);
  useEffectA(() => { try { localStorage.setItem("hive:story", storyId); } catch {} }, [storyId]);

  useEffectA(() => {
    const onMsg = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweaksOn(true);
      if (e.data?.type === "__deactivate_edit_mode") setTweaksOn(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type:"__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffectA(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); }
      if (e.key === "Escape") setCmdOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setTweak = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    window.parent.postMessage({ type:"__edit_mode_set_keys", edits:{ [k]: v }}, "*");
  };

  const openStory = (id) => { setStoryId(id); setRoute("story"); };

  // Apply accent color
  useEffectA(() => {
    document.documentElement.style.setProperty("--theme-600", tweaks.accent || "#005bd4");
  }, [tweaks.accent]);

  const style = tweaks.visualStyle;
  const bgHue = style === "terminal" ? "#0d0e11" : "#f5f7fa";
  const density = tweaks.density;

  return (
    <div style={{
      height:"100vh", display:"flex", flexDirection:"column",
      background:bgHue, overflow:"hidden",
      ...(style==="terminal" ? { color:"#d1d4db" } : {}),
    }}>
      <TopBar route={route} navStyle={tweaks.navStyle} onRoute={setRoute} onCmd={()=>setCmdOpen(true)} visualStyle={style}/>

      <div style={{flex:1, display:"flex", minHeight:0}}>
        {tweaks.navStyle === "sidebar" && <SideNav route={route} onRoute={setRoute} visualStyle={style}/>}

        <div style={{flex:1, display:"flex", flexDirection:"column", minHeight:0, background:bgHue}}>
          {tweaks.navStyle === "topbar" && <TopTabs route={route} onRoute={setRoute}/>}

          <div style={{flex:1, minHeight:0, overflow:"hidden"}}
               className={density === "compact" ? "hive-compact" : ""}>
            {route === "story"      && <StoryDetailScreen storyId={storyId} onOpenStory={openStory} density={density}/>}
            {route === "backlog"    && <BacklogScreen onOpenStory={openStory}/>}
            {route === "kanban"     && <KanbanScreen onOpenStory={openStory}/>}
            {route === "team"       && <TerminalWallScreen onOpenStory={openStory}/>}
            {route === "member"     && <MemberScreen userId={memberId} onOpenStory={openStory}/>}
            {route === "overview"   && <OverviewScreen/>}
            {route === "compute"    && <ComputeScreen/>}
            {route === "onboarding" && <OnboardingScreen onDone={()=>setRoute("backlog")}/>}
          </div>
        </div>
      </div>

      {cmdOpen && <CommandPalette onClose={()=>setCmdOpen(false)} onRoute={(r)=>{setRoute(r); setCmdOpen(false);}} onOpenStory={(id)=>{openStory(id); setCmdOpen(false);}}/>}

      {tweaksOn && <TweaksPanel tweaks={tweaks} setTweak={setTweak}/>}
    </div>
  );
}

function TopBar({ route, onRoute, onCmd, visualStyle, navStyle }) {
  const dark = visualStyle === "terminal";
  const bg   = dark ? "#0b0c10" : "#ffffff";
  const bd   = dark ? "#262930" : "#dbdde0";
  const fg   = dark ? "#e1e4ea" : "#191b1e";
  const sub  = dark ? "#8a8e98" : "#6f7174";
  return (
    <div style={{height:48, background:bg, borderBottom:`1px solid ${bd}`, display:"flex", alignItems:"center", gap:14, padding:"0 14px", flexShrink:0}}>
      <div style={{display:"flex", alignItems:"center", gap:9}}>
        <div style={{width:24, height:24, borderRadius:3, background:"#005bd4", color:"#fff", font:"700 13px/1 inherit", display:"flex", alignItems:"center", justifyContent:"center"}}>H</div>
        <div style={{font:"600 15px/1 inherit", color:fg, letterSpacing:-0.1}}>Hive</div>
        <span style={{color:dark?"#3e424b":"#c7c9cc"}}>/</span>
        <div style={{font:"14px/1 inherit", color:sub}}>ZStack console</div>
        <span style={{color:dark?"#3e424b":"#c7c9cc"}}>/</span>
        <div style={{font:"500 14px/1 inherit", color:fg}}>Sprint 24</div>
      </div>

      <div style={{flex:1}}/>

      <div onClick={onCmd} style={{display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background: dark?"#17191f":"#f5f7fa", border:`1px solid ${bd}`, borderRadius:2, cursor:"pointer", width:280, color:sub}}>
        <Icon name="search" size={14} color={sub}/>
        <span style={{flex:1, font:"13px/1 inherit"}}>Jump to story, member, screen…</span>
        <Kbd>⌘K</Kbd>
      </div>

      <Icon name="bell" size={16} color={sub}/>
      <Avatar user={TEAM[0]} size={28}/>
    </div>
  );
}

function SideNav({ route, onRoute, visualStyle }) {
  const dark = visualStyle === "terminal";
  const bg   = dark ? "#0b0c10" : "#ffffff";
  const bd   = dark ? "#262930" : "#ebedf0";
  const fg   = dark ? "#d1d4db" : "#494b4e";
  const muted= dark ? "#8a8e98" : "#9b9da0";
  const activeBg = dark ? "#17191f" : "#ecf5ff";

  return (
    <div style={{width:210, background:bg, borderRight:`1px solid ${bd}`, padding:"10px 0", display:"flex", flexDirection:"column", flexShrink:0}}>
      {NAV.map(n => {
        const active = route === n.id;
        return (
          <div key={n.id} onClick={()=>onRoute(n.id)}
            style={{height:34, padding:"0 14px 0 12px", display:"flex", alignItems:"center", gap:10, cursor:"pointer",
              background: active?activeBg:"transparent",
              color: active?"#005bd4":fg,
              borderLeft: `2px solid ${active?"#005bd4":"transparent"}`,
              paddingLeft: 12, font:"14px/1 inherit",
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = dark?"#17191f":"#f5f7fa"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
            <Icon name={n.icon} size={15}/>
            <span style={{flex:1}}>{n.label}</span>
            {n.id === "team" && <LiveDot color="#5aca49" size={5}/>}
          </div>
        );
      })}

      <div style={{flex:1}}/>

      <div style={{padding:"10px 14px", borderTop:`1px solid ${bd}`, display:"flex", gap:8, alignItems:"center"}}>
        <LiveDot color="#5aca49" size={6}/>
        <span style={{font:"11.5px/1 inherit", color:muted}}>{Object.keys(SESSIONS).length} sessions · {TEAM.filter(u=>u.status==="active").length} online</span>
      </div>
    </div>
  );
}

function TopTabs({ route, onRoute }) {
  return (
    <div style={{background:"#fff", borderBottom:"1px solid #dbdde0", padding:"0 14px", display:"flex", gap:4, flexShrink:0}}>
      {NAV.map(n => {
        const active = route === n.id;
        return (
          <div key={n.id} onClick={()=>onRoute(n.id)}
            style={{padding:"10px 14px", cursor:"pointer",
              color: active?"#005bd4":"#494b4e", font: active?"500 13px/1 inherit":"13px/1 inherit",
              borderBottom: `2px solid ${active?"#005bd4":"transparent"}`, marginBottom:-1,
              display:"flex", gap:6, alignItems:"center"}}>
            <Icon name={n.icon} size={13}/> {n.label}
          </div>
        );
      })}
    </div>
  );
}

function CommandPalette({ onClose, onRoute, onOpenStory }) {
  const [q, setQ] = React.useState("");
  const stories = STORIES.filter(s => s.title.toLowerCase().includes(q.toLowerCase()) || s.id.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  const routes = NAV.filter(n => n.label.toLowerCase().includes(q.toLowerCase())).slice(0, 4);

  return (
    <div onClick={onClose} style={{position:"fixed", inset:0, background:"rgba(13,14,17,0.5)", zIndex:100, display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:100}}>
      <div onClick={e=>e.stopPropagation()} style={{width:560, background:"#fff", border:"1px solid #dbdde0", borderRadius:4, boxShadow:"0 20px 25px -5px rgba(0,0,0,0.2)", overflow:"hidden"}}>
        <div style={{display:"flex", alignItems:"center", gap:10, padding:"14px 16px", borderBottom:"1px solid #ebedf0"}}>
          <Icon name="search" size={16} color="#6f7174"/>
          <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Type to jump…"
            style={{flex:1, border:"none", outline:"none", font:"15px/1 inherit", color:"#191b1e", background:"transparent"}}/>
          <Kbd>esc</Kbd>
        </div>
        <div style={{maxHeight:400, overflow:"auto", padding:"6px 0"}}>
          {stories.length > 0 && (
            <>
              <div style={{padding:"6px 16px", font:"500 11px/1 inherit", color:"#9b9da0", letterSpacing:0.5, textTransform:"uppercase"}}>Stories</div>
              {stories.map(s => (
                <div key={s.id} onClick={()=>onOpenStory(s.id)} style={{padding:"8px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:10}}
                  onMouseEnter={e=>e.currentTarget.style.background="#f5f7fa"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <StoryId id={s.id}/>
                  <span style={{flex:1, font:"13.5px/1 inherit", color:"#191b1e"}}>{s.title}</span>
                  <StatusChip status={s.status} size="sm"/>
                </div>
              ))}
            </>
          )}
          {routes.length > 0 && (
            <>
              <div style={{padding:"6px 16px", font:"500 11px/1 inherit", color:"#9b9da0", letterSpacing:0.5, textTransform:"uppercase", marginTop:6}}>Screens</div>
              {routes.map(r => (
                <div key={r.id} onClick={()=>onRoute(r.id)} style={{padding:"8px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:10}}
                  onMouseEnter={e=>e.currentTarget.style.background="#f5f7fa"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <Icon name={r.icon} size={14} color="#6f7174"/>
                  <span style={{flex:1, font:"13.5px/1 inherit", color:"#191b1e"}}>{r.label}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TweaksPanel({ tweaks, setTweak }) {
  return (
    <div style={{position:"fixed", bottom:16, right:16, width:260, background:"#fff", border:"1px solid #dbdde0", borderRadius:2, boxShadow:"0 10px 15px -3px rgba(0,0,0,0.12)", zIndex:90, overflow:"hidden"}}>
      <div style={{padding:"10px 14px", borderBottom:"1px solid #ebedf0", display:"flex", alignItems:"center"}}>
        <div style={{font:"600 13px/1 inherit", color:"#191b1e"}}>Tweaks</div>
        <div style={{flex:1}}/>
        <Kbd>⇧T</Kbd>
      </div>
      <div style={{padding:"12px 14px", display:"flex", flexDirection:"column", gap:14}}>
        <TweakGroup label="Visual style">
          {["enterprise","terminal","modern"].map(v => (
            <TweakChip key={v} active={tweaks.visualStyle===v} onClick={()=>setTweak("visualStyle", v)}>{v}</TweakChip>
          ))}
        </TweakGroup>
        <TweakGroup label="Density">
          {["compact","cozy"].map(v => (
            <TweakChip key={v} active={tweaks.density===v} onClick={()=>setTweak("density", v)}>{v}</TweakChip>
          ))}
        </TweakGroup>
        <TweakGroup label="Navigation">
          {["sidebar","topbar"].map(v => (
            <TweakChip key={v} active={tweaks.navStyle===v} onClick={()=>setTweak("navStyle", v)}>{v}</TweakChip>
          ))}
        </TweakGroup>
        <TweakGroup label="Accent">
          {["#005bd4","#6a63ff","#00c782","#d97757","#191b1e"].map(c => (
            <span key={c} onClick={()=>setTweak("accent", c)}
              style={{width:22, height:22, borderRadius:2, background:c, cursor:"pointer",
                boxShadow: tweaks.accent===c?`0 0 0 2px #fff, 0 0 0 3px ${c}`:"none"}}/>
          ))}
        </TweakGroup>
      </div>
    </div>
  );
}

function TweakGroup({ label, children }) {
  return (
    <div>
      <div style={{font:"500 11px/1 inherit", color:"#9b9da0", letterSpacing:0.5, textTransform:"uppercase", marginBottom:8}}>{label}</div>
      <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>{children}</div>
    </div>
  );
}
function TweakChip({ active, onClick, children }) {
  return (
    <span onClick={onClick} style={{padding:"4px 10px", border:`1px solid ${active?"#005bd4":"#dbdde0"}`, background: active?"#ecf5ff":"#fff", color: active?"#005bd4":"#494b4e", borderRadius:2, font:"500 12px/1 inherit", cursor:"pointer", textTransform:"capitalize"}}>{children}</span>
  );
}

Object.assign(window, { App });
