import React from 'react';
import ControlCaseta from './ControlCaseta';
import { useAuth } from '../../core/auth/AuthContext'; 

export default function Caseta() {
  const { usuario } = useAuth(); 

  return (
    <ControlCaseta c={usuario} />
  );
}