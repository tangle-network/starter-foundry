import { Routes, Route, Navigate } from 'react-router-dom'
import { AdminDashboard } from './routes/AdminDashboard'
import { AgentInspector } from './routes/AgentInspector'

const ENV_AGENT_NAME =
  (import.meta.env.VITE_AGENT_NAME as string | undefined) ?? '{{agentName}}'

export function App() {
  return (
    <div className='app-shell'>
      <header className='app-header'>
        <h1>{ENV_AGENT_NAME}</h1>
        <span className='app-subtitle'>Multi-tenant agent platform</span>
      </header>
      <main className='app-main'>
        <Routes>
          <Route path='/' element={<Navigate to='/admin' replace />} />
          <Route path='/admin' element={<AdminDashboard />} />
          <Route path='/agents/:id' element={<AgentInspector />} />
          <Route
            path='*'
            element={
              <div className='not-found'>
                <p>Route not found.</p>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  )
}
