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

const IMG = "https://image.tmdb.org/t/p/w500";
const IMG_ORIG = "https://image.tmdb.org/t/p/w780";

// ── Storage ────────────────────────────────────────────────────────────────
function loadList() {
  try { const r = localStorage.getItem("watchlist-v6"); return r ? JSON.parse(r) : []; } catch(e) { return []; }
}
function saveList(list) {
  try { localStorage.setItem("watchlist-v6", JSON.stringify(list)); } catch(e) {}
}

// ── TMDB API ───────────────────────────────────────────────────────────────
async function tmdb(path, params) {
  const qs = params ? "&" + new URLSearchParams(params).toString() : "";
  const res = await fetch("/api/tmdb?path=" + encodeURIComponent(path) + qs);
  if (!res.ok) throw new Error("TMDB HTTP " + res.status);
  const data = await res.json();
  if (data.status_message) throw new Error(data.status_message);
  return data;
}

async function searchMedia(query, type) {
  const endpoint = type === "series" ? "search/tv" : "search/movie";
  const data = await tmdb(endpoint, { query, include_adult: false });
  if (!data.results || !data.results.length) return [];

  // Return up to 5 results with basic info
  return data.results.slice(0, 5).map(function(r) {
    return {
      tmdbId: r.id,
      title: type === "series" ? r.name : r.title,
      originalTitle: type === "series" ? r.original_name : r.original_title,
      year: type === "series"
        ? (r.first_air_date ? parseInt(r.first_air_date) : null)
        : (r.release_date ? parseInt(r.release_date) : null),
      type: type,
      posterUrl: r.poster_path ? IMG + r.poster_path : "",
      posterOriginal: r.poster_path ? IMG_ORIG + r.poster_path : "",
      synopsis: r.overview || "",
      rating: r.vote_average ? r.vote_average.toFixed(1) + "/10" : "",
      genres: [],
      director: "",
      cast: [],
      duration: "",
      country: "",
      seasons: null,
      seasonsList: [],
    };
  });
}

async function fetchDetails(item) {
  const isSeries = item.type === "series";
  const path = isSeries ? "tv/" + item.tmdbId : "movie/" + item.tmdbId;
  const append = isSeries ? "credits,external_ids" : "credits";
  const data = await tmdb(path, { append_to_response: append });

  // Cast & director
  const credits = data.credits || {};
  const cast = (credits.cast || []).slice(0, 5).map(function(c) { return c.name; });
  let director = "";
  if (!isSeries && credits.crew) {
    const d = credits.crew.find(function(c) { return c.job === "Director"; });
    if (d) director = d.name;
  }
  if (isSeries) {
    director = (data.created_by || []).map(function(c) { return c.name; }).join(", ");
  }

  // Genres
  const genres = (data.genres || []).map(function(g) { return g.name; });

  // Country
  const country = isSeries
    ? (data.origin_country && data.origin_country[0]) || ""
    : (data.production_countries && data.production_countries[0] ? data.production_countries[0].iso_3166_1 : "");

  // Duration
  let duration = "";
  if (!isSeries && data.runtime) duration = Math.floor(data.runtime / 60) + "h" + (data.runtime % 60 ? (data.runtime % 60) + "min" : "");
  if (isSeries && data.episode_run_time && data.episode_run_time[0]) duration = data.episode_run_time[0] + "min/ep";

  // Seasons
  let seasons = null, seasonsList = [];
  if (isSeries) {
    seasons = data.number_of_seasons || null;
    seasonsList = (data.seasons || [])
      .filter(function(s) { return s.season_number > 0; })
      .map(function(s) {
        return {
          number: s.season_number,
          episodeCount: s.episode_count,
          year: s.air_date ? parseInt(s.air_date) : null,
          posterUrl: s.poster_path ? IMG + s.poster_path : "",
        };
      });
  }

  return {
    ...item,
    genres,
    director,
    cast,
    duration,
    country,
    seasons,
    seasonsList,
    synopsis: data.overview || item.synopsis,
    posterUrl: data.poster_path ? IMG + data.poster_path : item.posterUrl,
    posterOriginal: data.poster_path ? IMG_ORIG + data.poster_path : item.posterOriginal,
    backdropUrl: data.backdrop_path ? "https://image.tmdb.org/t/p/w1280" + data.backdrop_path : "",
  };
}

