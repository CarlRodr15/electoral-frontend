/**
 * @fileoverview Frontend Principal - Electora PWA
 * @description Panel de gestión territorial. Incluye soporte Offline-First, geolocalización, 
 * mapas interactivos con Leaflet, gráficas Recharts y exportación a Excel.
 * @author Carlos Rodriguez - CIO Calima El Darién
 * @version 1.1.1 (React Compiler Optimized)
 */

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Users, MapPin, Map as MapIcon, PieChart as ChartIcon, BarChart3, LogOut, Search, Edit2, Trash2, UserPlus, Bell, Moon, Sun, Download, ShieldCheck, Crosshair, AlertTriangle, ArrowRightLeft, Database } from 'lucide-react'

// ============================================================================
// FIX LEAFLET: Corrección de rutas para los íconos de los marcadores del mapa
// en entornos empaquetados por Vite/Webpack.
// ============================================================================
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ============================================================================
// COMPONENTES DE UTILIDAD Y UI BASE
// ============================================================================

const GlobalStyles = () => (
  <style>{`
    :root {
      --bg-main: #f4f7f6;
      --bg-card: #ffffff;
      --bg-input: #f8fafc;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --primary: #153c5e; 
      --secondary: #369c84; 
      --accent: #f28b30; 
      --danger: #ef4444;
      --shadow: 0 4px 20px rgba(0,0,0,0.04);
    }
    
    [data-theme='dark'] {
      --bg-main: #0f172a;
      --bg-card: #1e293b;
      --bg-input: #0f172a;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --border-color: #334155;
      --primary: #3b82f6;
      --secondary: #10b981;
      --accent: #f59e0b;
      --danger: #ef4444;
      --shadow: 0 4px 20px rgba(0,0,0,0.4);
    }

    * { box-sizing: border-box; font-family: 'Inter', system-ui, -apple-system, sans-serif; transition: background-color 0.3s, color 0.3s, border-color 0.3s; }
    body, html { margin: 0; padding: 0; background-color: var(--bg-main); color: var(--text-main); width: 100vw; min-height: 100vh; overflow-x: hidden; }
    #root { width: 100%; max-width: none; padding: 0; margin: 0; }
    @keyframes slideIn { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    
    input, select, textarea { font-size: 16px !important; outline: none; }
    input:focus, select:focus, textarea:focus { border-color: var(--primary) !important; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    
    .recharts-tooltip-cursor { fill: var(--bg-input); }
    .custom-tooltip { background: var(--bg-card); border: 1px solid var(--border-color); padding: 10px; border-radius: 8px; box-shadow: var(--shadow); }
  `}</style>
)

const BARRIOS_URBANOS = ['Centro', 'Obrero', 'La Carmelita', 'Fundadores', 'Sucre', 'San Vicente', 'El Dorado', 'Laureles', 'Otro'];
const VEREDAS_RURALES = ['Río Bravo', 'La Florida', 'Jiguales', 'Remolinos', 'La Cristalina', 'Santa Leticia', 'Palermo', 'Gorgona', 'Otra'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--text-main)' }}>{label || payload[0].name}</p>
        <p style={{ margin: '5px 0 0 0', color: payload[0].payload.color || 'var(--primary)' }}>
          Total: {payload[0].value} registros
        </p>
      </div>
    );
  }
  return null;
};

