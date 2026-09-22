import React from 'react';
import { X } from 'lucide-react';

export default function ModalFotoZoom({ fotoZoom, onClose }) {
  if (!fotoZoom) return null;

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        zIndex: 99999, /* MÁXIMA PRIORIDAD VISUAL */
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        style={{ position: 'relative', textAlign: 'center', maxWidth: '90%', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: '-46px', right: '0',
            background: 'rgba(255, 255, 255, 0.2)', border: 'none',
            color: '#fff', borderRadius: '50%',
            width: '38px', height: '38px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          aria-label="Cerrar foto"
        >
          <X size={20} />
        </button>
        <img 
          src={fotoZoom.url} 
          alt="Foto ampliada" 
          style={{
            maxWidth: '100%', maxHeight: '72vh',
            borderRadius: '16px', objectFit: 'contain',
            boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
            border: '2px solid rgba(255, 255, 255, 0.2)'
          }} 
        />
        <div style={{ color: '#ffffff', marginTop: '14px' }}>
          <div style={{ fontSize: '17px', fontWeight: '800' }}>{fotoZoom.nombre}</div>
          {fotoZoom.puesto && <div style={{ fontSize: '13px', color: '#a1a1aa', marginTop: '2px' }}>{fotoZoom.puesto}</div>}
        </div>
      </div>
    </div>
  );
}