import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Login from './pages/Login';
import Accueil from './pages/Accueil';
import AnnoncePage from './pages/AnnoncePage';
import VerifierEmail from './pages/VerifierEmail';
import Decouvrir from './pages/Decouvrir';
import { getToken } from './api';

// Dashboard : profil de recherche rempli OU compte connecté (session conservée au rechargement)
function PrivateRoute({ children }) {
  const { user } = useApp();
  return user || getToken() ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/verifier-email" element={<VerifierEmail />} />
      <Route path="/decouvrir/:searchId" element={<Decouvrir />} />
      <Route path="/accueil" element={<PrivateRoute><Accueil /></PrivateRoute>} />
      <Route path="/annonce/:id" element={<PrivateRoute><AnnoncePage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
