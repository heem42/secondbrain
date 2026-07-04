import { useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { AppPage } from './pages/AppPage';

export default function App() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <div className="splash">Loading…</div>;
  }
  return status === 'authed' ? <AppPage /> : <LoginPage />;
}
