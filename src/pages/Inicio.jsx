import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Inicio() {
  const { usuario } = useAuth();
  
  // Detectar modo oscuro para el texto
  const modoOscuro = localStorage.getItem('tema_sistema') === 'oscuro';
  const colorTexto = modoOscuro ? '#f8fafc' : '#0f172a';
  const colorSubtexto = modoOscuro ? '#94a3b8' : '#64748b';

  // Sacar solo el primer nombre para un saludo más amigable
  const primerNombre = usuario?.nombre_completo?.split(' ')[0] || 'Colaborador';

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', 
      justifyContent: 'center', height: '85vh', textAlign: 'center', padding: '20px' 
    }}>
      <img 
        src="/LogoVerde-removebg-preview.png" 
        alt="Logo Ideas Mobiliarium" 
        style={{ maxWidth: '240px', marginBottom: '24px', opacity: 0.9 }} 
      />
      
      <h1 style={{ fontSize: '26px', fontWeight: '800', color: colorTexto, margin: '0 0 8px 0' }}>
        Hola, {primerNombre}
      </h1>
      
      <p style={{ fontSize: '14px', color: colorSubtexto, maxWidth: '350px', lineHeight: '1.6', margin: 0 }}>
        Bienvenido al sistema oficial de permisos. Selecciona una opción del menú lateral para comenzar.
      </p>
    </div>
  );
}