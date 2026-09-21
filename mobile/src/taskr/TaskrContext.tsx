import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { taskApi, teamApi, projectApi, ticketApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { Task, TeamMember, Project, TaskStatus, isManagerLevel } from '../types';

type Data = {
  ticketRaised: number;
  tasks: Task[];
  members: TeamMember[];
  projects: Project[];
  loading: boolean;
  error: string;
  directoryError: string;
  refresh: () => Promise<void>;
  setStatus: (task: Task, status: TaskStatus) => Promise<void>;
  putTask: (task: Task) => void;
};
const Context = createContext<Data | null>(null);
export function TaskrProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ticketRaised, setTicketRaised] = useState(0);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [directoryError, setDirectoryError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    const [taskResult, projectResult, teamResult, ticketResult] = await Promise.allSettled([
      taskApi.list({ limit: 100 }), projectApi.list(), user ? teamApi.list() : Promise.resolve({ data: [] as TeamMember[] }), user?.role === 'admin' ? ticketApi.list({ limit: 1 }) : Promise.resolve({ data: [], meta: undefined }),
    ]);
    if (request !== sequence.current) return;
    if (taskResult.status === 'fulfilled') { setTasks(taskResult.value.data); setError(''); }
    else setError(taskResult.reason?.message || 'Could not load tasks. Pull down to retry.');
    if (projectResult.status === 'fulfilled') setProjects(projectResult.value.data);
    if (teamResult.status === 'fulfilled') setMembers(teamResult.value.data);
    if (ticketResult.status === 'fulfilled') setTicketRaised(Number((ticketResult.value.meta?.counts as { total?: number } | undefined)?.total || 0));
    setDirectoryError(projectResult.status === 'rejected' || teamResult.status === 'rejected' ? 'Some team or project information could not be loaded. Pull down to retry.' : '');
    setLoading(false);
  }, [user?.id, user?.role]);
  useEffect(() => { void refresh(); return () => { sequence.current++; }; }, [refresh]);
  const putTask = (task: Task) => setTasks(previous => previous.some(t => t.id === task.id) ? previous.map(t => t.id === task.id ? { ...t, ...task } : t) : [task, ...previous]);
  const setStatus = async (task: Task, status: TaskStatus) => { const result = await taskApi.updateStatus(task.id, status); putTask({ ...task, ...result.data }); };
  return (
    <Context.Provider
      value={{
        ticketRaised,
        tasks,
        members,
        projects,
        loading,
        error,
        directoryError,
        refresh,
        setStatus,
        putTask,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useTaskr() { const ctx = useContext(Context); if (!ctx) throw new Error('TaskrProvider is required'); return ctx; }
