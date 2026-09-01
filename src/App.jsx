import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const GlobalStyles = () => (
  <style>{`
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body, html { margin: 0; padding: 0; background-color: #f1f5f9; color: #0f172a; width: 100vw; min-height: 100vh; overflow-x: hidden; }
    #root { width: 100%; max-width: none; padding: 0; margin: 0; }
    @keyframes slideIn { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .grafica-barra { transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
  `}</style>
)

const BARRIOS_URBANOS = ['Centro', 'Obrero', 'La Carmelita', 'Fundadores', 'Sucre', 'San Vicente', 'El Dorado', 'Laureles', 'Otro'];
const VEREDAS_RURALES = ['Río Bravo', 'La Florida', 'Jiguales', 'Remolinos', 'La Cristalina', 'Santa Leticia', 'Palermo', 'Gorgona', 'Otra'];

function SeleccionarUbicacion({ formData, setFormData }) {
  useMapEvents({
    click(e) { setFormData({ ...formData, latitud: e.latlng.lat, longitud: e.latlng.lng }) },
  })
  return formData.latitud ? <Marker position={[formData.latitud, formData.longitud]} /> : null
}

function App() {
  const [usuario, setUsuario] = useState(null)
  const [pinAdmin, setPinAdmin] = useState('------')
  const [segundosRestantes, setSegundosRestantes] = useState(60 - new Date().getSeconds())
  const [loginData, setLoginData] = useState({ cedula: '', contrasena: '' })
  
  const [simpatizantes, setSimpatizantes] = useState([])
  const [usuariosDb, setUsuariosDb] = useState([]) 
  const [formData, setFormData] = useState({ nombreCompleto: '', cedula: '', telefono: '', zona: 'URBANA', barrioVereda: '', direccion: '', latitud: null, longitud: null, apoyaAlcaldia: false, apoyaConcejo: false })

  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalUsuarioAbierto, setModalUsuarioAbierto] = useState(false)
  const [nuevoUsuarioData, setNuevoUsuarioData] = useState({ nombre: '', cedula: '', telefono: '', rol: 'CONCEJAL', contrasena: '', concejalId: '' })

  const [vistaAdmin, setVistaAdmin] = useState('simpatizantes') 
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  
  const [equipoExpandido, setEquipoExpandido] = useState(null)
  const [filtroMapaInteractivo, setFiltroMapaInteractivo] = useState({ tipo: 'TODOS', id: null, nombre: '' })
  const [filtroZonaMapa, setFiltroZonaMapa] = useState('TODOS') 
  const [filtroLugarMapa, setFiltroLugarMapa] = useState('TODOS')

  const [notificacion, setNotificacion] = useState({ visible: false, mensaje: '', tipo: 'info' })
  const [modalConfirmacion, setModalConfirmacion] = useState({ visible: false, tipo: '', datos: null })
  const [modalTransferir, setModalTransferir] = useState({ visible: false, datos: null })
  const [liderDestino, setLiderDestino] = useState('')

  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [colaOffline, setColaOffline] = useState(() => JSON.parse(localStorage.getItem('colaOfflineElectoral')) || [])
  const [historialConflictos, setHistorialConflictos] = useState(() => JSON.parse(localStorage.getItem('historialConflictosElectoral')) || [])
  const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false)

  const centroCalima = [3.9274, -76.4851]

  const mostrarAlerta = useCallback((mensaje, tipo = 'info') => {
    setNotificacion({ visible: true, mensaje, tipo });
    setTimeout(() => setNotificacion({ visible: false, mensaje: '', tipo: 'info' }), 4000);
  }, []);

  const agregarConflicto = useCallback((cedula, nombre, motivo) => {
    setHistorialConflictos(prev => {
      const nuevo = [{ id: Date.now(), cedula, nombre, motivo, fecha: new Date().toLocaleString() }, ...prev];
      localStorage.setItem('historialConflictosElectoral', JSON.stringify(nuevo));
      return nuevo;
    });
  }, []);

  const limpiarHistorial = () => {
    setHistorialConflictos([]);
    localStorage.removeItem('historialConflictosElectoral');
  };

  const cargarDatosIniciales = useCallback(async () => {
    if (!navigator.onLine || !usuario) return; 
    try {
      const resSimp = await axios.get('https://api-electoral-calima.onrender.com/api/simpatizantes');
      setSimpatizantes(resSimp.data);
      if (usuario.rol === 'ADMIN' || usuario.rol === 'CONCEJAL') {
        const resUsu = await axios.get('https://api-electoral-calima.onrender.com/api/usuarios');
        setUsuariosDb(resUsu.data);
      }
    } catch (error) { console.error(error); }
  }, [usuario]);

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
          agregarConflicto(registro.cedula, registro.nombreCompleto, "Duplicado en Sincronización Offline");
        }
      }
    }

    setColaOffline(restantes);
    localStorage.setItem('colaOfflineElectoral', JSON.stringify(restantes));
    
    if (sincronizados > 0) {
      mostrarAlerta(`Se sincronizaron ${sincronizados} registros que estaban offline.`, "exito");
      cargarDatosIniciales(); 
    }
  }, [agregarConflicto, cargarDatosIniciales, mostrarAlerta]);

  useEffect(() => {
    const manejarConexion = () => {
      setIsOnline(true);
      mostrarAlerta("Conexión recuperada. Sincronizando datos...", "exito");
      sincronizarPendientes();
    };
    const manejarDesconexion = () => {
      setIsOnline(false);
      mostrarAlerta("Sin internet. Modo Offline Activado.", "error");
    };

    window.addEventListener('online', manejarConexion);
    window.addEventListener('offline', manejarDesconexion);
    
    // SOLUCIÓN ESLINT: Mover la ejecución al final de la cola de tareas
    const timerSync = setTimeout(() => {
      if (navigator.onLine && usuario) sincronizarPendientes();
    }, 0);

    return () => {
      window.removeEventListener('online', manejarConexion);
      window.removeEventListener('offline', manejarDesconexion);
      clearTimeout(timerSync);
    }
  }, [usuario, sincronizarPendientes, mostrarAlerta])

  useEffect(() => {
    // SOLUCIÓN ESLINT: Evitar actualizar el estado síncronamente durante el render
    const timerDatos = setTimeout(() => {
      cargarDatosIniciales();
    }, 0);
    
    const intervaloSincronizacion = setInterval(cargarDatosIniciales, 10000);
    
    return () => {
      clearTimeout(timerDatos);
      clearInterval(intervaloSincronizacion);
    };
  }, [cargarDatosIniciales])

  useEffect(() => {
    if (usuario?.rol === 'ADMIN') {
      const cargarPin = async () => {
        if (!navigator.onLine) return;
        try {
          const res = await axios.get('https://api-electoral-calima.onrender.com/api/pin-seguridad');
          setPinAdmin(res.data.pin);
        } catch (error) { console.error(error); }
      };
      
      const timerPin = setTimeout(() => { cargarPin(); }, 0);
      
      const intervalo = setInterval(() => {
        const seg = new Date().getSeconds();
        setSegundosRestantes(60 - seg);
        if (seg === 0) cargarPin();
      }, 1000);
      
      return () => {
        clearTimeout(timerPin);
        clearInterval(intervalo);
      };
    }
  }, [usuario])

  const manejarLogin = async (e) => {
    e.preventDefault()
    if (!navigator.onLine) return mostrarAlerta("Necesitas internet para iniciar sesión por primera vez.", "error");
    try {
      const respuesta = await axios.post('https://api-electoral-calima.onrender.com/api/login', loginData)
      setUsuario(respuesta.data.usuario)
      mostrarAlerta(`¡Bienvenido, ${respuesta.data.usuario.nombre}!`, 'exito')
    } catch (error) { 
      console.error(error);
      mostrarAlerta(error.response?.data?.error || "Error al iniciar sesión", 'error') 
    }
  }

  const guardarSimpatizante = async (e) => {
    e.preventDefault() 
    if (!formData.latitud || !formData.barrioVereda) return mostrarAlerta("Completa el barrio/vereda y la ubicación en el mapa.", 'error');

    const nuevoRegistro = { ...formData, liderId: usuario.id };

    if (!isOnline) {
      const nuevaCola = [...colaOffline, nuevoRegistro];
      setColaOffline(nuevaCola);
      localStorage.setItem('colaOfflineElectoral', JSON.stringify(nuevaCola));
      setSimpatizantes([...simpatizantes, { ...nuevoRegistro, id: Date.now() }]); 
      mostrarAlerta("Sin internet 📡. Ficha guardada en memoria local.", 'exito');
      setFormData({ nombreCompleto: '', cedula: '', telefono: '', zona: 'URBANA', barrioVereda: '', direccion: '', latitud: null, longitud: null, apoyaAlcaldia: false, apoyaConcejo: false })
      setModalAbierto(false)
      return;
    }

    try {
      await axios.post('https://api-electoral-calima.onrender.com/api/simpatizantes', nuevoRegistro)
      mostrarAlerta("¡Simpatizante guardado con éxito!", 'exito')
      cargarDatosIniciales();
      setFormData({ nombreCompleto: '', cedula: '', telefono: '', zona: 'URBANA', barrioVereda: '', direccion: '', latitud: null, longitud: null, apoyaAlcaldia: false, apoyaConcejo: false })
      setModalAbierto(false) 
    } catch (error) { 
      if (error.response?.status === 400) {
        agregarConflicto(formData.cedula, formData.nombreCompleto, "Cédula Duplicada en Registro Manual");
        mostrarAlerta("Cédula duplicada. Revisa el historial de notificaciones 🔔.", 'error'); 
      } else {
        mostrarAlerta("Error de conexión al guardar.", 'error'); 
      }
    }
  }

  const crearUsuarioDesdeAdmin = async (e) => {
    e.preventDefault();
    if (!isOnline) return mostrarAlerta("Necesitas internet para crear usuarios.", "error");
    try {
      await axios.post('https://api-electoral-calima.onrender.com/api/usuarios', { ...nuevoUsuarioData, codigoAutorizacion: pinAdmin });
      mostrarAlerta(`¡${nuevoUsuarioData.rol} creado con éxito!`, 'exito');
      cargarDatosIniciales();
      setModalUsuarioAbierto(false);
      setNuevoUsuarioData({ nombre: '', cedula: '', telefono: '', rol: 'CONCEJAL', contrasena: '', concejalId: '' });
    } catch (error) {
      console.error(error);
      mostrarAlerta(error.response?.data?.error || "Error al crear usuario. Verifica la cédula.", 'error');
    }
  }
  
  const confirmarEliminarSimpatizante = async () => {
    if (!isOnline) return mostrarAlerta("Necesitas internet para eliminar registros.", "error");
    try {
      await axios.delete(`https://api-electoral-calima.onrender.com/api/simpatizantes/${modalConfirmacion.datos.id}`);
      cargarDatosIniciales();
      mostrarAlerta("Registro eliminado.", 'exito');
      setFiltroMapaInteractivo({ tipo: 'TODOS', id: null, nombre: '' }); 
    } catch (error) { 
      console.error(error); 
      mostrarAlerta("Error al eliminar.", 'error'); 
    }
    setModalConfirmacion({ visible: false, tipo: '', datos: null });
  }

  const confirmarEliminarLider = async (accion) => {
    if (!isOnline) return mostrarAlerta("Necesitas internet para despedir usuarios.", "error");
    try {
      await axios.delete(`https://api-electoral-calima.onrender.com/api/usuarios/${modalConfirmacion.datos.id}`, { data: { accion: accion, adminId: usuario.id } });
      cargarDatosIniciales();
      mostrarAlerta("El usuario fue eliminado exitosamente.", 'exito');
      setFiltroMapaInteractivo({ tipo: 'TODOS', id: null, nombre: '' });
    } catch (error) { 
      console.error(error); 
      mostrarAlerta("Error al eliminar el usuario.", 'error'); 
    }
    setModalConfirmacion({ visible: false, tipo: '', datos: null });
  }

  const ejecutarTransferencia = async (e) => {
    e.preventDefault();
    if (!isOnline) return mostrarAlerta("Necesitas internet para transferir registros.", "error");
    if (!liderDestino) return mostrarAlerta("Debes seleccionar un líder o administrador de destino.", "error");
    try {
      await axios.put(`https://api-electoral-calima.onrender.com/api/simpatizantes/${modalTransferir.datos.id}/transferir`, { nuevoLiderId: liderDestino });
      cargarDatosIniciales();
      mostrarAlerta("Simpatizante reasignado con éxito.", "exito");
      setModalTransferir({ visible: false, datos: null });
      setLiderDestino('');
      setFiltroMapaInteractivo({ tipo: 'TODOS', id: null, nombre: '' });
    } catch (error) {
      console.error(error);
      mostrarAlerta("Error al transferir al simpatizante.", "error");
    }
  }

  const cerrarSesion = () => {
    setUsuario(null); setSimpatizantes([]); setUsuariosDb([]); setTerminoBusqueda('');
  }

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

  const agruparPorLugar = (zona) => {
    const filtrados = simpatizantesMetricas.filter(s => s.zona === zona);
    const conteo = {};
    filtrados.forEach(s => { conteo[s.barrioVereda] = (conteo[s.barrioVereda] || 0) + 1; });
    return Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  const topBarrios = agruparPorLugar('URBANA');
  const topVeredas = agruparPorLugar('RURAL');
  const maxBarrio = topBarrios.length ? topBarrios[0][1] : 1;
  const maxVereda = topVeredas.length ? topVeredas[0][1] : 1;
  const votosAlcaldia = simpatizantesMetricas.filter(s => s.apoyaAlcaldia).length;
  const votosConcejo = simpatizantesMetricas.filter(s => s.apoyaConcejo).length;

  if (!usuario) {
    return (
      <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <GlobalStyles />
        {notificacion.visible && (
          <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: notificacion.tipo === 'error' ? '#ef4444' : '#10b981', color: 'white', padding: '15px 30px', borderRadius: '30px', fontWeight: 'bold', zIndex: 9999, animation: 'slideIn 0.3s ease-out' }}>
            {notificacion.mensaje}
          </div>
        )}
        <div style={{ background: 'white', padding: '40px 30px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', width: '100%', maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ color: '#0f172a', margin: '0 0 5px 0', fontSize: '26px' }}>Panel Electoral</h1>
            <p style={{ color: '#64748b', margin: 0 }}>Calima El Darién</p>
          </div>
          <form onSubmit={manejarLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input placeholder="Número de Cédula" required onChange={e => setLoginData({...loginData, cedula: e.target.value})} style={{ padding: '14px', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#ffffff', color: '#000000' }} />
            <input type="password" placeholder="Contraseña" required onChange={e => setLoginData({...loginData, contrasena: e.target.value})} style={{ padding: '14px', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#ffffff', color: '#000000' }} />
            <button type="submit" style={{ padding: '16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Ingresar al Sistema</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', width: '100vw', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <GlobalStyles />
      
      {/* 📡 INDICADOR DE RED Y NOTIFICACIONES */}
      <div style={{ position: 'fixed', top: '10px', right: '20px', display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '6px 12px', borderRadius: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 9999 }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444', boxShadow: isOnline ? '0 0 8px #10b981' : '0 0 8px #ef4444' }}></div>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginRight: '10px' }}>{isOnline ? 'Conectado' : 'Offline'}</span>
        
        {/* 🔔 BOTÓN DE HISTORIAL DE CONFLICTOS */}
        <button 
          onClick={() => setModalHistorialAbierto(true)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', fontSize: '16px', padding: 0 }}
        >
          🔔
          {historialConflictos.length > 0 && (
            <span style={{ position: 'absolute', top: '-5px', right: '-8px', background: '#ef4444', color: 'white', fontSize: '9px', fontWeight: 'bold', padding: '2px 5px', borderRadius: '10px' }}>
              {historialConflictos.length}
            </span>
          )}
        </button>
        
        {colaOffline.length > 0 && <span style={{ fontSize: '12px', background: '#fbbf24', color: '#92400e', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold', marginLeft: '10px' }}>{colaOffline.length} en cola</span>}
      </div>

      {notificacion.visible && (
        <div style={{ position: 'fixed', top: '50px', left: '50%', transform: 'translateX(-50%)', background: notificacion.tipo === 'error' ? '#ef4444' : (notificacion.tipo === 'exito' ? '#10b981' : '#3b82f6'), color: 'white', padding: '15px 30px', borderRadius: '30px', fontWeight: 'bold', zIndex: 9999, animation: 'slideIn 0.3s ease-out', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {notificacion.mensaje}
        </div>
      )}

      {/* 🛑 MODAL: HISTORIAL DE CONFLICTOS */}
      {modalHistorialAbierto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative' }}>
            <button onClick={() => setModalHistorialAbierto(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            <h3 style={{ margin: '0 0 5px 0', color: '#0f172a', fontSize: '22px' }}>🔔 Auditoría de Registros</h3>
            <p style={{ color: '#64748b', marginBottom: '20px', fontSize: '14px' }}>Historial de cédulas duplicadas o rechazadas.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historialConflictos.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0' }}>No hay alertas recientes.</p>
              ) : (
                historialConflictos.map(conflicto => (
                  <div key={conflicto.id} style={{ padding: '15px', borderLeft: '4px solid #ef4444', background: '#fef2f2', borderRadius: '8px' }}>
                    <strong style={{ fontSize: '15px', color: '#991b1b', display: 'block', marginBottom: '4px' }}>⚠️ {conflicto.motivo}</strong>
                    <div style={{ fontSize: '13px', color: '#7f1d1d' }}>
                      <strong>Cédula:</strong> {conflicto.cedula} <br/>
                      <strong>Nombre:</strong> {conflicto.nombre} <br/>
                      <strong>Hora del intento:</strong> {conflicto.fecha}
                    </div>
                  </div>
                ))
              )}
            </div>

            {historialConflictos.length > 0 && (
              <button onClick={limpiarHistorial} style={{ width: '100%', padding: '12px', marginTop: '20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                Limpiar Historial
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL CREAR EQUIPO */}
      {modalUsuarioAbierto && usuario.rol === 'ADMIN' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative' }}>
            <button onClick={() => setModalUsuarioAbierto(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            <h3 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: '22px' }}>➕ Nuevo Miembro</h3>
            
            <form onSubmit={crearUsuarioDesdeAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <select value={nuevoUsuarioData.rol} onChange={e => setNuevoUsuarioData({...nuevoUsuarioData, rol: e.target.value, concejalId: ''})} required style={{ padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontWeight: 'bold' }}>
                <option value="CONCEJAL">Candidato al Concejo</option>
                <option value="LIDER">Líder de Campaña</option>
              </select>

              {nuevoUsuarioData.rol === 'LIDER' && (
                <select value={nuevoUsuarioData.concejalId} onChange={e => setNuevoUsuarioData({...nuevoUsuarioData, concejalId: e.target.value})} required style={{ padding: '14px', borderRadius: '10px', border: '2px solid #8b5cf6', backgroundColor: '#f5f3ff', color: '#0f172a' }}>
                  <option value="" disabled>Selecciona a qué Concejal pertenece...</option>
                  {usuariosDb.filter(u => u.rol === 'CONCEJAL').map(c => (
                    <option key={c.id} value={c.id}>Concejal: {c.nombre}</option>
                  ))}
                </select>
              )}

              <input placeholder="Nombre Completo" required value={nuevoUsuarioData.nombre} onChange={e => setNuevoUsuarioData({...nuevoUsuarioData, nombre: e.target.value})} style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '10px', backgroundColor: '#ffffff', color: '#000000' }} />
              <input placeholder="Cédula" required value={nuevoUsuarioData.cedula} onChange={e => setNuevoUsuarioData({...nuevoUsuarioData, cedula: e.target.value})} style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '10px', backgroundColor: '#ffffff', color: '#000000' }} />
              <input placeholder="Teléfono" required value={nuevoUsuarioData.telefono} onChange={e => setNuevoUsuarioData({...nuevoUsuarioData, telefono: e.target.value})} style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '10px', backgroundColor: '#ffffff', color: '#000000' }} />
              <input type="password" placeholder="Asignar Contraseña" required value={nuevoUsuarioData.contrasena} onChange={e => setNuevoUsuarioData({...nuevoUsuarioData, contrasena: e.target.value})} style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '10px', backgroundColor: '#ffffff', color: '#000000' }} />
              
              <button type="submit" style={{ padding: '16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar Usuario</button>
            </form>
          </div>
        </div>
      )}

      {/* MODALES DE TRANSFERENCIA Y CONFIRMACIÓN */}
      {modalTransferir.visible && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#0f172a', fontSize: '22px' }}>🔄 Reasignar Simpatizante</h3>
            <p style={{ color: '#64748b', marginBottom: '20px', fontSize: '15px' }}>Elige el nuevo líder para <strong>{modalTransferir.datos.nombre}</strong>.</p>
            <form onSubmit={ejecutarTransferencia} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <select value={liderDestino} onChange={(e) => setLiderDestino(e.target.value)} required style={{ padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', outline: 'none' }}>
                <option value="" disabled>Selecciona el nuevo destino...</option>
                <option value={usuario.id}>Mi equipo (Admin)</option>
                {lideresPermitidos.map(l => (
                  <option key={l.id} value={l.id}>{l.nombre} ({l.rol})</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => { setModalTransferir({visible: false, datos: null}); setLiderDestino(''); }} style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, padding: '12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Transferir</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalConfirmacion.visible && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#0f172a', fontSize: '22px' }}>⚠️ Confirmar Acción</h3>
            <p style={{ color: '#64748b', marginBottom: '25px', fontSize: '15px' }}>
              Estás a punto de eliminar a <strong>{modalConfirmacion.datos.nombre}</strong>.
            </p>
            {modalConfirmacion.tipo === 'eliminar_simpatizante' && (
              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => setModalConfirmacion({ visible: false, tipo: '', datos: null })} style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                <button onClick={confirmarEliminarSimpatizante} style={{ flex: 1, padding: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Eliminar</button>
              </div>
            )}
            {modalConfirmacion.tipo === 'eliminar_lider' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => confirmarEliminarLider('transferir')} style={{ width: '100%', padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>📦 Eliminar y TRANSFERIR registros</button>
                <button onClick={() => confirmarEliminarLider('borrar_todo')} style={{ width: '100%', padding: '14px', background: '#fee2e2', color: '#ef4444', border: '2px solid #fca5a5', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️ Borrar TODO (Usuario y registros)</button>
                <button onClick={() => setModalConfirmacion({ visible: false, tipo: '', datos: null })} style={{ width: '100%', padding: '12px', background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>Cancelar</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ width: '100%', maxWidth: '1200px' }}>
        
        {/* HEADER DE LA APP */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '15px 25px', borderRadius: '16px', flexWrap: 'wrap', gap: '15px', marginTop: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>Hola, {usuario.nombre.split(' ')[0]}</h2>
            <span style={{ fontSize: '12px', fontWeight: 'bold', background: usuario.rol === 'ADMIN' ? '#dbeafe' : (usuario.rol === 'CONCEJAL' ? '#e0e7ff' : '#dcfce3'), color: usuario.rol === 'ADMIN' ? '#1e40af' : (usuario.rol === 'CONCEJAL' ? '#4338ca' : '#166534'), padding: '4px 10px', borderRadius: '12px', display: 'inline-block', marginTop: '5px' }}>
              {usuario.rol}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            {usuario.rol === 'ADMIN' && (
              <>
                <div style={{ background: '#0f172a', padding: '8px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>PIN DE ACCESO</span>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#fbbf24' }}>{pinAdmin}</span>
                  </div>
                  <div style={{ position: 'relative', width: '36px', height: '36px' }}>
                    <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="18" cy="18" r="15" stroke="#334155" strokeWidth="4" fill="none" />
                      <circle cx="18" cy="18" r="15" stroke="#3b82f6" strokeWidth="4" fill="none" strokeDasharray={94.2} strokeDashoffset={94.2 - (segundosRestantes / 60) * 94.2} style={{ transition: 'stroke-dashoffset 1s linear' }} />
                    </svg>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: 'bold' }}>{segundosRestantes}</div>
                  </div>
                </div>
                <button onClick={() => setModalUsuarioAbierto(true)} style={{ padding: '10px 20px', background: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ➕ Crear Equipo
                </button>
              </>
            )}
            <button onClick={cerrarSesion} style={{ padding: '10px 20px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Salir</button>
          </div>
        </div>

        {/* 📊 TARJETAS DE MÉTRICAS GLOBALES TÁCTILES */}
        <div style={{ display: 'flex', gap: '15px', marginTop: '20px', flexWrap: 'wrap' }}>
          <div 
            onClick={() => { setFiltroZonaMapa('TODOS'); setFiltroLugarMapa('TODOS'); }}
            style={{ flex: '1 1 200px', background: 'white', padding: '20px', borderRadius: '16px', borderLeft: '5px solid #0f172a', cursor: 'pointer', outline: filtroZonaMapa === 'TODOS' ? '3px solid #0f172a' : 'none', transform: filtroZonaMapa === 'TODOS' ? 'scale(1.03)' : 'scale(1)', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}
          >
            <h3 style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '13px', textTransform: 'uppercase' }}>
              {filtroMapaInteractivo.tipo === 'TODOS' ? 'TOTAL REGISTROS' : `EQUIPO: ${filtroMapaInteractivo.nombre}`}
            </h3>
            <p style={{ fontSize: '32px', margin: 0, fontWeight: '800', color: '#0f172a' }}>{simpatizantesMetricas.length}</p>
          </div>
          <div 
            onClick={() => { setFiltroZonaMapa('URBANA'); setFiltroLugarMapa('TODOS'); }}
            style={{ flex: '1 1 200px', background: 'white', padding: '20px', borderRadius: '16px', borderLeft: '5px solid #3b82f6', cursor: 'pointer', outline: filtroZonaMapa === 'URBANA' ? '3px solid #3b82f6' : 'none', transform: filtroZonaMapa === 'URBANA' ? 'scale(1.03)' : 'scale(1)', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.1)' }}
          >
            <h3 style={{ margin: '0 0 5px 0', color: '#3b82f6', fontSize: '13px' }}>FUERZA URBANA</h3>
            <p style={{ fontSize: '32px', margin: 0, fontWeight: '800', color: '#1e3a8a' }}>{simpatizantesMetricas.filter(s => s.zona === 'URBANA').length}</p>
          </div>
          <div 
            onClick={() => { setFiltroZonaMapa('RURAL'); setFiltroLugarMapa('TODOS'); }}
            style={{ flex: '1 1 200px', background: 'white', padding: '20px', borderRadius: '16px', borderLeft: '5px solid #10b981', cursor: 'pointer', outline: filtroZonaMapa === 'RURAL' ? '3px solid #10b981' : 'none', transform: filtroZonaMapa === 'RURAL' ? 'scale(1.03)' : 'scale(1)', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.1)' }}
          >
            <h3 style={{ margin: '0 0 5px 0', color: '#10b981', fontSize: '13px' }}>FUERZA RURAL</h3>
            <p style={{ fontSize: '32px', margin: 0, fontWeight: '800', color: '#064e3b' }}>{simpatizantesMetricas.filter(s => s.zona === 'RURAL').length}</p>
          </div>
        </div>

        {/* 📈 DASHBOARD DE GRÁFICAS ESTADÍSTICAS NATIVAS */}
        <div style={{ display: 'flex', gap: '15px', marginTop: '20px', flexWrap: 'wrap' }}>
          
          <div style={{ flex: '1 1 300px', background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#0f172a', fontSize: '16px' }}>🏙️ Top Barrios (Urbano)</h3>
            {topBarrios.length === 0 ? <p style={{color: '#94a3b8', fontSize: '14px'}}>Sin datos urbanos.</p> : null}
            {topBarrios.map(([nombre, cantidad]) => (
              <div key={nombre} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                  <span>{nombre}</span><span>{cantidad}</span>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div className="grafica-barra" style={{ width: `${(cantidad / maxBarrio) * 100}%`, height: '100%', background: '#3b82f6', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ flex: '1 1 300px', background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#0f172a', fontSize: '16px' }}>🌲 Top Veredas (Rural)</h3>
            {topVeredas.length === 0 ? <p style={{color: '#94a3b8', fontSize: '14px'}}>Sin datos rurales.</p> : null}
            {topVeredas.map(([nombre, cantidad]) => (
              <div key={nombre} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                  <span>{nombre}</span><span>{cantidad}</span>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div className="grafica-barra" style={{ width: `${(cantidad / maxVereda) * 100}%`, height: '100%', background: '#10b981', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ flex: '1 1 300px', background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#0f172a', fontSize: '16px' }}>📊 Intención de Voto</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', color: '#4338ca', marginBottom: '4px' }}>
                  <span>🏛️ Apoyo Alcaldía</span><span>{votosAlcaldia}</span>
                </div>
                <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                  <div className="grafica-barra" style={{ width: `${simpatizantesMetricas.length ? (votosAlcaldia / simpatizantesMetricas.length) * 100 : 0}%`, height: '100%', background: '#6366f1', borderRadius: '6px' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', color: '#15803d', marginBottom: '4px' }}>
                  <span>👥 Apoyo Concejo</span><span>{votosConcejo}</span>
                </div>
                <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                  <div className="grafica-barra" style={{ width: `${simpatizantesMetricas.length ? (votosConcejo / simpatizantesMetricas.length) * 100 : 0}%`, height: '100%', background: '#22c55e', borderRadius: '6px' }} />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* 🗺️ MAPA CON FILTRO ESPACIAL Y DE LUGARES EN LA ESQUINA */}
        <div style={{ marginTop: '20px', background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: '0 0 5px 0', color: '#0f172a' }}>📍 Análisis Territorial Espacial</h3>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select 
                value={filtroLugarMapa} 
                onChange={(e) => {
                  const val = e.target.value;
                  setFiltroLugarMapa(val);
                  if (BARRIOS_URBANOS.includes(val)) setFiltroZonaMapa('URBANA');
                  if (VEREDAS_RURALES.includes(val)) setFiltroZonaMapa('RURAL');
                }} 
                style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none', fontWeight: 'bold', cursor: 'pointer' }}
              >
                <option value="TODOS">🗺️ Ver todos los lugares</option>
                <optgroup label="🏙️ Zona Urbana">
                  {BARRIOS_URBANOS.map(b => <option key={b} value={b}>{b}</option>)}
                </optgroup>
                <optgroup label="🌲 Zona Rural">
                  {VEREDAS_RURALES.map(v => <option key={v} value={v}>{v}</option>)}
                </optgroup>
              </select>

              {(filtroMapaInteractivo.tipo !== 'TODOS' || filtroZonaMapa !== 'TODOS' || filtroLugarMapa !== 'TODOS') && (
                <button 
                  onClick={() => { 
                    setFiltroMapaInteractivo({ tipo: 'TODOS', id: null, nombre: '' });
                    setFiltroZonaMapa('TODOS');
                    setFiltroLugarMapa('TODOS');
                    setEquipoExpandido(null);
                  }}
                  style={{ padding: '8px 15px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  ✖ Quitar Filtros
                </button>
              )}
            </div>
          </div>
          
          <div style={{ height: '400px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 0 }}>
            <MapContainer center={centroCalima} zoom={14} style={{ height: '100%', width: '100%', zIndex: 1 }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {simpatizantesMapa.map(s => (
                <Marker key={s.id} position={[s.latitud, s.longitud]}>
                  <Popup>
                    <strong>{s.nombreCompleto}</strong><br/>
                    {s.zona} - {s.barrioVereda}<br/>
                    {usuario.rol !== 'LIDER' && s.lider && <span style={{ color: '#8b5cf6', fontSize: '11px' }}>Líder: {s.lider.nombre}</span>}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* PESTAÑAS Y BUSCADOR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '25px', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setVistaAdmin('simpatizantes')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: vistaAdmin === 'simpatizantes' ? '#0f172a' : '#e2e8f0', color: vistaAdmin === 'simpatizantes' ? 'white' : '#475569' }}>👥 Base de Datos</button>
            {(usuario.rol === 'ADMIN' || usuario.rol === 'CONCEJAL') && (
              <button onClick={() => setVistaAdmin('lideres')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: vistaAdmin === 'lideres' ? '#0f172a' : '#e2e8f0', color: vistaAdmin === 'lideres' ? 'white' : '#475569' }}>
                🏅 {usuario.rol === 'ADMIN' ? 'Equipo Político' : 'Mi Equipo'}
              </button>
            )}
          </div>
          <input type="text" placeholder="🔍 Buscar..." value={terminoBusqueda} onChange={(e) => setTerminoBusqueda(e.target.value)} style={{ padding: '12px 20px', borderRadius: '30px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '350px', backgroundColor: '#ffffff', color: '#000000', outline: 'none' }} />
        </div>

        {/* LISTAS DE DATOS */}
        <div style={{ marginTop: '20px', background: 'white', padding: '20px', borderRadius: '16px' }}>
          {vistaAdmin === 'simpatizantes' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {simpatizantesVisibles.length === 0 ? <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0' }}>No se encontraron simpatizantes.</p> : null}
              {simpatizantesVisibles.map(simp => (
                <div key={simp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: '1px solid #f1f5f9', borderRadius: '12px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <strong style={{ fontSize: '16px' }}>{simp.nombreCompleto}</strong>
                    <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>CC: {simp.cedula} &nbsp;•&nbsp; {simp.zona}: {simp.barrioVereda}</div>
                    {usuario.rol !== 'LIDER' && simp.lider && (
                      <div style={{ color: '#8b5cf6', fontSize: '12px', marginTop: '6px', fontWeight: 'bold' }}>👤 Registrado por: {simp.lider.nombre}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {simp.apoyaAlcaldia && <span style={{ background: '#dbeafe', color: '#1e40af', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>Alcaldía</span>}
                    {simp.apoyaConcejo && <span style={{ background: '#dcfce3', color: '#166534', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>Concejo</span>}
                    
                    {usuario.rol === 'ADMIN' && (
                      <button onClick={() => setModalTransferir({ visible: true, datos: { id: simp.id, nombre: simp.nombreCompleto } })} style={{ background: '#ede9fe', color: '#8b5cf6', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '10px' }}>Transferir</button>
                    )}
                    {(usuario.rol === 'ADMIN' || usuario.id === simp.liderId) && (
                      <button onClick={() => setModalConfirmacion({ visible: true, tipo: 'eliminar_simpatizante', datos: { id: simp.id, nombre: simp.nombreCompleto } })} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' }}>X</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {usuario.rol === 'CONCEJAL' && (
                <>
                  {lideresPermitidos.length === 0 ? <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0' }}>Aún no tienes líderes a tu cargo.</p> : null}
                  {lideresPermitidos.map(lider => {
                    const registrosLider = simpatizantes.filter(s => s.liderId === lider.id).length;
                    const esLiderSeleccionado = filtroMapaInteractivo.tipo === 'LIDER' && filtroMapaInteractivo.id === lider.id;
                    return (
                      <div 
                        key={lider.id} 
                        onClick={() => setFiltroMapaInteractivo({ tipo: 'LIDER', id: lider.id, nombre: lider.nombre })}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: esLiderSeleccionado ? '2px solid #10b981' : '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', cursor: 'pointer' }}
                      >
                        <div>
                          <strong style={{ fontSize: '16px' }}>{lider.nombre}</strong> <span style={{ fontSize: '10px', background: '#dcfce3', color: '#166534', padding: '2px 6px', borderRadius: '4px' }}>LÍDER</span>
                          <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>CC: {lider.cedula} &nbsp;•&nbsp; Tel: {lider.telefono || 'N/A'}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Aportes</span>
                          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>{registrosLider}</span>
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
                      <div key={concejal.id} style={{ display: 'flex', flexDirection: 'column', border: estaSeleccionadoMapa ? '2px solid #8b5cf6' : '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', overflow: 'hidden', transition: 'all 0.3s ease' }}>
                        <div 
                          onClick={() => { setFiltroMapaInteractivo({ tipo: 'CONCEJAL', id: concejal.id, nombre: concejal.nombre }); setEquipoExpandido(estaExpandido ? null : concejal.id); }}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', cursor: 'pointer', background: estaExpandido ? '#f1f5f9' : 'transparent' }}
                        >
                          <div>
                            <strong style={{ fontSize: '18px', color: '#0f172a' }}>{concejal.nombre}</strong> <span style={{ fontSize: '10px', background: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', marginLeft: '5px' }}>CONCEJAL</span>
                            <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>CC: {concejal.cedula} &nbsp;•&nbsp; Líderes a cargo: {lideresDeEsteConcejal.length}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Total Equipo</span>
                              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#4338ca' }}>{registrosDelEquipo}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setModalConfirmacion({ visible: true, tipo: 'eliminar_lider', datos: { id: concejal.id, nombre: concejal.nombre } }); }} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '10px 15px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>Despedir</button>
                            <span style={{ transform: estaExpandido ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>▼</span>
                          </div>
                        </div>

                        {estaExpandido && (
                          <div style={{ background: 'white', padding: '15px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {lideresDeEsteConcejal.length === 0 ? <p style={{ textAlign: 'center', color: '#94a3b8', margin: '10px 0' }}>No tiene líderes registrados aún.</p> : null}
                            {lideresDeEsteConcejal.map(lider => {
                              const registrosLider = simpatizantes.filter(s => s.liderId === lider.id).length;
                              const esLiderSeleccionado = filtroMapaInteractivo.tipo === 'LIDER' && filtroMapaInteractivo.id === lider.id;
                              return (
                                <div 
                                  key={lider.id} 
                                  onClick={(e) => { e.stopPropagation(); setFiltroMapaInteractivo({ tipo: 'LIDER', id: lider.id, nombre: lider.nombre }); }}
                                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', borderLeft: esLiderSeleccionado ? '4px solid #10b981' : '4px solid #cbd5e1', background: '#f8fafc', borderRadius: '0 8px 8px 0', cursor: 'pointer' }}
                                >
                                  <div>
                                    <strong style={{ fontSize: '15px' }}>↳ {lider.nombre}</strong> <span style={{ fontSize: '10px', background: '#dcfce3', color: '#166534', padding: '2px 6px', borderRadius: '4px' }}>LÍDER</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Aportes</span>
                                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{registrosLider}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); setModalConfirmacion({ visible: true, tipo: 'eliminar_lider', datos: { id: lider.id, nombre: lider.nombre } }); }} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>X</button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {lideresIndependientes.map(lider => {
                    const registros = simpatizantes.filter(s => s.liderId === lider.id).length;
                    const esLiderSeleccionado = filtroMapaInteractivo.tipo === 'LIDER' && filtroMapaInteractivo.id === lider.id;
                    return (
                      <div 
                        key={lider.id} 
                        onClick={() => setFiltroMapaInteractivo({ tipo: 'LIDER', id: lider.id, nombre: lider.nombre })}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: esLiderSeleccionado ? '2px solid #10b981' : '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px', cursor: 'pointer' }}
                      >
                        <div>
                          <strong style={{ fontSize: '16px' }}>{lider.nombre}</strong> <span style={{ fontSize: '10px', background: '#dcfce3', color: '#166534', padding: '2px 6px', borderRadius: '4px' }}>LÍDER DIRECTO</span>
                          <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>CC: {lider.cedula} &nbsp;•&nbsp; Tel: {lider.telefono || 'N/A'}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Registros</span>
                            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>{registros}</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setModalConfirmacion({ visible: true, tipo: 'eliminar_lider', datos: { id: lider.id, nombre: lider.nombre } }); }} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '10px 15px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>Despedir</button>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* BOTÓN FLOTANTE REGISTRO SIMPATIZANTE */}
        <button onClick={() => setModalAbierto(true)} style={{ position: 'fixed', bottom: '30px', right: '30px', background: '#3b82f6', color: 'white', width: '65px', height: '65px', borderRadius: '50%', border: 'none', boxShadow: '0 10px 25px rgba(59, 130, 246, 0.5)', fontSize: '30px', cursor: 'pointer', zIndex: 100 }}>+</button>

      </div>

      {/* 📝 EL FORMULARIO FLOTANTE (SIMPATIZANTES) */}
      {modalAbierto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative' }}>
            <button onClick={() => setModalAbierto(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '22px' }}>Ficha de Simpatizante</h3>
            
            <form onSubmit={guardarSimpatizante} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input placeholder="Nombre Completo" value={formData.nombreCompleto} onChange={e => setFormData({...formData, nombreCompleto: e.target.value})} required style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', backgroundColor: '#ffffff', color: '#000000' }} />
              <input placeholder="Cédula" value={formData.cedula} onChange={e => setFormData({...formData, cedula: e.target.value})} required style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', backgroundColor: '#ffffff', color: '#000000' }} />
              <input placeholder="Teléfono" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', backgroundColor: '#ffffff', color: '#000000' }} />
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: '8px', cursor: 'pointer', background: formData.zona === 'URBANA' ? '#0f172a' : '#f1f5f9', color: formData.zona === 'URBANA' ? 'white' : '#64748b', fontWeight: 'bold' }}>
                  <input type="radio" name="zona" value="URBANA" checked={formData.zona === 'URBANA'} onChange={() => setFormData({...formData, zona: 'URBANA', barrioVereda: ''})} style={{ display: 'none' }} />
                  🏙️ Urbana
                </label>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: '8px', cursor: 'pointer', background: formData.zona === 'RURAL' ? '#10b981' : '#f1f5f9', color: formData.zona === 'RURAL' ? 'white' : '#64748b', fontWeight: 'bold' }}>
                  <input type="radio" name="zona" value="RURAL" checked={formData.zona === 'RURAL'} onChange={() => setFormData({...formData, zona: 'RURAL', barrioVereda: ''})} style={{ display: 'none' }} />
                  🌲 Rural
                </label>
              </div>

              <select required value={formData.barrioVereda} onChange={e => setFormData({...formData, barrioVereda: e.target.value})} style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', backgroundColor: '#ffffff', color: '#000000' }}>
                <option value="" disabled>Selecciona {formData.zona === 'URBANA' ? 'el Barrio' : 'la Vereda'}...</option>
                {(formData.zona === 'URBANA' ? BARRIOS_URBANOS : VEREDAS_RURALES).map(lugar => (
                  <option key={lugar} value={lugar}>{lugar}</option>
                ))}
              </select>

              <input placeholder="Dirección exacta o referencia" value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} required style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', backgroundColor: '#ffffff', color: '#000000' }} />

              <div style={{ height: '180px', width: '100%', borderRadius: '10px', overflow: 'hidden', border: formData.latitud ? '2px solid #10b981' : '2px solid #cbd5e1', zIndex: 0 }}>
                <MapContainer center={centroCalima} zoom={15} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <SeleccionarUbicacion formData={formData} setFormData={setFormData} />
                </MapContainer>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: formData.apoyaAlcaldia ? '#e0e7ff' : '#f1f5f9', padding: '12px', borderRadius: '10px', cursor: 'pointer', border: formData.apoyaAlcaldia ? '2px solid #6366f1' : '2px solid transparent' }}>
                  <input type="checkbox" checked={formData.apoyaAlcaldia} onChange={e => setFormData({...formData, apoyaAlcaldia: e.target.checked})} style={{ display: 'none' }} />
                  <span style={{ fontWeight: 'bold', color: formData.apoyaAlcaldia ? '#4338ca' : '#64748b' }}>🏛️ Alcaldía</span>
                </label>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: formData.apoyaConcejo ? '#dcfce3' : '#f1f5f9', padding: '12px', borderRadius: '10px', cursor: 'pointer', border: formData.apoyaConcejo ? '2px solid #22c55e' : '2px solid transparent' }}>
                  <input type="checkbox" checked={formData.apoyaConcejo} onChange={e => setFormData({...formData, apoyaConcejo: e.target.checked})} style={{ display: 'none' }} />
                  <span style={{ fontWeight: 'bold', color: formData.apoyaConcejo ? '#15803d' : '#64748b' }}>👥 Concejo</span>
                </label>
              </div>
              
              <button type="submit" style={{ padding: '14px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar Ficha</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App