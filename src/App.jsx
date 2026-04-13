import { useState, useEffect, useCallback } from "react";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap";
document.head.appendChild(fontLink);

const CATEGORIES = [
  { id: "serie-seul",     label: "Série",          sub: "Seul",      color: "#4f46e5", bg: "#eef2ff" },
  { id: "divert-seul",   label: "Divertissement", sub: "Seul",      color: "#b45309", bg: "#fefce8" },
  { id: "serie-couple",  label: "Série",          sub: "En couple", color: "#be185d", bg: "#fdf2f8" },
  { id: "divert-couple", label: "Divertissement", sub: "En couple", color: "#047857", bg: "#f0fdf4" },
  { id: "serie-fille",   label: "Série",          sub: "Fille",     color: "#7c3aed", bg: "#f5f3ff" },
  { id: "divert-fille",  label: "Divertissement", sub: "Fille",     color: "#c2410c", bg: "#fff7ed" },
];

// ── Storage (localStorage) ─────────────────────────────────────────────────
function loadList() {
  try {
    const raw = localStorage.getItem("watchlist-v5");
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}
function saveList(list) {
  try { localStorage.setItem("watchlist-v5", JSON.stringify(list)); } catch(e) {}
}

// ── API (via secure Vercel proxy) ──────────────────────────────────────────
function extractJSON(raw) {
  var s = raw.trim();
  try { var r = JSON.parse(s); return Array.isArray(r) ? r : [r]; } catch(e) {}
  s = s.replace(/```json|```/g, "").trim();
  try { var r = JSON.parse(s); return Array.isArray(r) ? r : [r]; } catch(e) {}
  var m = s.match(/\[[\s\S]*\]/);
  if (m) { try { var r = JSON.parse(m[0]); return Array.isArray(r) ? r : [r]; } catch(e) {} }
  return null;
}

async function searchMedia(query, type) {
  var isSeries = type === "series";
  var prompt = "You are a film/TV encyclopedia. Reply ONLY with a raw JSON array (start [, end ], no markdown).\n"
    + "Return 1-5 results for: " + query + "\n"
    + "Each object: title, originalTitle, year (integer), type (\"" + type + "\"), "
    + "genres (array), director, cast (5 names array), synopsis (French 2-4 sentences), "
    + "rating (\"8.1/10 IMDb\"), duration (\"45min/ep\" or \"2h10\"), country, "
    + (isSeries ? "seasons (integer), seasonsList ([{number,episodeCount,year}])"
                : "seasons (null), seasonsList ([])");

  var res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  var text = await res.text();
  var data;
  try { data = JSON.parse(text); } catch(e) { throw new Error("Réponse invalide du serveur"); }
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

  var content = (data.content || []).filter(function(b) { return b.type === "text"; }).map(function(b) { return b.text; }).join("\n");
  var results = extractJSON(content);
  if (!results || !results.length) throw new Error("Aucun résultat parsé");
  return results;
}

function getCat(id) { return CATEGORIES.find(function(c) { return c.id === id; }); }

// ── MovieCard ──────────────────────────────────────────────────────────────
function MovieCard({ item, onClick }) {
  var [hover, setHover] = useState(false);
  var cat = getCat(item.category);
  return (
    <div onClick={onClick} onMouseEnter={function(){setHover(true);}} onMouseLeave={function(){setHover(false);}}
      style={{ cursor:"pointer", background:"white", borderRadius:14, padding:"14px 16px",
        boxShadow: hover ? "0 8px 24px rgba(0,0,0,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition:"all 0.2s", display:"flex", alignItems:"center", gap:14, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ width:4, flexShrink:0, alignSelf:"stretch", borderRadius:4, background: cat ? cat.color : "#e5e7eb" }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:5 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:"0.95rem", color:"#111827", lineHeight:1.3, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{item.title}</div>
          {item.watched && <span style={{ flexShrink:0, width:22, height:22, borderRadius:"50%", background:"#10b981", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"0.75rem" }}>✓</span>}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:6 }}>
          <span style={{ background: item.type==="series"?"#1e1b4b":"#78350f", color:"white", borderRadius:5, padding:"1px 7px", fontSize:"0.62rem", fontWeight:700 }}>
            {item.type==="series"?"SÉRIE":"FILM"}
          </span>
          {item.year && <span style={{ fontSize:"0.75rem", color:"#9ca3af" }}>{item.year}</span>}
          {item.type==="series" && item.seasons && <span style={{ fontSize:"0.75rem", color:"#9ca3af" }}>{item.seasons} saison{item.seasons>1?"s":""}</span>}
          {item.rating && <span style={{ fontSize:"0.75rem", color:"#f59e0b" }}>⭐ {item.rating}</span>}
          {cat && <span style={{ background:cat.bg, color:cat.color, borderRadius:5, padding:"1px 7px", fontSize:"0.65rem", fontWeight:700 }}>{cat.sub}</span>}
        </div>
        {item.genres && item.genres.length > 0 && (
          <div style={{ marginTop:5, fontSize:"0.72rem", color:"#9ca3af" }}>{item.genres.slice(0,3).join(" · ")}</div>
        )}
      </div>
      <div style={{ flexShrink:0, color:"#d1d5db", fontSize:"1.2rem" }}>›</div>
    </div>
  );
}

// ── AddModal ───────────────────────────────────────────────────────────────
function AddModal({ onAdd, onClose }) {
  var [query, setQuery] = useState("");
  var [mediaType, setMediaType] = useState("series");
  var [category, setCategory] = useState(CATEGORIES[0].id);
  var [results, setResults] = useState([]);
  var [selected, setSelected] = useState(null);
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState("");

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true); setError(""); setResults([]); setSelected(null);
    try {
      var found = await searchMedia(query, mediaType);
      if (!found || !found.length) setError("Aucun résultat. Essayez d'autres mots-clés.");
      else { setResults(found); if (found.length === 1) setSelected(found[0]); }
    } catch(e) { setError("Erreur : " + e.message); }
    setLoading(false);
  }

  function handleAdd() {
    if (!selected) return;
    onAdd({ ...selected, category, id: Date.now().toString(), addedAt: new Date().toISOString(), watched: false, watchedSeasons: [] });
    onClose();
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:1000, backdropFilter:"blur(6px)" }}>
      <div style={{ background:"white", borderRadius:"24px 24px 0 0", width:"100%", maxWidth:640, maxHeight:"94vh", overflow:"auto", padding:"28px 20px 40px", fontFamily:"'DM Sans',sans-serif" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h2 style={{ margin:0, fontFamily:"'Playfair Display',serif", fontSize:"1.4rem", color:"#111827" }}>Ajouter un titre</h2>
          <button onClick={onClose} style={{ background:"#f3f4f6", border:"none", borderRadius:"50%", width:34, height:34, cursor:"pointer", color:"#6b7280", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>

        <div style={{ display:"flex", background:"#f3f4f6", borderRadius:12, padding:4, marginBottom:18 }}>
          {[{v:"series",l:"📺 Série"},{v:"movie",l:"🎬 Film"}].map(function(x){ return (
            <button key={x.v} onClick={function(){ setMediaType(x.v); }} style={{ flex:1, padding:"9px 0", border:"none", borderRadius:9, fontWeight:600, cursor:"pointer", background:mediaType===x.v?"white":"transparent", color:mediaType===x.v?"#111827":"#9ca3af", boxShadow:mediaType===x.v?"0 1px 4px rgba(0,0,0,0.1)":"none", fontSize:"0.88rem", fontFamily:"'DM Sans',sans-serif" }}>{x.l}</button>
          ); })}
        </div>

        <div style={{ marginBottom:18 }}>
          <p style={{ margin:"0 0 10px", fontSize:"0.7rem", fontWeight:700, color:"#9ca3af", letterSpacing:"1px" }}>CATÉGORIE</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
            {CATEGORIES.map(function(cat){ return (
              <button key={cat.id} onClick={function(){ setCategory(cat.id); }} style={{ padding:"6px 13px", border:"2px solid "+(category===cat.id?cat.color:"#e5e7eb"), background:category===cat.id?cat.bg:"white", color:category===cat.id?cat.color:"#6b7280", borderRadius:9, cursor:"pointer", fontWeight:600, fontSize:"0.74rem", fontFamily:"'DM Sans',sans-serif" }}>
                {cat.label==="Série"?"📺":"🎬"} {cat.label} · {cat.sub}
              </button>
            ); })}
          </div>
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          <input value={query} onChange={function(e){ setQuery(e.target.value); }} onKeyDown={function(e){ if(e.key==="Enter") handleSearch(); }}
            placeholder="Titre, mots-clés…"
            style={{ flex:1, padding:"12px 16px", border:"2px solid #e5e7eb", borderRadius:11, fontSize:"0.93rem", outline:"none", color:"#111827", fontFamily:"'DM Sans',sans-serif" }}
            onFocus={function(e){ e.target.style.borderColor="#4f46e5"; }} onBlur={function(e){ e.target.style.borderColor="#e5e7eb"; }}
          />
          <button onClick={handleSearch} disabled={loading||!query.trim()} style={{ padding:"12px 18px", background:loading||!query.trim()?"#e5e7eb":"#4f46e5", color:loading||!query.trim()?"#9ca3af":"white", border:"none", borderRadius:11, fontWeight:700, cursor:loading||!query.trim()?"not-allowed":"pointer", fontSize:"0.95rem" }}>
            {loading?"⏳":"🔍"}
          </button>
        </div>

        {loading && <div style={{ textAlign:"center", padding:"20px 0", color:"#9ca3af", fontSize:"0.88rem" }}>Recherche en cours…</div>}
        {error && <div style={{ color:"#b91c1c", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"12px 14px", fontSize:"0.84rem", marginBottom:14, wordBreak:"break-word" }}>{error}</div>}

        {results.length > 1 && !selected && (
          <div style={{ marginBottom:16 }}>
            <p style={{ margin:"0 0 10px", fontSize:"0.7rem", fontWeight:700, color:"#9ca3af", letterSpacing:"1px" }}>{results.length} RÉSULTATS — CHOISISSEZ</p>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {results.map(function(r, i){ return (
                <div key={i} onClick={function(){ setSelected(r); }}
                  style={{ cursor:"pointer", padding:"12px 14px", borderRadius:11, border:"1.5px solid #e5e7eb", background:"white", display:"flex", justifyContent:"space-between", alignItems:"center" }}
                  onMouseEnter={function(e){ e.currentTarget.style.borderColor="#4f46e5"; }}
                  onMouseLeave={function(e){ e.currentTarget.style.borderColor="#e5e7eb"; }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:"0.88rem", color:"#111827" }}>{r.title}</div>
                    <div style={{ fontSize:"0.74rem", color:"#9ca3af", marginTop:2 }}>
                      {[r.year, r.country, r.type==="series"&&r.seasons?r.seasons+" saisons":null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span style={{ color:"#d1d5db", fontSize:"1.1rem" }}>›</span>
                </div>
              ); })}
            </div>
          </div>
        )}

        {selected && (
          <div style={{ border:"2px solid #4f46e5", borderRadius:14, padding:16, marginBottom:16, background:"#fafafe" }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:"1.1rem", color:"#111827", marginBottom:4 }}>{selected.title}</div>
            {selected.originalTitle && selected.originalTitle !== selected.title && (
              <div style={{ fontSize:"0.72rem", color:"#9ca3af", marginBottom:6, fontStyle:"italic" }}>{selected.originalTitle}</div>
            )}
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
              {[selected.year, selected.country, selected.duration, selected.rating?"⭐ "+selected.rating:null].filter(Boolean).map(function(v,i){ return <span key={i} style={{ fontSize:"0.77rem", color:"#6b7280" }}>{v}</span>; })}
            </div>
            {selected.genres && selected.genres.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
                {selected.genres.slice(0,4).map(function(g,i){ return <span key={i} style={{ background:"#f3f4f6", color:"#6b7280", borderRadius:5, padding:"2px 8px", fontSize:"0.68rem", fontWeight:600 }}>{g}</span>; })}
              </div>
            )}
            {selected.director && <div style={{ fontSize:"0.8rem", color:"#374151", marginBottom:4 }}><b>Réal. :</b> {selected.director}</div>}
            {selected.cast && selected.cast.length > 0 && <div style={{ fontSize:"0.8rem", color:"#374151", marginBottom:8 }}><b>Avec :</b> {selected.cast.slice(0,4).join(", ")}</div>}
            {selected.synopsis && <p style={{ margin:"0 0 8px", fontSize:"0.8rem", color:"#4b5563", lineHeight:1.6 }}>{selected.synopsis}</p>}
            {selected.type==="series" && selected.seasonsList && selected.seasonsList.length > 0 && (
              <div style={{ fontSize:"0.76rem", color:"#6b7280" }}>
                📺 {selected.seasonsList.length} saison{selected.seasonsList.length>1?"s":""} · {selected.seasonsList.reduce(function(a,s){return a+(s.episodeCount||0);},0)} épisodes
              </div>
            )}
            {results.length > 1 && (
              <button onClick={function(){ setSelected(null); }} style={{ marginTop:10, background:"none", border:"1px solid #e5e7eb", borderRadius:7, padding:"4px 12px", cursor:"pointer", fontSize:"0.72rem", color:"#6b7280", fontFamily:"'DM Sans',sans-serif" }}>← Autre résultat</button>
            )}
          </div>
        )}

        {selected && (
          <button onClick={handleAdd} style={{ width:"100%", padding:14, background:"#4f46e5", color:"white", border:"none", borderRadius:12, fontWeight:700, fontSize:"0.97rem", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 4px 16px rgba(79,70,229,0.3)" }}>
            Ajouter à la Watch List ✓
          </button>
        )}
      </div>
    </div>
  );
}

// ── DetailModal ────────────────────────────────────────────────────────────
function DetailModal({ item, onClose, onDelete, onToggleWatched, onToggleSeason }) {
  var cat = getCat(item.category);
  var allDone = item.seasonsList && item.seasonsList.length > 0 &&
    item.seasonsList.every(function(s){ return item.watchedSeasons && item.watchedSeasons.includes(s.number); });

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"flex-start", justifyContent:"center", zIndex:1000, overflow:"auto", backdropFilter:"blur(6px)", padding:"20px 12px 40px" }}>
      <div style={{ background:"white", borderRadius:20, width:"100%", maxWidth:640, overflow:"hidden", marginTop:8, fontFamily:"'DM Sans',sans-serif" }}>

        <div style={{ background: cat ? cat.bg : "#f9fafb", padding:"24px 20px 20px", borderBottom:"1px solid #f0f0f0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                <span style={{ background:item.type==="series"?"#1e1b4b":"#78350f", color:"white", borderRadius:6, padding:"3px 10px", fontSize:"0.63rem", fontWeight:700 }}>{item.type==="series"?"SÉRIE":"FILM"}</span>
                {cat && <span style={{ background:cat.color, color:"white", borderRadius:6, padding:"3px 10px", fontSize:"0.63rem", fontWeight:700 }}>{cat.sub}</span>}
                {item.watched && <span style={{ background:"#065f46", color:"white", borderRadius:6, padding:"3px 10px", fontSize:"0.63rem", fontWeight:700 }}>✓ VU</span>}
              </div>
              <h2 style={{ margin:"0 0 4px", fontFamily:"'Playfair Display',serif", color:"#111827", fontSize:"1.45rem", fontWeight:900, lineHeight:1.2 }}>{item.title}</h2>
              {item.originalTitle && item.originalTitle !== item.title && (
                <p style={{ margin:"0 0 6px", color:"#9ca3af", fontSize:"0.78rem", fontStyle:"italic" }}>{item.originalTitle}</p>
              )}
              <p style={{ margin:0, color:"#6b7280", fontSize:"0.82rem" }}>
                {[item.year, item.country, item.duration, item.rating?"⭐ "+item.rating:""].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button onClick={onClose} style={{ flexShrink:0, marginLeft:12, background:"rgba(0,0,0,0.08)", border:"none", borderRadius:"50%", width:36, height:36, cursor:"pointer", color:"#374151", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
          </div>
        </div>

        <div style={{ padding:"20px 20px 24px" }}>
          {item.genres && item.genres.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
              {item.genres.map(function(g,i){ return <span key={i} style={{ background:"#f3f4f6", color:"#374151", borderRadius:6, padding:"4px 11px", fontSize:"0.74rem", fontWeight:600 }}>{g}</span>; })}
            </div>
          )}
          {item.director && <div style={{ marginBottom:6, fontSize:"0.84rem", color:"#374151" }}><b>Réalisateur :</b> {item.director}</div>}
          {item.cast && item.cast.length > 0 && <div style={{ marginBottom:14, fontSize:"0.84rem", color:"#374151" }}><b>Avec :</b> {item.cast.slice(0,5).join(", ")}</div>}
          {item.synopsis && (
            <div style={{ marginBottom:20 }}>
              <p style={{ margin:"0 0 6px", fontSize:"0.68rem", fontWeight:700, color:"#9ca3af", letterSpacing:"1px" }}>SYNOPSIS</p>
              <p style={{ margin:0, fontSize:"0.86rem", color:"#4b5563", lineHeight:1.65 }}>{item.synopsis}</p>
            </div>
          )}

          {item.type==="series" && item.seasonsList && item.seasonsList.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <p style={{ margin:0, fontSize:"0.68rem", fontWeight:700, color:"#9ca3af", letterSpacing:"1px" }}>SAISONS · {(item.watchedSeasons||[]).length}/{item.seasonsList.length} vues</p>
                {allDone && <span style={{ fontSize:"0.7rem", color:"#059669", fontWeight:700 }}>✓ Série terminée</span>}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {item.seasonsList.map(function(s,i){
                  var seen = item.watchedSeasons && item.watchedSeasons.includes(s.number);
                  return (
                    <div key={i} onClick={function(){ onToggleSeason(item.id, s.number); }}
                      style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderRadius:10, background:seen?"#f0fdf4":"#f9fafb", border:"1.5px solid "+(seen?"#bbf7d0":"#e5e7eb"), cursor:"pointer" }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:"0.84rem", color:"#111827" }}>Saison {s.number}{s.year?" ("+s.year+")":""}</div>
                        <div style={{ fontSize:"0.71rem", color:"#9ca3af" }}>{s.episodeCount} épisode{s.episodeCount>1?"s":""}</div>
                      </div>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:seen?"#10b981":"white", border:"2px solid "+(seen?"#10b981":"#d1d5db"), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"0.9rem", flexShrink:0 }}>
                        {seen?"✓":""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={function(){ onToggleWatched(item.id); }} style={{ flex:1, padding:"13px 0", background:item.watched?"#f0fdf4":"#4f46e5", color:item.watched?"#059669":"white", border:item.watched?"2px solid #bbf7d0":"none", borderRadius:11, fontWeight:700, cursor:"pointer", fontSize:"0.9rem", fontFamily:"'DM Sans',sans-serif" }}>
              {item.watched?"✓ Vu":"Marquer comme vu"}
            </button>
            <button onClick={function(){ onDelete(item.id); onClose(); }} style={{ padding:"13px 16px", background:"#fef2f2", color:"#dc2626", border:"2px solid #fecaca", borderRadius:11, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>🗑️</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  var [watchlist, setWatchlist] = useState(function(){ return loadList(); });
  var [activeCategory, setActiveCategory] = useState("all");
  var [showAdd, setShowAdd] = useState(false);
  var [detailItem, setDetailItem] = useState(null);
  var [filterWatched, setFilterWatched] = useState("all");

  var update = useCallback(function(nl){ setWatchlist(nl); saveList(nl); }, []);
  function handleAdd(item){ update([...watchlist, item]); }
  function handleDelete(id){ update(watchlist.filter(function(i){ return i.id!==id; })); }
  function handleToggleWatched(id){
    var nl=watchlist.map(function(i){ return i.id===id?{...i,watched:!i.watched}:i; });
    update(nl);
    setDetailItem(function(p){ return p&&p.id===id?{...p,watched:!p.watched}:p; });
  }
  function handleToggleSeason(id,num){
    var nl=watchlist.map(function(item){
      if(item.id!==id) return item;
      var ws=item.watchedSeasons||[];
      return {...item,watchedSeasons:ws.includes(num)?ws.filter(function(s){return s!==num;}):[...ws,num]};
    });
    update(nl);
    setDetailItem(function(p){ return p&&p.id===id?nl.find(function(i){return i.id===id;}):p; });
  }

  var total=watchlist.length, seen=watchlist.filter(function(i){return i.watched;}).length;
  var filtered=activeCategory==="all"?watchlist:watchlist.filter(function(i){return i.category===activeCategory;});
  if(filterWatched==="unwatched") filtered=filtered.filter(function(i){return !i.watched;});
  if(filterWatched==="watched") filtered=filtered.filter(function(i){return i.watched;});
  var counts={};
  watchlist.forEach(function(i){counts[i.category]=(counts[i.category]||0)+1;});

  return (
    <div style={{ minHeight:"100vh", background:"#f9fafb", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ background:"white", borderBottom:"1px solid #f0f0f0", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ maxWidth:680, margin:"0 auto", padding:"16px 18px 0" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div>
              <h1 style={{ margin:0, fontFamily:"'Playfair Display',serif", fontSize:"1.7rem", fontWeight:900, color:"#111827", letterSpacing:"-0.5px" }}>Watch List</h1>
              <p style={{ margin:"2px 0 0", fontSize:"0.76rem", color:"#9ca3af" }}>
                {total} titre{total!==1?"s":""} · {seen} vu{seen!==1?"s":""}{total>0&&seen>0?" · "+Math.round(seen/total*100)+"%":""}
              </p>
            </div>
            <button onClick={function(){ setShowAdd(true); }} style={{ background:"#4f46e5", color:"white", border:"none", borderRadius:12, padding:"10px 18px", fontWeight:700, cursor:"pointer", fontSize:"0.88rem", boxShadow:"0 4px 14px rgba(79,70,229,0.35)", fontFamily:"'DM Sans',sans-serif" }}>
              + Ajouter
            </button>
          </div>
          <div style={{ display:"flex", gap:1, overflowX:"auto", scrollbarWidth:"none" }}>
            {[{id:"all",label:"Tout",color:"#4f46e5"}, ...CATEGORIES].map(function(cat){
              var isAll=cat.id==="all", count=isAll?total:(counts[cat.id]||0), active=activeCategory===cat.id;
              return (
                <button key={cat.id} onClick={function(){ setActiveCategory(cat.id); }}
                  style={{ padding:"8px 12px 11px", border:"none", background:"none", cursor:"pointer", fontWeight:active?700:500, color:active?cat.color:"#9ca3af", borderBottom:"2.5px solid "+(active?cat.color:"transparent"), fontSize:"0.77rem", whiteSpace:"nowrap", transition:"all 0.15s", fontFamily:"'DM Sans',sans-serif" }}>
                  {isAll?"Tout":(cat.label==="Série"?"📺 ":"🎬 ")+cat.label+" · "+cat.sub} {count>0?"("+count+")":""}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"14px 18px 0" }}>
        <div style={{ display:"flex", gap:7 }}>
          {[{v:"all",l:"Tous"},{v:"unwatched",l:"À voir"},{v:"watched",l:"Vus ✓"}].map(function(x){ return (
            <button key={x.v} onClick={function(){ setFilterWatched(x.v); }} style={{ padding:"5px 13px", border:"1.5px solid "+(filterWatched===x.v?"#4f46e5":"#e5e7eb"), borderRadius:8, background:filterWatched===x.v?"#eef2ff":"white", color:filterWatched===x.v?"#4f46e5":"#6b7280", fontWeight:600, cursor:"pointer", fontSize:"0.76rem", fontFamily:"'DM Sans',sans-serif" }}>{x.l}</button>
          ); })}
        </div>
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"16px 18px 48px" }}>
        {filtered.length===0 ? (
          <div style={{ textAlign:"center", padding:"80px 20px", color:"#9ca3af" }}>
            <div style={{ fontSize:"4rem", marginBottom:14 }}>🎬</div>
            <h3 style={{ margin:"0 0 8px", color:"#374151", fontFamily:"'Playfair Display',serif", fontWeight:700 }}>{total===0?"Votre liste est vide":"Aucun titre ici"}</h3>
            <p style={{ margin:"0 0 24px", fontSize:"0.88rem" }}>{total===0?"Commencez par ajouter un film ou une série !":"Changez de filtre."}</p>
            {total===0 && <button onClick={function(){ setShowAdd(true); }} style={{ background:"#4f46e5", color:"white", border:"none", borderRadius:12, padding:"12px 26px", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>+ Ajouter un titre</button>}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {filtered.map(function(item){ return <MovieCard key={item.id} item={item} onClick={function(){ setDetailItem(item); }} />; })}
          </div>
        )}
      </div>

      {showAdd && <AddModal onAdd={handleAdd} onClose={function(){ setShowAdd(false); }} />}
      {detailItem && <DetailModal item={detailItem} onClose={function(){ setDetailItem(null); }} onDelete={handleDelete} onToggleWatched={handleToggleWatched} onToggleSeason={handleToggleSeason} />}
    </div>
  );
}
