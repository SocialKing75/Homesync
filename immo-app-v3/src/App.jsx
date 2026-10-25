import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomeSync from './pages/HomeSync';
import VerifierEmail from './pages/VerifierEmail';

// Les anciens écrans restent dans le dépôt, hors du parcours connecté prioritaire.
export default function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/" element={<HomeSync />} />
      <Route path="/verifier-email" element={<VerifierEmail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>;
}
