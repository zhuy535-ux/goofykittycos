import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';
import { api } from '../api/client';
import type { Todo } from '../types';

export default function Todos() {
  const user = useAuth((s) => s.user)!;
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState('');

  const load = async () => setTodos(await api.get<Todo[]>(`/todos?user_id=${user.id}`));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!title.trim()) return;
    await api.post<Todo>('/todos', { user_id: user.id, title: title.trim() });
    setTitle('');
    load();
  };

  const toggle = async (t: Todo) => {
    await api.patch(`/todos/${t.id}`, { done: t.done ? 0 : 1 });
    load();
  };

  const del = async (t: Todo) => {
    await api.del(`/todos/${t.id}`);
    load();
  };

  return (
    <>
      <h2>To-Do List</h2>
      <div className="card" style={{ display: 'flex', gap: 8 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's next?" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="primary" onClick={add}>Add</button>
      </div>

      {todos.length === 0 && <p className="list-empty">No to-dos yet.</p>}
      {todos.map((t) => (
        <div key={t.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={!!t.done} onChange={() => toggle(t)} style={{ width: 'auto' }} />
          <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--text-dim)' : 'var(--text)' }}>
            {t.title}
          </span>
          <button onClick={() => del(t)}>Delete</button>
        </div>
      ))}
    </>
  );
}
