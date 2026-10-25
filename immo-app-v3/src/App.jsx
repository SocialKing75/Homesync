import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import ChatMap from './pages/Login';
import Onboarding from './pages/Onboarding';
import Messages from './pages/Messages';
import Matching from './pages/Matching';
import PropertyDetails from './pages/PropertyDetails';
import Accueil from './pages/Accueil';
import VerifierEmail from './pages/VerifierEmail';
import Decouvrir from './pages/Decouvrir';
import { getToken } from './api';

import Favoris from './pages/Favoris';
import Profil from './pages/Profil';
import AgenceWorkspace from './pages/AgenceWorkspace';
function PrivateRoute({ children }) {
  const { user } = useApp();
  return user || getToken() ? children : <Navigate to="/" replace />;
}

function LegacyPropertyRedirect() {
  const { id } = useParams();
  return <Navigate to={`/bien/${encodeURIComponent(id)}`} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/recherche" element={<ChatMap />} />
      <Route path="/agence" element={<AgenceWorkspace />} />
      <Route path="/verifier-email" element={<VerifierEmail />} />
      <Route path="/decouvrir/:searchId" element={<Decouvrir />} />
      <Route path="/accueil" element={<Navigate to="/recherche" replace />} />
      <Route path="/matching" element={<PrivateRoute><Matching /></PrivateRoute>} />
      <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
      <Route path="/bien/:id" element={<PrivateRoute><PropertyDetails /></PrivateRoute>} />
      <Route path="/annonce/:id" element={<PrivateRoute><LegacyPropertyRedirect /></PrivateRoute>} />
      <Route path="/favoris" element={<PrivateRoute><Favoris /></PrivateRoute>} />
      <Route path="/profil" element={<PrivateRoute><Profil /></PrivateRoute>} />
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
