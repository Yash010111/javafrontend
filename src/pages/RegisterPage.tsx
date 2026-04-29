import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { AuthResponse } from '../types';
import type { AuthRequest } from '../types';
import { register } from '../api';
import ErrorBanner from '../components/ErrorBanner';

interface Props {
  auth: AuthResponse | null;
  onAuthSuccess: (auth: AuthResponse) => void;
}

export default function RegisterPage({ auth, onAuthSuccess }: Props) {
  const navigate = useNavigate();
  const [registerData, setRegisterData] = useState<AuthRequest>({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (auth) {
      navigate(auth.roles.includes('ROLE_ADMIN') ? '/admin' : '/home');
    }
  }, [auth, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await register(registerData);
      onAuthSuccess(response);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Unable to register. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-shell container auth-page">
      <div className="card auth-card">
        <div className="status-row">
          <div>
            <h1 className="page-title">Create your account</h1>
            <p className="page-subtitle">Join StockPulse and start managing trades with a sleek, secure dashboard.</p>
          </div>
          <Link to="/" className="secondary link-button">
            Back to login
          </Link>
        </div>

        <ErrorBanner message={error} />

        <form onSubmit={handleSubmit} className="field-group">
          <label>
            Username
            <input
              value={registerData.username}
              onChange={(event) => setRegisterData({ ...registerData, username: event.target.value })}
              required
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              value={registerData.password}
              onChange={(event) => setRegisterData({ ...registerData, password: event.target.value })}
              type="password"
              required
              autoComplete="new-password"
            />
          </label>
          <button type="submit" className="primary" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}
