import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { StudyPlannerProvider } from './context/StudyPlannerContext';
import { PUBLIC_PREVIEW_MODE, MOCK_PREVIEW_USER } from './config/previewMode';

describe('App', () => {
  it('renders loading state initially and renders landing view when unauthenticated', async () => {
    render(
      <StudyPlannerProvider>
        <App />
      </StudyPlannerProvider>,
    );

    // Verify initial loading indicator element
    expect(screen.getByText(/Yuklanmoqda.../i)).toBeInTheDocument();

    // Verify transition to unauthenticated LandingPage header ("Kirish" action button) after session check
    const elements = await screen.findAllByText(/Kirish/i, {}, { timeout: 10000 });
    expect(elements[0]).toBeInTheDocument();
  }, 15000);

  it('has public preview mode disabled by default with secure mock fallback config', () => {
    expect(PUBLIC_PREVIEW_MODE).toBe(false);
    expect(MOCK_PREVIEW_USER.email).toBe('fsoyilov@gmail.com');
    expect(MOCK_PREVIEW_USER.user_metadata?.role).toBe('superadmin');
  });
});
