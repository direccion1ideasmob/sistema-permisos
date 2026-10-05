import React from 'react';
import ControlCaseta from '../components/vigilancia/ControlCaseta';
import { useAuth } from '../context/AuthContext'; 

export default function Caseta() {
  // 1. Nos conectamos a la "nube" de tu sistema para descargar quién inició sesión
  const { usuario } = useAuth(); 

  // 2. Se lo pasamos directo al componente de Vigilancia
  return (
    <ControlCaseta c={usuario} />
  );
}