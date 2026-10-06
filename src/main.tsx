import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AdminPage } from './AdminPage.tsx'
import { BoardPage } from './BoardPage.tsx'
import { LangProvider } from './i18n'
import { RegisterPage } from './RegisterPage.tsx'

// "/" is the public board; "/code" -> "/details" registers; "/login" -> "/edit" lets an
// owner sign back in (email + current code) and edit; "/admin" is the super user panel.
const PARTICIPANT_PATHS = ['/code', '/details', '/login', '/edit']

const path = location.pathname.replace(/\/+$/, '')
let page
if (PARTICIPANT_PATHS.includes(path)) page = <RegisterPage />
else if (path === '/admin') page = <AdminPage />
else {
  // Old /board links and unknown paths land on the board.
  if (path !== '') history.replaceState(null, '', '/' + location.search)
  page = <BoardPage />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>{page}</LangProvider>
  </StrictMode>,
)
