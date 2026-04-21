// Connect onboarding — bring your local editor into Hive

function OnboardingScreen({ onDone }) {
  const [step, setStep] = React.useState(1);

  return (
    <div style={{height:"100%", overflow:"auto", background:"#f5f7fa", padding:"40px 24px", display:"flex", justifyContent:"center"}}>
      <div style={{width:"100%", maxWidth:720}}>
        <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:8}}>
          <div style={{width:28, height:28, background:"#005bd4", borderRadius:3, color:"#fff", font:"700 13px/1 inherit", display:"flex", alignItems:"center", justifyContent:"center"}}>H</div>
          <div style={{font:"600 16px/1 inherit", color:"#191b1e"}}>Connect your workspace</div>
          <div style={{flex:1}}/>
          <span style={{font:"12px/1 inherit", color:"#6f7174"}}>Step {step} / 4</span>
        </div>

        <div style={{display:"flex", gap:4, marginBottom:24}}>
          {[1,2,3,4].map(s => (
            <div key={s} style={{flex:1, height:3, background: s<=step?"#005bd4":"#dbdde0", borderRadius:2}}/>
          ))}
        </div>

        {step===1 && <PickEditor onNext={()=>setStep(2)}/>}
        {step===2 && <InstallBridge onNext={()=>setStep(3)} onBack={()=>setStep(1)}/>}
        {step===3 && <ShareAgent onNext={()=>setStep(4)} onBack={()=>setStep(2)}/>}
        {step===4 && <Ready onDone={onDone}/>}
      </div>
    </div>
  );
}

function Card2({ children, style }) {
  return <div style={{background:"#fff", border:"1px solid #dbdde0", borderRadius:2, padding:24, ...style}}>{children}</div>;
}

