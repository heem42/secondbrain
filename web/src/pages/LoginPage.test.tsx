import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
import { ApiError } from '../api/client';

// Drive the page through a mocked auth context.
const login = vi.fn();
const signup = vi.fn();
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ login, signup }),
}));

// The segmented toggle and the primary button can share a label ("Sign In"),
// so target the real submit by its type.
function submitButton(): HTMLButtonElement {
  const btn = screen
    .getAllByRole('button')
    .find((b) => (b as HTMLButtonElement).type === 'submit');
  if (!btn) throw new Error('submit button not found');
  return btn as HTMLButtonElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginPage', () => {
  it('keeps submit disabled until email + an 8-char password are present', async () => {
    render(<LoginPage />);
    expect(submitButton()).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await userEvent.type(screen.getByPlaceholderText(/Password/), 'short'); // 5 chars
    expect(submitButton()).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText(/Password/), 'er12'); // → 9 chars
    expect(submitButton()).toBeEnabled();
  });

  it('calls auth.login with the entered credentials', async () => {
    login.mockResolvedValue(undefined);
    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await userEvent.type(screen.getByPlaceholderText(/Password/), 'password123');
    await userEvent.click(submitButton());

    expect(login).toHaveBeenCalledWith('a@b.com', 'password123');
  });

  it('shows the server error message when login fails', async () => {
    login.mockRejectedValue(new ApiError(401, 'Invalid credentials'));
    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await userEvent.type(screen.getByPlaceholderText(/Password/), 'password123');
    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument(),
    );
  });

  it('switches to sign-up mode and shows the display-name field', async () => {
    render(<LoginPage />);
    expect(screen.queryByPlaceholderText(/Display name/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    expect(screen.getByPlaceholderText(/Display name/)).toBeInTheDocument();
  });
});