function getCat(id) { return CATEGORIES.find(function(c) { return c.id === id; }); }

// ── Poster ─────────────────────────────────────────────────────────────────
const GRADS = [
  "linear-gradient(145deg,#1e1b4b,#4338ca)",
  "linear-gradient(145deg,#3b0764,#7e22ce)",
  "linear-gradient(145deg,#0c4a6e,#0369a1)",
  "linear-gradient(145deg,#14532d,#15803d)",
  "linear-gradient(145deg,#7f1d1d,#b91c1c)",
  "linear-gradient(145deg,#1c1917,#57534e)",
];
function gradFor(t) { var n=0; for(var i=0;i<(t||"").length;i++) n+=t.charCodeAt(i); return GRADS[n%GRADS.length]; }

function Poster({ url, title, style }) {
  const [err, setErr] = useState(false);
  const letters = (title||"?").split(" ").slice(0,2).map(function(w){return w[0];}).join("").toUpperCase();
  const base = { width:"100%", height:"100%", ...(style||{}) };
  if (!url || err) return (
    <div style={{ ...base, background:gradFor(title), display:"flex", alignItems:"center", justifyContent:"center",
      color:"rgba(255,255,255,0.85)", fontFamily:"'Playfair Display',serif", fontSize:"2.5rem", fontWeight:900 }}>
      {letters}
    </div>
  );
  return <img src={url} alt={title} onError={function(){setErr(true);}} style={{ ...base, objectFit:"cover" }} />;
}

// ── MovieCard ──────────────────────────────────────────────────────────────
function MovieCard({ item, onClick }) {
  const [hover, setHover] = useState(false);
  const cat = getCat(item.category);
  return (
    <div onClick={onClick} onMouseEnter={function(){setHover(true);}} onMouseLeave={function(){setHover(false);}}
      style={{ cursor:"pointer", background:"white", borderRadius:14, overflow:"hidden",
        boxShadow: hover?"0 12px 32px rgba(0,0,0,0.15)":"0 2px 8px rgba(0,0,0,0.07)",
        transform: hover?"translateY(-3px)":"translateY(0)", transition:"all 0.22s",
        display:"flex", fontFamily:"'DM Sans',sans-serif" }}>

      {/* Poster thumbnail */}
      <div style={{ width:72, flexShrink:0, position:"relative" }}>
        <Poster url={item.posterUrl} title={item.title} style={{ position:"absolute", inset:0 }} />
        <div style={{ paddingTop:"150%" }} />
        {item.watched && (
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:28, height:28, borderRadius:"50%", border:"2px solid #10b981", display:"flex", alignItems:"center", justifyContent:"center", color:"#10b981", fontSize:"0.9rem" }}>✓</div>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex:1, minWidth:0, padding:"12px 14px 12px 12px", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:6, marginBottom:5 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:"0.93rem", color:"#111827", lineHeight:1.3, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{item.title}</div>
            {item.watched && <span style={{ flexShrink:0, width:20, height:20, borderRadius:"50%", background:"#10b981", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"0.7rem" }}>✓</span>}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, alignItems:"center" }}>
            <span style={{ background:item.type==="series"?"#1e1b4b":"#78350f", color:"white", borderRadius:5, padding:"1px 7px", fontSize:"0.6rem", fontWeight:700 }}>
              {item.type==="series"?"SÉRIE":"FILM"}
            </span>
            {item.year && <span style={{ fontSize:"0.73rem", color:"#9ca3af" }}>{item.year}</span>}
            {item.type==="series" && item.seasons && <span style={{ fontSize:"0.73rem", color:"#9ca3af" }}>{item.seasons} saison{item.seasons>1?"s":""}</span>}
            {item.rating && <span style={{ fontSize:"0.73rem", color:"#f59e0b" }}>⭐ {item.rating}</span>}
            {cat && <span style={{ background:cat.bg, color:cat.color, borderRadius:5, padding:"1px 7px", fontSize:"0.63rem", fontWeight:700 }}>{cat.sub}</span>}
          </div>
          {item.genres && item.genres.length > 0 && (
            <div style={{ marginTop:4, fontSize:"0.7rem", color:"#9ca3af" }}>{item.genres.slice(0,3).join(" · ")}</div>
          )}
        </div>
        <div style={{ flexShrink:0, color:"#d1d5db", fontSize:"1.1rem" }}>›</div>
      </div>
    </div>
  );
}

