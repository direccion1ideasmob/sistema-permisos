import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/auth/AuthContext';
import Layout from './core/layout/Layout'; 
import Login from './core/auth/Login';

// Carga inteligente por módulo (Code Splitting para que el sistema vuele)
const Inicio = lazy(() => import('./modules/inicio/Inicio'));
const AdminUsuarios = lazy(() => import('./modules/directorio/AdminUsuarios'));
const Solicitar = lazy(() => import('./modules/permisos/solicitud/Solicitar'));
const MisPermisos = lazy(() => import('./modules/permisos/solicitud/MisPermisos'));
const Aprobaciones = lazy(() => import('./modules/permisos/autorizacion/Aprobaciones'));
const AprobarDirecto = lazy(() => import('./modules/permisos/autorizacion/AprobarDirecto'));
const ControlHistorial = lazy(() => import('./modules/permisos/historial/ControlHistorial'));
const Caseta = lazy(() => import('./modules/vigilancia/Caseta'));

function PantallaCargando() {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#737373', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
      Cargando módulo...
    </div>
  );
}

function RutasProtegidas() {
  const { usuario, iniciarSesion } = useAuth();
  if (!usuario) return <Login alEntrar={iniciarSesion} />;
  return <Layout />;
}

function RutaRol({ rolesPermitidos, children }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/" replace />;
  if (!rolesPermitidos.includes(usuario.rol)) return <Navigate to="/inicio" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PantallaCargando />}>
          <Routes>
            <Route path="/aprobar-directo" element={<AprobarDirecto />} />
            
            <Route element={<RutasProtegidas />}>
              <Route path="/inicio" element={<Inicio />} />
              <Route path="/solicitar" element={<Solicitar />} />
              <Route path="/mis-permisos" element={<MisPermisos />} />
              
              <Route 
                path="/aprobaciones" 
                element={
                  <RutaRol rolesPermitidos={['encargado', 'jefe_area', 'gerente_produccion', 'gerente_admin', 'gerente_rh', 'rh_nominas', 'superadmin']}>
                    <Aprobaciones />
                  </RutaRol>
                } 
              />

              <Route 
                path="/control-historial" 
                element={
                  <RutaRol rolesPermitidos={['encargado', 'jefe_area', 'gerente_produccion', 'gerente_admin', 'gerente_rh', 'rh_nominas', 'superadmin']}>
                    <ControlHistorial />
                  </RutaRol>
                } 
              />

              <Route 
                path="/caseta/*" 
                element={
                  <RutaRol rolesPermitidos={['caseta', 'gerente_rh', 'rh_nominas', 'superadmin']}>
                    <Caseta />
                  </RutaRol>
                } 
              />
              
              <Route 
                path="/directorio" 
                element={
                  <RutaRol rolesPermitidos={['superadmin', 'gerente_rh', 'rh_nominas']}>
                    <AdminUsuarios />
                  </RutaRol>
                } 
              />
              
              <Route path="/" element={<Navigate to="/inicio" replace />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
