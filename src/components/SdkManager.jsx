import { useState, useEffect } from 'react'
import { Spinner } from './UI.jsx'
import * as api from '../api.js'

const CORE_TOOLS = [
  { id: 'emulator', name: 'Android Emulator', desc: 'Core emulator engine (required)', icon: '🤖', required: true },
  { id: 'platform-tools', name: 'Platform Tools (ADB/Fastboot)', desc: 'ADB, fastboot, and platform utilities', icon: '🔧', required: true }
]

const TABS = [
  { id: 'stable_playstore', label: '🎮 Stable (Play Store)' },
  { id: 'stable_google',    label: '🔬 Stable (Google APIs)' },
  { id: 'beta',             label: '🚀 Beta / Preview' },
  { id: 'tv',              label: '📺 Android TV' },
  { id: 'wear',            label: '⌚ Wear OS' },
  { id: 'automotive',      label: '🚗 Automotive' },
]

export function SdkManager({ status, refreshStatus }) {
  const [installing, setInstalling] = useState({})
  const [errors, setErrors] = useState({})
  const [systemImages, setSystemImages] = useState([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('stable_playstore')
  const [progress, setProgress] = useState({})

  useEffect(() => {
    const unsubscribe = api.on('progress', (payload) => {
      const { task, pct } = payload
      setProgress(s => ({ ...s, [task]: pct }))
    })
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  const loadSdkImages = async () => {
    setLoadingImages(true)
    try {
      const list = await api.fetchSdkPackages()
      setSystemImages(Array.isArray(list) ? list : [])
    } catch (e) {
      console.error(e)
    }
    setLoadingImages(false)
  }

  useEffect(() => {
    if (status?.cmdline_installed && status?.jdk_installed) {
      loadSdkImages()
    }
  }, [status?.cmdline_installed, status?.jdk_installed])

  const installPkg = async (pkgId) => {
    setInstalling(s => ({ ...s, [pkgId]: true }))
    setErrors(s => ({ ...s, [pkgId]: null }))
    try {
      const result = await api.installPackage({ packageId: pkgId })
      if (!result.ok) {
        setErrors(s => ({ ...s, [pkgId]: result.error || 'Installation failed' }))
      } else {
        if (refreshStatus) await refreshStatus()
        await loadSdkImages()
      }
    } catch (e) {
      setErrors(s => ({ ...s, [pkgId]: e.toString() }))
    }
    setInstalling(s => ({ ...s, [pkgId]: false }))
  }

  const acceptLicenses = async () => {
    setInstalling(s => ({ ...s, _licenses: true }))
    try {
      await api.acceptLicenses()
    } catch (e) {
      setErrors(s => ({ ...s, _licenses: e.toString() }))
    }
    setInstalling(s => ({ ...s, _licenses: false }))
  }

  // Block if cmdline tools not ready
  if (!status?.cmdline_installed || !status?.jdk_installed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="alert alert-warn">
          ⚠️ <strong>Setup not complete!</strong> You must install <strong>JDK</strong> and <strong>cmdline-tools</strong> first before using the SDK Manager.
          Go to the <strong>Setup / Install</strong> page in the sidebar and complete all steps.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Step 1: Portable OpenJDK 21', done: status?.jdk_installed },
            { label: 'Step 2: Android cmdline-tools', done: status?.cmdline_installed },
            { label: 'Step 3: Use SDK Manager below ↓', done: false },
          ].map((s, i) => (
            <div key={i} className="pkg-row">
              <span style={{ fontSize: 20 }}>{s.done ? '✅' : '⏳'}</span>
              <span className="pkg-name" style={{ color: s.done ? 'var(--text-green)' : 'var(--text-muted)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const installedList = status?.installed_packages || []

  // Filter dynamic images based on active tab and search input
  const filteredImages = systemImages.filter(img => {
    const matchesSearch = img.name.toLowerCase().includes(search.toLowerCase()) || 
                          img.id.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false

    switch (activeTab) {
      case 'stable_playstore': return img.category === 'Stable (Play Store)';
      case 'stable_google':    return img.category === 'Stable (Google APIs)';
      case 'beta':             return img.category === 'Beta / Preview';
      case 'tv':              return img.category === 'Android TV';
      case 'wear':            return img.category === 'Wear OS';
      case 'automotive':      return img.category === 'Automotive';
      default:                return true;
    }
  })

  // Deduplicate: If there are multiple packages with the same variant and base API level, keep only the latest version.
  const dedupedImages = [];
  const seen = {};
  const sortedImagesForDedup = [...filteredImages].sort((a, b) => {
    const matchA = a.id.match(/android-([\d.]+)/);
    const matchB = b.id.match(/android-([\d.]+)/);
    const verA = matchA ? parseFloat(matchA[1]) : 0;
    const verB = matchB ? parseFloat(matchB[1]) : 0;
    return verB - verA; // higher version first
  });

  sortedImagesForDedup.forEach(img => {
    const idParts = img.id.split(';');
    if (idParts.length >= 4) {
      const rawVer = idParts[1].replace('android-', '');
      const baseVer = rawVer.split('.')[0]; // e.g. "36" from "36.1"
      const variant = idParts[2];
      const key = `${baseVer}-${variant}`;
      if (!seen[key]) {
        seen[key] = true;
        dedupedImages.push(img);
      }
    } else {
      dedupedImages.push(img);
    }
  });

  const [expandedGroups, setExpandedGroups] = useState({})

  // Group dedupedImages by Android version (e.g. "Android 16 (API 36)")
  const groups = {};
  dedupedImages.forEach(img => {
    const parts = img.name.split(' · ');
    const groupName = parts[0] || 'Unknown';
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(img);
  });

  // Sort groups descending (e.g. Android 17 before Android 16)
  const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numB - numA;
  });

  // Auto-expand the latest (first) group by default when tab/list changes
  useEffect(() => {
    if (sortedGroupKeys.length > 0) {
      const latest = sortedGroupKeys[0];
      setExpandedGroups(s => {
        if (s[latest] === undefined) {
          return { [latest]: true };
        }
        return s;
      });
    }
  }, [activeTab, systemImages, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      
      {/* ─── Part 1: Core Required Emulator Tools ─── */}
      <div className="section">
        <div className="section-title">⚙️ Core Required Emulator Tools</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CORE_TOOLS.map(pkg => {
            const isInstalled = installedList.includes(pkg.id) || 
                                (pkg.id === 'emulator' && status?.emulator_installed) ||
                                (pkg.id === 'platform-tools' && status?.platform_tools_installed);
            const isInstalling = installing[pkg.id];
            const pct = progress[pkg.id] || 0;
            return (
              <div key={pkg.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="pkg-row">
                  <span style={{ fontSize: 22 }}>{pkg.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div className="pkg-name">
                      {pkg.name}
                      <span className="badge badge-warn" style={{ marginLeft: 8 }}>Required</span>
                      {isInstalled && <span className="badge badge-ok" style={{ marginLeft: 8 }}>Installed</span>}
                    </div>
                    <div className="pkg-desc">{pkg.desc}</div>
                    <div className="font-mono text-muted" style={{ fontSize: 10, marginTop: 3 }}>{pkg.id}</div>
                  </div>
                  {isInstalled ? (
                    <button className="btn btn-sm btn-ghost" disabled style={{ opacity: 0.8, color: 'var(--text-green)', borderColor: 'rgba(16,185,129,0.3)' }}>
                      ✅ Installed
                    </button>
                  ) : (
                    <button className={`btn btn-sm ${isInstalling ? 'btn-ghost' : 'btn-primary'}`}
                      onClick={() => installPkg(pkg.id)} disabled={!!isInstalling}>
                      {isInstalling ? <><Spinner size={12} />Installing…</> : '⬇ Install'}
                    </button>
                  )}
                </div>
                {isInstalling && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', padding: '0 12px 10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-accent)' }}>
                      <span>Downloading & extracting...</span>
                      <span className="font-mono" style={{ fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #7850ff, #a855f7)', borderRadius: 3, transition: 'width 0.2s ease-out' }} />
                    </div>
                  </div>
                )}
                {errors[pkg.id] && <div className="alert alert-danger" style={{ fontSize: 12, padding: '8px 12px' }}>❌ {errors[pkg.id]}</div>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="divider" />

      {/* ─── Part 1.5: Installed System Images ─── */}
      {(() => {
        const installedImages = systemImages.filter(img => img.installed || installedList.includes(img.id));
        if (installedImages.length === 0) return null;
        return (
          <div className="section">
            <div className="section-title">💾 Installed System Images (Ready to Use)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {installedImages.map(img => {
                const isInstalling = installing[img.id];
                const pct = progress[img.id] || 0;
                const parts = img.name.split(' · ');
                const version = parts[0] || 'Android';
                const variant = parts[1] || 'Google APIs';
                const arch = parts[2] || 'x86_64';
                
                return (
                  <div key={img.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="pkg-row" style={{ background: 'rgba(16,185,129,0.03)', borderColor: 'rgba(16,185,129,0.15)' }}>
                      <span style={{ fontSize: 22 }}>📱</span>
                      <div style={{ flex: 1 }}>
                        <div className="pkg-name" style={{ fontSize: 13, fontWeight: 600 }}>
                          {version} · {variant}
                          <span className="badge badge-ok" style={{ marginLeft: 8 }}>Ready</span>
                        </div>
                        <div className="pkg-desc" style={{ fontSize: 11 }}>Architecture: <span className="font-mono">{arch}</span></div>
                        <div className="font-mono text-muted" style={{ fontSize: 9, marginTop: 2 }}>{img.id}</div>
                      </div>
                      <button className={`btn btn-sm ${isInstalling ? 'btn-ghost' : 'btn-primary'}`}
                        onClick={() => installPkg(img.id)} disabled={!!isInstalling}>
                        {isInstalling ? <><Spinner size={10} />Updating…</> : '🔄 Update / Repair'}
                      </button>
                    </div>
                    {isInstalling && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', padding: '0 10px 8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-accent)' }}>
                          <span>Updating system image...</span>
                          <span className="font-mono" style={{ fontWeight: 600 }}>{pct}%</span>
                        </div>
                        <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #7850ff, #a855f7)', borderRadius: 2, transition: 'width 0.2s ease-out' }} />
                        </div>
                      </div>
                    )}
                    {errors[img.id] && <div className="alert alert-danger" style={{ fontSize: 10, padding: '5px 8px' }}>❌ {errors[img.id]}</div>}
                  </div>
                )
              })}
            </div>
            <div className="divider" style={{ marginTop: 20 }} />
          </div>
        )
      })()}

      {/* ─── Part 2: System Images Manager ─── */}
      <div className="section">
        <div className="section-title">📦 Download Android System Images (All Versions, TV, Wear OS)</div>
        
        <div className="flex gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={acceptLicenses} disabled={!!installing._licenses}>
            {installing._licenses ? <><Spinner size={12} />Accepting...</> : '📜 Accept All SDK Licenses'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={loadSdkImages} disabled={loadingImages}>
            {loadingImages ? <><Spinner size={12} />Fetching...</> : '🔄 Sync Google Repository'}
          </button>
        </div>

        {/* Search and Category Tabs */}
        <div className="search-input-wrapper">
          <input 
            className="form-input search-input" 
            placeholder="🔍 Search system images by API level, name, x86_64, etc..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>

        <div className="tabs">
          {TABS.map(tab => (
            <button 
              key={tab.id} 
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dynamic Package List */}
        {loadingImages ? (
          <div className="flex items-center justify-center" style={{ padding: 40, gap: 12 }}>
            <Spinner size={20} />
            <span className="text-muted">Fetching all available system images from Google APIs...</span>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 10px' }}>
            <div className="empty-icon" style={{ fontSize: 32 }}>📦</div>
            <div className="empty-title">No matches found</div>
            <div className="empty-desc" style={{ fontSize: 12 }}>Try syncing the Google repository or searching with a different keyword.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>
            {sortedGroupKeys.map(groupKey => {
              const groupImages = groups[groupKey];
              const isExpanded = !!expandedGroups[groupKey];
              const installedCount = groupImages.filter(img => installedList.includes(img.id)).length;
              
              return (
                <div key={groupKey} style={{ 
                  background: 'rgba(255,255,255,0.015)', 
                  borderRadius: 8, 
                  border: '1px solid rgba(255,255,255,0.04)',
                  overflow: 'hidden'
                }}>
                  {/* Accordion Header */}
                  <div 
                    onClick={() => setExpandedGroups(s => ({ ...s, [groupKey]: !s[groupKey] }))}
                    style={{ 
                      padding: '10px 14px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      cursor: 'pointer',
                      background: isExpanded ? 'rgba(120,80,255,0.05)' : 'transparent',
                      transition: 'background 0.2s ease',
                      userSelect: 'none'
                    }}
                    className="accordion-header"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>🤖</span>
                      <span style={{ fontWeight: 600, fontSize: 13, color: isExpanded ? 'var(--text-accent)' : 'var(--text-primary)' }}>
                        {groupKey}
                      </span>
                      <span className="badge" style={{ fontSize: 9, padding: '1px 5px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
                        {groupImages.length} {groupImages.length === 1 ? 'image' : 'images'}
                      </span>
                      {installedCount > 0 && (
                        <span className="badge badge-ok" style={{ fontSize: 9, padding: '1px 5px' }}>
                          {installedCount} Installed
                        </span>
                      )}
                    </div>
                    <span style={{ 
                      fontSize: 10, 
                      transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', 
                      transition: 'transform 0.15s ease',
                      color: 'var(--text-muted)'
                    }}>
                      ▼
                    </span>
                  </div>

                  {/* Accordion Body */}
                  {isExpanded && (
                    <div style={{ 
                      padding: '10px 12px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 8, 
                      background: 'rgba(0,0,0,0.12)',
                      borderTop: '1px solid rgba(255,255,255,0.03)' 
                    }}>
                      {groupImages.map(img => {
                        const isInstalled = img.installed || installedList.includes(img.id);
                        const isInstalling = installing[img.id];
                        const pct = progress[img.id] || 0;
                        const friendlySubName = img.name.split(' · ')[1] || img.name;
                        return (
                          <div key={img.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div className="pkg-row" style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.005)', border: '1px solid rgba(255,255,255,0.02)' }}>
                              <div style={{ flex: 1 }}>
                                <div className="pkg-name" style={{ fontSize: 12, fontWeight: 600 }}>
                                  {friendlySubName}
                                  {isInstalled && <span className="badge badge-ok" style={{ marginLeft: 8, padding: '1px 5px', fontSize: 9 }}>Installed</span>}
                                </div>
                                <div className="pkg-desc" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{img.desc || 'System image for emulator'}</div>
                                <div className="font-mono text-muted" style={{ fontSize: 8, marginTop: 1 }}>{img.id}</div>
                              </div>
                              {isInstalled ? (
                                <button className="btn btn-sm btn-ghost" disabled style={{ opacity: 0.8, color: 'var(--text-green)', borderColor: 'rgba(16,185,129,0.2)' }}>
                                  ✅ Installed
                                </button>
                              ) : (
                                <button className={`btn btn-sm ${isInstalling ? 'btn-ghost' : 'btn-primary'}`}
                                  onClick={() => installPkg(img.id)} disabled={!!isInstalling}>
                                  {isInstalling ? <><Spinner size={10} />Installing…</> : '⬇ Install'}
                                </button>
                              )}
                            </div>
                            {isInstalling && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', padding: '0 10px 8px 10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-accent)' }}>
                                  <span>Downloading system image...</span>
                                  <span className="font-mono" style={{ fontWeight: 600 }}>{pct}%</span>
                                </div>
                                <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #7850ff, #a855f7)', borderRadius: 2, transition: 'width 0.2s ease-out' }} />
                                </div>
                              </div>
                            )}
                            {errors[img.id] && <div className="alert alert-danger" style={{ fontSize: 10, padding: '5px 8px' }}>❌ {errors[img.id]}</div>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