function PickEditor({ onNext }) {
  const [pick, setPick] = React.useState("claude");
  return (
    <Card2>
      <h1 style={{font:"600 22px/1.3 inherit", color:"#191b1e", margin:"0 0 6px 0"}}>Which agent do you run locally?</h1>
      <p style={{font:"14px/1.5 inherit", color:"#6f7174", margin:"0 0 20px 0"}}>Hive will stream your sessions so teammates see what you're working on — and can dispatch stories to your runner.</p>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
        {AGENTS.map(a => (
          <div key={a.id} onClick={()=>setPick(a.id)}
            style={{padding:"14px 16px", border:`1px solid ${pick===a.id?"#005bd4":"#dbdde0"}`, background: pick===a.id?"#ecf5ff":"#fff", borderRadius:2, cursor:"pointer", display:"flex", alignItems:"center", gap:12}}>
            <div style={{width:32, height:32, borderRadius:2, background:a.color, color:"#fff", font:"700 14px/1 inherit", display:"flex", alignItems:"center", justifyContent:"center"}}>{a.name[0]}</div>
            <div style={{flex:1}}>
              <div style={{font:"500 14px/1.2 inherit", color:"#191b1e"}}>{a.name}</div>
              <div style={{font:"12px/1.3 inherit", color:"#6f7174", marginTop:2}}>{a.id==="claude"?"CLI · tool-use native":a.id==="cursor"?"Composer + chat":a.id==="codex"?"GPT-backed CLI":"Generic LSP bridge"}</div>
            </div>
            {pick===a.id && <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#005bd4"/><polyline points="4,8 7,11 12,5" fill="none" stroke="#fff" strokeWidth="2"/></svg>}
          </div>
        ))}
      </div>
      <div style={{marginTop:20, display:"flex", justifyContent:"flex-end", gap:8}}>
        <Button size="default" onClick={onNext}>Continue</Button>
      </div>
    </Card2>
  );
}

function InstallBridge({ onNext, onBack }) {
  const [copied, setCopied] = React.useState(false);
  const cmd = "curl -fsSL https://hive.dev/install.sh | sh -s -- --team=acme";
  return (
    <Card2>
      <h1 style={{font:"600 22px/1.3 inherit", color:"#191b1e", margin:"0 0 6px 0"}}>Install the Hive bridge</h1>
      <p style={{font:"14px/1.5 inherit", color:"#6f7174", margin:"0 0 18px 0"}}>One binary. Runs in your terminal alongside your editor; wraps stdout and tool-call events into a secure stream.</p>
      <div style={{background:"#0d0e11", border:"1px solid #262930", borderRadius:2, padding:"12px 14px", font:"13px/1.5 var(--font-mono,monospace)", color:"#d1d4db", display:"flex", alignItems:"center", gap:12}}>
        <span style={{color:"#5aca49"}}>$</span>
        <span style={{flex:1, overflow:"auto", whiteSpace:"nowrap"}}>{cmd}</span>
        <button onClick={()=>setCopied(true)} style={{background:"transparent", border:"1px solid #3e424b", color:"#d1d4db", borderRadius:2, font:"12px/1 inherit", padding:"6px 10px", cursor:"pointer"}}>{copied?"copied":"copy"}</button>
      </div>
      <div style={{marginTop:14, font:"12px/1.5 inherit", color:"#9b9da0"}}>Or download directly for <a href="#" style={{color:"#005bd4"}}>macOS</a> · <a href="#" style={{color:"#005bd4"}}>Linux</a> · <a href="#" style={{color:"#005bd4"}}>Windows</a></div>

      <div style={{marginTop:20, background:"#fafbfd", border:"1px solid #ebedf0", borderRadius:2, padding:"12px 14px", display:"flex", gap:12, alignItems:"flex-start"}}>
        <Icon name="settings" size={16} color="#6f7174"/>
        <div style={{flex:1, font:"12.5px/1.5 inherit", color:"#6f7174"}}>
          <b style={{color:"#494b4e"}}>What gets shared:</b> command prompts you send, tool calls (file reads, writes, runs), file paths the agent touches, and terminal output. Secrets in <code>.env</code>, <code>.git/</code>, and paths matching <code>.hiveignore</code> are filtered before they leave your machine.
        </div>
      </div>

      <div style={{marginTop:20, display:"flex", justifyContent:"space-between"}}>
        <Button variant="subtle" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>I've run it</Button>
      </div>
    </Card2>
  );
}

function ShareAgent({ onNext, onBack }) {
  const [share, setShare] = React.useState({ stream:true, dispatch:true, files:false });
  return (
    <Card2>
      <h1 style={{font:"600 22px/1.3 inherit", color:"#191b1e", margin:"0 0 6px 0"}}>Share your runner with the team</h1>
      <p style={{font:"14px/1.5 inherit", color:"#6f7174", margin:"0 0 18px 0"}}>You can let teammates see your sessions, dispatch stories to your machine, or both. Toggle any time.</p>

      {[
        { k:"stream",   l:"Stream my sessions",          sub:"Teammates can watch terminals I run. Read-only." },
        { k:"dispatch", l:"Let others dispatch to me",   sub:"Stories assigned to this machine spin up a fresh session using my credentials." },
        { k:"files",    l:"Allow file-diff previews",    sub:"Surface changed files in the story detail view." },
      ].map(row => (
        <label key={row.k} style={{display:"flex", alignItems:"flex-start", gap:12, padding:"12px 0", borderTop:"1px solid #ebedf0", cursor:"pointer"}}>
          <div style={{marginTop:2}}>
            <div onClick={()=>setShare(s => ({...s, [row.k]: !s[row.k]}))}
              style={{width:34, height:20, borderRadius:10, background: share[row.k]?"#005bd4":"#dbdde0", position:"relative", transition:"background 150ms"}}>
              <span style={{position:"absolute", top:2, left: share[row.k]?16:2, width:16, height:16, borderRadius:16, background:"#fff", transition:"left 150ms"}}/>
            </div>
          </div>
          <div style={{flex:1}}>
            <div style={{font:"500 14px/1.3 inherit", color:"#191b1e"}}>{row.l}</div>
            <div style={{font:"12.5px/1.5 inherit", color:"#6f7174"}}>{row.sub}</div>
          </div>
        </label>
      ))}

      <div style={{marginTop:20, display:"flex", justifyContent:"space-between"}}>
        <Button variant="subtle" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </Card2>
  );
}

function Ready({ onDone }) {
  return (
    <Card2 style={{textAlign:"center", padding:"40px 24px"}}>
      <div style={{width:56, height:56, margin:"0 auto 16px auto", borderRadius:56, background:"#dffcc6", display:"flex", alignItems:"center", justifyContent:"center"}}>
        <svg width="28" height="28" viewBox="0 0 24 24"><polyline points="5,12 10,17 19,7" fill="none" stroke="#3faf38" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <h1 style={{font:"600 22px/1.3 inherit", color:"#191b1e", margin:"0 0 6px 0"}}>You're in the hive</h1>
      <p style={{font:"14px/1.5 inherit", color:"#6f7174", margin:"0 0 20px 0"}}>Your <code style={{font:"13px var(--font-mono,monospace)", color:"#191b1e"}}>mbp-m3</code> is now a runner. Claim a story from the backlog to dispatch your first session.</p>
      <Button onClick={onDone}>Open backlog</Button>
    </Card2>
  );
}

Object.assign(window, { OnboardingScreen });
