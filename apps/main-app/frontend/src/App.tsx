import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ScrollToTop } from './shared/navigation/ScrollToTop';
import { AuthProvider } from './features/auth/AuthContext';
import { AppRoutes } from './routes';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
