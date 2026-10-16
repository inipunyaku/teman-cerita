import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ApiError } from './lib/api';
import { AuthProvider } from './lib/auth';
import { WelcomeSplashProvider } from './components/WelcomeSplash';
import App from './App';
import './index.css';

const onAuthError = (err: unknown) => {
  if (err instanceof ApiError && err.status === 401 && queryClient.getQueryData<{ user: unknown }>(['me'])?.user) {
    queryClient.setQueryData(['me'], { user: null });
  }
};

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onAuthError }),
  mutationCache: new MutationCache({ onError: onAuthError }),
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <WelcomeSplashProvider>
            <App />
          </WelcomeSplashProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: { borderRadius: 16, border: '1px solid #E3EDF5', fontFamily: 'inherit', boxShadow: '0 18px 50px -20px rgba(15,92,138,.45)' },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
