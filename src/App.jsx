import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Inicio from './pages/Inicio';
import AdminUsuarios from './pages/AdminUsuarios';
import Layout from './components/Layout'; 
import Login from './pages/Login';
import Solicitar from './pages/Solicitar';
import MisPermisos from './pages/MisPermisos';
import Aprobaciones from './pages/Aprobaciones';
import Caseta from './pages/Caseta';
import AprobarDirecto from './pages/AprobarDirecto';
import ControlHistorial from './pages/ControlHistorial';

function RutasProtegidas() {
  const { usuario, iniciarSesion } = useAuth();

  if (!usuario) {
    return <Login alEntrar={iniciarSesion} />;
  }

  return <Layout />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta pública para aprobación directa por WhatsApp */}
          <Route path="/aprobar-directo" element={<AprobarDirecto />} />
          
          {/* Rutas Privadas envueltas en Layout */}
          <Route element={<RutasProtegidas />}>
            <Route path="/inicio" element={<Inicio />} />
            <Route path="/solicitar" element={<Solicitar />} />
            <Route path="/mis-permisos" element={<MisPermisos />} />
            <Route path="/aprobaciones" element={<Aprobaciones />} />
            <Route path="/control-historial" element={<ControlHistorial />} />
            <Route path="/caseta" element={<Caseta />} />
            <Route path="/directorio" element={<AdminUsuarios />} />
            
            {/* Redirección por defecto a INICIO */}
            <Route path="/" element={<Navigate to="/inicio" replace />} />
          </Route>
          
          {/* Comodín de seguridad */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}