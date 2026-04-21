// All screens for Hive
const { useState: uS, useEffect: uE, useMemo: uM, useRef: uR } = React;

function useLocalState(key, initial) {
  const [v, setV] = uS(()=>{
    try { const s = localStorage.getItem(key); if (s) return JSON.parse(s); } catch(e){}
    return initial;
  });
  uE(()=>{ try { localStorage.setItem(key, JSON.stringify(v)); } catch(e){} }, [key,v]);
  return [v, setV];
}

// ============== MAIN — Story + Terminal split ==============
function CurrentStoryScreen({ storyId, onSelectStory, onNavigate }) {
  const story = STORIES.find(s=>s.id===storyId) || STORIES[0];
  const [activeSession, setActiveSession] = uS(story.sessions[0] || null);
  const [rightTab, setRightTab] = uS("terminal");
  const assignee = TEAM.find(u=>u.id===story.assignee);
  const sessions = story.sessions.map(sid=>SESSIONS[sid]).filter(Boolean);

  uE(()=>{ setActiveSession(story.sessions[0]||null); setRightTab("terminal"); }, [story.id]);

  const done = story.acceptance.filter(a=>a.done).length;
  const activeSess = activeSession ? SESSIONS[activeSession] : null;

  return (
    <div className="story-split" style={{padding:16,height:"100%",overflow:"hidden"}}>
      {/* LEFT — Story detail */}
      <div style={{display:"flex",flexDirection:"column",minHeight:0,overflow:"auto",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)"}}>
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid var(--border)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <StoryId id={story.id}/>
            <span style={{color:"var(--fg-4)"}}>·</span>
            <span style={{font:"500 12px/1 var(--font)",color:"var(--fg-3)"}}>{story.epic}</span>
            {story.branch && <>
              <span style={{color:"var(--fg-4)"}}>·</span>
              <span style={{display:"inline-flex",alignItems:"center",gap:4,font:"500 12px/1 var(--mono)",color:"var(--fg-3)"}}>
                <Icon name="branch" size={12}/>{story.branch}
              </span>
            </>}
            <div style={{marginLeft:"auto",display:"flex",gap:6}}>
              <Button variant="ghost" size="sm" icon={<Icon name="link" size={13}/>}/>
              <Button variant="ghost" size="sm" icon={<Icon name="more" size={14}/>}/>
            </div>
          </div>
          <h1 style={{margin:"0 0 14px",font:"600 22px/1.25 var(--font)",letterSpacing:-0.3}}>{story.title}</h1>
          <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{font:"500 12px/1 var(--font)",color:"var(--fg-3)",width:70}}>Status</span>
              <StatusPill status={story.status}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{font:"500 12px/1 var(--font)",color:"var(--fg-3)",width:70}}>Priority</span>
              <Priority level={story.priority} showLabel/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{font:"500 12px/1 var(--font)",color:"var(--fg-3)",width:70}}>Assignee</span>
              {assignee ? <div style={{display:"flex",alignItems:"center",gap:6}}><Avatar user={assignee} size={20}/><span style={{font:"500 12.5px/1 var(--font)"}}>{assignee.name}</span></div> : <span style={{color:"var(--fg-4)"}}>—</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{font:"500 12px/1 var(--font)",color:"var(--fg-3)",width:70}}>Estimate</span>
              <span style={{font:"500 12.5px/1 var(--font)",color:"var(--fg-2)"}}>{story.points} pts</span>
            </div>
          </div>
        </div>

        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:22}}>
          {/* Description */}
          <section>
            <h3 style={{margin:"0 0 8px",font:"600 12px/1 var(--font)",color:"var(--fg-3)",letterSpacing:0.4,textTransform:"uppercase"}}>Description</h3>
            <p style={{margin:0,font:"400 13.5px/1.6 var(--font)",color:"var(--fg)"}}>{story.description}</p>
          </section>

          {/* Acceptance */}
          <section>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <h3 style={{margin:0,font:"600 12px/1 var(--font)",color:"var(--fg-3)",letterSpacing:0.4,textTransform:"uppercase"}}>Acceptance criteria</h3>
              <span style={{font:"500 12px/1 var(--mono)",color:"var(--fg-3)"}}>{done}/{story.acceptance.length}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              {story.acceptance.map((a,i)=>(
                <label key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 10px",borderRadius:6,cursor:"pointer",transition:"background 120ms"}} onMouseEnter={e=>e.currentTarget.style.background="var(--bg-2)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{flexShrink:0,marginTop:1,width:16,height:16,borderRadius:4,border:a.done?"none":"1.5px solid var(--border-2)",background:a.done?"var(--success)":"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                    {a.done && <Icon name="check" size={11} color="#fff" strokeWidth={2.5}/>}
                  </span>
                  <span style={{font:"400 13px/1.4 var(--font)",color:a.done?"var(--fg-3)":"var(--fg)",textDecoration:a.done?"line-through":"none"}}>{a.text}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Dependencies */}
          {(story.blocks?.length||story.blockedBy?.length) ? (
            <section>
              <h3 style={{margin:"0 0 10px",font:"600 12px/1 var(--font)",color:"var(--fg-3)",letterSpacing:0.4,textTransform:"uppercase"}}>Relations</h3>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {story.blocks?.map(b=>(
                  <div key={b} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"var(--bg-2)",borderRadius:6,font:"500 12.5px/1 var(--font)"}}>
                    <Icon name="arrow" size={13} color="var(--fg-3)"/>
                    <span style={{color:"var(--fg-3)"}}>blocks</span>
                    <StoryId id={b}/>
                    <span style={{color:"var(--fg-2)"}}>{STORIES.find(s=>s.id===b)?.title}</span>
                  </div>
                ))}
                {story.blockedBy?.map(b=>(
                  <div key={b} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"#fef2f2",borderRadius:6,font:"500 12.5px/1 var(--font)",color:"#991b1b"}}>
                    <Icon name="flag" size={12}/>
                    <span>blocked by</span>
                    <StoryId id={b}/>
                    <span>{STORIES.find(s=>s.id===b)?.title}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Activity */}
          <section>
            <h3 style={{margin:"0 0 12px",font:"600 12px/1 var(--font)",color:"var(--fg-3)",letterSpacing:0.4,textTransform:"uppercase"}}>Activity</h3>
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",left:11,top:8,bottom:8,width:1.5,background:"var(--border)"}}/>
              {story.activity.map((act,i)=>{
                const actor = TEAM.find(u=>u.handle===act.who);
                const agent = AGENTS[act.who];
                return (
                  <div key={i} style={{display:"flex",gap:12,padding:"6px 0",position:"relative"}}>
                    <div style={{position:"relative",zIndex:1,flexShrink:0}}>
                      {actor ? <Avatar user={actor} size={22}/> :
                       agent ? <div style={{width:22,height:22,borderRadius:22,background:agent.color,color:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center",font:"600 11px/1 var(--font)",boxShadow:"0 0 0 2px var(--surface)"}}>{agent.short[0]}</div> :
                       <div style={{width:22,height:22,borderRadius:22,background:"var(--bg-2)"}}/>}
                    </div>
                    <div style={{flex:1,font:"400 12.5px/1.55 var(--font)",color:"var(--fg-2)",paddingTop:2}}>
                      <span style={{fontWeight:500,color:"var(--fg)"}}>{actor?.name || agent?.name || act.who}</span>
                      {" "}{act.text}
                      {act.ref && <span style={{marginLeft:6,padding:"1px 6px",background:"var(--bg-2)",borderRadius:4,font:"500 11.5px/1.4 var(--mono)",color:"var(--fg-3)"}}>{act.ref}</span>}
                      <span style={{marginLeft:8,color:"var(--fg-4)",font:"500 11.5px/1 var(--mono)"}}>{act.t}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Comment composer */}
          <div style={{border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
            <Avatar user={TEAM[0]} size={22}/>
            <span style={{flex:1,color:"var(--fg-4)",font:"400 13px/1 var(--font)"}}>Leave a comment or @mention an agent…</span>
            <Kbd>⌘↵</Kbd>
          </div>
        </div>
      </div>

      {/* RIGHT — Terminal / Tabs */}
      <div style={{display:"flex",flexDirection:"column",minHeight:0,gap:12}}>
        {/* Tab bar */}
        <div style={{display:"flex",alignItems:"center",gap:4,padding:4,background:"var(--bg-2)",borderRadius:"var(--radius)",flexShrink:0}}>
          {[
            {id:"terminal", label:"Live terminal", badge: sessions.length},
            {id:"changes", label:"Changes"},
            {id:"runs", label:"Runs"},
            {id:"related", label:"Related"},
          ].map(t=>(
            <button key={t.id} onClick={()=>setRightTab(t.id)} style={{
              flex:"none",padding:"7px 14px",border:"none",background:rightTab===t.id?"var(--surface)":"transparent",
              color:rightTab===t.id?"var(--fg)":"var(--fg-3)",font:"500 12.5px/1 var(--font)",cursor:"pointer",
              borderRadius:6,display:"inline-flex",alignItems:"center",gap:7,
              boxShadow:rightTab===t.id?"var(--shadow-sm)":"none",transition:"all 120ms ease",
            }}>
              {t.label}
              {t.badge>0 && <span style={{padding:"1px 6px",background:"var(--accent)",color:"#fff",borderRadius:10,font:"600 10.5px/1.4 var(--font)"}}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {rightTab==="terminal" && (
          sessions.length===0 ? <EmptyPanel label="No sessions running" cta="Assign an agent" icon="terminal"/> :
          <>
            {sessions.length>1 && (
              <div style={{display:"flex",gap:6,flexShrink:0,overflowX:"auto",paddingBottom:2}}>
                {sessions.map(s=>(
                  <button key={s.id} onClick={()=>setActiveSession(s.id)} style={{
                    flex:"none",padding:"7px 12px 7px 10px",background: activeSession===s.id?"var(--surface)":"var(--bg-2)",
                    border: activeSession===s.id?"1px solid var(--border-2)":"1px solid transparent",
                    borderRadius:"var(--radius-sm)",font:"500 12px/1 var(--font)",color:"var(--fg)",cursor:"pointer",
                    display:"inline-flex",alignItems:"center",gap:7,boxShadow: activeSession===s.id?"var(--shadow-sm)":"none"
                  }}>
                    <SessionStatusGlyph status={s.status}/>
                    <span style={{width:8,height:8,borderRadius:2,background:AGENTS[s.agent].color}}/>
                    {s.title}
                  </button>
                ))}
              </div>
            )}
            <div style={{flex:1,minHeight:0}}>
              {activeSess && <Terminal session={activeSess}/>}
            </div>
          </>
        )}
        {rightTab==="changes" && <ChangesPanel story={story}/>}
        {rightTab==="runs" && <RunsPanel story={story}/>}
        {rightTab==="related" && <RelatedPanel story={story}/>}
      </div>
    </div>
  );
}

function EmptyPanel({ label, cta, icon }) {
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,background:"var(--surface)",border:"1px dashed var(--border-2)",borderRadius:"var(--radius-lg)"}}>
      <div style={{width:44,height:44,borderRadius:44,background:"var(--bg-2)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--fg-3)"}}>
        <Icon name={icon||"inbox"} size={20}/>
      </div>
      <div style={{font:"500 14px/1 var(--font)",color:"var(--fg-2)"}}>{label}</div>
      {cta && <Button variant="secondary" size="sm" icon={<Icon name="plus" size={13}/>}>{cta}</Button>}
    </div>
  );
}

function ChangesPanel({ story }) {
  const files = [
    { path:"api/middleware/ratelimit.ts", add:84, del:12, status:"new" },
    { path:"api/routes/auth.ts", add:1, del:1, status:"mod" },
    { path:"api/middleware/__tests__/ratelimit.test.ts", add:112, del:0, status:"new" },
    { path:"api/auth.md", add:18, del:0, status:"mod" },
  ];
  return (
    <div style={{flex:1,minHeight:0,overflow:"auto",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)"}}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{font:"600 13.5px/1 var(--font)",marginBottom:3}}>4 files changed</div>
          <div style={{font:"500 12px/1 var(--mono)",color:"var(--fg-3)"}}><span style={{color:"#059669"}}>+215</span> <span style={{color:"#dc2626"}}>−13</span></div>
        </div>
        <Button variant="secondary" size="sm" icon={<Icon name="pr" size={13}/>}>Open PR</Button>
      </div>
      {files.map((f,i)=>(
        <div key={i} style={{padding:"12px 18px",borderBottom:i<files.length-1?"1px solid var(--border)":"none",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:6,height:6,borderRadius:6,background:f.status==="new"?"#10b981":"#f59e0b"}}/>
          <span style={{flex:1,font:"500 13px/1.3 var(--mono)",color:"var(--fg)",wordBreak:"break-all"}}>{f.path}</span>
          <span style={{font:"500 12px/1 var(--mono)",color:"#059669"}}>+{f.add}</span>
          <span style={{font:"500 12px/1 var(--mono)",color:"#dc2626"}}>−{f.del}</span>
        </div>
      ))}
    </div>
  );
}

function RunsPanel({ story }) {
  const runs = [
    { name:"pnpm test middleware/ratelimit", status:"passed", dur:"3.2s", when:"15:22", out:"6 passed" },
    { name:"pnpm lint api/", status:"passed", dur:"1.8s", when:"15:20", out:"no issues" },
    { name:"pnpm test middleware/ratelimit", status:"running", dur:"—", when:"just now", out:"running 4/6" },
  ];
  return (
    <div style={{flex:1,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",overflow:"auto"}}>
      {runs.map((r,i)=>(
        <div key={i} style={{padding:"12px 18px",borderBottom:i<runs.length-1?"1px solid var(--border)":"none",display:"flex",alignItems:"center",gap:12}}>
          {r.status==="passed" ? <StatusIcon status="done" size={16}/> : <LiveDot color="#f59e0b"/>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{font:"500 13px/1.3 var(--mono)",color:"var(--fg)"}}>{r.name}</div>
            <div style={{font:"500 11.5px/1.4 var(--font)",color:"var(--fg-3)",marginTop:2}}>{r.out} · {r.dur}</div>
          </div>
          <span style={{font:"500 12px/1 var(--mono)",color:"var(--fg-4)"}}>{r.when}</span>
        </div>
      ))}
    </div>
  );
}

function RelatedPanel({ story }) {
  return (
    <div style={{flex:1,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)",padding:18,overflow:"auto"}}>
      <h4 style={{margin:"0 0 10px",font:"600 12px/1 var(--font)",color:"var(--fg-3)",letterSpacing:0.4,textTransform:"uppercase"}}>Linked resources</h4>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {[
          { icon:"branch", label:story.branch, meta:"2 commits ahead of main"},
          { icon:"pr", label:story.pr || "No PR yet", meta:story.pr?"Ready for review":"Open when ready" },
          { icon:"git", label:"main", meta:"base branch" },
        ].map((x,i)=>(
          <div key={i} style={{padding:"10px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",display:"flex",alignItems:"center",gap:10}}>
            <Icon name={x.icon} size={14} color="var(--fg-3)"/>
            <div style={{flex:1}}>
              <div style={{font:"500 12.5px/1.3 var(--mono)",color:"var(--fg)"}}>{x.label}</div>
              <div style={{font:"400 11.5px/1.3 var(--font)",color:"var(--fg-3)",marginTop:2}}>{x.meta}</div>
            </div>
            <Icon name="external" size={13} color="var(--fg-4)"/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== BOARD ==============
function BoardScreen({ onSelectStory }) {
  const cols = [
    { id:"todo", label:"Todo" },
    { id:"in_progress", label:"In progress" },
    { id:"review", label:"In review" },
    { id:"done", label:"Done" },
  ];
  return (
    <div style={{padding:"20px 24px",height:"100%",display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h1 style={{margin:0,font:"600 22px/1 var(--font)",letterSpacing:-0.3}}>Board</h1>
          <div style={{font:"400 13px/1 var(--font)",color:"var(--fg-3)",marginTop:6}}>Sprint 24 · {STORIES.length} stories · {STORIES.filter(s=>s.status==="done").length} done</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Button variant="secondary" size="default" icon={<Icon name="filter" size={13}/>}>Filter</Button>
          <Button variant="primary" size="default" icon={<Icon name="plus" size={13}/>}>New story</Button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4, minmax(0,1fr))",gap:14,flex:1,minHeight:0}}>
        {cols.map(col=>{
          const items = STORIES.filter(s=>s.status===col.id);
          const meta = STATUS_META[col.id];
          return (
            <div key={col.id} style={{display:"flex",flexDirection:"column",minHeight:0,background:"var(--bg-2)",borderRadius:"var(--radius-lg)",padding:10}}>
              <div style={{padding:"6px 8px 12px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:meta.dot}}/>
                <span style={{font:"600 13px/1 var(--font)"}}>{col.label}</span>
                <span style={{font:"500 12px/1 var(--mono)",color:"var(--fg-3)"}}>{items.length}</span>
                <button style={{marginLeft:"auto",width:22,height:22,borderRadius:5,border:"none",background:"transparent",color:"var(--fg-3)",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}><Icon name="plus" size={13}/></button>
              </div>
              <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",gap:8,padding:"0 2px"}}>
                {items.map(s=>{
                  const assignee = TEAM.find(u=>u.id===s.assignee);
                  const epic = EPICS.find(e=>e.name===s.epic);
                  const sessions = (s.sessions||[]).map(id=>SESSIONS[id]).filter(Boolean);
                  const done = s.acceptance?.filter(a=>a.done).length||0;
                  const total = s.acceptance?.length||0;
                  return (
                    <div key={s.id} onClick={()=>onSelectStory(s.id)} style={{
                      background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"12px 12px 10px",
                      cursor:"pointer",boxShadow:"var(--shadow-sm)",transition:"all 120ms ease",
                    }} onMouseEnter={e=>{e.currentTarget.style.boxShadow="var(--shadow-md)";e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="var(--shadow-sm)";e.currentTarget.style.transform="none";}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <StoryId id={s.id}/>
                        <Priority level={s.priority}/>
                        {epic && <span style={{marginLeft:"auto",display:"inline-flex",alignItems:"center",gap:4,font:"500 11px/1 var(--font)",color:"var(--fg-3)"}}>
                          <span style={{width:7,height:7,borderRadius:2,background:epic.color}}/>{s.epic}
                        </span>}
                      </div>
                      <div style={{font:"500 13.5px/1.4 var(--font)",color:"var(--fg)",marginBottom:10}}>{s.title}</div>
                      {total>0 && <div style={{marginBottom:8}}>
                        <div style={{font:"500 11px/1 var(--mono)",color:"var(--fg-3)",marginBottom:4}}>{done}/{total}</div>
                        <ProgressBar value={done} total={total}/>
                      </div>}
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {assignee ? <Avatar user={assignee} size={20} dot/> : <div style={{width:20,height:20,borderRadius:20,border:"1.5px dashed var(--border-2)"}}/>}
                        <span style={{font:"500 11.5px/1 var(--mono)",color:"var(--fg-3)"}}>{s.points}pt</span>
                        {sessions.length>0 && <div style={{marginLeft:"auto",display:"inline-flex",alignItems:"center",gap:4,padding:"2px 6px",background:"var(--bg-2)",borderRadius:4,font:"500 11px/1 var(--font)",color:"var(--fg-2)"}}>
                          <LiveDot size={5}/>
                          {sessions.length} session{sessions.length>1?"s":""}
                        </div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============== BACKLOG / CLAIM TASKS ==============
function BacklogScreen({ onSelectStory }) {
  const [filter, setFilter] = uS("all");
  const items = STORIES.filter(s=>s.status==="todo" && !s.assignee);
  const filtered = filter==="all" ? items : items.filter(s=>s.priority===filter);

  return (
    <div style={{padding:"20px 24px",height:"100%",display:"flex",flexDirection:"column",gap:18,overflow:"auto"}}>
      <div>
        <h1 style={{margin:0,font:"600 22px/1 var(--font)",letterSpacing:-0.3}}>Available to claim</h1>
        <div style={{font:"400 13px/1 var(--font)",color:"var(--fg-3)",marginTop:6}}>{items.length} unassigned stories in this sprint · grab one to start</div>
      </div>
      <div style={{display:"flex",gap:6}}>
        <Chip active={filter==="all"} onClick={()=>setFilter("all")}>All ({items.length})</Chip>
        {["P1","P2","P3"].map(p=>{
          const m = PRIO_META[p];
          const n = items.filter(s=>s.priority===p).length;
          return <Chip key={p} active={filter===p} onClick={()=>setFilter(p)} color={m.color}>{p} · {m.label} ({n})</Chip>;
        })}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(380px, 1fr))",gap:12}}>
        {filtered.map(s=>{
          const epic = EPICS.find(e=>e.name===s.epic);
          return (
            <Card key={s.id} style={{padding:16,display:"flex",flexDirection:"column",gap:12,cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <StoryId id={s.id}/>
                <Priority level={s.priority} showLabel/>
                {epic && <span style={{marginLeft:"auto",display:"inline-flex",alignItems:"center",gap:5,font:"500 11.5px/1 var(--font)",color:"var(--fg-3)"}}>
                  <span style={{width:7,height:7,borderRadius:2,background:epic.color}}/>{s.epic}
                </span>}
              </div>
              <div>
                <div style={{font:"600 14.5px/1.35 var(--font)",marginBottom:6,color:"var(--fg)"}}>{s.title}</div>
                <div style={{font:"400 12.5px/1.5 var(--font)",color:"var(--fg-3)",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{s.description}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:10,borderTop:"1px dashed var(--border)"}}>
                <span style={{font:"500 11.5px/1 var(--mono)",color:"var(--fg-3)"}}>{s.points} pts</span>
                {s.blockedBy?.length>0 && <span style={{display:"inline-flex",alignItems:"center",gap:4,font:"500 11.5px/1 var(--font)",color:"var(--warning)"}}>
                  <Icon name="flag" size={11}/>blocked by {s.blockedBy.join(", ")}
                </span>}
                <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                  <Button variant="ghost" size="sm" onClick={()=>onSelectStory(s.id)}>Details</Button>
                  <Button variant="primary" size="sm" icon={<Icon name="bolt" size={12}/>}>Claim</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============== TEAM STREAM — multi-session wall ==============
function TeamStreamScreen() {
  const allSess = Object.values(SESSIONS);
  const [filter, setFilter] = uS("all");
  const filtered = filter==="all" ? allSess : allSess.filter(s=>s.agent===filter);
  return (
    <div style={{padding:"20px 24px",height:"100%",display:"flex",flexDirection:"column",gap:14,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div>
          <h1 style={{margin:0,font:"600 22px/1 var(--font)",letterSpacing:-0.3,display:"flex",alignItems:"center",gap:10}}>Team stream <LiveDot color="var(--success)" size={8}/></h1>
          <div style={{font:"400 13px/1 var(--font)",color:"var(--fg-3)",marginTop:6}}>{allSess.filter(s=>s.status==="running"||s.status==="thinking").length} live sessions across {new Set(allSess.map(s=>s.user)).size} members</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <Chip active={filter==="all"} onClick={()=>setFilter("all")}>All ({allSess.length})</Chip>
          {Object.values(AGENTS).filter(a=>allSess.some(s=>s.agent===a.id)).map(a=>{
            const n = allSess.filter(s=>s.agent===a.id).length;
            return <Chip key={a.id} active={filter===a.id} onClick={()=>setFilter(a.id)} color={a.color}>{a.short} ({n})</Chip>;
          })}
        </div>
      </div>
      <div style={{flex:1,minHeight:0,display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(520px, 1fr))",gridAutoRows:"minmax(320px, 1fr)",gap:14,overflow:"auto"}}>
        {filtered.map(s=>(
          <Terminal key={s.id} session={s}/>
        ))}
      </div>
    </div>
  );
}

// ============== MEMBERS — pick a person, see their day ==============
function MembersScreen() {
  const [selected, setSelected] = uS(TEAM[0].id);
  const user = TEAM.find(u=>u.id===selected);
  const userSessions = (SESSIONS_BY_USER[selected]||[]).map(id=>SESSIONS[id]);
  const userStories = STORIES.filter(s=>s.assignee===selected);

  return (
    <div style={{display:"grid",gridTemplateColumns:"280px 1fr",height:"100%",overflow:"hidden"}}>
      {/* LEFT — member list */}
      <div style={{borderRight:"1px solid var(--border)",overflow:"auto",background:"var(--surface)"}}>
        <div style={{padding:"16px 18px 10px",borderBottom:"1px solid var(--border)",position:"sticky",top:0,background:"var(--surface)",zIndex:1}}>
          <div style={{font:"600 13px/1 var(--font)",marginBottom:3}}>Members</div>
          <div style={{font:"400 12px/1 var(--font)",color:"var(--fg-3)"}}>{TEAM.filter(u=>u.status==="active").length} online</div>
        </div>
        {TEAM.map(u=>{
          const active = selected===u.id;
          const nSess = (SESSIONS_BY_USER[u.id]||[]).length;
          const nStories = STORIES.filter(s=>s.assignee===u.id && s.status!=="done").length;
          return (
            <button key={u.id} onClick={()=>setSelected(u.id)} style={{
              width:"100%",textAlign:"left",padding:"10px 18px",border:"none",
              background: active?"var(--bg-2)":"transparent",borderLeft:active?"3px solid var(--accent)":"3px solid transparent",
              cursor:"pointer",display:"flex",alignItems:"center",gap:12,
            }}>
              <Avatar user={u} size={32} dot/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{font:"500 13px/1.3 var(--font)",color:"var(--fg)"}}>{u.name}</div>
                <div style={{font:"400 11.5px/1.3 var(--font)",color:"var(--fg-3)",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.role}</div>
              </div>
              {nSess>0 && <span style={{padding:"2px 7px",background:"var(--bg-2)",borderRadius:10,font:"600 10.5px/1.4 var(--mono)",color:"var(--fg-2)"}}>{nSess}</span>}
            </button>
          );
        })}
      </div>

      {/* RIGHT — detail */}
      <div style={{overflow:"auto"}}>
        <div style={{padding:"24px 28px 20px",borderBottom:"1px solid var(--border)"}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <Avatar user={user} size={56} dot ring/>
            <div style={{flex:1}}>
              <h1 style={{margin:"0 0 4px",font:"600 22px/1.2 var(--font)",letterSpacing:-0.3}}>{user.name}</h1>
              <div style={{display:"flex",alignItems:"center",gap:10,font:"400 13px/1 var(--font)",color:"var(--fg-3)"}}>
                <span>@{user.handle}</span><span>·</span><span>{user.role}</span><span>·</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:5,font:"500 12px/1 var(--mono)"}}>
                  <Icon name="cpu" size={11}/>{user.machine}
                </span>
              </div>
            </div>
            <Button variant="secondary" size="default" icon={<Icon name="external" size={13}/>}>Pair</Button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginTop:20}}>
            {[
              { label:"Active sessions", value: userSessions.filter(s=>s.status!=="offline").length, accent:"#10b981" },
              { label:"Assigned stories", value: userStories.filter(s=>s.status!=="done").length, accent:"#6366f1" },
              { label:"Done this week", value: STORIES.filter(s=>s.assignee===selected && s.status==="done").length, accent:"#a855f7" },
              { label:"Points in flight", value: userStories.filter(s=>s.status==="in_progress").reduce((a,b)=>a+b.points,0), accent:"#f59e0b" },
            ].map((m,i)=>(
              <div key={i} style={{padding:"12px 14px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)"}}>
                <div style={{font:"500 11.5px/1 var(--font)",color:"var(--fg-3)",marginBottom:8,letterSpacing:0.2}}>{m.label}</div>
                <div style={{font:"600 22px/1 var(--font)",color:m.accent,letterSpacing:-0.5}}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sessions grid */}
        <div style={{padding:"20px 28px 12px"}}>
          <h3 style={{margin:"0 0 12px",font:"600 13px/1 var(--font)",color:"var(--fg)",display:"flex",alignItems:"center",gap:8}}>
            Active sessions <span style={{padding:"1px 7px",background:"var(--bg-2)",borderRadius:10,font:"500 11.5px/1.5 var(--mono)",color:"var(--fg-3)"}}>{userSessions.length}</span>
          </h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(380px, 1fr))",gap:12,minHeight:300}}>
            {userSessions.map(s=>(
              <div key={s.id} style={{height:300}}>
                <Terminal session={s} compact/>
              </div>
            ))}
          </div>
        </div>

        {/* Stories + today timeline */}
        <div style={{padding:"8px 28px 28px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div>
            <h3 style={{margin:"12px 0 10px",font:"600 13px/1 var(--font)"}}>Assigned stories</h3>
            <Card>
              {userStories.length===0 && <div style={{padding:"18px 16px",font:"400 13px/1.4 var(--font)",color:"var(--fg-3)",textAlign:"center"}}>No stories assigned</div>}
              {userStories.map((s,i)=>(
                <div key={s.id} style={{padding:"10px 14px",borderBottom:i<userStories.length-1?"1px solid var(--border)":"none",display:"flex",alignItems:"center",gap:10}}>
                  <StatusIcon status={s.status} size={14}/>
                  <StoryId id={s.id}/>
                  <span style={{flex:1,font:"500 12.5px/1.3 var(--font)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.title}</span>
                  <Priority level={s.priority}/>
                </div>
              ))}
            </Card>
          </div>
          <div>
            <h3 style={{margin:"12px 0 10px",font:"600 13px/1 var(--font)"}}>Today</h3>
            <Card style={{padding:"4px 0"}}>
              {[
                { t:"09:14", text:"Stand-up notes", kind:"note" },
                { t:"11:25", text:"Opened Claude Code on HIV-138", kind:"start" },
                { t:"13:04", text:"Committed ClusterHealth.tsx · +112 −8", kind:"commit" },
                { t:"15:10", text:"Left review comment on PR #441", kind:"review" },
                { t:"15:40", text:"Live · thinking about smoothed IOPS values", kind:"live" },
              ].map((e,i,arr)=>(
                <div key={i} style={{padding:"8px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{font:"500 11.5px/1.5 var(--mono)",color:"var(--fg-3)",width:38}}>{e.t}</span>
                  <span style={{marginTop:5,width:6,height:6,borderRadius:6,background: e.kind==="live"?"var(--success)":"var(--border-2)"}}/>
                  <span style={{flex:1,font:"400 12.5px/1.4 var(--font)",color:"var(--fg-2)"}}>{e.text}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== COMPUTE / NODES ==============
function ComputeScreen() {
  const nodes = TEAM.map(u=>{
    const sess = SESSIONS_BY_USER[u.id]||[];
    const cpu = u.status==="active" ? 20 + Math.floor(Math.random()*60) : u.status==="idle" ? 4+Math.floor(Math.random()*8) : 0;
    const ram = u.status==="offline"?0:30+Math.floor(Math.random()*50);
    return { user:u, sess, cpu, ram, gpu:u.machine.includes("mbp-m3")||u.machine.includes("mac-studio") ? "M3 Max / 40c" : u.machine.includes("ws")? "RTX 4090" : "none", rtt: u.status==="offline"?null:12+Math.floor(Math.random()*80) };
  });
  return (
    <div style={{padding:"20px 24px",height:"100%",display:"flex",flexDirection:"column",gap:18,overflow:"auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h1 style={{margin:0,font:"600 22px/1 var(--font)",letterSpacing:-0.3}}>Compute mesh</h1>
          <div style={{font:"400 13px/1 var(--font)",color:"var(--fg-3)",marginTop:6}}>Team machines pooled as an agent-schedulable fabric · {nodes.filter(n=>n.user.status==="active").length} of {nodes.length} online</div>
        </div>
        <Button variant="secondary" icon={<Icon name="plug" size={14}/>}>Connect my machine</Button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(340px, 1fr))",gap:12}}>
        {nodes.map(n=>(
          <Card key={n.user.id} style={{padding:16}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <Avatar user={n.user} size={30} dot/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{font:"500 13px/1.2 var(--font)"}}>{n.user.name}</div>
                <div style={{font:"500 11.5px/1 var(--mono)",color:"var(--fg-3)",marginTop:2}}>{n.user.machine}</div>
              </div>
              {n.sess.length>0 && <span style={{padding:"2px 7px",background:"var(--bg-2)",borderRadius:10,font:"500 11px/1.5 var(--mono)",color:"var(--fg-2)",display:"inline-flex",alignItems:"center",gap:4}}>
                <LiveDot size={5}/>{n.sess.length}
              </span>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <ResBar label="CPU" value={n.cpu} color="#6366f1"/>
              <ResBar label="RAM" value={n.ram} color="#a855f7"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14,paddingTop:12,borderTop:"1px dashed var(--border)"}}>
              <div>
                <div style={{font:"500 10.5px/1 var(--font)",color:"var(--fg-3)",letterSpacing:0.3,textTransform:"uppercase",marginBottom:4}}>Accelerator</div>
                <div style={{font:"500 12px/1.3 var(--mono)",color:"var(--fg)"}}>{n.gpu}</div>
              </div>
              <div>
                <div style={{font:"500 10.5px/1 var(--font)",color:"var(--fg-3)",letterSpacing:0.3,textTransform:"uppercase",marginBottom:4}}>RTT</div>
                <div style={{font:"500 12px/1.3 var(--mono)",color:n.rtt===null?"var(--fg-4)":"var(--fg)"}}>{n.rtt===null?"—":`${n.rtt}ms`}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ResBar({ label, value, color }) {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",font:"500 11.5px/1 var(--font)",marginBottom:5}}>
        <span style={{color:"var(--fg-3)"}}>{label}</span>
        <span style={{font:"500 11.5px/1 var(--mono)",color:"var(--fg-2)"}}>{value}%</span>
      </div>
      <ProgressBar value={value} total={100} color={color} height={5}/>
    </div>
  );
}

// ============== OVERVIEW ==============
function OverviewScreen() {
  const totalPts = STORIES.reduce((a,b)=>a+(b.points||0),0);
  const donePts = STORIES.filter(s=>s.status==="done").reduce((a,b)=>a+(b.points||0),0);
  const inProgress = STORIES.filter(s=>s.status==="in_progress").length;
  const liveSess = Object.values(SESSIONS).filter(s=>s.status==="running"||s.status==="thinking").length;

  // simple burnup data
  const burnup = [2,5,8,11,13,15,18,donePts];

  return (
    <div style={{padding:"20px 24px",height:"100%",overflow:"auto",display:"flex",flexDirection:"column",gap:18}}>
      <div>
        <h1 style={{margin:0,font:"600 22px/1 var(--font)",letterSpacing:-0.3}}>Overview</h1>
        <div style={{font:"400 13px/1 var(--font)",color:"var(--fg-3)",marginTop:6}}>Sprint 24 · Day 6 of 10</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {[
          { label:"Sprint progress", value:`${Math.round(donePts/totalPts*100)}%`, sub:`${donePts} / ${totalPts} pts`, color:"#10b981" },
          { label:"In progress", value:inProgress, sub:"stories active", color:"#6366f1" },
          { label:"Live sessions", value:liveSess, sub:"agents working", color:"#a855f7" },
          { label:"Avg cycle time", value:"1.8d", sub:"−0.4d vs last sprint", color:"#f59e0b" },
        ].map((k,i)=>(
          <Card key={i} style={{padding:16}}>
            <div style={{font:"500 11.5px/1 var(--font)",color:"var(--fg-3)",marginBottom:10,letterSpacing:0.2,textTransform:"uppercase"}}>{k.label}</div>
            <div style={{font:"600 28px/1 var(--font)",color:k.color,letterSpacing:-0.6,marginBottom:6}}>{k.value}</div>
            <div style={{font:"400 12px/1 var(--font)",color:"var(--fg-3)"}}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:16}}>
        {/* Burnup */}
        <Card style={{padding:18}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <h3 style={{margin:0,font:"600 13.5px/1 var(--font)"}}>Burnup</h3>
            <div style={{display:"flex",gap:14,font:"500 11.5px/1 var(--font)"}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:5,color:"var(--fg-2)"}}><span style={{width:10,height:2,background:"#10b981"}}/>Completed</span>
              <span style={{display:"inline-flex",alignItems:"center",gap:5,color:"var(--fg-2)"}}><span style={{width:10,height:2,borderTop:"1.5px dashed var(--fg-4)"}}/>Ideal</span>
            </div>
          </div>
          <BurnupChart data={burnup} total={totalPts}/>
        </Card>

        {/* Epics */}
        <Card style={{padding:18}}>
          <h3 style={{margin:"0 0 16px",font:"600 13.5px/1 var(--font)"}}>Epics</h3>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {EPICS.map(e=>(
              <div key={e.id}>
                <div style={{display:"flex",justifyContent:"space-between",font:"500 12.5px/1 var(--font)",marginBottom:6}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:7}}>
                    <span style={{width:8,height:8,borderRadius:2,background:e.color}}/>
                    {e.name}
                  </span>
                  <span style={{font:"500 11.5px/1 var(--mono)",color:"var(--fg-3)"}}>{e.progress}%</span>
                </div>
                <ProgressBar value={e.progress} total={100} color={e.color} height={5}/>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Team load */}
      <Card style={{padding:18}}>
        <h3 style={{margin:"0 0 16px",font:"600 13.5px/1 var(--font)"}}>Team load</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:14}}>
          {TEAM.map(u=>{
            const nSess = (SESSIONS_BY_USER[u.id]||[]).length;
            const pts = STORIES.filter(s=>s.assignee===u.id && s.status!=="done").reduce((a,b)=>a+b.points,0);
            return (
              <div key={u.id} style={{padding:"10px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <Avatar user={u} size={24} dot/>
                  <span style={{font:"500 12.5px/1 var(--font)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",font:"500 11px/1 var(--font)",color:"var(--fg-3)",marginBottom:4}}>
                  <span>{pts} pts</span>
                  <span>{nSess} sess</span>
                </div>
                <ProgressBar value={Math.min(pts,10)} total={10} color={`hsl(${u.hue} 65% 55%)`} height={4}/>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function BurnupChart({ data, total }) {
  const w = 600, h = 180, pad = 28;
  const max = total;
  const step = (w - pad*2) / (data.length - 1);
  const points = data.map((v,i)=> `${pad + step*i},${h - pad - (v/max)*(h - pad*2)}`).join(" ");
  const idealEnd = `${w - pad},${h - pad - ((total*0.95)/max)*(h - pad*2)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="none" style={{display:"block",maxHeight:180}}>
      {[0,0.25,0.5,0.75,1].map((r,i)=>(
        <line key={i} x1={pad} y1={h-pad-r*(h-pad*2)} x2={w-pad} y2={h-pad-r*(h-pad*2)} stroke="var(--border)" strokeDasharray={r===1?"":"2 3"}/>
      ))}
      <line x1={pad} y1={h-pad} x2={idealEnd.split(",")[0]} y2={idealEnd.split(",")[1]} stroke="var(--fg-4)" strokeWidth="1.5" strokeDasharray="4 3"/>
      <polyline points={points} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points={`${pad},${h-pad} ${points} ${w-pad},${h-pad}`} fill="#10b981" opacity="0.08"/>
      {data.map((v,i)=>(
        <circle key={i} cx={pad + step*i} cy={h - pad - (v/max)*(h - pad*2)} r={i===data.length-1?4:2.5} fill="#10b981" stroke="var(--surface)" strokeWidth="2"/>
      ))}
    </svg>
  );
}

// ============== CONNECT — onboarding ==============
function ConnectScreen() {
  const [step, setStep] = uS(1);
  const [agentId, setAgentId] = uS("claude");
  return (
    <div style={{padding:"40px 32px",height:"100%",overflow:"auto",display:"flex",justifyContent:"center"}}>
      <div style={{width:"100%",maxWidth:680}}>
        <div style={{marginBottom:28}}>
          <h1 style={{margin:"0 0 8px",font:"600 24px/1.2 var(--font)",letterSpacing:-0.4}}>Connect your machine</h1>
          <p style={{margin:0,font:"400 14px/1.5 var(--font)",color:"var(--fg-3)"}}>Link your local editor so Hive can schedule agent sessions on your hardware. Your code never leaves your machine.</p>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:28}}>
          {[1,2,3,4].map(n=>(
            <React.Fragment key={n}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:24,height:24,borderRadius:24,display:"inline-flex",alignItems:"center",justifyContent:"center",font:"600 12px/1 var(--font)",background:step>=n?"var(--accent)":"var(--bg-2)",color:step>=n?"#fff":"var(--fg-3)"}}>{step>n?<Icon name="check" size={13} strokeWidth={2.5}/>:n}</div>
                <span style={{font:"500 12.5px/1 var(--font)",color:step>=n?"var(--fg)":"var(--fg-3)"}}>{["Choose agent","Install bridge","Configure shares","Ready"][n-1]}</span>
              </div>
              {n<4 && <div style={{flex:1,height:1.5,background: step>n?"var(--accent)":"var(--border)"}}/>}
            </React.Fragment>
          ))}
        </div>

        <Card style={{padding:24}}>
          {step===1 && <>
            <h3 style={{margin:"0 0 4px",font:"600 16px/1 var(--font)"}}>Which editor or CLI do you use?</h3>
            <p style={{margin:"0 0 18px",font:"400 13px/1.5 var(--font)",color:"var(--fg-3)"}}>You can add more later. Hive schedules sessions on whatever agents you connect.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
              {Object.values(AGENTS).map(a=>(
                <button key={a.id} onClick={()=>setAgentId(a.id)} style={{
                  padding:"14px 16px",textAlign:"left",background:agentId===a.id?"var(--bg-2)":"var(--surface)",
                  border: agentId===a.id?`1.5px solid ${a.color}`:"1.5px solid var(--border)",borderRadius:"var(--radius)",
                  display:"flex",alignItems:"center",gap:12,cursor:"pointer",transition:"all 120ms",
                }}>
                  <span style={{width:36,height:36,borderRadius:8,background:a.color+"22",color:a.color,display:"inline-flex",alignItems:"center",justifyContent:"center",font:"600 16px/1 var(--font)"}}>{a.glyph}</span>
                  <div style={{flex:1}}>
                    <div style={{font:"600 13px/1.2 var(--font)"}}>{a.name}</div>
                    <div style={{font:"400 11.5px/1.3 var(--font)",color:"var(--fg-3)",marginTop:2}}>{a.id==="claude"?"Anthropic":a.id==="cursor"?"Anysphere":a.id==="codex"?"OpenAI":a.id==="local"?"Any editor via MCP":"Aider"}</div>
                  </div>
                  {agentId===a.id && <Icon name="check" size={16} color={a.color} strokeWidth={2.5}/>}
                </button>
              ))}
            </div>
          </>}

          {step===2 && <>
            <h3 style={{margin:"0 0 4px",font:"600 16px/1 var(--font)"}}>Install the Hive bridge</h3>
            <p style={{margin:"0 0 18px",font:"400 13px/1.5 var(--font)",color:"var(--fg-3)"}}>A small daemon that proxies agent I/O to your teammates.</p>
            <div style={{padding:"16px 18px",background:"#0f0f14",borderRadius:"var(--radius)",font:"500 13px/1.7 var(--mono)",color:"#d4d4d8"}}>
              <div style={{color:"#52525b"}}># macOS / Linux</div>
              <div><span style={{color:"#818cf8"}}>curl</span> -fsSL hive.sh/install <span style={{color:"#a1a1aa"}}>|</span> <span style={{color:"#818cf8"}}>sh</span></div>
              <div style={{marginTop:10,color:"#52525b"}}># then auth & link this workspace</div>
              <div><span style={{color:"#818cf8"}}>hive</span> login <span style={{color:"#a1a1aa"}}>&amp;&amp;</span> <span style={{color:"#818cf8"}}>hive</span> link acme-team</div>
            </div>
          </>}

          {step===3 && <>
            <h3 style={{margin:"0 0 4px",font:"600 16px/1 var(--font)"}}>Configure shares</h3>
            <p style={{margin:"0 0 18px",font:"400 13px/1.5 var(--font)",color:"var(--fg-3)"}}>Decide what teammates can do with your machine.</p>
            {[
              { label:"Allow teammates to view my live sessions", on:true },
              { label:"Allow scheduled agent jobs on my machine", on:true },
              { label:"Allow remote terminal control (requires my approval)", on:false },
              { label:"Share GPU for distributed inference", on:false },
            ].map((x,i)=>(
              <label key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderTop:i===0?"none":"1px solid var(--border)"}}>
                <span style={{flex:1,font:"500 13px/1.3 var(--font)",color:"var(--fg)"}}>{x.label}</span>
                <span style={{width:36,height:20,borderRadius:20,background:x.on?"var(--accent)":"var(--border-2)",position:"relative",transition:"background 120ms"}}>
                  <span style={{position:"absolute",top:2,left:x.on?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",boxShadow:"var(--shadow-sm)",transition:"left 120ms"}}/>
                </span>
              </label>
            ))}
          </>}

          {step===4 && <div style={{textAlign:"center",padding:"24px 12px"}}>
            <div style={{width:60,height:60,borderRadius:60,background:"#ecfdf5",color:"#10b981",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
              <Icon name="check" size={28} strokeWidth={2.5}/>
            </div>
            <h3 style={{margin:"0 0 8px",font:"600 18px/1.2 var(--font)"}}>You're connected</h3>
            <p style={{margin:"0 auto 0",maxWidth:380,font:"400 13.5px/1.6 var(--font)",color:"var(--fg-3)"}}>Your machine <span style={{font:"500 12.5px/1 var(--mono)",color:"var(--fg)"}}>mbp-m3-max</span> is now schedulable. Claim a story from the backlog to open your first Hive-managed session.</p>
          </div>}

          <div style={{display:"flex",justifyContent:"space-between",marginTop:24,paddingTop:18,borderTop:"1px solid var(--border)"}}>
            <Button variant="ghost" onClick={()=>setStep(Math.max(1,step-1))} disabled={step===1}>Back</Button>
            <Button variant="primary" onClick={()=>setStep(Math.min(4,step+1))} iconRight={step<4 && <Icon name="chevron" size={13}/>}>
              {step===4 ? "Go to board" : "Continue"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { CurrentStoryScreen, BoardScreen, BacklogScreen, TeamStreamScreen, MembersScreen, ComputeScreen, OverviewScreen, ConnectScreen, useLocalState });