function BotonCentrarUbicacion({ setFormData }) {
  const map = useMap();
  const [posicionGPS, setPosicionGPS] = useState(null);

  const ubicarGPS = (e) => {
    e.preventDefault(); e.stopPropagation();
    map.locate({ setView: true, maxZoom: 16 });
  };

  useMapEvents({
    locationfound(e) {
      setPosicionGPS(e.latlng);
      if (setFormData) setFormData(prev => ({ ...prev, latitud: e.latlng.lat, longitud: e.latlng.lng }));
    },
    locationerror() { alert("No pudimos obtener tu ubicación. Verifica permisos de GPS en tu navegador."); }
  });

  return (
    <>
      <button 
        onClick={ubicarGPS}
        style={{ position: 'absolute', bottom: '20px', right: '10px', zIndex: 1000, background: 'var(--bg-card)', color: 'var(--primary)', border: '2px solid var(--primary)', borderRadius: '50%', width: '45px', height: '45px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        title="Centrar en mi ubicación"
      >
        <Crosshair size={22} />
      </button>
      {posicionGPS && !setFormData && (
        <Marker position={posicionGPS}>
          <Popup>Ubicación Actual</Popup>
        </Marker>
      )}
    </>
  );
}

function SeleccionarUbicacion({ formData, setFormData }) {
  useMapEvents({
    click(e) { setFormData({ ...formData, latitud: e.latlng.lat, longitud: e.latlng.lng }) },
  })
  return formData.latitud ? <Marker position={[formData.latitud, formData.longitud]} /> : null
}

// ============================================================================
// APLICACIÓN PRINCIPAL
// ============================================================================

function App() {
  /* --- 1. ESTADOS DE SESIÓN Y UI --- */
  const [usuario, setUsuario] = useState(() => JSON.parse(localStorage.getItem('usuarioElectoral')) || null)
  const [loginData, setLoginData] = useState({ cedula: '', contrasena: '' })
  const [modoOscuro, setModoOscuro] = useState(() => localStorage.getItem('temaElectoral') === 'dark')

  /* --- 2. ESTADOS DE BASE DE DATOS Y COLAS --- */
  const [simpatizantes, setSimpatizantes] = useState([])
  const [usuariosDb, setUsuariosDb] = useState([]) 
  const [historialConflictos, setHistorialConflictos] = useState([]) 
  const [colaOffline, setColaOffline] = useState(() => JSON.parse(localStorage.getItem('colaOfflineElectoral')) || [])
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  /* --- 3. ESTADOS DE FORMULARIOS --- */
  const [formData, setFormData] = useState({ nombreCompleto: '', cedula: '', telefono: '', zona: 'URBANA', barrioVereda: '', direccion: '', latitud: null, longitud: null, apoyaAlcaldia: false, apoyaConcejo: false, mesa: '', observaciones: '' })
  const [nuevoUsuarioData, setNuevoUsuarioData] = useState({ nombre: '', cedula: '', telefono: '', rol: 'CONCEJAL', contrasena: '', concejalId: '' })
  const [datosEdicion, setDatosEdicion] = useState({ id: null, mesa: '', observaciones: '' })
  const [liderDestino, setLiderDestino] = useState('')

  /* --- 4. ESTADOS DE CONTROL DE MODALES Y FILTROS --- */
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalUsuarioAbierto, setModalUsuarioAbierto] = useState(false)
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false)
  const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false)
  const [modalConfirmacion, setModalConfirmacion] = useState({ visible: false, tipo: '', datos: null })
  const [modalTransferir, setModalTransferir] = useState({ visible: false, datos: null })
  const [notificacion, setNotificacion] = useState({ visible: false, mensaje: '', tipo: 'info' })

  const [vistaAdmin, setVistaAdmin] = useState('simpatizantes') 
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const [equipoExpandido, setEquipoExpandido] = useState(null)
  
  const [filtroMapaInteractivo, setFiltroMapaInteractivo] = useState({ tipo: 'TODOS', id: null, nombre: '' })
  const [filtroZonaMapa, setFiltroZonaMapa] = useState('TODOS') 
  const [filtroLugarMapa, setFiltroLugarMapa] = useState('TODOS')

  const centroCalima = [3.9274, -76.4851]

  /* ========================================================================
     CICLO DE VIDA Y EFECTOS
     ======================================================================== */

  useEffect(() => {
    if (modoOscuro) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('temaElectoral', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('temaElectoral', 'light');
    }
  }, [modoOscuro]);

  const alternarTema = () => setModoOscuro(!modoOscuro);

  const mostrarAlerta = useCallback((mensaje, tipo = 'info') => {
    setNotificacion({ visible: true, mensaje, tipo });
    setTimeout(() => setNotificacion({ visible: false, mensaje: '', tipo: 'info' }), 4000);
  }, []);

  const cargarDatosIniciales = useCallback(async () => {
    if (!navigator.onLine || !usuario) return; 
    try {
      const resSimp = await axios.get('https://api-electoral-calima.onrender.com/api/simpatizantes');
      setSimpatizantes(resSimp.data);
      if (usuario.rol === 'ADMIN' || usuario.rol === 'CONCEJAL') {
        const resUsu = await axios.get('https://api-electoral-calima.onrender.com/api/usuarios');
        setUsuariosDb(resUsu.data);
        const resAlertas = await axios.get('https://api-electoral-calima.onrender.com/api/alertas');
        setHistorialConflictos(resAlertas.data);
      }
    } catch (error) { console.error("Error al cargar datos:", error); }
  }, [usuario]);

  const agregarConflicto = useCallback(async (cedula, nombre, motivo) => {
    try {
      await axios.post('https://api-electoral-calima.onrender.com/api/alertas', { cedula, nombre, motivo });
      cargarDatosIniciales(); 
    } catch (error) { console.error("Error al registrar alerta en la nube", error); }
  }, [cargarDatosIniciales]);

  const sincronizarPendientes = useCallback(async () => {
    const pendientes = JSON.parse(localStorage.getItem('colaOfflineElectoral')) || [];
    if (pendientes.length === 0) return;
    let restantes = [...pendientes];
    let sincronizados = 0;

    for (const registro of pendientes) {
      try {
        await axios.post('https://api-electoral-calima.onrender.com/api/simpatizantes', registro);
        restantes = restantes.filter(r => r.cedula !== registro.cedula);
        sincronizados++;
      } catch (error) {
        if (error.response && error.response.status === 400) {
          restantes = restantes.filter(r => r.cedula !== registro.cedula);
          agregarConflicto(registro.cedula, registro.nombreCompleto, "Duplicado tras modo Offline");
        }
      }
    }
    setColaOffline(restantes);
    localStorage.setItem('colaOfflineElectoral', JSON.stringify(restantes));
    if (sincronizados > 0) {
      mostrarAlerta(`Sincronización de ${sincronizados} registros completada.`, "exito");
      cargarDatosIniciales(); 
    }
  }, [agregarConflicto, cargarDatosIniciales, mostrarAlerta]);

  useEffect(() => {
    const manejarConexion = () => { setIsOnline(true); mostrarAlerta("Conexión recuperada.", "exito"); sincronizarPendientes(); };
    const manejarDesconexion = () => { setIsOnline(false); mostrarAlerta("Sin conexión. Modo Offline activo.", "error"); };
    window.addEventListener('online', manejarConexion);
    window.addEventListener('offline', manejarDesconexion);
    const timerSync = setTimeout(() => { if (navigator.onLine && usuario) sincronizarPendientes(); }, 0);
    return () => { window.removeEventListener('online', manejarConexion); window.removeEventListener('offline', manejarDesconexion); clearTimeout(timerSync); }
  }, [usuario, sincronizarPendientes, mostrarAlerta])

  useEffect(() => {
    const timerDatos = setTimeout(() => { cargarDatosIniciales(); }, 0);
    const intervaloSincronizacion = setInterval(cargarDatosIniciales, 10000);
    return () => { clearTimeout(timerDatos); clearInterval(intervaloSincronizacion); };
  }, [cargarDatosIniciales])

  /* ========================================================================
     CONTROLADORES DE API (CRUD)
     ======================================================================== */

  const manejarLogin = async (e) => {
    e.preventDefault();
    if (!navigator.onLine) return mostrarAlerta("Internet requerido para primer inicio.", "error");
    try {
      const respuesta = await axios.post('https://api-electoral-calima.onrender.com/api/login', loginData);
      setUsuario(respuesta.data.usuario);
      localStorage.setItem('usuarioElectoral', JSON.stringify(respuesta.data.usuario));
      mostrarAlerta(`Bienvenido, ${respuesta.data.usuario.nombre}`, 'exito');
    } catch (error) { mostrarAlerta(error.response?.data?.error || "Error de autenticación", 'error'); }
  }

  const guardarSimpatizante = async (e) => {
    e.preventDefault();
    if (!formData.latitud || !formData.barrioVereda) return mostrarAlerta("Falta ubicación en el mapa.", 'error');
    const nuevoRegistro = { ...formData, liderId: usuario.id };

    if (!isOnline) {
      const nuevaCola = [...colaOffline, nuevoRegistro];
      setColaOffline(nuevaCola);
      localStorage.setItem('colaOfflineElectoral', JSON.stringify(nuevaCola));
      setSimpatizantes([...simpatizantes, { ...nuevoRegistro, id: Date.now() }]); 
      mostrarAlerta("Guardado en memoria (Offline).", 'exito');
      setFormData({ nombreCompleto: '', cedula: '', telefono: '', zona: 'URBANA', barrioVereda: '', direccion: '', latitud: null, longitud: null, apoyaAlcaldia: false, apoyaConcejo: false, mesa: '', observaciones: '' });
      setModalAbierto(false);
      return;
    }
    try {
      await axios.post('https://api-electoral-calima.onrender.com/api/simpatizantes', nuevoRegistro);
      mostrarAlerta("Registro guardado con éxito.", 'exito');
      cargarDatosIniciales();
      setFormData({ nombreCompleto: '', cedula: '', telefono: '', zona: 'URBANA', barrioVereda: '', direccion: '', latitud: null, longitud: null, apoyaAlcaldia: false, apoyaConcejo: false, mesa: '', observaciones: '' });
      setModalAbierto(false);
    } catch (error) { 
      if (error.response?.status === 400) {
        agregarConflicto(formData.cedula, formData.nombreCompleto, "Cédula Duplicada Manual");
        mostrarAlerta("Cédula duplicada. Revisa notificaciones.", 'error'); 
      } else { mostrarAlerta("Error de conexión al servidor.", 'error'); }
    }
  }

  const guardarEdicion = async (e) => {
    e.preventDefault();
    if (!isOnline) return mostrarAlerta("Requiere internet.", "error");
    try {
      await axios.put(`https://api-electoral-calima.onrender.com/api/simpatizantes/${datosEdicion.id}`, { mesa: datosEdicion.mesa, observaciones: datosEdicion.observaciones });
      mostrarAlerta("Datos adicionales actualizados.", "exito");
      cargarDatosIniciales();
      setModalEditarAbierto(false);
    } catch (error) { 
      console.error(error); 
      mostrarAlerta("Error al actualizar la base de datos", "error"); 
    }
  }

  const crearUsuarioDesdeAdmin = async (e) => {
    e.preventDefault();
    if (!isOnline) return mostrarAlerta("Requiere internet.", "error");
    try {
      await axios.post('https://api-electoral-calima.onrender.com/api/usuarios', nuevoUsuarioData);
      mostrarAlerta(`Estructura creada.`, 'exito');
      cargarDatosIniciales();
      setModalUsuarioAbierto(false);
      setNuevoUsuarioData({ nombre: '', cedula: '', telefono: '', rol: 'CONCEJAL', contrasena: '', concejalId: '' });
    } catch (error) { mostrarAlerta(error.response?.data?.error || "Error al crear.", 'error'); }
  }
  
  const confirmarEliminarSimpatizante = async () => {
    if (!isOnline) return mostrarAlerta("Requiere internet.", "error");
    try {
      await axios.delete(`https://api-electoral-calima.onrender.com/api/simpatizantes/${modalConfirmacion.datos.id}`);
      cargarDatosIniciales();
      mostrarAlerta("Registro purgado.", 'exito');
      setFiltroMapaInteractivo({ tipo: 'TODOS', id: null, nombre: '' }); 
    } catch (error) { 
      console.error(error); 
      mostrarAlerta("Error al eliminar.", 'error'); 
    }
    setModalConfirmacion({ visible: false, tipo: '', datos: null });
  }

  const confirmarEliminarLider = async (accion) => {
    if (!isOnline) return mostrarAlerta("Requiere internet.", "error");
    try {
      await axios.delete(`https://api-electoral-calima.onrender.com/api/usuarios/${modalConfirmacion.datos.id}`, { data: { accion: accion, adminId: usuario.id } });
      cargarDatosIniciales();
      mostrarAlerta("Usuario eliminado del organigrama.", 'exito');
      setFiltroMapaInteractivo({ tipo: 'TODOS', id: null, nombre: '' });
    } catch (error) { 
      console.error(error); 
      mostrarAlerta("Error al eliminar el usuario.", 'error'); 
    }
    setModalConfirmacion({ visible: false, tipo: '', datos: null });
  }

  const ejecutarTransferencia = async (e) => {
    e.preventDefault();
    if (!isOnline) return mostrarAlerta("Requiere internet.", "error");
    if (!liderDestino) return mostrarAlerta("Selecciona destino.", "error");
    try {
      await axios.put(`https://api-electoral-calima.onrender.com/api/simpatizantes/${modalTransferir.datos.id}/transferir`, { nuevoLiderId: liderDestino });
      cargarDatosIniciales();
      mostrarAlerta("Simpatizante reasignado con éxito.", "exito");
      setModalTransferir({ visible: false, datos: null });
      setLiderDestino('');
      setFiltroMapaInteractivo({ tipo: 'TODOS', id: null, nombre: '' });
    } catch (error) { 
      console.error(error); 
      mostrarAlerta("Error en transferencia estructural.", "error"); 
    }
  }

  const limpiarHistorial = async () => {
    if (!isOnline) return mostrarAlerta("Requiere internet.", "error");
    try {
      await axios.delete('https://api-electoral-calima.onrender.com/api/alertas');
      setHistorialConflictos([]);
      mostrarAlerta("Auditoría purgada.", "exito");
    } catch (error) { console.error(error); }
  };

  const cerrarSesion = () => { 
    setUsuario(null); setSimpatizantes([]); setUsuariosDb([]); setTerminoBusqueda(''); localStorage.removeItem('usuarioElectoral'); 
  }

  /**
   * @function exportarAExcel
   * @description Extrae la vista actual de datos a formato CSV respetando UTF-8 (Tildes).
   */
  const exportarAExcel = () => {
    const cabeceras = ['Nombre Completo', 'Cédula', 'Teléfono', 'Zona', 'Barrio/Vereda', 'Dirección', 'Apoya Alcaldía', 'Apoya Concejo', 'Líder Registrador', 'Mesa Votación', 'Observaciones'];
    const filas = simpatizantesVisibles.map(s => [
      `"${s.nombreCompleto}"`, `"${s.cedula}"`, `"${s.telefono || ''}"`, `"${s.zona}"`, `"${s.barrioVereda}"`, `"${s.direccion}"`, s.apoyaAlcaldia ? 'SI' : 'NO', s.apoyaConcejo ? 'SI' : 'NO', `"${s.lider?.nombre || 'Desconocido'}"`, `"${s.mesa || ''}"`, `"${s.observaciones ? s.observaciones.replace(/\n/g, ' ') : ''}"`
    ]);
    const contenidoCSV = "data:text/csv;charset=utf-8,\uFEFF" + cabeceras.join(";") + "\n" + filas.map(e => e.join(";")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(contenidoCSV));
    link.setAttribute("download", `Electora_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ========================================================================
     LÓGICA DE FILTRADO Y MÉTRICAS (React Compiler Auto-Memoized)
     ======================================================================== */

  const simpatizantesPermitidos = simpatizantes.filter(s => {
    if (usuario?.rol === 'ADMIN') return true; 
    if (usuario?.rol === 'CONCEJAL') return s.liderId === usuario.id || s.lider?.concejalId === usuario.id; 
    return s.liderId === usuario?.id; 
  });

  const simpatizantesVisibles = simpatizantesPermitidos.filter(s => 
    s.nombreCompleto.toLowerCase().includes(terminoBusqueda.toLowerCase()) || s.cedula.includes(terminoBusqueda)
  );

  const lideresPermitidos = usuariosDb.filter(u => {
    if (usuario?.rol === 'ADMIN') return u.rol === 'LIDER' || u.rol === 'CONCEJAL';
    if (usuario?.rol === 'CONCEJAL') return u.rol === 'LIDER' && u.concejalId === usuario.id;
    return false;
  }).filter(u => u.nombre.toLowerCase().includes(terminoBusqueda.toLowerCase()) || u.cedula.includes(terminoBusqueda));

  const concejalesLista = lideresPermitidos.filter(u => u.rol === 'CONCEJAL');
  const lideresIndependientes = lideresPermitidos.filter(u => u.rol === 'LIDER' && !u.concejalId); 

  const simpatizantesMetricas = simpatizantesPermitidos.filter(s => {
    if (filtroMapaInteractivo.tipo === 'CONCEJAL') return s.lider?.concejalId === filtroMapaInteractivo.id || s.liderId === filtroMapaInteractivo.id;
    if (filtroMapaInteractivo.tipo === 'LIDER') return s.liderId === filtroMapaInteractivo.id;
    return true; 
  });

  const simpatizantesMapa = simpatizantesVisibles.filter(s => s.latitud && s.longitud).filter(s => {
    if (filtroMapaInteractivo.tipo === 'CONCEJAL' && s.lider?.concejalId !== filtroMapaInteractivo.id && s.liderId !== filtroMapaInteractivo.id) return false;
    if (filtroMapaInteractivo.tipo === 'LIDER' && s.liderId !== filtroMapaInteractivo.id) return false;
    if (filtroZonaMapa !== 'TODOS' && s.zona !== filtroZonaMapa) return false;
    if (filtroLugarMapa !== 'TODOS' && s.barrioVereda !== filtroLugarMapa) return false;
    return true;
  });

  // Preparación de datos para Recharts
  const agruparPorLugar = (zona) => {
    const filtrados = simpatizantesMetricas.filter(s => s.zona === zona);
    const conteo = {};
    filtrados.forEach(s => { conteo[s.barrioVereda] = (conteo[s.barrioVereda] || 0) + 1; });
    return Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
  };

  const datosTopBarrios = agruparPorLugar('URBANA');
  const datosTopVeredas = agruparPorLugar('RURAL');

  const votosAlcaldia = simpatizantesMetricas.filter(s => s.apoyaAlcaldia).length;
  const votosConcejo = simpatizantesMetricas.filter(s => s.apoyaConcejo).length;
  const sinApoyo = simpatizantesMetricas.length - Math.max(votosAlcaldia, votosConcejo);

  const datosIntencionVoto = [
    { name: 'Solo Alcaldía/Ambos', value: votosAlcaldia, color: 'var(--primary)' },
    { name: 'Solo Concejo', value: votosConcejo, color: 'var(--secondary)' },
    { name: 'Sin Definir', value: sinApoyo > 0 ? sinApoyo : 0, color: 'var(--border-color)' }
  ].filter(d => d.value > 0);

  /* ========================================================================
     RENDERIZADO VISUAL
     ======================================================================== */

  if (!usuario) {
    return (
      <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <GlobalStyles />
        <button onClick={alternarTema} style={{ position: 'fixed', top: '20px', right: '20px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '45px', height: '45px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow)' }}>
          {modoOscuro ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {notificacion.visible && (
          <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: notificacion.tipo === 'error' ? 'var(--danger)' : 'var(--secondary)', color: '#ffffff', padding: '15px 30px', borderRadius: '30px', fontWeight: 'bold', zIndex: 9999, animation: 'slideIn 0.3s ease-out' }}>
            {notificacion.mensaje}
          </div>
        )}
        <div style={{ background: 'var(--bg-card)', padding: '40px 30px', borderRadius: '20px', boxShadow: 'var(--shadow)', width: '100%', maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <img src="/ELECTORA-iso.png" alt="Electora Logo" style={{ width: '90px', marginBottom: '15px' }} />
            <h1 style={{ color: 'var(--text-main)', margin: '0 0 5px 0', fontSize: '26px', fontWeight: '800' }}>Electora</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Gestión Territorial SaaS</p>
          </div>
          <form onSubmit={manejarLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input placeholder="Número de Cédula" required onChange={e => setLoginData({...loginData, cedula: e.target.value})} style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
            <input type="password" placeholder="Contraseña" required onChange={e => setLoginData({...loginData, contrasena: e.target.value})} style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
            <button type="submit" style={{ padding: '16px', background: 'var(--primary)', color: '#ffffff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <ShieldCheck size={20} /> Ingresar al Sistema
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', width: '100vw', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <GlobalStyles />
      
      {/* 📡 STATUS BAR */}
      <div style={{ position: 'fixed', top: '10px', right: '20px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: '20px', boxShadow: 'var(--shadow)', zIndex: 9999, border: '1px solid var(--border-color)' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isOnline ? 'var(--secondary)' : 'var(--danger)', boxShadow: isOnline ? '0 0 8px var(--secondary)' : '0 0 8px var(--danger)' }}></div>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginRight: '10px' }}>{isOnline ? 'En línea' : 'Offline'}</span>
        
        {(usuario.rol === 'ADMIN' || usuario.rol === 'CONCEJAL') && (
          <button onClick={() => setModalHistorialAbierto(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', padding: 0, color: 'var(--text-muted)' }}>
            <Bell size={18} />
            {historialConflictos.length > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--danger)', color: 'white', fontSize: '9px', fontWeight: 'bold', padding: '2px 5px', borderRadius: '10px' }}>
                {historialConflictos.length}
              </span>
            )}
          </button>
        )}
      </div>

      {notificacion.visible && (
        <div style={{ position: 'fixed', top: '50px', left: '50%', transform: 'translateX(-50%)', background: notificacion.tipo === 'error' ? 'var(--danger)' : (notificacion.tipo === 'exito' ? 'var(--secondary)' : 'var(--primary)'), color: 'white', padding: '15px 30px', borderRadius: '30px', fontWeight: 'bold', zIndex: 9999, animation: 'slideIn 0.3s ease-out', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: 'var(--shadow)' }}>
          {notificacion.mensaje}
        </div>
      )}

      {/* --- MODALES DEL SISTEMA --- */}
      {modalHistorialAbierto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow)', position: 'relative' }}>
            <button onClick={() => setModalHistorialAbierto(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-main)', border: 'none', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            <h3 style={{ margin: '0 0 5px 0', color: 'var(--text-main)', fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={24} color="var(--accent)" /> Auditoría Global</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '14px' }}>Conflictos registrados en la red.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historialConflictos.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>No hay alertas recientes.</p>
              ) : (
                historialConflictos.map(conflicto => (
                  <div key={conflicto.id} style={{ padding: '15px', borderLeft: '4px solid var(--danger)', background: 'var(--bg-input)', borderRadius: '8px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--danger)', display: 'block', marginBottom: '4px' }}>{conflicto.motivo}</strong>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      <strong>Cédula:</strong> {conflicto.cedula} <br/>
                      <strong>Nombre:</strong> {conflicto.nombre} <br/>
                      <strong>Hora:</strong> {new Date(conflicto.fecha).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            {historialConflictos.length > 0 && usuario.rol === 'ADMIN' && (
              <button onClick={limpiarHistorial} style={{ width: '100%', padding: '12px', marginTop: '20px', background: 'var(--bg-main)', color: 'var(--text-main)', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                Limpiar Historial Global
              </button>
            )}
          </div>
        </div>
      )}

      {modalUsuarioAbierto && usuario.rol === 'ADMIN' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow)', position: 'relative' }}>
            <button onClick={() => setModalUsuarioAbierto(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-main)', border: 'none', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '22px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserPlus size={24} color="var(--primary)" /> Nuevo Miembro
            </h3>
            <form onSubmit={crearUsuarioDesdeAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <select value={nuevoUsuarioData.rol} onChange={e => setNuevoUsuarioData({...nuevoUsuarioData, rol: e.target.value, concejalId: ''})} required style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: 'bold' }}>
                <option value="CONCEJAL">Candidato al Concejo</option>
                <option value="LIDER">Líder de Campaña</option>
              </select>
              {nuevoUsuarioData.rol === 'LIDER' && (
                <select value={nuevoUsuarioData.concejalId} onChange={e => setNuevoUsuarioData({...nuevoUsuarioData, concejalId: e.target.value})} required style={{ padding: '14px', borderRadius: '10px', border: '2px solid var(--secondary)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}>
                  <option value="" disabled>Selecciona a qué Concejal pertenece...</option>
                  {usuariosDb.filter(u => u.rol === 'CONCEJAL').map(c => (
                    <option key={c.id} value={c.id}>Concejal: {c.nombre}</option>
                  ))}
                </select>
              )}
              <input placeholder="Nombre Completo" required value={nuevoUsuarioData.nombre} onChange={e => setNuevoUsuarioData({...nuevoUsuarioData, nombre: e.target.value})} style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
              <input placeholder="Cédula" required value={nuevoUsuarioData.cedula} onChange={e => setNuevoUsuarioData({...nuevoUsuarioData, cedula: e.target.value})} style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
              <input placeholder="Teléfono" required value={nuevoUsuarioData.telefono} onChange={e => setNuevoUsuarioData({...nuevoUsuarioData, telefono: e.target.value})} style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
              <input type="password" placeholder="Asignar Contraseña" required value={nuevoUsuarioData.contrasena} onChange={e => setNuevoUsuarioData({...nuevoUsuarioData, contrasena: e.target.value})} style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
              <button type="submit" style={{ padding: '16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar Usuario</button>
            </form>
          </div>
        </div>
      )}

      {modalEditarAbierto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow)', position: 'relative' }}>
            <button onClick={() => setModalEditarAbierto(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-main)', border: 'none', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit2 size={24} color="var(--accent)" /> Completar Datos
            </h3>
            <form onSubmit={guardarEdicion} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input placeholder="Número de Mesa (Ej: Mesa 4)" value={datosEdicion.mesa} onChange={e => setDatosEdicion({...datosEdicion, mesa: e.target.value})} style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
              <textarea placeholder="Observaciones adicionales (transporte, salud, etc.)" rows="4" value={datosEdicion.observaciones} onChange={e => setDatosEdicion({...datosEdicion, observaciones: e.target.value})} style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', resize: 'none' }} />
              <button type="submit" style={{ padding: '16px', background: 'var(--secondary)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar Cambios</button>
            </form>
          </div>
        </div>
      )}

      {modalTransferir.visible && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-main)', fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightLeft size={24} color="var(--primary)" /> Reasignar
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '15px' }}>Elige el nuevo líder para <strong>{modalTransferir.datos.nombre}</strong>.</p>
            <form onSubmit={ejecutarTransferencia} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <select value={liderDestino} onChange={(e) => setLiderDestino(e.target.value)} required style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}>
                <option value="" disabled>Selecciona el destino...</option>
                <option value={usuario.id}>Mi equipo (Admin)</option>
                {lideresPermitidos.map(l => <option key={l.id} value={l.id}>{l.nombre} ({l.rol})</option>)}
              </select>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => { setModalTransferir({visible: false, datos: null}); setLiderDestino(''); }} style={{ flex: 1, padding: '12px', background: 'var(--bg-main)', color: 'var(--text-main)', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--secondary)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Transferir</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalConfirmacion.visible && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-main)', fontSize: '22px' }}>Confirmar Acción</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '25px', fontSize: '15px' }}>
              Estás a punto de eliminar a <strong>{modalConfirmacion.datos.nombre}</strong>.
            </p>
            {modalConfirmacion.tipo === 'eliminar_simpatizante' && (
              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => setModalConfirmacion({ visible: false, tipo: '', datos: null })} style={{ flex: 1, padding: '12px', background: 'var(--bg-main)', color: 'var(--text-main)', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                <button onClick={confirmarEliminarSimpatizante} style={{ flex: 1, padding: '12px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Eliminar</button>
              </div>
            )}
            {modalConfirmacion.tipo === 'eliminar_lider' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => confirmarEliminarLider('transferir')} style={{ width: '100%', padding: '14px', background: 'var(--secondary)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Eliminar y Transferir Registros</button>
                <button onClick={() => confirmarEliminarLider('borrar_todo')} style={{ width: '100%', padding: '14px', background: 'transparent', color: 'var(--danger)', border: '2px solid var(--danger)', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Borrar Todo</button>
                <button onClick={() => setModalConfirmacion({ visible: false, tipo: '', datos: null })} style={{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>Cancelar</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ width: '100%', maxWidth: '1200px' }}>
        
        {/* HEADER EMPRESARIAL */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '20px 25px', borderRadius: '16px', flexWrap: 'wrap', gap: '15px', marginTop: '20px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src="/ELECTORA-iso.png" alt="Electora" style={{ width: '45px', height: 'auto' }} />
            <div>
              <h2 style={{ margin: '0', fontSize: '20px', color: 'var(--text-main)', fontWeight: '800' }}>{usuario.nombre.split(' ')[0]}</h2>
              <span style={{ fontSize: '11px', fontWeight: 'bold', background: usuario.rol === 'ADMIN' ? 'var(--primary)' : (usuario.rol === 'CONCEJAL' ? 'var(--secondary)' : 'var(--accent)'), color: '#ffffff', padding: '4px 10px', borderRadius: '12px', display: 'inline-block', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {usuario.rol}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <button onClick={alternarTema} style={{ padding: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px' }}>
              {modoOscuro ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={cerrarSesion} style={{ padding: '10px', background: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* 📊 TARJETAS DE MÉTRICAS */}
        <div style={{ display: 'flex', gap: '20px', marginTop: '25px', flexWrap: 'wrap' }}>
          <div onClick={() => { setFiltroZonaMapa('TODOS'); setFiltroLugarMapa('TODOS'); }} style={{ flex: '1 1 200px', background: 'var(--bg-card)', padding: '25px', borderRadius: '16px', borderTop: '4px solid var(--primary)', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow)', border: filtroZonaMapa === 'TODOS' ? '2px solid var(--primary)' : '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>{filtroMapaInteractivo.tipo === 'TODOS' ? 'Total Base' : `Equipo: ${filtroMapaInteractivo.nombre}`}</h3>
              <Database size={20} color="var(--primary)" />
            </div>
            <p style={{ fontSize: '36px', margin: 0, fontWeight: '800', color: 'var(--text-main)' }}>{simpatizantesMetricas.length}</p>
          </div>
          
          <div onClick={() => { setFiltroZonaMapa('URBANA'); setFiltroLugarMapa('TODOS'); }} style={{ flex: '1 1 200px', background: 'var(--bg-card)', padding: '25px', borderRadius: '16px', borderTop: '4px solid var(--secondary)', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow)', border: filtroZonaMapa === 'URBANA' ? '2px solid var(--secondary)' : '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: '0', color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Fuerza Urbana</h3>
              <Users size={20} color="var(--secondary)" />
            </div>
            <p style={{ fontSize: '36px', margin: 0, fontWeight: '800', color: 'var(--text-main)' }}>{simpatizantesMetricas.filter(s => s.zona === 'URBANA').length}</p>
          </div>

          <div onClick={() => { setFiltroZonaMapa('RURAL'); setFiltroLugarMapa('TODOS'); }} style={{ flex: '1 1 200px', background: 'var(--bg-card)', padding: '25px', borderRadius: '16px', borderTop: '4px solid var(--accent)', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow)', border: filtroZonaMapa === 'RURAL' ? '2px solid var(--accent)' : '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: '0', color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Fuerza Rural</h3>
              <MapIcon size={20} color="var(--accent)" />
            </div>
            <p style={{ fontSize: '36px', margin: 0, fontWeight: '800', color: 'var(--text-main)' }}>{simpatizantesMetricas.filter(s => s.zona === 'RURAL').length}</p>
          </div>
        </div>

        {/* 📈 DASHBOARD DE GRÁFICOS REALES (RECHARTS) */}
        <div style={{ display: 'flex', gap: '20px', marginTop: '25px', flexWrap: 'wrap' }}>
          
          <div style={{ flex: '1 1 350px', background: 'var(--bg-card)', padding: '25px', borderRadius: '16px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart3 size={20} color="var(--primary)" /> Top Barrios Urbanos</h3>
            {datosTopBarrios.length === 0 ? <p style={{color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center'}}>Sin datos.</p> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={datosTopBarrios} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{fill: 'var(--text-muted)', fontSize: 12}} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                  <Bar dataKey="value" fill="var(--secondary)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ flex: '1 1 350px', background: 'var(--bg-card)', padding: '25px', borderRadius: '16px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart3 size={20} color="var(--accent)" /> Top Veredas Rurales</h3>
            {datosTopVeredas.length === 0 ? <p style={{color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center'}}>Sin datos.</p> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={datosTopVeredas} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{fill: 'var(--text-muted)', fontSize: 12}} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                  <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ flex: '1 1 350px', background: 'var(--bg-card)', padding: '25px', borderRadius: '16px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-main)', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><ChartIcon size={20} color="var(--primary)" /> Intención de Voto</h3>
            {datosIntencionVoto.length === 0 ? <p style={{color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', marginTop: '40px'}}>Sin datos.</p> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={datosIntencionVoto} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                    {datosIntencionVoto.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px', color: 'var(--text-muted)'}}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 🗺️ MAPA TERRITORIAL */}
        <div style={{ marginTop: '25px', background: 'var(--bg-card)', padding: '25px', borderRadius: '16px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={22} color="var(--primary)" /> Análisis Espacial</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select value={filtroLugarMapa} onChange={(e) => { const val = e.target.value; setFiltroLugarMapa(val); if (BARRIOS_URBANOS.includes(val)) setFiltroZonaMapa('URBANA'); if (VEREDAS_RURALES.includes(val)) setFiltroZonaMapa('RURAL'); }} style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontWeight: 'bold', cursor: 'pointer' }}>
                <option value="TODOS">Todas las zonas</option>
                <optgroup label="Zona Urbana">{BARRIOS_URBANOS.map(b => <option key={b} value={b}>{b}</option>)}</optgroup>
                <optgroup label="Zona Rural">{VEREDAS_RURALES.map(v => <option key={v} value={v}>{v}</option>)}</optgroup>
              </select>
              {(filtroMapaInteractivo.tipo !== 'TODOS' || filtroZonaMapa !== 'TODOS' || filtroLugarMapa !== 'TODOS') && (
                <button onClick={() => { setFiltroMapaInteractivo({ tipo: 'TODOS', id: null, nombre: '' }); setFiltroZonaMapa('TODOS'); setFiltroLugarMapa('TODOS'); setEquipoExpandido(null); }} style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontWeight: 'bold', cursor: 'pointer' }}>
                  Restablecer Filtros
                </button>
              )}
            </div>
          </div>
          <div style={{ position: 'relative', height: '450px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', zIndex: 0 }}>
            <MapContainer center={centroCalima} zoom={14} style={{ height: '100%', width: '100%', zIndex: 1 }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <BotonCentrarUbicacion />
              {simpatizantesMapa.map(s => (
                <Marker key={s.id} position={[s.latitud, s.longitud]}>
                  <Popup>
                    <strong style={{color: '#000'}}>{s.nombreCompleto}</strong><br/>
                    <span style={{color: '#333'}}>{s.zona} - {s.barrioVereda}</span><br/>
                    {usuario.rol !== 'LIDER' && s.lider && <span style={{ color: 'var(--primary)', fontSize: '11px', fontWeight: 'bold' }}>Líder: {s.lider.nombre}</span>}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* CONTROLES DE TABLAS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setVistaAdmin('simpatizantes')} style={{ padding: '12px 20px', borderRadius: '8px', border: vistaAdmin === 'simpatizantes' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 'bold', background: vistaAdmin === 'simpatizantes' ? 'var(--primary)' : 'var(--bg-card)', color: vistaAdmin === 'simpatizantes' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} /> Padrón Electoral
            </button>
            {(usuario.rol === 'ADMIN' || usuario.rol === 'CONCEJAL') && (
              <button onClick={() => setVistaAdmin('lideres')} style={{ padding: '12px 20px', borderRadius: '8px', border: vistaAdmin === 'lideres' ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 'bold', background: vistaAdmin === 'lideres' ? 'var(--primary)' : 'var(--bg-card)', color: vistaAdmin === 'lideres' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} /> {usuario.rol === 'ADMIN' ? 'Estructura Política' : 'Mi Equipo'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '500px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', top: '14px', left: '15px' }} />
              <input type="text" placeholder="Buscar por cédula o nombre..." value={terminoBusqueda} onChange={(e) => setTerminoBusqueda(e.target.value)} style={{ padding: '12px 20px 12px 45px', borderRadius: '30px', border: '1px solid var(--border-color)', width: '100%', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
            </div>
            {vistaAdmin === 'simpatizantes' && (
              <button onClick={exportarAExcel} style={{ padding: '12px 20px', borderRadius: '30px', border: 'none', background: 'var(--secondary)', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={18} /> Excel
              </button>
            )}
          </div>
        </div>

        {/* LISTAS DE DATOS */}
        <div style={{ marginTop: '20px', background: 'var(--bg-card)', padding: '25px', borderRadius: '16px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' }}>
          {vistaAdmin === 'simpatizantes' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {simpatizantesVisibles.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>No se encontraron registros.</p> : null}
              {simpatizantesVisibles.map(simp => (
                <div key={simp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '15px 20px', border: '1px solid var(--border-color)', borderRadius: '12px', flexWrap: 'wrap', gap: '15px', background: 'var(--bg-input)' }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '16px', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>{simp.nombreCompleto}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Cédula: <strong>{simp.cedula}</strong> &nbsp;•&nbsp; {simp.zona}: {simp.barrioVereda}</div>
                    {(simp.mesa || simp.observaciones) && (
                      <div style={{ marginTop: '10px', padding: '10px 15px', background: 'var(--bg-card)', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
                        {simp.mesa && <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '4px' }}><strong>Mesa de Votación:</strong> {simp.mesa}</div>}
                        {simp.observaciones && <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{simp.observaciones}"</div>}
                      </div>
                    )}
                    {usuario.rol !== 'LIDER' && simp.lider && (
                      <div style={{ color: 'var(--primary)', fontSize: '12px', marginTop: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <UserPlus size={14} /> Registrado por: {simp.lider.nombre}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {simp.apoyaAlcaldia && <span style={{ background: 'var(--primary)', color: 'white', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>Alcaldía</span>}
                    {simp.apoyaConcejo && <span style={{ background: 'var(--secondary)', color: 'white', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>Concejo</span>}
                    <button onClick={() => { setDatosEdicion({ id: simp.id, mesa: simp.mesa || '', observaciones: simp.observaciones || '' }); setModalEditarAbierto(true); }} style={{ background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Editar Datos Adicionales">
                      <Edit2 size={16} />
                    </button>
                    {usuario.rol === 'ADMIN' && (
                      <button onClick={() => setModalTransferir({ visible: true, datos: { id: simp.id, nombre: simp.nombreCompleto } })} style={{ background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Reasignar Líder">
                        <ArrowRightLeft size={16} />
                      </button>
                    )}
                    {(usuario.rol === 'ADMIN' || usuario.id === simp.liderId) && (
                      <button onClick={() => setModalConfirmacion({ visible: true, tipo: 'eliminar_simpatizante', datos: { id: simp.id, nombre: simp.nombreCompleto } })} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Eliminar Registro">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {usuario.rol === 'CONCEJAL' && (
                <>
                  {lideresPermitidos.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>Aún no tienes líderes a tu cargo.</p> : null}
                  {lideresPermitidos.map(lider => {
                    const registrosLider = simpatizantes.filter(s => s.liderId === lider.id).length;
                    const esLiderSeleccionado = filtroMapaInteractivo.tipo === 'LIDER' && filtroMapaInteractivo.id === lider.id;
                    return (
                      <div key={lider.id} onClick={() => setFiltroMapaInteractivo({ tipo: 'LIDER', id: lider.id, nombre: lider.nombre })} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', border: esLiderSeleccionado ? '2px solid var(--secondary)' : '1px solid var(--border-color)', background: 'var(--bg-input)', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <div>
                          <strong style={{ fontSize: '16px', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>{lider.nombre}</strong> 
                          <span style={{ fontSize: '10px', background: 'var(--secondary)', color: 'white', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>Líder</span>
                          <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>Cédula: {lider.cedula} &nbsp;•&nbsp; Tel: {lider.telefono || 'N/A'}</div>
                        </div>
                        <div style={{ textAlign: 'center', background: 'var(--bg-card)', padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Aportes</span>
                          <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>{registrosLider}</span>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
              {usuario.rol === 'ADMIN' && (
                <>
                  {concejalesLista.map(concejal => {
                    const lideresDeEsteConcejal = lideresPermitidos.filter(u => u.rol === 'LIDER' && u.concejalId === concejal.id);
                    const registrosDelEquipo = simpatizantes.filter(s => s.lider?.concejalId === concejal.id || s.liderId === concejal.id).length;
                    const estaExpandido = equipoExpandido === concejal.id;
                    const estaSeleccionadoMapa = filtroMapaInteractivo.tipo === 'CONCEJAL' && filtroMapaInteractivo.id === concejal.id;
                    return (
                      <div key={concejal.id} style={{ display: 'flex', flexDirection: 'column', border: estaSeleccionadoMapa ? '2px solid var(--primary)' : '1px solid var(--border-color)', background: 'var(--bg-input)', borderRadius: '12px', overflow: 'hidden', transition: 'all 0.3s ease' }}>
                        <div onClick={() => { setFiltroMapaInteractivo({ tipo: 'CONCEJAL', id: concejal.id, nombre: concejal.nombre }); setEquipoExpandido(estaExpandido ? null : concejal.id); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', cursor: 'pointer', background: estaExpandido ? 'var(--bg-card)' : 'transparent' }}>
                          <div>
                            <strong style={{ fontSize: '18px', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>{concejal.nombre}</strong> 
                            <span style={{ fontSize: '10px', background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>Candidato al Concejo</span>
                            <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>Cédula: {concejal.cedula} &nbsp;•&nbsp; Líderes a cargo: {lideresDeEsteConcejal.length}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ textAlign: 'center', background: 'var(--bg-card)', padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Fuerza Total</span>
                              <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)' }}>{registrosDelEquipo}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setModalConfirmacion({ visible: true, tipo: 'eliminar_lider', datos: { id: concejal.id, nombre: concejal.nombre } }); }} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                        {estaExpandido && (
                          <div style={{ background: 'var(--bg-card)', padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estructura de Líderes</h4>
                            {lideresDeEsteConcejal.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '10px 0' }}>Sin estructura registrada.</p> : null}
                            {lideresDeEsteConcejal.map(lider => {
                              const registrosLider = simpatizantes.filter(s => s.liderId === lider.id).length;
                              const esLiderSeleccionado = filtroMapaInteractivo.tipo === 'LIDER' && filtroMapaInteractivo.id === lider.id;
                              return (
                                <div key={lider.id} onClick={(e) => { e.stopPropagation(); setFiltroMapaInteractivo({ tipo: 'LIDER', id: lider.id, nombre: lider.nombre }); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderLeft: esLiderSeleccionado ? '4px solid var(--secondary)' : '4px solid var(--border-color)', background: 'var(--bg-input)', borderRadius: '0 8px 8px 0', cursor: 'pointer' }}>
                                  <div>
                                    <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>{lider.nombre}</strong>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>C.C. {lider.cedula}</div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Aportes</span>
                                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main)' }}>{registrosLider}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); setModalConfirmacion({ visible: true, tipo: 'eliminar_lider', datos: { id: lider.id, nombre: lider.nombre } }); }} style={{ background: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer', padding: '5px' }}>
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {lideresIndependientes.length > 0 && <h4 style={{ margin: '20px 0 0 0', fontSize: '14px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Líderes Directos (Alcaldía)</h4>}
                  {lideresIndependientes.map(lider => {
                    const registros = simpatizantes.filter(s => s.liderId === lider.id).length;
                    const esLiderSeleccionado = filtroMapaInteractivo.tipo === 'LIDER' && filtroMapaInteractivo.id === lider.id;
                    return (
                      <div key={lider.id} onClick={() => setFiltroMapaInteractivo({ tipo: 'LIDER', id: lider.id, nombre: lider.nombre })} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', border: esLiderSeleccionado ? '2px solid var(--secondary)' : '1px solid var(--border-color)', background: 'var(--bg-input)', borderRadius: '12px', cursor: 'pointer' }}>
                        <div>
                          <strong style={{ fontSize: '16px', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>{lider.nombre}</strong> 
                          <span style={{ fontSize: '10px', background: 'var(--secondary)', color: 'white', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>Líder</span>
                          <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>Cédula: {lider.cedula} &nbsp;•&nbsp; Tel: {lider.telefono || 'N/A'}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <div style={{ textAlign: 'center', background: 'var(--bg-card)', padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Registros</span>
                            <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>{registros}</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setModalConfirmacion({ visible: true, tipo: 'eliminar_lider', datos: { id: lider.id, nombre: lider.nombre } }); }} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* 🔥 BOTÓN FLOTANTE DINÁMICO */}
        {usuario.rol === 'ADMIN' ? (
          <button onClick={() => setModalUsuarioAbierto(true)} style={{ position: 'fixed', bottom: '30px', right: '30px', background: 'var(--primary)', color: 'white', width: '65px', height: '65px', borderRadius: '50%', border: 'none', boxShadow: '0 10px 25px rgba(21, 60, 94, 0.4)', cursor: 'pointer', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Agregar Equipo">
            <UserPlus size={28} />
          </button>
        ) : (
          <button onClick={() => setModalAbierto(true)} style={{ position: 'fixed', bottom: '30px', right: '30px', background: 'var(--accent)', color: 'white', width: '65px', height: '65px', borderRadius: '50%', border: 'none', boxShadow: '0 10px 25px rgba(242, 139, 48, 0.4)', cursor: 'pointer', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Agregar Simpatizante">
            <UserPlus size={32} />
          </button>
        )}

      </div>

      {/* 📝 EL FORMULARIO FLOTANTE (CREAR SIMPATIZANTES) */}
      {modalAbierto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow)', position: 'relative' }}>
            <button onClick={() => setModalAbierto(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-main)', border: 'none', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '22px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}><UserPlus size={24} color="var(--accent)" /> Registro</h3>
            
            <form onSubmit={guardarSimpatizante} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input placeholder="Nombre Completo" value={formData.nombreCompleto} onChange={e => setFormData({...formData, nombreCompleto: e.target.value})} required style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
              <input placeholder="Cédula" value={formData.cedula} onChange={e => setFormData({...formData, cedula: e.target.value})} required style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
              <input placeholder="Teléfono" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
              
              <input placeholder="Mesa de Votación (Opcional)" value={formData.mesa} onChange={e => setFormData({...formData, mesa: e.target.value})} style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
              <textarea placeholder="Observaciones (transporte, etc.) (Opcional)" rows="2" value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', resize: 'none' }} />

              <div style={{ display: 'flex', gap: '10px' }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: '8px', cursor: 'pointer', background: formData.zona === 'URBANA' ? 'var(--primary)' : 'var(--bg-input)', color: formData.zona === 'URBANA' ? 'white' : 'var(--text-muted)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
                  <input type="radio" name="zona" value="URBANA" checked={formData.zona === 'URBANA'} onChange={() => setFormData({...formData, zona: 'URBANA', barrioVereda: ''})} style={{ display: 'none' }} />
                  Urbana
                </label>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: '8px', cursor: 'pointer', background: formData.zona === 'RURAL' ? 'var(--secondary)' : 'var(--bg-input)', color: formData.zona === 'RURAL' ? 'white' : 'var(--text-muted)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
                  <input type="radio" name="zona" value="RURAL" checked={formData.zona === 'RURAL'} onChange={() => setFormData({...formData, zona: 'RURAL', barrioVereda: ''})} style={{ display: 'none' }} />
                  Rural
                </label>
              </div>

              <select required value={formData.barrioVereda} onChange={e => setFormData({...formData, barrioVereda: e.target.value})} style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}>
                <option value="" disabled>Selecciona {formData.zona === 'URBANA' ? 'Barrio' : 'Vereda'}...</option>
                {(formData.zona === 'URBANA' ? BARRIOS_URBANOS : VEREDAS_RURALES).map(lugar => <option key={lugar} value={lugar}>{lugar}</option>)}
              </select>

              <input placeholder="Dirección o referencia" value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} required style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />

              <div style={{ position: 'relative', height: '180px', width: '100%', borderRadius: '10px', overflow: 'hidden', border: formData.latitud ? '2px solid var(--secondary)' : '2px solid var(--border-color)', zIndex: 0 }}>
                <MapContainer center={centroCalima} zoom={15} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <BotonCentrarUbicacion setFormData={setFormData} />
                  <SeleccionarUbicacion formData={formData} setFormData={setFormData} />
                </MapContainer>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: formData.apoyaAlcaldia ? 'var(--primary)' : 'var(--bg-input)', color: formData.apoyaAlcaldia ? '#ffffff' : 'var(--text-muted)', padding: '14px', borderRadius: '10px', cursor: 'pointer', border: '1px solid var(--border-color)' }}>
                  <input type="checkbox" checked={formData.apoyaAlcaldia} onChange={e => setFormData({...formData, apoyaAlcaldia: e.target.checked})} style={{ display: 'none' }} />
                  <span style={{ fontWeight: 'bold' }}>Apoya Alcaldía</span>
                </label>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: formData.apoyaConcejo ? 'var(--secondary)' : 'var(--bg-input)', color: formData.apoyaConcejo ? '#ffffff' : 'var(--text-muted)', padding: '14px', borderRadius: '10px', cursor: 'pointer', border: '1px solid var(--border-color)' }}>
                  <input type="checkbox" checked={formData.apoyaConcejo} onChange={e => setFormData({...formData, apoyaConcejo: e.target.checked})} style={{ display: 'none' }} />
                  <span style={{ fontWeight: 'bold' }}>Apoya Concejo</span>
                </label>
              </div>
              <button type="submit" style={{ padding: '16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '10px' }}>Guardar Registro</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App