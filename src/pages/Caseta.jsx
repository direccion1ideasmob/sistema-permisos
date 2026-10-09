import React from 'react';
import ControlCaseta from '../components/vigilancia/ControlCaseta';
import { useAuth } from '../context/AuthContext'; 

export default function Caseta() {
  const { usuario } = useAuth(); 

  return (
    <ControlCaseta c={usuario} />
  );
}