// ── AddModal ───────────────────────────────────────────────────────────────
function AddModal({ onAdd, onClose }) {
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState("series");
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true); setError(""); setResults([]); setSelected(null);
    try {
      const found = await searchMedia(query, mediaType);
      if (!found || !found.length) setError("Aucun résultat. Essayez d'autres mots-clés.");
      else {
        setResults(found);
        if (found.length === 1) await selectItem(found[0]);
      }
    } catch(e) { setError("Erreur : " + e.message); }
    setLoading(false);
  }

  async function selectItem(item) {
    setLoadingDetails(true);
    try {
      const detailed = await fetchDetails(item);
      setSelected(detailed);
    } catch(e) {
      setSelected(item); // fallback to basic info
    }
    setLoadingDetails(false);
  }

  function handleAdd() {
    if (!selected) return;
    onAdd({ ...selected, category, id: Date.now().toString(), addedAt: new Date().toISOString(), watched: false, watchedSeasons: [] });
    onClose();
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:1000, backdropFilter:"blur(6px)" }}>
      <div style={{ background:"white", borderRadius:"24px 24px 0 0", width:"100%", maxWidth:640, maxHeight:"95vh", overflow:"auto", padding:"28px 20px 40px", fontFamily:"'DM Sans',sans-serif" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h2 style={{ margin:0, fontFamily:"'Playfair Display',serif", fontSize:"1.4rem", color:"#111827" }}>Ajouter un titre</h2>
          <button onClick={onClose} style={{ background:"#f3f4f6", border:"none", borderRadius:"50%", width:34, height:34, cursor:"pointer", color:"#6b7280", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>

        {/* Type */}
        <div style={{ display:"flex", background:"#f3f4f6", borderRadius:12, padding:4, marginBottom:18 }}>
          {[{v:"series",l:"📺 Série"},{v:"movie",l:"🎬 Film"}].map(function(x){ return (
            <button key={x.v} onClick={function(){ setMediaType(x.v); }} style={{ flex:1, padding:"9px 0", border:"none", borderRadius:9, fontWeight:600, cursor:"pointer", background:mediaType===x.v?"white":"transparent", color:mediaType===x.v?"#111827":"#9ca3af", boxShadow:mediaType===x.v?"0 1px 4px rgba(0,0,0,0.1)":"none", fontSize:"0.88rem", fontFamily:"'DM Sans',sans-serif" }}>{x.l}</button>
          ); })}
        </div>

        {/* Category */}
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

        {/* Search */}
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

        {(loading || loadingDetails) && (
          <div style={{ textAlign:"center", padding:"20px 0", color:"#9ca3af", fontSize:"0.88rem" }}>
            {loadingDetails ? "Chargement des détails…" : "Recherche en cours…"}
          </div>
        )}
        {error && <div style={{ color:"#b91c1c", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"12px 14px", fontSize:"0.84rem", marginBottom:14, wordBreak:"break-word" }}>{error}</div>}

        {/* Multiple results */}
        {results.length > 1 && !selected && !loadingDetails && (
          <div style={{ marginBottom:16 }}>
            <p style={{ margin:"0 0 10px", fontSize:"0.7rem", fontWeight:700, color:"#9ca3af", letterSpacing:"1px" }}>{results.length} RÉSULTATS — CHOISISSEZ</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))", gap:10 }}>
              {results.map(function(r, i){ return (
                <div key={i} onClick={function(){ selectItem(r); }}
                  style={{ cursor:"pointer", borderRadius:10, overflow:"hidden", border:"2px solid #e5e7eb", transition:"border-color 0.15s", background:"white" }}
                  onMouseEnter={function(e){ e.currentTarget.style.borderColor="#4f46e5"; }}
                  onMouseLeave={function(e){ e.currentTarget.style.borderColor="#e5e7eb"; }}>
                  <div style={{ position:"relative", paddingTop:"150%" }}>
                    <div style={{ position:"absolute", inset:0 }}>
                      <Poster url={r.posterUrl} title={r.title} />
                    </div>
                  </div>
                  <div style={{ padding:"6px 8px" }}>
                    <div style={{ fontWeight:700, fontSize:"0.72rem", color:"#111827", lineHeight:1.2, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{r.title}</div>
                    <div style={{ fontSize:"0.63rem", color:"#9ca3af" }}>{r.year}</div>
                  </div>
                </div>
              ); })}
            </div>
          </div>
        )}

        {/* Selected preview */}
        {selected && !loadingDetails && (
          <div style={{ border:"2px solid #4f46e5", borderRadius:14, overflow:"hidden", marginBottom:16 }}>
            <div style={{ display:"flex" }}>
              <div style={{ width:100, flexShrink:0, position:"relative" }}>
                <Poster url={selected.posterUrl} title={selected.title} style={{ position:"absolute", inset:0 }} />
                <div style={{ paddingTop:"150%" }} />
              </div>
              <div style={{ flex:1, padding:"14px 14px 14px 12px", minWidth:0 }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:"1rem", color:"#111827", marginBottom:4, lineHeight:1.2 }}>{selected.title}</div>
                {selected.originalTitle && selected.originalTitle !== selected.title && (
                  <div style={{ fontSize:"0.7rem", color:"#9ca3af", marginBottom:4, fontStyle:"italic" }}>{selected.originalTitle}</div>
                )}
                <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:6 }}>
                  {[selected.year, selected.country, selected.duration, selected.rating?"⭐ "+selected.rating:null].filter(Boolean).map(function(v,i){ return <span key={i} style={{ fontSize:"0.75rem", color:"#6b7280" }}>{v}</span>; })}
                </div>
                {selected.genres && selected.genres.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginBottom:6 }}>
                    {selected.genres.slice(0,4).map(function(g,i){ return <span key={i} style={{ background:"#f3f4f6", color:"#6b7280", borderRadius:4, padding:"1px 6px", fontSize:"0.63rem", fontWeight:600 }}>{g}</span>; })}
                  </div>
                )}
                {selected.director && <div style={{ fontSize:"0.74rem", color:"#374151", marginBottom:3 }}><b>Réal. :</b> {selected.director}</div>}
                {selected.cast && selected.cast.length > 0 && <div style={{ fontSize:"0.74rem", color:"#374151" }}><b>Avec :</b> {selected.cast.slice(0,3).join(", ")}</div>}
              </div>
            </div>
            {selected.synopsis && (
              <div style={{ padding:"10px 14px", fontSize:"0.79rem", color:"#4b5563", lineHeight:1.6, borderTop:"1px solid #f0f0f0" }}>
                {selected.synopsis.slice(0, 260)}{selected.synopsis.length > 260 ? "…" : ""}
              </div>
            )}
            {selected.type==="series" && selected.seasonsList && selected.seasonsList.length > 0 && (
              <div style={{ padding:"0 14px 12px", fontSize:"0.74rem", color:"#6b7280" }}>
                📺 {selected.seasonsList.length} saison{selected.seasonsList.length>1?"s":""} · {selected.seasonsList.reduce(function(a,s){return a+(s.episodeCount||0);},0)} épisodes
              </div>
            )}
            {results.length > 1 && (
              <div style={{ padding:"0 14px 12px" }}>
                <button onClick={function(){ setSelected(null); }} style={{ background:"none", border:"1px solid #e5e7eb", borderRadius:7, padding:"4px 12px", cursor:"pointer", fontSize:"0.72rem", color:"#6b7280", fontFamily:"'DM Sans',sans-serif" }}>← Autre résultat</button>
              </div>
            )}
          </div>
        )}

        {selected && !loadingDetails && (
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
  const cat = getCat(item.category);
  const [backdropErr, setBackdropErr] = useState(false);
  const allDone = item.seasonsList && item.seasonsList.length > 0 &&
    item.seasonsList.every(function(s){ return item.watchedSeasons && item.watchedSeasons.includes(s.number); });

  const heroUrl = (!backdropErr && item.backdropUrl) ? item.backdropUrl : item.posterOriginal || item.posterUrl;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"flex-start", justifyContent:"center", zIndex:1000, overflow:"auto", backdropFilter:"blur(8px)", padding:"16px 12px 40px" }}>
      <div style={{ background:"white", borderRadius:20, width:"100%", maxWidth:640, overflow:"hidden", marginTop:8, fontFamily:"'DM Sans',sans-serif" }}>

        {/* Hero with backdrop or poster */}
        <div style={{ position:"relative", height:220, overflow:"hidden", background:"#1e1b4b" }}>
          {heroUrl
            ? <img src={heroUrl} alt={item.title} onError={function(){ setBackdropErr(true); }} style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.85 }} />
            : <div style={{ width:"100%", height:"100%", background:gradFor(item.title) }} />
          }
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 55%, transparent 100%)" }} />
          <button onClick={onClose} style={{ position:"absolute", top:12, right:12, background:"rgba(255,255,255,0.9)", border:"none", borderRadius:"50%", width:34, height:34, cursor:"pointer", color:"#374151", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>

          {/* Poster thumbnail overlay */}
          <div style={{ position:"absolute", bottom:16, left:16, display:"flex", gap:12, alignItems:"flex-end" }}>
            <div style={{ width:70, flexShrink:0, borderRadius:8, overflow:"hidden", boxShadow:"0 4px 16px rgba(0,0,0,0.5)", position:"relative" }}>
              <Poster url={item.posterUrl} title={item.title} style={{ position:"absolute", inset:0 }} />
              <div style={{ paddingTop:"150%" }} />
            </div>
            <div style={{ paddingBottom:4 }}>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:6 }}>
                <span style={{ background:item.type==="series"?"#312e81":"#92400e", color:"white", borderRadius:5, padding:"2px 8px", fontSize:"0.6rem", fontWeight:700 }}>{item.type==="series"?"SÉRIE":"FILM"}</span>
                {cat && <span style={{ background:cat.color, color:"white", borderRadius:5, padding:"2px 8px", fontSize:"0.6rem", fontWeight:700 }}>{cat.sub}</span>}
                {item.watched && <span style={{ background:"#065f46", color:"white", borderRadius:5, padding:"2px 8px", fontSize:"0.6rem", fontWeight:700 }}>✓ VU</span>}
              </div>
              <h2 style={{ margin:"0 0 3px", fontFamily:"'Playfair Display',serif", color:"white", fontSize:"1.25rem", fontWeight:900, lineHeight:1.2 }}>{item.title}</h2>
              <p style={{ margin:0, color:"rgba(255,255,255,0.65)", fontSize:"0.77rem" }}>
                {[item.year, item.country, item.duration, item.rating?"⭐ "+item.rating:""].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding:"18px 18px 24px" }}>
          {item.genres && item.genres.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
              {item.genres.map(function(g,i){ return <span key={i} style={{ background:"#f3f4f6", color:"#374151", borderRadius:6, padding:"4px 10px", fontSize:"0.73rem", fontWeight:600 }}>{g}</span>; })}
            </div>
          )}
          {item.director && <div style={{ marginBottom:5, fontSize:"0.83rem", color:"#374151" }}><b>{item.type==="series"?"Créé par :":"Réalisateur :"}</b> {item.director}</div>}
          {item.cast && item.cast.length > 0 && <div style={{ marginBottom:14, fontSize:"0.83rem", color:"#374151" }}><b>Avec :</b> {item.cast.join(", ")}</div>}

          {item.synopsis && (
            <div style={{ marginBottom:18 }}>
              <p style={{ margin:"0 0 5px", fontSize:"0.67rem", fontWeight:700, color:"#9ca3af", letterSpacing:"1px" }}>SYNOPSIS</p>
              <p style={{ margin:0, fontSize:"0.85rem", color:"#4b5563", lineHeight:1.65 }}>{item.synopsis}</p>
            </div>
          )}

          {item.type==="series" && item.seasonsList && item.seasonsList.length > 0 && (
            <div style={{ marginBottom:18 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
                <p style={{ margin:0, fontSize:"0.67rem", fontWeight:700, color:"#9ca3af", letterSpacing:"1px" }}>SAISONS · {(item.watchedSeasons||[]).length}/{item.seasonsList.length} vues</p>
                {allDone && <span style={{ fontSize:"0.7rem", color:"#059669", fontWeight:700 }}>✓ Série terminée</span>}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {item.seasonsList.map(function(s,i){
                  const seen = item.watchedSeasons && item.watchedSeasons.includes(s.number);
                  return (
                    <div key={i} onClick={function(){ onToggleSeason(item.id, s.number); }}
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:10, background:seen?"#f0fdf4":"#f9fafb", border:"1.5px solid "+(seen?"#bbf7d0":"#e5e7eb"), cursor:"pointer" }}>
                      {s.posterUrl && (
                        <div style={{ width:32, flexShrink:0, borderRadius:4, overflow:"hidden" }}>
                          <img src={s.posterUrl} alt={"S"+s.number} style={{ width:"100%", display:"block" }} onError={function(e){e.target.style.display="none";}} />
                        </div>
                      )}
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:"0.83rem", color:"#111827" }}>Saison {s.number}{s.year?" ("+s.year+")":""}</div>
                        <div style={{ fontSize:"0.7rem", color:"#9ca3af" }}>{s.episodeCount} épisode{s.episodeCount>1?"s":""}</div>
                      </div>
                      <div style={{ width:26, height:26, borderRadius:"50%", background:seen?"#10b981":"white", border:"2px solid "+(seen?"#10b981":"#d1d5db"), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"0.85rem", flexShrink:0 }}>
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
  const [watchlist, setWatchlist] = useState(function(){ return loadList(); });
  const [activeCategory, setActiveCategory] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [filterWatched, setFilterWatched] = useState("all");

  const update = useCallback(function(nl){ setWatchlist(nl); saveList(nl); }, []);
  function handleAdd(item){ update([...watchlist, item]); }
  function handleDelete(id){ update(watchlist.filter(function(i){ return i.id!==id; })); }
  function handleToggleWatched(id){
    const nl=watchlist.map(function(i){ return i.id===id?{...i,watched:!i.watched}:i; });
    update(nl);
    setDetailItem(function(p){ return p&&p.id===id?{...p,watched:!p.watched}:p; });
  }
  function handleToggleSeason(id,num){
    const nl=watchlist.map(function(item){
      if(item.id!==id) return item;
      const ws=item.watchedSeasons||[];
      return {...item,watchedSeasons:ws.includes(num)?ws.filter(function(s){return s!==num;}):[...ws,num]};
    });
    update(nl);
    setDetailItem(function(p){ return p&&p.id===id?nl.find(function(i){return i.id===id;}):p; });
  }

  const total=watchlist.length, seen=watchlist.filter(function(i){return i.watched;}).length;
  let filtered=activeCategory==="all"?watchlist:watchlist.filter(function(i){return i.category===activeCategory;});
  if(filterWatched==="unwatched") filtered=filtered.filter(function(i){return !i.watched;});
  if(filterWatched==="watched") filtered=filtered.filter(function(i){return i.watched;});
  const counts={};
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
              const isAll=cat.id==="all", count=isAll?total:(counts[cat.id]||0), active=activeCategory===cat.id;
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
