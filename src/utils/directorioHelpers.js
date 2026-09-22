import { 
  Briefcase, Laptop, Truck, Wrench, TrendingUp, 
  Calculator, Palette, ShoppingCart, ShieldAlert, 
  HeartHandshake, Factory, HardHat, Zap 
} from 'lucide-react';

export const estandarizar = (txt) => 
  txt ? txt.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

export const obtenerIconoDepto = (nombre) => {
  const txt = (nombre || '').toUpperCase();
  if (txt.includes('SISTEMA') || txt.includes('TI') || txt.includes('TECNOLOGIA')) return Laptop;
  if (txt.includes('LOGISTICA') || txt.includes('ALMACEN') || txt.includes('EMBARQUE') || txt.includes('CHOFER')) return Truck;
  if (txt.includes('MANTENIMIENTO') || txt.includes('INGENIERIA') || txt.includes('TALLER')) return Wrench;
  if (txt.includes('VENTA') || txt.includes('COMERCIAL') || txt.includes('PROYECTO')) return TrendingUp;
  if (txt.includes('FINANZA') || txt.includes('CONTABILIDAD') || txt.includes('ADMINISTRACION')) return Calculator;
  if (txt.includes('DISEÑO') || txt.includes('MARKETING') || txt.includes('ARQUITECTURA')) return Palette;
  if (txt.includes('COMPRA') || txt.includes('ABASTECIMIENTO')) return ShoppingCart;
  if (txt.includes('SEGURIDAD') || txt.includes('CASETA')) return ShieldAlert;
  if (txt.includes('RECURSO') || txt.includes('RH') || txt.includes('NOMINA')) return HeartHandshake;
  if (txt.includes('PRODUCCION') || txt.includes('MANUFACTURA')) return Factory;
  if (txt.includes('OBRA') || txt.includes('INSTALACION') || txt.includes('ESTIMACION')) return HardHat;
  if (txt.includes('ELECTRIC') || txt.includes('ELECTROMECANICA')) return Zap;
  return Briefcase;
};

export const obtenerBadgeRol = (rol, modoOscuro) => {
  const roles = {
    gerente: { 
      bg: modoOscuro ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)', 
      border: modoOscuro ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)', 
      text: modoOscuro ? '#f87171' : '#dc2626', 
      label: 'GERENTE' 
    },
    jefe_area: { 
      bg: modoOscuro ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)', 
      border: modoOscuro ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)', 
      text: modoOscuro ? '#fbbf24' : '#d97706', 
      label: 'JEFE DE ÁREA' 
    },
    rh_nominas: { 
      bg: modoOscuro ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)', 
      border: modoOscuro ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)', 
      text: modoOscuro ? '#818cf8' : '#4f46e5', 
      label: 'RH / NÓMINAS' 
    },
    caseta: { 
      bg: modoOscuro ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.1)', 
      border: modoOscuro ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.2)', 
      text: modoOscuro ? '#94a3b8' : '#475569', 
      label: 'CASETA' 
    },
    empleado: { 
      bg: modoOscuro ? 'rgba(22, 163, 74, 0.15)' : 'rgba(22, 163, 74, 0.1)', 
      border: modoOscuro ? 'rgba(22, 163, 74, 0.3)' : 'rgba(22, 163, 74, 0.2)', 
      text: modoOscuro ? '#4ade80' : '#15803d', 
      label: 'EMPLEADO' 
    }
  };
  return roles[rol] || roles.empleado;
};