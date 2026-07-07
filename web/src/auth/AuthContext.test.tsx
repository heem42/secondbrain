import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';

// Mock the API client so we drive auth purely by its return values.
vi.mock('../api/client', () => ({
  apiFetch: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  refreshAccessToken: vi.fn(),
}));
import * as client from './../api/client';
const c = vi.mocked(client);

function Consumer() {
  const { status, user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? ''}</span>
      <button onClick={() => void login('a@b.com', 'password123')}>login</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

function renderApp() {
  return render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthContext session restore', () => {
  it('restores an authed session from the refresh cookie on mount', async () => {
    c.refreshAccessToken.mockResolvedValue(true);
    c.apiFetch.mockResolvedValue({ id: 'u1', email: 'a@b.com', displayName: 'A' });

    renderApp();

    // starts in loading, then resolves to authed after the mount effect
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authed'),
    );
    expect(screen.getByTestId('email')).toHaveTextContent('a@b.com');
    expect(c.apiFetch).toHaveBeenCalledWith('/users/me');
  });

  it('is anonymous when no refresh cookie is present', async () => {
    c.refreshAccessToken.mockResolvedValue(false);

    renderApp();

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anon'),
    );
    expect(c.apiFetch).not.toHaveBeenCalled();
  });

  it('falls back to anonymous if the profile fetch fails', async () => {
    c.refreshAccessToken.mockResolvedValue(true);
    c.apiFetch.mockRejectedValue(new Error('boom'));

    renderApp();

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anon'),
    );
  });
});

describe('AuthContext login/logout', () => {
  it('transitions to authed on login and back to anon on logout', async () => {
    c.refreshAccessToken.mockResolvedValue(false); // start signed out
    c.login.mockResolvedValue({ id: 'u1', email: 'a@b.com', displayName: 'A' });
    c.logout.mockResolvedValue(undefined);

    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anon'),
    );

    await userEvent.click(screen.getByText('login'));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authed'),
    );
    expect(c.login).toHaveBeenCalledWith('a@b.com', 'password123');
    expect(screen.getByTestId('email')).toHaveTextContent('a@b.com');

    await userEvent.click(screen.getByText('logout'));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anon'),
    );
    expect(screen.getByTestId('email')).toHaveTextContent('');
  });
});
