import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { invoke } from '@tauri-apps/api/core'
import { FileUp, History, List, Play, RotateCcw, Settings2, Trash2, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { weightedPick } from './weightedPick.js'
import './styles.css'
import './selection.css'
import './theme.css'

const initialPeople = ['林晓', '周宁', '陈默', '王悦', '刘洋', '赵安', '孙妍', '李想']
const defaultState = { groups: [{ id: '001', name: '默认名单', people: initialPeople.map((name, id) => ({ id, name, drawn: false })) }], draws: [] }

function useAppData() {
  const [data, setData] = useState(defaultState)
  const [weights, setWeights] = useState({})
  useEffect(() => {
    invoke('load_data').then((saved) => setData(saved.groups ? saved : { ...defaultState, groups: [{ ...defaultState.groups[0], people: saved.people || [] }] })).catch(() => {
      const saved = localStorage.getItem('draw-lottery-data')
      if (saved) setData(JSON.parse(saved))
    })
    invoke('load_probabilities').then(setWeights).catch(() => {})
  }, [])
  const save = (next) => { setData(next); localStorage.setItem('draw-lottery-data', JSON.stringify(next)); invoke('save_data', { data: next }).catch(() => {}) }
  return [data, save, weights]
}

function App() {
  const [data, save, weights] = useAppData()
  const [tab, setTab] = useState('draw')
  const [activeGroup, setActiveGroup] = useState('001')
  const [count, setCount] = useState(1)
  const [removeDrawn, setRemoveDrawn] = useState(true)
  const [result, setResult] = useState([])
  const [rolling, setRolling] = useState(false)
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [manageSelected, setManageSelected] = useState(new Set())
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef(false)
  const group = data.groups.find((item) => item.id === activeGroup) || data.groups[0]
  const people = group?.people || []
  const available = people.filter((person) => (!removeDrawn || !person.drawn) && (!selected.size || selected.has(person.id)))

  const togglePerson = (id) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  const draw = () => {
    if (rolling || !available.length) return
    const amount = Math.min(Math.max(1, Number(count) || 1), available.length)
    setRolling(true)
    window.setTimeout(() => {
      const pool = [...available]; const picked = []
      for (let i = 0; i < amount; i += 1) {
        const chosen = weightedPick(pool, weights, group.id)
        const index = pool.findIndex((person) => person.id === chosen.id)
        picked.push(pool.splice(index < 0 ? pool.length - 1 : index, 1)[0])
      }
      const now = new Date().toLocaleString('zh-CN', { hour12: false })
      const nextGroups = data.groups.map((item) => item.id !== group.id || !removeDrawn ? item : { ...item, people: item.people.map((person) => picked.some((one) => one.id === person.id) ? { ...person, drawn: true } : person) })
      save({ groups: nextGroups, draws: [{ id: Date.now(), groupId: group.id, groupName: group.name, time: now, names: picked.map((item) => item.name) }, ...data.draws] })
      setResult(picked.map((item) => item.name)); setSelected(new Set()); setRolling(false)
    }, 650)
  }
  const resetDrawn = () => save({ ...data, groups: data.groups.map((item) => item.id === group.id ? { ...item, people: item.people.map((person) => ({ ...person, drawn: false })) } : item) })
  const addPeople = () => { const names = input.split(/[,，\n\r]+/).map((name) => name.trim()).filter(Boolean); const existing = new Set(people.map((person) => person.name)); const additions = names.filter((name) => !existing.has(name)).map((name, index) => ({ id: Date.now() + index, name, drawn: false })); if (additions.length) save({ ...data, groups: data.groups.map((item) => item.id === group.id ? { ...item, people: [...item.people, ...additions] } : item) }); setInput('') }
  const removePerson = (id) => save({ ...data, groups: data.groups.map((item) => item.id === group.id ? { ...item, people: item.people.filter((person) => person.id !== id) } : item) })
  const removeManagedPeople = () => { if (!manageSelected.size) return; save({ ...data, groups: data.groups.map((item) => item.id === group.id ? { ...item, people: item.people.filter((person) => !manageSelected.has(person.id)) } : item) }); setManageSelected(new Set()) }
  const toggleManagedPerson = (id) => setManageSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  const addGroup = () => { const id = String(Math.max(...data.groups.map((item) => Number(item.id) || 0), 0) + 1).padStart(3, '0'); save({ ...data, groups: [...data.groups, { id, name: `名单组 ${id}`, people: [] }] }); setActiveGroup(id) }
  const removeGroup = (id) => { if (data.groups.length <= 1) return; const nextGroups = data.groups.filter((item) => item.id !== id); save({ ...data, groups: nextGroups }); if (activeGroup === id) setActiveGroup(nextGroups[0].id); setManageSelected(new Set()); setSelected(new Set()) }
  const clearHistory = () => save({ ...data, draws: [] })
  const importFile = (event) => { const file = event.target.files?.[0]; if (!file) return; if (/\.xlsx?$/i.test(file.name)) file.arrayBuffer().then((buffer) => { const workbook = XLSX.read(buffer, { type: 'array' }); const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }); setInput(rows.flat().filter(Boolean).join('\n')) }); else { const reader = new FileReader(); reader.onload = () => setInput(String(reader.result).replace(/\r/g, '')); reader.readAsText(file) }; event.target.value = '' }
  const pointerDown = (id) => { dragStart.current = true; setDragging(true); togglePerson(id) }
  const pointerEnter = (id) => { if (dragStart.current) setSelected((current) => new Set(current).add(id)) }
  const endDrag = () => { dragStart.current = false; setDragging(false) }

  return <div className="app-shell" onPointerUp={endDrag}>
    <header className="topbar"><div className="brand"><img className="brand-icon" src="/icons/app-icon.png" alt="抽签" /><div><strong>抽签</strong><small>简洁 · 专注 · 公平</small></div></div></header>
    <div className="workspace"><aside className="sidebar"><nav><button className={tab === 'draw' ? 'active' : ''} onClick={() => setTab('draw')}><Play size={17} />开始抽签</button><button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}><List size={17} />名单管理</button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><History size={17} />抽签记录<span className="nav-count">{data.draws.length}</span></button></nav><div className="sidebar-foot"><Settings2 size={15} />数据保存在程序目录 / data</div></aside>
      <main className="main-content">
        <div className="group-bar"><span>当前名单组</span>{data.groups.map((item) => <div className={`group-pill ${item.id === activeGroup ? 'selected' : ''}`} key={item.id}><button onClick={() => { setActiveGroup(item.id); setSelected(new Set()); setManageSelected(new Set()) }}>{item.id} · {item.name}</button><button className="delete-group" disabled={data.groups.length <= 1} onClick={() => removeGroup(item.id)} title="删除名单组"><X size={13} /></button></div>)}<button className="add-group" onClick={addGroup}>＋ 新建名单组</button></div>
        {tab === 'draw' && <section className="draw-page"><div className="page-heading"><div><p className="eyebrow">名单组 {group.id}</p><h1>准备好了吗？</h1><p className="muted">从 {people.length} 位名单中，随机抽取今天的幸运对象。</p></div><button className="ghost-button" onClick={resetDrawn}><RotateCcw size={16} />重置本轮</button></div><div className="draw-layout"><section className="result-panel"><div className="panel-label">本次抽取结果</div><div className={`result-stage ${rolling ? 'rolling' : ''}`}>{result.length ? result.map((name) => <div className="result-name" key={name}>{name}</div>) : <div className="empty-result"><span>?</span><p>点击开始抽签</p></div>}</div><button className="draw-button" disabled={!available.length || rolling} onClick={draw}><Play size={18} fill="currentColor" />{rolling ? '抽取中...' : '开始抽签'}</button>{!available.length && <p className="warning">没有可抽取对象，请调整选择或重置本轮</p>}</section><section className="settings-panel"><div className="panel-label">抽签设置</div><label>抽取人数<div className="stepper"><button onClick={() => setCount(Math.max(1, count - 1))}>−</button><strong>{count}</strong><button onClick={() => setCount(Math.min(people.length || 1, count + 1))}>+</button></div></label><label className="switch-row"><span><strong>抽中后移除</strong><small>本轮不再重复抽取</small></span><button className={`switch ${removeDrawn ? 'on' : ''}`} onClick={() => setRemoveDrawn(!removeDrawn)}><i /></button></label><div className="setting-note"><strong>{available.length}</strong><span>人可参与本次抽签</span></div></section></div><section className="selection-card"><div className="selection-head"><div><strong>选择参与者</strong><small>{selected.size ? `已选择 ${selected.size} 人` : '点击或按住拖选，默认全体参与'}</small></div>{selected.size > 0 && <button onClick={() => setSelected(new Set())}>清除选择</button>}</div><div className={`person-grid ${dragging ? 'dragging' : ''}`}>{people.map((person) => <button key={person.id} className={`${selected.has(person.id) ? 'chosen' : ''} ${person.drawn ? 'drawn' : ''}`} onPointerDown={() => pointerDown(person.id)} onPointerEnter={() => pointerEnter(person.id)}>{person.name}{person.drawn && <small>已抽</small>}</button>)}</div></section></section>}
        {tab === 'people' && <section className="content-page"><div className="page-heading"><div><p className="eyebrow">名单管理</p><h1>管理参与者</h1><p className="muted">固定编号 {group.id} · {group.name}</p></div><label className="outline-button"><FileUp size={16} />导入文件<input type="file" accept=".txt,.csv,.xls,.xlsx" onChange={importFile} /></label></div><div className="people-editor"><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="请输入姓名，例如：\n林晓\n周宁\n陈默" /><button className="draw-button compact" onClick={addPeople}>添加到名单</button></div><div className="list-card"><div className="list-header"><strong>当前名单组 · {group.id}</strong><div className="manage-actions"><span>{people.length} 人</span><button onClick={() => setManageSelected(manageSelected.size === people.length ? new Set() : new Set(people.map((person) => person.id)))}>{manageSelected.size === people.length ? '取消全选' : '全选'}</button><button className="delete-selected" disabled={!manageSelected.size} onClick={removeManagedPeople}><Trash2 size={14} />删除选中</button></div></div>{people.map((person) => <div className={`person-row ${manageSelected.has(person.id) ? 'managed-selected' : ''}`} key={person.id} onClick={() => toggleManagedPerson(person.id)}><input type="checkbox" checked={manageSelected.has(person.id)} onChange={() => toggleManagedPerson(person.id)} onClick={(event) => event.stopPropagation()} /><span className={person.drawn ? 'person-drawn' : ''}>{person.name}</span>{person.drawn && <em>已抽取</em>}<button onClick={(event) => { event.stopPropagation(); removePerson(person.id) }} aria-label={`删除${person.name}`}><X size={15} /></button></div>)}</div></section>}
        {tab === 'history' && <section className="content-page"><div className="page-heading"><div><p className="eyebrow">历史记录</p><h1>抽签记录</h1><p className="muted">每一次抽签都会自动保存到本地。</p></div><button className="ghost-button danger" onClick={clearHistory}><Trash2 size={16} />清空记录</button></div><div className="history-list">{data.draws.length ? data.draws.map((item, index) => <div className="history-row" key={item.id}><span className="batch">{String(data.draws.length - index).padStart(2, '0')}</span><div><strong>{item.names.join('、')}</strong><small>名单组 {item.groupId || '001'} · {item.time}</small></div><span className="history-count">{item.names.length} 人</span></div>) : <div className="blank"><History size={28} /><p>还没有抽签记录</p></div>}</div></section>}
      </main></div></div>
}
createRoot(document.getElementById('root')).render(<App />)
