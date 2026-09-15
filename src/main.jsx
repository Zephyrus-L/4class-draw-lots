import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { invoke } from '@tauri-apps/api/core'
import { Clipboard, Download, FileUp, Github, History, Info, List, PanelLeftClose, PanelLeftOpen, Play, Plus, RotateCcw, Settings2, Trash2, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { weightedPick } from './weightedPick.js'
import './styles.css'
import './selection.css'
import './theme.css'

const initialPeople = ['林晓', '周宁', '陈默', '王悦', '刘洋', '赵安', '孙妍', '李想']
const APP_VERSION = '1.0.2'
const defaultState = { schemaVersion: 2, groups: [{ id: '001', name: '默认名单', people: initialPeople.map((name, id) => ({ id, name, drawn: false })), selectedPersonIds: [] }], draws: [], settings: { count: 1, removeDrawn: true, recordHistory: true, activeGroup: '001', tab: 'draw' } }

function normalize(saved) {
  const source = saved?.groups ? saved : { ...defaultState, groups: [{ ...defaultState.groups[0], people: saved?.people || [] }] }
  const groups = (source.groups?.length ? source.groups : defaultState.groups).map((item, index) => {
    const people = (item.people || []).map((person, personIndex) => ({ id: person.id ?? `${item.id}-${personIndex}`, name: String(person.name || '').trim(), drawn: Boolean(person.drawn) })).filter((person) => person.name)
    const peopleIds = new Set(people.map((person) => String(person.id)))
    return { id: String(item.id || String(index + 1).padStart(3, '0')), name: item.name || `名单组 ${item.id}`, people, selectedPersonIds: (item.selectedPersonIds || []).map(String).filter((id) => peopleIds.has(id)) }
  })
  const settings = { ...defaultState.settings, ...(source.settings || {}) }
  settings.activeGroup = groups.some((item) => item.id === settings.activeGroup) ? settings.activeGroup : groups[0].id
  return { schemaVersion: 2, groups, draws: Array.isArray(source.draws) ? source.draws : [], settings }
}

function useAppData() {
  const [data, setData] = useState(defaultState)
  const [weights, setWeights] = useState({})
  useEffect(() => {
    invoke('load_data').then((saved) => setData(normalize(saved))).catch(() => { try { const saved = localStorage.getItem('4class-draw-lots-data'); if (saved) setData(normalize(JSON.parse(saved))) } catch {} })
    invoke('load_probabilities').then(setWeights).catch(() => {})
  }, [])
  const save = (next) => { const normalized = normalize(next); setData(normalized); localStorage.setItem('4class-draw-lots-data', JSON.stringify(normalized)); invoke('save_data', { data: normalized }).catch(() => {}) }
  return [data, save, weights]
}

function App() {
  const [data, save, weights] = useAppData()
  const [result, setResult] = useState([])
  const [rolling, setRolling] = useState(false)
  const [input, setInput] = useState('')
  const [manageSelected, setManageSelected] = useState(new Set())
  const [historySelected, setHistorySelected] = useState(new Set())
  const [historyGroup, setHistoryGroup] = useState('all')
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFields, setExportFields] = useState({ batch: true, group: true, time: true, names: true })
  const [copied, setCopied] = useState(false)
  const [rollingName, setRollingName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const dragStart = useRef(false)
  const rollingTimer = useRef(null)
  const drawTimer = useRef(null)
  const tab = data.settings.tab || 'draw'
  const activeGroup = data.settings.activeGroup || data.groups[0].id
  const group = data.groups.find((item) => item.id === activeGroup) || data.groups[0]
  const people = group?.people || []
  const selected = new Set((group?.selectedPersonIds || []).map(String))
  const count = Number(data.settings.count) || 1
  const removeDrawn = data.settings.removeDrawn !== false
  const recordHistory = data.settings.recordHistory !== false
  const available = people.filter((person) => (!removeDrawn || !person.drawn) && (!selected.size || selected.has(String(person.id))))

  const updateSettings = (patch) => save({ ...data, settings: { ...data.settings, ...patch } })
  const setTab = (value) => updateSettings({ tab: value })
  const selectGroup = (id) => { updateSettings({ activeGroup: id }); setResult([]) }
  const changeSelection = (next) => save({ ...data, groups: data.groups.map((item) => item.id === group.id ? { ...item, selectedPersonIds: [...next] } : item) })
  const togglePerson = (id) => { const next = new Set(selected); next.has(String(id)) ? next.delete(String(id)) : next.add(String(id)); changeSelection(next) }
  const draw = () => {
    if (rolling || !available.length) return
    const amount = Math.min(Math.max(1, count), available.length)
    const pool = [...available]; const picked = []
    for (let index = 0; index < amount; index += 1) { const chosen = weightedPick(pool, weights, group.id); picked.push(pool.splice(pool.findIndex((person) => person.id === chosen.id), 1)[0]) }
    const animate = (delay, index) => {
      rollingTimer.current = window.setTimeout(() => {
        setRollingName(people[index % people.length]?.name || '')
        if (delay < 170) animate(delay + 14, index + 1)
      }, delay)
    }
    animate(20, 0)
    setRolling(true)
    drawTimer.current = window.setTimeout(() => {
      window.clearTimeout(rollingTimer.current)
      const now = new Date().toLocaleString('zh-CN', { hour12: false })
      const nextGroups = data.groups.map((item) => item.id !== group.id || !removeDrawn ? item : { ...item, people: item.people.map((person) => picked.some((one) => one.id === person.id) ? { ...person, drawn: true } : person) })
      const nextDraw = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, groupId: group.id, groupName: group.name, time: now, createdAt: new Date().toISOString(), names: picked.map((item) => item.name) }
      save({ ...data, groups: nextGroups, draws: recordHistory ? [nextDraw, ...data.draws] : data.draws })
      setRollingName(picked[0]?.name || '')
      setResult(picked.map((item) => item.name)); setRolling(false)
    }, 1250)
  }
  const resetDrawn = () => { if (rolling) return; save({ ...data, groups: data.groups.map((item) => item.id === group.id ? { ...item, selectedPersonIds: [], people: item.people.map((person) => ({ ...person, drawn: false })) } : item) }); setResult([]) }
  const addPeople = () => { const names = input.split(/[,，\n\r]+/).map((name) => name.trim()).filter(Boolean); const existing = new Set(people.map((person) => person.name)); const additions = names.filter((name) => !existing.has(name)).map((name, index) => ({ id: `${Date.now()}-${index}`, name, drawn: false })); if (additions.length) save({ ...data, groups: data.groups.map((item) => item.id === group.id ? { ...item, people: [...item.people, ...additions] } : item) }); setInput('') }
  const importFile = (event) => { const file = event.target.files?.[0]; if (!file) return; if (/\.xlsx?$/i.test(file.name)) file.arrayBuffer().then((buffer) => { const workbook = XLSX.read(buffer, { type: 'array' }); const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }); setInput(rows.flat().filter(Boolean).join('\n')) }); else { const reader = new FileReader(); reader.onload = () => setInput(String(reader.result).replace(/\r/g, '')); reader.readAsText(file) }; event.target.value = '' }
  const removeManagedPeople = (ids = manageSelected) => { if (!ids.size) return; save({ ...data, groups: data.groups.map((item) => item.id === group.id ? { ...item, selectedPersonIds: item.selectedPersonIds.filter((id) => !ids.has(String(id))), people: item.people.filter((person) => !ids.has(String(person.id))) } : item) }); setManageSelected(new Set()) }
  const addSelectedToGroup = () => { if (!manageSelected.size) return; const id = String(Math.max(...data.groups.map((item) => Number(item.id) || 0), 0) + 1).padStart(3, '0'); const copied = people.filter((person) => manageSelected.has(String(person.id))).map((person, index) => ({ ...person, id: `${Date.now()}-${index}`, drawn: false })); save({ ...data, groups: [...data.groups, { id, name: `名单组 ${id}`, people: copied, selectedPersonIds: [] }], settings: { ...data.settings, activeGroup: id } }); setManageSelected(new Set()) }
  const addGroup = () => { const id = String(Math.max(...data.groups.map((item) => Number(item.id) || 0), 0) + 1).padStart(3, '0'); save({ ...data, groups: [...data.groups, { id, name: `名单组 ${id}`, people: [], selectedPersonIds: [] }], settings: { ...data.settings, activeGroup: id } }) }
  const renameGroup = () => { const name = window.prompt('请输入名单组名称', group.name)?.trim(); if (name) save({ ...data, groups: data.groups.map((item) => item.id === group.id ? { ...item, name } : item) }) }
  const removeGroup = () => { if (data.groups.length <= 1 || !window.confirm(`确定删除“${group.name}”吗？`)) return; const nextGroups = data.groups.filter((item) => item.id !== group.id); save({ ...data, groups: nextGroups, settings: { ...data.settings, activeGroup: nextGroups[0].id } }); setManageSelected(new Set()) }
  const deleteHistory = () => { if (!historySelected.size) return; save({ ...data, draws: data.draws.filter((item) => !historySelected.has(String(item.id))) }); setHistorySelected(new Set()) }
  const filteredDraws = data.draws.filter((item) => historyGroup === 'all' || item.groupId === historyGroup)
  const copyResult = () => { if (!result.length || !navigator.clipboard) return; navigator.clipboard.writeText(result.join('、')).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1200) }).catch(() => {}) }
  const exportHistory = (format) => { const fields = Object.entries(exportFields).filter(([, enabled]) => enabled).map(([key]) => key); const headers = { batch: '批次号', group: '名单组', time: '时间', names: '姓名' }; const rows = filteredDraws.filter((item) => !historySelected.size || historySelected.has(String(item.id))).map((item, index) => fields.map((field) => field === 'batch' ? String(filteredDraws.length - index).padStart(2, '0') : field === 'group' ? `${item.groupId} · ${item.groupName || ''}` : field === 'names' ? item.names.join('、') : item.time)); const text = format === 'csv' ? [fields.map((field) => headers[field]), ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n') : [fields.map((field) => headers[field]).join('\t'), ...rows.map((row) => row.join('\t'))].join('\n'); const blob = new Blob([`\uFEFF${text}`], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `4class-${new Date().toISOString().slice(0, 10)}.${format === 'csv' ? 'csv' : 'txt'}`; link.click(); URL.revokeObjectURL(link.href); setExportOpen(false) }
  useEffect(() => () => { if (rollingTimer.current) window.clearTimeout(rollingTimer.current); if (drawTimer.current) window.clearTimeout(drawTimer.current) }, [])
  const pointerDown = (id) => { dragStart.current = true; setDragging(true); togglePerson(id) }
  const pointerEnter = (id) => { if (dragStart.current && !selected.has(String(id))) togglePerson(id) }
  const endDrag = () => { dragStart.current = false; setDragging(false) }

  const groupBar = tab === 'draw' ? <div className="group-bar"><span>当前名单组</span>{data.groups.map((item) => <button disabled={rolling} className={item.id === group.id ? 'selected' : ''} key={item.id} onClick={() => selectGroup(item.id)}>{item.id} · {item.name}</button>)}</div> : tab === 'people' ? <div className="group-bar"><span>当前名单组</span>{data.groups.map((item) => <button className={item.id === group.id ? 'selected' : ''} key={item.id} onClick={() => selectGroup(item.id)}>{item.id} · {item.name}</button>)}<button className="add-group" onClick={addGroup}><Plus size={13} />新建名单组</button><button onClick={renameGroup}>重命名</button><button className="delete-group-action" disabled={data.groups.length <= 1} onClick={removeGroup}><X size={13} />删除当前组</button></div> : null
  const stats = Object.entries(filteredDraws.flatMap((item) => item.names).reduce((map, name) => { map[name] = (map[name] || 0) + 1; return map }, {})).sort(([, a], [, b]) => b - a)
  const openGithub = () => invoke('open_github').catch(() => window.open('https://github.com/Zephyrus-L/4class-draw-lots', '_blank', 'noopener,noreferrer'))
  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} onPointerUp={endDrag}>
    <div className="workspace"><aside className="sidebar"><div className="sidebar-brand"><img className="brand-icon" src="/icons/app-icon.png" alt="4class抽签" /><div><strong>4class抽签</strong><small>简洁 · 专注 · 公平</small></div></div><button className="sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}>{sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button><nav><button disabled={rolling} className={tab === 'draw' ? 'active' : ''} onClick={() => setTab('draw')}><Play size={17} />开始抽签</button><button disabled={rolling} className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}><List size={17} />名单管理</button><button disabled={rolling} className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><History size={17} />抽签记录<span className="nav-count">{data.draws.length}</span></button><button disabled={rolling} className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}><Info size={17} />关于</button></nav><div className="sidebar-foot"><Settings2 size={15} />数据保存在程序目录 / data</div></aside>
      <main className="main-content">{groupBar}
        {tab === 'draw' && <section className="draw-page"><div className="page-heading"><div><p className="eyebrow">名单组 {group.id}</p><h1>准备好了吗？</h1><p className="muted">从 {people.length} 位名单中，随机抽取今天的幸运对象。</p></div><button className="ghost-button" disabled={rolling} onClick={resetDrawn}><RotateCcw size={16} />重置本轮</button></div><div className="draw-layout"><section className="result-panel"><div className="panel-label">本次抽取结果</div><div className={`result-stage ${rolling ? 'rolling' : ''}`} onClick={draw}>{rolling ? <div className="result-name rolling-preview">{rollingName}</div> : result.length ? result.map((name) => <div className="result-name" key={name}>{name}</div>) : <div className="empty-result"><span>?</span><p>点击开始抽签</p></div>}<button className="copy-result" onClick={(event) => { event.stopPropagation(); copyResult() }} disabled={!result.length || rolling} title="复制结果"><Clipboard size={15} /></button></div><button className="draw-button" disabled={!available.length || rolling} onClick={draw}><Play size={18} fill="currentColor" />{rolling ? '抽取中...' : '开始抽签'}</button>{copied && <p className="copy-feedback">已复制当前结果</p>}{!available.length && <p className="warning">没有可抽取对象，请调整选择或重置本轮</p>}</section><section className="settings-panel"><div className="panel-label">抽签设置</div><label>抽取人数<div className="stepper"><button disabled={rolling} onClick={() => updateSettings({ count: Math.max(1, count - 1) })}>−</button><strong>{count}</strong><button disabled={rolling} onClick={() => updateSettings({ count: Math.min(people.length || 1, count + 1) })}>+</button></div></label><label className="switch-row"><span><strong>抽中后移除</strong><small>本轮不再重复抽取</small></span><button disabled={rolling} className={`switch ${removeDrawn ? 'on' : ''}`} onClick={() => updateSettings({ removeDrawn: !removeDrawn })}><i /></button></label><label className="switch-row"><span><strong>记录抽签历史</strong><small>保存本次结果到历史记录</small></span><button disabled={rolling} className={`switch ${recordHistory ? 'on' : ''}`} onClick={() => updateSettings({ recordHistory: !recordHistory })}><i /></button></label><div className="setting-note"><strong>{available.length}</strong><span>人可参与本次抽签</span></div></section></div><section className="selection-card"><div className="selection-head"><div><strong>选择参与者</strong><small>{selected.size ? `已选择 ${selected.size} 人` : '点击或按住拖选，默认全体参与'}</small></div>{selected.size > 0 && <button disabled={rolling} onClick={() => changeSelection(new Set())}>清除选择</button>}</div><div className={`person-grid ${dragging ? 'dragging' : ''}`}>{people.map((person) => <button disabled={rolling} key={person.id} className={`${selected.has(String(person.id)) ? 'chosen' : ''} ${person.drawn ? 'drawn' : ''}`} onPointerDown={() => pointerDown(person.id)} onPointerEnter={() => pointerEnter(person.id)}>{person.name}{person.drawn && <small>已抽取</small>}</button>)}</div></section></section>}
        {tab === 'people' && <section className="content-page"><div className="page-heading"><div><p className="eyebrow">名单管理</p><h1>管理参与者</h1><p className="muted">固定编号 {group.id} · {group.name}</p></div><label className="outline-button"><FileUp size={16} />导入文件<input type="file" accept=".txt,.csv,.xls,.xlsx" onChange={importFile} /></label></div><div className="people-editor"><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="请输入姓名，例如：\n林晓\n周宁\n陈默" /><button className="draw-button compact" onClick={addPeople}>添加到名单</button></div><div className="list-card"><div className="list-header"><strong>当前名单组 · {group.id}</strong><div className="manage-actions"><span>{people.length} 人</span><button onClick={() => setManageSelected(manageSelected.size === people.length ? new Set() : new Set(people.map((person) => String(person.id))))}>{manageSelected.size === people.length ? '取消全选' : '全选'}</button><button className="delete-selected" disabled={!manageSelected.size} onClick={removeManagedPeople}><Trash2 size={14} />删除选中</button><button disabled={!manageSelected.size} onClick={addSelectedToGroup}><Plus size={14} />选中添加到新组</button></div></div>{people.map((person) => <div className={`person-row ${manageSelected.has(String(person.id)) ? 'managed-selected' : ''}`} key={person.id} onClick={() => setManageSelected((current) => { const next = new Set(current); next.has(String(person.id)) ? next.delete(String(person.id)) : next.add(String(person.id)); return next })}><input type="checkbox" checked={manageSelected.has(String(person.id))} readOnly /><span className={person.drawn ? 'person-drawn' : ''}>{person.name}</span>{person.drawn && <em>已抽取</em>}<button onClick={(event) => { event.stopPropagation(); removeManagedPeople(new Set([String(person.id)])) }} aria-label={`删除${person.name}`}><X size={15} /></button></div>)}</div></section>}
        {tab === 'history' && <section className="content-page"><div className="page-heading"><div><p className="eyebrow">历史记录</p><h1>抽签记录</h1><p className="muted">共 {filteredDraws.length} 批，{filteredDraws.flatMap((item) => item.names).length} 人次。</p></div><div className="history-actions"><button className="ghost-button" disabled={!historySelected.size} onClick={deleteHistory}><Trash2 size={16} />删除选中</button><button className="ghost-button" onClick={() => setExportOpen(!exportOpen)}><Download size={16} />导出</button></div></div><div className="history-toolbar"><select value={historyGroup} onChange={(event) => { setHistoryGroup(event.target.value); setHistorySelected(new Set()) }}><option value="all">全部名单组</option>{data.groups.map((item) => <option value={item.id} key={item.id}>{item.id} · {item.name}</option>)}</select><button onClick={() => setHistorySelected(historySelected.size === filteredDraws.length ? new Set() : new Set(filteredDraws.map((item) => String(item.id))))}>{historySelected.size === filteredDraws.length ? '取消全选' : '全选当前记录'}</button>{exportOpen && <div className="export-panel"><strong>导出内容</strong>{Object.entries({ batch: '批次号', group: '名单组', time: '时间', names: '姓名' }).map(([key, label]) => <label key={key}><input type="checkbox" checked={exportFields[key]} onChange={() => setExportFields({ ...exportFields, [key]: !exportFields[key] })} />{label}</label>)}<div><button onClick={() => exportHistory('csv')}>导出 CSV</button><button onClick={() => exportHistory('txt')}>导出 TXT</button></div></div>}</div><div className="history-list">{filteredDraws.length ? filteredDraws.map((item, index) => <label className={`history-row ${historySelected.has(String(item.id)) ? 'history-selected' : ''}`} key={item.id}><input type="checkbox" checked={historySelected.has(String(item.id))} onChange={() => setHistorySelected((current) => { const next = new Set(current); next.has(String(item.id)) ? next.delete(String(item.id)) : next.add(String(item.id)); return next })} /><span className="batch">{String(filteredDraws.length - index).padStart(2, '0')}</span><div><strong>{item.names.join('、')}</strong><small>名单组 {item.groupId || '001'} · {item.groupName || ''} · {item.time}</small></div><span className="history-count">{item.names.length} 人</span></label>) : <div className="blank"><History size={28} /><p>还没有抽签记录</p></div>}</div><div className="stats-panel"><div className="panel-label">抽取统计</div><div className="stats-summary"><span><strong>{filteredDraws.length}</strong>批次</span><span><strong>{filteredDraws.flatMap((item) => item.names).length}</strong>人次</span><span><strong>{stats.length}</strong>人</span></div><div className="stats-list">{stats.map(([name, times]) => <div key={name}><span>{name}</span><strong>{times} 次</strong></div>)}</div></div></section>}
        {tab === 'about' && <section className="content-page about-page"><p className="eyebrow">关于应用</p><h1>4class抽签</h1><p className="muted">简洁、专注、公平的本地抽签工具。</p><div className="about-block"><Info size={20} /><div><strong>当前版本</strong><p>{APP_VERSION}</p></div></div><button className="about-link" onClick={openGithub}><Github size={18} />访问 GitHub 项目</button></section>}
      </main></div></div>
}
createRoot(document.getElementById('root')).render(<App />)
