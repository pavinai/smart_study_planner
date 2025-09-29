// Shared app.js for Smart Study Planner - manages tasks across pages
const LS_KEY = 'smart_study_tasks_v1';

function loadTasks(){
  try{
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  }catch(e){
    return [];
  }
}
function saveTasks(tasks){
  localStorage.setItem(LS_KEY, JSON.stringify(tasks));
}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function escapeHtml(s=''){ return String(s).replace(/[&<>\"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])) }
function formatDateTime(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

// Expose a getter so other scripts/pages can access tasks
window.getTasks = loadTasks;
window.saveTasks = saveTasks;

// --- Index page behavior (form, list, timeline) ---
(function(){
  const form = document.getElementById('task-form');
  if(!form) return; // not on index page
  let tasks = loadTasks();

  // DOM refs
  const titleEl = document.getElementById('title');
  const descriptionEl = document.getElementById('description');
  const dueDateEl = document.getElementById('dueDate');
  const dueTimeEl = document.getElementById('dueTime');
  const subjectEl = document.getElementById('subject');
  const priorityEl = document.getElementById('priority');
  const estimateEl = document.getElementById('estimate');
  const repeatEl = document.getElementById('repeat');
  const tasksList = document.getElementById('tasksList');
  const timelineContainer = document.getElementById('timelineContainer');
  const searchEl = document.getElementById('search');
  const filterSubject = document.getElementById('filterSubject');
  const filterPriority = document.getElementById('filterPriority');
  const clearCompletedBtn = document.getElementById('clearCompleted');
  const exportBtn = document.getElementById('exportJson');
  const clearFormBtn = document.getElementById('clearForm');

  function save(){ saveTasks(tasks); }

  function renderSubjects(){
    const subjects = [...new Set(tasks.map(t=>t.subject).filter(Boolean))];
    filterSubject.innerHTML = '<option value="all">All subjects</option>' + subjects.map(s=>`<option value="${s}">${escapeHtml(s)}</option>`).join('');
  }

  function renderTasks(){
    tasksList.innerHTML = '';
    const q = (searchEl && searchEl.value.trim().toLowerCase()) || '';
    const fs = (filterSubject && filterSubject.value) || 'all';
    const fp = (filterPriority && filterPriority.value) || 'all';

    const filtered = tasks.filter(t=>{
      if(q && !((t.title||'').toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q))) return false;
      if(fs !== 'all' && t.subject !== fs) return false;
      if(fp !== 'all' && t.priority !== fp) return false;
      return true;
    }).sort((a,b)=> new Date(a.completed?1:0) - new Date(b.completed?1:0) || (new Date(a.due||0) - new Date(b.due||0)));

    if(filtered.length===0){ tasksList.innerHTML = '<li class="muted">No tasks found.</li>'; return; }

    filtered.forEach(t=>{
      const li = document.createElement('li');
      li.className = 'task-item';
      li.setAttribute('data-priority', t.priority || 'medium');
      li.innerHTML = `
        <div class="task-left">
          <input type="checkbox" data-id="${t.id}" class="task-check" ${t.completed? 'checked':''} />
          <div>
            <div><strong>${escapeHtml(t.title)}</strong></div>
            <div class="task-meta">${escapeHtml(t.subject || 'General')} · ${escapeHtml(t.priority||'medium')} · ${t.estimate? t.estimate+' min':''}</div>
          </div>
        </div>
        <div class="task-right">
          <div class="task-meta">${t.due? formatDateTime(t.due) : ''}</div>
          <div style="margin-top:6px">
            <button data-action="edit" data-id="${t.id}">Edit</button>
            <button data-action="delete" data-id="${t.id}">Delete</button>
          </div>
        </div>
      `;
      tasksList.appendChild(li);
    });
  }

  function renderTimeline(){
    if(tasks.length===0){ timelineContainer.textContent = 'No tasks yet — add your first task.'; return; }
    const dayBuckets = {};
    tasks.forEach(t=>{
      const day = t.due? new Date(t.due).toISOString().slice(0,10) : 'no-date';
      dayBuckets[day] = dayBuckets[day]||[];
      dayBuckets[day].push(t);
    });
    timelineContainer.innerHTML = Object.keys(dayBuckets).map(day=>{
      const dayLabel = day==='no-date'? 'No date' : day;
      const blocks = dayBuckets[day].map((t,i)=>{
        const cls = i%3===0? 'p1' : (i%3===1? 'p2' : 'p3');
        return `<div class="task-block ${cls}" title="${escapeHtml(t.title)}" style="left:${(i*20)%80}%">${escapeHtml(t.title.slice(0,12))}</div>`
      }).join('');
      return `<div style="margin-bottom:10px"><strong>${dayLabel}</strong><div class="bar">${blocks}</div></div>`;
    }).join('');
  }

  // events
  form.addEventListener('submit', e=>{
    e.preventDefault();
    const id = uid();
    const dueDate = dueDateEl.value;
    const dueTime = dueTimeEl.value;
    let due = null;
    if(dueDate){
      if(dueTime) due = new Date(dueDate + 'T' + dueTime);
      else due = new Date(dueDate + 'T00:00');
    }
    const task = {
      id,
      title: titleEl.value.trim(),
      description: descriptionEl.value.trim(),
      due: due? due.toISOString(): null,
      subject: subjectEl.value.trim(),
      priority: priorityEl.value,
      estimate: estimateEl.value? Number(estimateEl.value): null,
      repeat: repeatEl.value,
      createdAt: new Date().toISOString(),
      completed: false
    };
    tasks.push(task);
    save(); renderSubjects(); renderTasks(); renderTimeline();
    form.reset();
  });

  clearFormBtn.addEventListener('click', ()=>form.reset());

  tasksList.addEventListener('click', e=>{
    const action = e.target.dataset.action;
    const id = e.target.dataset.id;
    if(action==='delete'){
      tasks = tasks.filter(t=>t.id !== id);
      save(); renderSubjects(); renderTasks(); renderTimeline();
    } else if(action==='edit'){
      const t = tasks.find(x=>x.id===id);
      if(!t) return;
      titleEl.value = t.title; descriptionEl.value = t.description; subjectEl.value = t.subject || '';
      priorityEl.value = t.priority || 'medium'; estimateEl.value = t.estimate || '';
      if(t.due){ const d = new Date(t.due); dueDateEl.value = d.toISOString().slice(0,10); dueTimeEl.value = d.toTimeString().slice(0,5); }
      tasks = tasks.filter(x=>x.id!==id);
      save(); renderSubjects(); renderTasks(); renderTimeline();
    }
  });

  tasksList.addEventListener('change', e=>{
    if(e.target.classList.contains('task-check')){
      const id = e.target.dataset.id;
      const t = tasks.find(x=>x.id===id);
      if(t){ t.completed = e.target.checked; save(); renderTasks(); renderTimeline(); }
    }
  });

  searchEl.addEventListener('input', renderTasks);
  filterSubject.addEventListener('change', renderTasks);
  filterPriority.addEventListener('change', renderTasks);

  clearCompletedBtn.addEventListener('click', ()=>{
    tasks = tasks.filter(t=>!t.completed);
    save(); renderSubjects(); renderTasks(); renderTimeline();
  });

  exportBtn.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(tasks, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'study_tasks.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // initial render
  renderSubjects(); renderTasks(); renderTimeline();

  // simple reminder (optional)
  if('Notification' in window){
    if(Notification.permission === 'default') Notification.requestPermission();
  }
  setInterval(()=>{
    const now = new Date();
    tasks.forEach(t=>{
      if(t.completed || !t.due) return;
      const due = new Date(t.due);
      const diff = due - now;
      if(diff > 0 && diff < 5*60*1000){
        if(Notification.permission === 'granted'){
          new Notification('Upcoming task: ' + t.title, {body: 'Due at ' + due.toLocaleTimeString()});
        }
      }
    });
  }, 60*1000);

})(); // end index scope


// --- Insights rendering (used by insights.html) ---
window.renderInsights = function(){
  const container = document.getElementById('summaryStats');
  const listEl = document.getElementById('insightsTasks');
  if(!container || !listEl) return;
  const tasks = loadTasks();
  const total = tasks.length;
  const completed = tasks.filter(t=>t.completed).length;
  const upcoming = tasks.filter(t=>!t.completed && t.due && new Date(t.due) > new Date()).length;
  const overdue = tasks.filter(t=>!t.completed && t.due && new Date(t.due) < new Date()).length;
  container.innerHTML = `<div>Total tasks: <strong>${total}</strong> · Completed: <strong>${completed}</strong> · Upcoming: <strong>${upcoming}</strong> · Overdue: <strong>${overdue}</strong></div>`;
  listEl.innerHTML = tasks.map(t=>`<li class="task-item" data-priority="${t.priority||'medium'}"><div><strong>${escapeHtml(t.title)}</strong><div class="task-meta">${escapeHtml(t.subject||'General')} · ${formatDateTime(t.due)}</div></div></li>`).join('') || '<li>No tasks</li>';
};


// --- Focus Mode (extra.html) ---
window.initFocusMode = function(){
  const titleEl = document.getElementById('current-task');
  const dueEl = document.getElementById('current-task-due-val');
  const subjectEl = document.getElementById('current-task-subject-val');
  const titleLabel = document.getElementById('current-task-title');
  const pickBtn = document.getElementById('pick-next');
  const tasks = loadTasks();

  function pickNext(){
    const nxt = tasks.filter(t=>!t.completed).sort((a,b)=> new Date(a.due||0) - new Date(b.due||0))[0];
    if(!nxt){
      titleEl.textContent = 'No task selected.';
      dueEl.textContent = '—';
      subjectEl.textContent = '—';
      return null;
    }
    titleEl.textContent = nxt.title;
    dueEl.textContent = formatDateTime(nxt.due);
    subjectEl.textContent = nxt.subject || 'General';
    return nxt;
  }

  if(pickBtn) pickBtn.addEventListener('click', pickNext);
  pickNext();

  // Pomodoro timer (basic)
  const timerEl = document.getElementById('timer');
  const startBtn = document.getElementById('timer-start');
  const pauseBtn = document.getElementById('timer-pause');
  const resetBtn = document.getElementById('timer-reset');
  let duration = 25*60; // seconds
  let remaining = duration;
  let timerId = null;

  function updateDisplay(){
    const m = Math.floor(remaining/60).toString().padStart(2,'0');
    const s = (remaining%60).toString().padStart(2,'0');
    if(timerEl) timerEl.textContent = `${m}:${s}`;
  }
  function tick(){
    if(remaining<=0){ clearInterval(timerId); timerId=null; return; }
    remaining -= 1;
    updateDisplay();
  }
  if(startBtn) startBtn.addEventListener('click', ()=>{ if(!timerId){ timerId = setInterval(tick,1000); } });
  if(pauseBtn) pauseBtn.addEventListener('click', ()=>{ if(timerId){ clearInterval(timerId); timerId=null; } });
  if(resetBtn) resetBtn.addEventListener('click', ()=>{ remaining = duration; updateDisplay(); if(timerId){ clearInterval(timerId); timerId=null; } });
  updateDisplay();
}; // end focus mode
