import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Al cargar la app, revisamos si ya hay una sesión guardada en el navegador
    const sesionGuardada = localStorage.getItem('permisos_sesion');
    if (sesionGuardada) {
      setUsuario(JSON.parse(sesionGuardada));
    }
    setCargando(false);
  }, []);

  const iniciarSesion = (datosUsuario) => {
    localStorage.setItem('permisos_sesion', JSON.stringify(datosUsuario));
    setUsuario(datosUsuario);
  };

  const cerrarSesion = () => {
    localStorage.removeItem('permisos_sesion');
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, iniciarSesion, cerrarSesion, cargando }}>
      {!cargando && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);