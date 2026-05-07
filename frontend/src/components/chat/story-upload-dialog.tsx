'use client';

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ImagePlus, Film, Sparkles, ArrowRight, Music, Search, ChevronLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpotifySearch } from '@/hooks/use-stories';
import type { SpotifyTrack } from '@/lib/stories-api';

interface StoryUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (file: File, caption: string, music?: SpotifyTrack | null) => Promise<void>;
}

const CAPTION_MAX = 200;

function MusicPicker({ onSelect, onBack }: { onSelect: (t: SpotifyTrack | null) => void; onBack: () => void }) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: tracks = [], isFetching } = useSpotifySearch(debouncedQ);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Search bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid rgba(0,128,200,0.1)' }}>
        <button onClick={onBack} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
          <ChevronLeft style={{ width: 16, height: 16 }} />
        </button>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 11, height: 11, color: 'rgba(146,220,229,0.5)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search a song…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(0,128,200,0.07)',
              border: '1px solid rgba(0,128,200,0.15)',
              borderRadius: 8, padding: '7px 10px 7px 26px',
              fontSize: 12, color: '#d6eef5', outline: 'none', caretColor: '#92dce5',
            }}
          />
        </div>
        <button
          onClick={() => onSelect(null)}
          style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          No music
        </button>
      </div>

      {/* Results */}
      <div style={{ maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
        {isFetching && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(146,220,229,0.4)', fontSize: 11 }}>
            Searching…
          </div>
        )}
        {!isFetching && debouncedQ.length >= 2 && tracks.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
            No results
          </div>
        )}
        {!isFetching && debouncedQ.length < 2 && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>
            Type to search music
          </div>
        )}
        {tracks.map(track => (
          <button
            key={track.id}
            onClick={() => onSelect(track)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
              transition: 'background 0.15s', textAlign: 'left',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,128,200,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            {track.cover_url ? (
              <img src={track.cover_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(0,128,200,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Music style={{ width: 14, height: 14, color: '#5bb8d4' }} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#d6eef5', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</p>
              <p style={{ fontSize: 10.5, color: 'rgba(146,220,229,0.55)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</p>
            </div>
            <span style={{ fontSize: 9, color: 'rgba(0,128,200,0.5)', background: 'rgba(0,128,200,0.1)', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>
              30s
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function StoryUploadDialog({ open, onOpenChange, onSubmit }: StoryUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [music, setMusic] = useState<SpotifyTrack | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Play preview audio when music is selected
  useEffect(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (music?.preview_url) {
      const a = new Audio(music.preview_url);
      a.volume = 0.5;
      a.loop = true;
      a.play().catch(() => {});
      previewAudioRef.current = a;
    }
    return () => { previewAudioRef.current?.pause(); };
  }, [music]);

  // Stop preview audio when dialog closes
  useEffect(() => {
    if (!open && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 350);
      return () => clearTimeout(t);
    }
  }, [open]);

  function pick(f: File) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setIsVideo(f.type.startsWith('video/'));
    setPreview(URL.createObjectURL(f));
  }

  function clear() {
    if (preview) URL.revokeObjectURL(preview);
    if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
    setFile(null); setPreview(null); setIsVideo(false);
    setCaption(''); setMusic(null); setShowMusicPicker(false);
  }

  function handleClose() { clear(); onOpenChange(false); }

  async function handleSubmit() {
    if (!file || loading) return;
    setLoading(true);
    try {
      await onSubmit(file, caption.trim(), music);
      clear(); onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes su-orb { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(14px,-10px) scale(1.12)} }
        @keyframes su-orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-12px,8px) scale(0.9)} }
        @keyframes su-ring-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes su-ring-rev { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes su-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes su-scan { 0%{transform:translateY(-100%);opacity:0.5} 100%{transform:translateY(500%);opacity:0} }
        @keyframes su-in { from{opacity:0;transform:scale(0.95) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes su-out { from{opacity:1;transform:scale(1) translateY(0)} to{opacity:0;transform:scale(0.95) translateY(10px)} }
        @keyframes su-dots { 0%,80%,100%{transform:scale(0.5);opacity:0.3} 40%{transform:scale(1);opacity:1} }
        @keyframes su-wave { 0%,100%{height:6px} 50%{height:14px} }
        .su-in { animation:su-in 0.3s cubic-bezier(0.16,1,0.3,1) forwards }
        .su-out { animation:su-out 0.25s ease-in forwards }
        .su-btn-active { background:linear-gradient(110deg,#0080c8 0%,#38b6d8 40%,#92dce5 60%,#0080c8 100%);background-size:200% auto;animation:su-shimmer 2.8s linear infinite }
        .su-btn-active:hover { animation-duration:1.2s }
      `}</style>

      <div onClick={handleClose} style={{ position:'fixed',inset:0,zIndex:9998,background:'rgba(0,0,0,0.72)',backdropFilter:'blur(10px)',WebkitBackdropFilter:'blur(10px)',opacity:visible?1:0,transition:'opacity 0.3s ease' }} />

      <div style={{ position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none' }}>
        <div className={visible?'su-in':'su-out'} style={{ pointerEvents:'auto',width:'100%',maxWidth:340,margin:'0 16px' }}>
          <div style={{ background:'linear-gradient(160deg,#13192b 0%,#0d1220 100%)',border:'1px solid rgba(0,128,200,0.18)',borderRadius:20,overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.6)' }}>

            {/* Header */}
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 14px 11px',borderBottom:'1px solid rgba(0,128,200,0.12)' }}>
              <div style={{ display:'flex',alignItems:'center',gap:7 }}>
                <div style={{ width:26,height:26,borderRadius:7,background:'linear-gradient(135deg,#0080c8,#92dce5)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <Sparkles style={{ width:12,height:12,color:'#fff' }} />
                </div>
                <span style={{ fontSize:13.5,fontWeight:700,letterSpacing:'-0.3px',background:'linear-gradient(90deg,#92dce5,#e0f4fb)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>New Story</span>
              </div>
              <button onClick={handleClose} style={{ width:26,height:26,borderRadius:7,border:'none',background:'rgba(255,255,255,0.06)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.4)',transition:'all 0.15s' }}
                onMouseEnter={e=>{ (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.11)';(e.currentTarget as HTMLButtonElement).style.color='#fff' }}
                onMouseLeave={e=>{ (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.06)';(e.currentTarget as HTMLButtonElement).style.color='rgba(255,255,255,0.4)' }}>
                <X style={{ width:12,height:12 }} />
              </button>
            </div>

            {/* Music picker panel */}
            {showMusicPicker ? (
              <MusicPicker
                onSelect={(t) => { setMusic(t); setShowMusicPicker(false); }}
                onBack={() => setShowMusicPicker(false)}
              />
            ) : (
              <div style={{ padding:'12px 12px 14px' }}>

                {/* Preview / Drop zone */}
                <div
                  style={{ position:'relative',width:'100%',aspectRatio:'4/3',borderRadius:13,overflow:'hidden',cursor:preview?'default':'pointer',border:dragging?'1.5px solid rgba(0,128,200,0.6)':'1.5px solid rgba(0,128,200,0.12)',transition:'border-color 0.2s' }}
                  onClick={() => !preview && inputRef.current?.click()}
                  onDragEnter={e=>{ e.preventDefault();dragCounter.current++;setDragging(true) }}
                  onDragLeave={()=>{ dragCounter.current--;if(dragCounter.current===0)setDragging(false) }}
                  onDragOver={e=>e.preventDefault()}
                  onDrop={e=>{ e.preventDefault();dragCounter.current=0;setDragging(false);const f=e.dataTransfer.files[0];if(f)pick(f) }}
                >
                  {!preview ? (
                    <div style={{ position:'absolute',inset:0,background:dragging?'linear-gradient(160deg,rgba(0,128,200,0.14) 0%,rgba(146,220,229,0.08) 100%)':'linear-gradient(160deg,rgba(13,18,32,0.95) 0%,rgba(10,14,26,0.98) 100%)',transition:'background 0.25s',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
                      <div style={{ position:'absolute',width:160,height:160,borderRadius:'50%',background:'radial-gradient(circle,rgba(0,128,200,0.2) 0%,transparent 70%)',top:'10%',left:'50%',transform:'translateX(-50%)',animation:'su-orb 8s ease-in-out infinite',filter:'blur(18px)' }} />
                      <div style={{ position:'absolute',width:100,height:100,borderRadius:'50%',background:'radial-gradient(circle,rgba(146,220,229,0.15) 0%,transparent 70%)',bottom:'15%',right:'10%',animation:'su-orb2 11s ease-in-out infinite',filter:'blur(14px)' }} />
                      <div style={{ position:'absolute',inset:0,opacity:0.06,backgroundImage:'radial-gradient(circle,rgba(146,220,229,0.9) 1px,transparent 1px)',backgroundSize:'24px 24px' }} />
                      <div style={{ position:'relative',width:58,height:58,marginBottom:14 }}>
                        <div style={{ position:'absolute',inset:-12,borderRadius:'50%',border:'1px dashed rgba(0,128,200,0.3)',animation:`su-ring-spin ${dragging?'1.5s':'9s'} linear infinite` }} />
                        <div style={{ position:'absolute',inset:-5,borderRadius:'50%',border:'1px solid rgba(146,220,229,0.18)',animation:`su-ring-rev ${dragging?'2s':'13s'} linear infinite` }} />
                        <div style={{ width:58,height:58,borderRadius:16,background:'linear-gradient(135deg,rgba(0,128,200,0.22),rgba(146,220,229,0.12))',border:'1px solid rgba(0,128,200,0.25)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:dragging?'0 0 24px 6px rgba(0,128,200,0.3)':'0 6px 24px rgba(0,128,200,0.15)',transition:'box-shadow 0.3s' }}>
                          {dragging ? <Film style={{ width:24,height:24,color:'#92dce5' }} /> : <ImagePlus style={{ width:24,height:24,color:'#5bb8d4' }} />}
                        </div>
                      </div>
                      <p style={{ fontSize:13.5,fontWeight:700,letterSpacing:'-0.2px',color:dragging?'#92dce5':'#7ec8de',marginBottom:4,transition:'color 0.2s',zIndex:1 }}>{dragging?'Drop it in':'Add your moment'}</p>
                      <p style={{ fontSize:11,color:'rgba(255,255,255,0.28)',zIndex:1 }}>{dragging?'Release to upload':'Photo or video · disappears in 24h'}</p>
                      <div style={{ position:'absolute',bottom:10,display:'flex',gap:5 }}>
                        {['JPG','PNG','MP4'].map(ext=>(
                          <span key={ext} style={{ fontSize:9,fontWeight:600,letterSpacing:'0.4px',color:'rgba(146,220,229,0.35)',background:'rgba(0,128,200,0.08)',border:'1px solid rgba(0,128,200,0.14)',borderRadius:4,padding:'2px 6px' }}>{ext}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ position:'absolute',inset:0 }}>
                      {isVideo
                        ? <video src={preview} style={{ width:'100%',height:'100%',objectFit:'cover' }} autoPlay playsInline loop />
                        : <img src={preview} alt="preview" style={{ width:'100%',height:'100%',objectFit:'cover' }} />}
                      <div style={{ position:'absolute',left:0,right:0,top:0,height:'25%',background:'linear-gradient(to bottom,rgba(0,128,200,0.1),transparent)',animation:'su-scan 0.7s ease-out forwards',pointerEvents:'none' }} />
                      <div style={{ position:'absolute',top:0,left:0,right:0,height:50,background:'linear-gradient(to bottom,rgba(0,0,0,0.5),transparent)',pointerEvents:'none' }} />
                      <div style={{ position:'absolute',bottom:0,left:0,right:0,height:60,background:'linear-gradient(to top,rgba(0,0,0,0.55),transparent)',pointerEvents:'none' }} />
                      <div style={{ position:'absolute',top:10,left:10,display:'flex',alignItems:'center',gap:4,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',borderRadius:7,padding:'3px 8px',border:'1px solid rgba(0,128,200,0.2)' }}>
                        {isVideo ? <Film style={{ width:9,height:9,color:'#92dce5' }} /> : <ImagePlus style={{ width:9,height:9,color:'#92dce5' }} />}
                        <span style={{ fontSize:9.5,fontWeight:600,color:'rgba(255,255,255,0.65)',letterSpacing:'0.3px' }}>{isVideo?'Video':'Photo'}</span>
                      </div>
                      {/* Music tag on preview */}
                      {music && (
                        <div style={{ position:'absolute',bottom:10,left:10,right:10,display:'flex',alignItems:'center',gap:8,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(10px)',WebkitBackdropFilter:'blur(10px)',borderRadius:10,padding:'7px 10px',border:'1px solid rgba(0,128,200,0.2)' }}>
                          {music.cover_url && <img src={music.cover_url} alt="" style={{ width:28,height:28,borderRadius:5,objectFit:'cover' }} />}
                          <div style={{ flex:1,minWidth:0 }}>
                            <p style={{ fontSize:10.5,fontWeight:600,color:'#fff',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{music.title}</p>
                            <p style={{ fontSize:9.5,color:'rgba(146,220,229,0.6)',margin:0 }}>{music.artist}</p>
                          </div>
                          {/* mini waveform */}
                          <div style={{ display:'flex',alignItems:'center',gap:1.5 }}>
                            {[0,0.1,0.2,0.15,0.05,0.25,0.1].map((delay,i)=>(
                              <div key={i} style={{ width:2.5,borderRadius:2,background:'#92dce5',animation:`su-wave 0.8s ${delay}s ease-in-out infinite` }} />
                            ))}
                          </div>
                        </div>
                      )}
                      <button onClick={e=>{e.stopPropagation();clear()}} style={{ position:'absolute',top:10,right:10,width:28,height:28,borderRadius:8,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.1)',cursor:'pointer',color:'rgba(255,255,255,0.75)',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s' }}
                        onMouseEnter={e=>(e.currentTarget.style.background='rgba(220,38,38,0.5)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='rgba(0,0,0,0.45)')}>
                        <X style={{ width:11,height:11 }} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Caption */}
                <div style={{ marginTop:10,position:'relative' }}>
                  <input type="text" placeholder="Add a caption…" value={caption} onChange={e=>setCaption(e.target.value.slice(0,CAPTION_MAX))} onKeyDown={e=>{if(e.key==='Enter')handleSubmit()}}
                    style={{ width:'100%',boxSizing:'border-box',background:'rgba(0,128,200,0.06)',border:'1px solid rgba(0,128,200,0.14)',borderRadius:10,padding:'9px 44px 9px 12px',fontSize:12,color:'#d6eef5',outline:'none',transition:'border-color 0.2s',caretColor:'#92dce5' }}
                    onFocus={e=>(e.currentTarget.style.borderColor='rgba(0,128,200,0.45)')}
                    onBlur={e=>(e.currentTarget.style.borderColor='rgba(0,128,200,0.14)')} />
                  {caption.length>0&&(<span style={{ position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',fontSize:10,fontWeight:500,color:caption.length>CAPTION_MAX*0.85?'#f87171':'rgba(146,220,229,0.35)',transition:'color 0.2s' }}>{CAPTION_MAX-caption.length}</span>)}
                </div>

                {/* Music button */}
                <button
                  onClick={() => setShowMusicPicker(true)}
                  style={{ marginTop:8,width:'100%',height:36,borderRadius:10,border:'1px solid',borderColor:music?'rgba(0,128,200,0.4)':'rgba(0,128,200,0.14)',background:music?'rgba(0,128,200,0.1)':'rgba(0,128,200,0.04)',cursor:'pointer',display:'flex',alignItems:'center',gap:8,padding:'0 12px',transition:'all 0.15s' }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(0,128,200,0.4)')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor=music?'rgba(0,128,200,0.4)':'rgba(0,128,200,0.14)')}
                >
                  <Music style={{ width:12,height:12,color:music?'#92dce5':'rgba(0,128,200,0.6)',flexShrink:0 }} />
                  {music ? (
                    <>
                      <span style={{ flex:1,fontSize:11.5,color:'#92dce5',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textAlign:'left' }}>{music.title} — {music.artist}</span>
                      <button onClick={e=>{e.stopPropagation();setMusic(null)}} style={{ background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.3)',padding:0,display:'flex' }}>
                        <X style={{ width:10,height:10 }} />
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize:11.5,color:'rgba(146,220,229,0.4)',fontWeight:500 }}>Add music from Spotify</span>
                  )}
                </button>

                {/* Share */}
                <button onClick={handleSubmit} disabled={!file||loading} className={cn(!file||loading?'':'su-btn-active')}
                  style={{ marginTop:9,width:'100%',height:42,borderRadius:12,border:'none',cursor:file&&!loading?'pointer':'not-allowed',background:!file||loading?'rgba(255,255,255,0.05)':undefined,color:!file||loading?'rgba(255,255,255,0.22)':'#fff',fontSize:13,fontWeight:700,letterSpacing:'-0.2px',display:'flex',alignItems:'center',justifyContent:'center',gap:7,transition:'transform 0.15s,box-shadow 0.2s',boxShadow:file&&!loading?'0 6px 20px rgba(0,128,200,0.35)':'none' }}
                  onMouseEnter={e=>{ if(file&&!loading)(e.currentTarget as HTMLButtonElement).style.transform='scale(1.015)' }}
                  onMouseLeave={e=>{ (e.currentTarget as HTMLButtonElement).style.transform='scale(1)' }}>
                  {loading ? (
                    <>{[0,0.14,0.28].map((delay,i)=>(
                      <span key={i} style={{ width:5,height:5,borderRadius:'50%',background:'rgba(255,255,255,0.5)',animation:`su-dots 1.2s ${delay}s ease-in-out infinite`,display:'inline-block' }} />
                    ))}<span style={{ marginLeft:4 }}>Sharing…</span></>
                  ) : (
                    <><Sparkles style={{ width:14,height:14 }} />Share Story<ArrowRight style={{ width:13,height:13,opacity:0.65 }} /></>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*,video/mp4,video/webm,video/mov" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0];if(f)pick(f);e.target.value='' }} />
    </>,
    document.body
  );
}
