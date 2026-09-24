// --- 1. CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://xpufmicxmbhpqocrwgdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwdWZtaWN4bWJocHFvY3J3Z2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MzE1OTcsImV4cCI6MjEwMzEwNzU5N30.811oNtrlBbEvNvhxaLlvJBZtqSpU98ZQ9sORRh4EIu8';
const clienteDb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- MÓDULO DE AUTENTICACIÓN (INGRESO DE PELUQUERÍAS) ---
// Variable global para saber en qué peluquería estamos trabajando
let peluqueriaIdActual = null;
let usuarioActual = null;
let calendarioGlobal = null;

function haySesionActiva() {
    return !!usuarioActual && !!peluqueriaIdActual;
}

function cerrarSesion() {
    peluqueriaIdActual = null;
    usuarioActual = null;

    const loginOverlay = document.getElementById('pantalla-login');
    if (loginOverlay) {
        loginOverlay.style.display = 'flex';
    }

    const mensaje = document.getElementById('login-mensaje');
    if (mensaje) {
        mensaje.innerText = '';
    }

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';

    const titulo = document.getElementById('titulo-peluqueria');
    if (titulo) {
        titulo.innerText = 'VERONA Estilistas';
    }
}

function mostrarRegistro() {
    const loginFormulario = document.getElementById('login-formulario');
    const registroFormulario = document.getElementById('registro-form');
    const btnLogin = document.getElementById('btn-mostrar-login');
    const btnRegistro = document.getElementById('btn-mostrar-registro');
    const mensaje = document.getElementById('login-mensaje');

    if (loginFormulario) loginFormulario.classList.add('hidden');
    if (registroFormulario) registroFormulario.classList.add('visible');
    if (btnLogin) btnLogin.classList.remove('active');
    if (btnRegistro) btnRegistro.classList.add('active');
    if (mensaje) mensaje.innerText = '';
}

function mostrarLogin() {
    const loginFormulario = document.getElementById('login-formulario');
    const registroFormulario = document.getElementById('registro-form');
    const btnLogin = document.getElementById('btn-mostrar-login');
    const btnRegistro = document.getElementById('btn-mostrar-registro');
    const mensaje = document.getElementById('login-mensaje');

    if (loginFormulario) loginFormulario.classList.remove('hidden');
    if (registroFormulario) registroFormulario.classList.remove('visible');
    if (btnLogin) btnLogin.classList.add('active');
    if (btnRegistro) btnRegistro.classList.remove('active');
    if (mensaje) mensaje.innerText = '';
}

async function crearPerfilUsuario(authUserId, peluqueriaId) {
    const { error } = await clienteDb
        .from('perfiles_usuarios')
        .upsert({ id: authUserId, peluqueria_id: peluqueriaId }, { onConflict: 'id' });

    return error;
}

// Reemplaza la función registrarUsuario() completa de app.js (líneas 77-160).
// Ya no crea el salón ni el perfil desde el navegador: lo hace el trigger
// public.handle_new_user() de fix_registro.sql usando los datos de options.data.
// La función crearPerfilUsuario() ya no se usa y se puede borrar.

async function registrarUsuario() {
    const nombre = document.getElementById('registro-nombre').value.trim();
    const email = document.getElementById('registro-email').value.trim();
    const password = document.getElementById('registro-password').value;
    const confirmPassword = document.getElementById('registro-confirm-password').value;
    const nombreSalon = document.getElementById('registro-peluqueria-nombre').value.trim();
    const mensaje = document.getElementById('login-mensaje');
    const boton = document.querySelector('#registro-form .login-button');

    if (!nombre || !email || !password || !confirmPassword || !nombreSalon) {
        mensaje.innerText = 'Completa todos los campos, incluido el nombre del salón.';
        mensaje.style.color = 'red';
        return;
    }

    if (password !== confirmPassword) {
        mensaje.innerText = 'Las contraseñas no coinciden.';
        mensaje.style.color = 'red';
        return;
    }

    if (password.length < 6) {
        mensaje.innerText = 'La contraseña debe tener al menos 6 caracteres.';
        mensaje.style.color = 'red';
        return;
    }

    // Evita doble clic (antes cada clic podía crear un salón nuevo)
    if (boton) boton.disabled = true;

    try {
        const { data: authData, error: authError } = await clienteDb.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nombre_completo: nombre,
                    nombre_salon: nombreSalon
                }
            }
        });

        if (authError) {
            console.error('Error en signUp:', authError);
            mensaje.innerText = authError.message || 'No se pudo crear el usuario.';
            mensaje.style.color = 'red';
            return;
        }

        // Con la confirmación de correo desactivada, signUp deja una sesión abierta.
        // Se cierra para que el flujo sea siempre: registrarse -> iniciar sesión.
        if (authData?.session) {
            await clienteDb.auth.signOut();
        }

        if (authData?.session) {
            mensaje.innerText = 'Usuario y salón creados correctamente. Ya podés iniciar sesión.';
        } else {
            mensaje.innerText = 'Usuario creado. Confirma tu correo para poder ingresar.';
        }
        mensaje.style.color = 'green';

        document.getElementById('registro-nombre').value = '';
        document.getElementById('registro-email').value = '';
        document.getElementById('registro-password').value = '';
        document.getElementById('registro-confirm-password').value = '';
        document.getElementById('registro-peluqueria-nombre').value = '';

        // mostrarLogin() limpia el mensaje, así que se restaura después
        const texto = mensaje.innerText;
        mostrarLogin();
        mensaje.innerText = texto;
    } finally {
        if (boton) boton.disabled = false;
    }
}
async function iniciarSesion() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const mensaje = document.getElementById('login-mensaje');

    if (!email || !password) {
        mensaje.innerText = "Por favor, ingresa correo y contraseña.";
        mensaje.style.color = "red";
        return;
    }

    const { data: authData, error: authError } = await clienteDb.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (authError) {
        mensaje.innerText = "Credenciales incorrectas.";
        mensaje.style.color = "red";
        return;
    }

    usuarioActual = authData.user;

    const { data: perfilData, error: perfilError } = await clienteDb
        .from('perfiles_usuarios')
        .select('peluqueria_id')
        .eq('id', usuarioActual.id)
        .maybeSingle();

    if (!perfilData || !perfilData.peluqueria_id) {
        mensaje.innerText = perfilError?.message || "Este usuario no tiene un salón asignado o la relación no está configurada.";
        mensaje.style.color = "red";
        console.error("Error al buscar perfil:", perfilError);
        return;
    }

    peluqueriaIdActual = perfilData.peluqueria_id;

    const { data: peluqueriaData, error: errorPeluqueria } = await clienteDb
        .from('peluquerias')
        .select('nombre')
        .eq('id', peluqueriaIdActual)
        .maybeSingle();

    if (!errorPeluqueria && peluqueriaData) {
        document.getElementById('titulo-peluqueria').innerText = peluqueriaData.nombre;
    }

    document.getElementById('pantalla-login').style.display = 'none';
    inicializarApp();
}

// Envolvemos las funciones de arranque para que esperen al login
function inicializarApp() {
    if (!haySesionActiva()) return;

    // Aquí puedes agregar todas tus funciones de arranque
    // --- 11. ARRANQUE AUTOMÁTICO ---
    cargarPeluquerosDropdown();
    cargarClientesDropdown();
    cargarInventario();
    cargarCaja();
    cargarCajaMensual();
    cargarTurnos();
    cargarProximosTurnos();
    cargarPeluquerosAdmin();
    cargarProductosAdmin();
}

function abrirSolapa(idSolapa, evento) {
   document.querySelectorAll('.contenido-solapa').forEach(d => d.classList.remove('activa'));
    document.querySelectorAll('.btn-solapa').forEach(b => b.classList.remove('activo'));
    
    document.getElementById(idSolapa).classList.add('activa');
    if (evento) evento.currentTarget.classList.add('activo');

    if (idSolapa === 'solapa-reserva' || idSolapa === 'solapa-calendario') {
        setTimeout(() => {
            if (!calendarioGlobal) {
                cargarCalendario();
            } else {
                calendarioGlobal.render();
            }
        }, 150);
    }
}

// --- 3. MÓDULO DE CALENDARIO GENERAL (SOLAPA 8) ---
async function cargarCalendario() {
    if (!haySesionActiva()) return;

    const calendarEl = document.getElementById('calendario-full');
    if (!calendarEl) return;

    const { data: turnos, error } = await clienteDb
        .from('turnos')
        .select('*, clientes(nombre, apellido), peluqueros(nombre, color_calendario)')
        .eq('peluqueria_id', peluqueriaIdActual); // <-- AGREGADO

    if (error) {
        console.error("Error al cargar turnos para el calendario:", error);
        return;
    }

    const eventos = turnos.map(turno => {
        const nombreCliente = turno.clientes?.nombre || 'Desconocido';
        const nombrePeluquero = turno.peluqueros?.nombre || 'Sin asignar';
        const color = turno.peluqueros?.color_calendario || '#3498db';

        return {
            id: turno.id,
            // ¡Corregido! Restauramos las comillas invertidas (backticks) para que el texto se forme bien
            title: `${nombreCliente} - ${turno.descripcion_trabajo || 'Turno'} (${nombrePeluquero})`,
            start: turno.fecha_hora_inicio,
            end: turno.fecha_hora_fin,
            backgroundColor: color,
            borderColor: color
        };
    });

    if (calendarioGlobal) calendarioGlobal.destroy();

    calendarioGlobal = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'es',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' },
        slotMinTime: '08:00:00',
        slotMaxTime: '22:00:00',
        allDaySlot: false,
        height: 650,
        events: eventos,

        // --- CORRECCIÓN: ACTIVACIÓN DE DRAG & DROP ---
        editable: true, // Permite mover los turnos
        eventOverlap: true, 

        eventDrop: async function(info) {
            const turnoId = info.event.id;
            const nuevaFechaInicio = info.event.start;
            const nuevaFechaFin = info.event.end ? info.event.end : new Date(nuevaFechaInicio.getTime() + (60 * 60 * 1000)); 

            if(confirm(`¿Confirmas la reprogramación para el ${nuevaFechaInicio.toLocaleString('es-AR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}?`)) {
                
                const { error } = await clienteDb
                    .from('turnos')
                    .update({ 
                        fecha_hora_inicio: nuevaFechaInicio.toISOString(),
                        fecha_hora_fin: nuevaFechaFin.toISOString()
                    })
                    .eq('id', turnoId);

                if (error) {
                    alert("Error al reprogramar en la base de datos.");
                    console.error(error);
                    info.revert(); // Devuelve el turno a su lugar si hay error
                } else {
                    // Refresca la lista de turnos de hoy en caso de que lo hayas movido al día actual
                    if (typeof cargarTurnos === 'function') cargarTurnos();  
                }
            } else {
                info.revert(); // Devuelve el turno si el usuario cancela en el cartelito
            }
        }
    });

    calendarioGlobal.render();
}

async function cargarTurnos() {
    if (!haySesionActiva()) return;

    // 1. Calculamos el inicio y el fin exacto del día de hoy
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);

    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    // 2. Aplicamos los filtros de fecha (.gte y .lte) para aislar el día presente
    const { data: turnos, error } = await clienteDb
        .from('turnos')
        .select('*, peluqueros(nombre, color_calendario), clientes(nombre, apellido)')
        .eq('peluqueria_id', peluqueriaIdActual) // <-- NUEVO FILTRO
        .gte('fecha_hora_inicio', hoyInicio.toISOString()) 
        .lte('fecha_hora_inicio', hoyFin.toISOString())    
        .order('fecha_hora_inicio', { ascending: true });

    if (error) {
        console.error("Error al cargar turnos:", error);
        return;
    }

    renderizarTurnos(turnos);
}

function renderizarTurnos(turnos) {
    const contenedor = document.getElementById('lista-turnos');
    contenedor.innerHTML = '';

    if (turnos.length === 0) {
        contenedor.innerHTML = '<p>No hay turnos programados para hoy.</p>';
        return;
    }

    // 1. NUEVO: Ordenamos los turnos para empujar los finalizados al fondo
    turnos.sort((a, b) => {
        if (a.estado === 'finalizado' && b.estado !== 'finalizado') return 1;
        if (a.estado !== 'finalizado' && b.estado === 'finalizado') return -1;
        return 0; // Si ambos están igual, respeta el orden de horario original
    });

    turnos.forEach(turno => {
        const div = document.createElement('div');
        div.className = `turno-card estado-${turno.estado}`;
        
        const fecha = new Date(turno.fecha_hora_inicio);
        const horaFormateada = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const nombreCliente = turno.clientes?.nombre || 'Desconocido';
        const apellidoCliente = turno.clientes?.apellido || '';
        const trabajo = turno.descripcion_trabajo || 'Servicio de salón';
        
        // 2. NUEVO: Verificamos si está finalizado para bloquear modificaciones
        const esFinalizado = turno.estado === 'finalizado';
        
        let controlesHTML = '';
        let botonBorrarHTML = '';

        if (esFinalizado) {
            // Diseño bloqueado de solo lectura
            controlesHTML = `<span style="color: #27ae60; font-weight: bold; font-size: 14px;">✅ Servicio Finalizado</span>`;
            // El botón de borrar queda vacío para que no se pueda eliminar accidentalmente
        } else {
            // Diseño interactivo normal para turnos pendientes
            controlesHTML = `
                <select class="selector-estado" onchange="cambiarEstado('${turno.id}', this.value)">
                    <option value="programado" ${turno.estado === 'programado' ? 'selected' : ''}>Programado (Gris)</option>
                    <option value="check-in" ${turno.estado === 'check-in' ? 'selected' : ''}>Check-in (Amarillo)</option>
                    <option value="en_proceso" ${turno.estado === 'en_proceso' ? 'selected' : ''}>En Proceso (Naranja)</option>
                    <option value="finalizado" ${turno.estado === 'finalizado' ? 'selected' : ''}>Finalizado (Verde)</option>
                </select>
            `;
            botonBorrarHTML = `<button onclick="borrarTurno('${turno.id}')" style="background: transparent; border: none; font-size: 18px; cursor: pointer;" title="Borrar Turno">❌</button>`;
        }
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; width: 100%;">
                <div>
                    <strong style="font-size: 16px; color: #2c3e50;">⏰ ${horaFormateada} | 👤 ${nombreCliente} ${apellidoCliente}</strong><br>
                    <span style="color: #e67e22; font-size: 14px; font-weight: 500; display: inline-block; margin-top: 4px;">📝 ${trabajo}</span><br>
                    <div style="margin-top: 8px;">
                        ${controlesHTML}
                    </div>
                </div>
                ${botonBorrarHTML}
            </div>
            <div class="etiqueta-peluquero" style="background-color: ${turno.peluqueros?.color_calendario || '#ccc'};">
                ${turno.peluqueros?.nombre || 'Sin asignar'}
            </div>
        `;
        contenedor.appendChild(div);
    });
}

// Función para actualizar la base de datos (Sin descuento automático de stock)
async function cambiarEstado(turnoId, nuevoEstado) {
    // A. Actualizamos el color en Supabase como siempre
    const { error } = await clienteDb
        .from('turnos')
        .update({ estado: nuevoEstado })
        .eq('id', turnoId);

    if (error) {
        alert("Error al actualizar el estado. Revisa los permisos.");
        console.error(error);
        return; 
    }

    // B. LÓGICA DE CAJA Y RESEÑA
    if (nuevoEstado === 'finalizado') {
        const resena = prompt("Turno finalizado. Escribe una breve reseña del trabajo realizado (Ej. Mechas con gorro, decoloración suave):");
        
        // Ya no preguntamos por la tintura, pasamos directo al cobro
        const precio = prompt("¿Cuál fue el precio total cobrado al cliente? (Ej: 15000)");

        if (precio !== null && resena !== null) {
            // Mostramos la nota recordatoria inmediatamente después de ingresar el cobro
            alert("Nota: Actualizar el stock de productos en el caso de haber utilizado.");

            const RENDER_URL = 'https://apflekiyo.onrender.com'; 
            
            try {
                // 1. Guardamos la reseña en el turno
                await clienteDb.from('turnos').update({ resena: resena }).eq('id', turnoId);
                
                // 2. Averiguamos qué peluquero atendió este turno para su comisión
                const { data: turnoInfo } = await clienteDb
                    .from('turnos')
                    .select('peluquero_id')
                    .eq('id', turnoId)
                    .single();

                // 3. Enviamos el paquete de datos al servidor (fijamos gramosUsados en 0)
                const respuesta = await fetch(`${RENDER_URL}/api/finalizar-turno`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        turnoId: turnoId,
                        peluqueroId: turnoInfo.peluquero_id,
                        insumoId: 1, 
                        gramosUsados: 0, // Mantenemos esta variable en 0 para que tu backend no falle
                        precioTotal: parseFloat(precio) || 0 
                    })
                });

                const resultado = await respuesta.json();
                alert(resultado.mensaje || "Hubo un problema: " + resultado.error);
                
            } catch (errorRender) {
                console.error("Error al conectar con Render:", errorRender);
                alert("El turno finalizó, pero no pudimos conectar con el servidor para la caja.");
            }
        } else {
            alert("Operación cancelada. El turno se marcó como finalizado pero no se registraron los pagos.");
        }
    }
}

async function borrarTurno(id) {
    if(confirm("¿Estás seguro que deseas eliminar este turno?")) {
        await clienteDb.from('turnos').delete().eq('id', id);
    }
}

// --- 5. MÓDULO DE CLIENTES (Buscador y Creación) ---
async function guardarCliente() {
    if (!haySesionActiva()) return;

    const nombre = document.getElementById('nuevo-cliente-nombre').value.trim();
    const apellido = document.getElementById('nuevo-cliente-apellido').value.trim();
    const telefono = document.getElementById('nuevo-cliente-telefono').value.trim();
    const mensaje = document.getElementById('mensaje-cliente');

    if (!nombre) return alert("El nombre es obligatorio para crear un cliente.");

    const { error } = await clienteDb.from('clientes').insert([{ peluqueria_id: peluqueriaIdActual, nombre: nombre, apellido: apellido, telefono: telefono }]);

    if (error) {
        mensaje.style.color = 'red';
        mensaje.innerText = "Error al guardar el cliente.";
    } else {
        mensaje.style.color = '#27ae60';
        mensaje.innerText = "¡Cliente guardado con éxito!";
        document.getElementById('nuevo-cliente-nombre').value = '';
        document.getElementById('nuevo-cliente-apellido').value = '';
        document.getElementById('nuevo-cliente-telefono').value = '';
        setTimeout(() => { mensaje.innerText = ''; }, 3000);
        cargarClientesDropdown();
    }
}

async function buscarCliente() {
    if (!haySesionActiva()) return;

    const termino = document.getElementById('buscador-cliente').value.trim();
    const contenedor = document.getElementById('resultado-busqueda');

    if (!termino) {
        contenedor.innerHTML = '<p>Por favor, ingresa un nombre para buscar.</p>';
        return;
    }

    contenedor.innerHTML = '<p>Buscando en la base de datos...</p>';

    // 1. Buscamos los datos básicos del cliente (Nombre, Apellido, Teléfono)
    const { data: clientes, error: errorClientes } = await clienteDb
        .from('clientes')
        .select('*')
        .eq('peluqueria_id', peluqueriaIdActual) // <-- AGREGADO
        .or(`nombre.ilike.%${termino}%,apellido.ilike.%${termino}%`)
        .limit(5);

    if (errorClientes) {
        console.error("Error al buscar cliente:", errorClientes);
        contenedor.innerHTML = '<p style="color:red;">Error de conexión con la base de datos.</p>';
        return;
    }

    if (clientes.length === 0) {
        contenedor.innerHTML = '<p>No se encontraron clientes con ese nombre.</p>';
        return;
    }

    let html = '';
    
    // 2. Usamos un bucle "for...of" para hacer una sub-consulta por cada cliente encontrado
    for (const cliente of clientes) {
        // Buscamos el historial de turnos de este cliente específico
        const { data: turnos, error: errorTurnos } = await clienteDb
            .from('turnos')
            .select('*, peluqueros(nombre)')
            .eq('cliente_id', cliente.id)
            .order('fecha_hora_inicio', { ascending: false }); // Los más recientes primero

        html += `<div style="background: #f9f9f9; padding: 15px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #ddd;">
                    <h4 style="margin-top:0; color:#2c3e50; font-size:18px;">👤 ${cliente.nombre} ${cliente.apellido || ''}</h4>
                    <p style="margin: 5px 0;"><strong>Teléfono:</strong> ${cliente.telefono || 'Sin registrar'}</p>
                    
                    <h5 style="margin-bottom: 5px; margin-top: 15px; color:#d35400;">📅 Historial de Atención y Trabajos:</h5>`;

        // Verificamos si tiene turnos en el historial
        if (!turnos || turnos.length === 0) {
            html += `<p style="font-size:13px; color:#7f8c8d;">No tiene trabajos ni turnos registrados aún.</p>`;
        } else {
            html += `<ul style="font-size:14px; padding-left: 0; margin-top:5px; color:#444; list-style-type: none;">`;
            
            // 3. Compilamos e imprimimos cada día de atención y el trabajo realizado
            for (const turno of turnos) {
                // Formateamos la fecha exacta del día de atención
                const fechaObj = new Date(turno.fecha_hora_inicio);
                const fecha = fechaObj.toLocaleDateString('es-AR');
                const hora = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                
                // Obtenemos el trabajo realizado (o un genérico si no se especificó)
                const trabajoRealizado = turno.descripcion_trabajo || 'Servicio de peluquería';
                
                // Ícono visual según el estado del turno
                const estado = turno.estado === 'finalizado' ? '✅ Finalizado' : `⏳ ${turno.estado}`;
                
                html += `<li style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #ccc;">
                            <strong style="color: #2c3e50;">🗓️ ${fecha} a las ${hora}hs</strong> | ${estado}<br>
                            <span style="color: #2980b9;">✂️ Trabajo: <strong>${trabajoRealizado}</strong></span><br>
                            <span style="font-size:13px; color:#7f8c8d;">Atendió: ${turno.peluqueros?.nombre || 'Sin asignar'}</span>
                         </li>`;
            }
            html += `</ul>`;
        }
        html += `</div>`;
    }

    contenedor.innerHTML = html;
}

// --- 6. MÓDULO DE CAJA Y REPORTE PDF ---
async function cargarCaja() {
    if (!haySesionActiva()) return;

    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    const { data: registros, error } = await clienteDb
        .from('caja')
        .select('monto_total, monto_comision, peluqueros(nombre)')
        .eq('peluqueria_id', peluqueriaIdActual) // <-- NUEVO FILTRO
        .gte('fecha_cobro', inicioDelDia.toISOString());

    if (!error) renderizarCaja(registros);
}

function renderizarCaja(registros) {
    const contenedor = document.getElementById('resumen-caja');
    if (!registros || registros.length === 0) return contenedor.innerHTML = '<p>No hay ingresos aún hoy.</p>';

    let totalCaja = 0;
    const comisiones = {};

    registros.forEach(reg => {
        totalCaja += Number(reg.monto_total);
        const nombrePeluquero = reg.peluqueros?.nombre || 'Sin asignar';
        if (!comisiones[nombrePeluquero]) comisiones[nombrePeluquero] = 0;
        comisiones[nombrePeluquero] += Number(reg.monto_comision);
    });

    let html = `<div class="totales-caja">Total Ingresos: $${totalCaja.toLocaleString()}</div><strong>Comisiones a pagar:</strong>`;
    for (const [nombre, monto] of Object.entries(comisiones)) {
        html += `<div class="comision-item"><span>${nombre}</span><span style="color: #27ae60; font-weight: bold;">$${monto.toLocaleString()}</span></div>`;
    }
    contenedor.innerHTML = html;
}

async function cargarCajaMensual() {
    if (!haySesionActiva()) return;

    const contenedorComisiones = document.getElementById('lista-comisiones-mes');
    const textoTotal = document.getElementById('total-mes-ingresos');
    const tablaDetalle = document.getElementById('tabla-detalle-mes');
    const textoContador = document.getElementById('contador-trabajos-mes');
    
    if(!contenedorComisiones || !textoTotal) return;

    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();

    const { data: registros, error } = await clienteDb
        .from('caja')
        .select('monto_total, monto_comision, fecha_cobro, peluqueros(nombre)')
        .eq('peluqueria_id', peluqueriaIdActual) // <-- NUEVO FILTRO
        .gte('fecha_cobro', primerDiaMes)
        .order('fecha_cobro', { ascending: true });

    if (error) return contenedorComisiones.innerHTML = '<p style="color:red;">Error de conexión.</p>'; 
    if (registros.length === 0) {
        textoTotal.innerText = '$0';
        if (textoContador) textoContador.innerText = 'Total de trabajos realizados: 0';
        if (tablaDetalle) tablaDetalle.innerHTML = '<tr><td colspan="4" style="padding: 10px; text-align: center;">No hay ingresos este mes.</td></tr>';
        return contenedorComisiones.innerHTML = '<p>No hay ingresos este mes.</p>';
    }

    let facturacionTotal = 0;
    const liquidacion = {};
    let htmlTabla = '';

    registros.forEach(reg => {
        const montoTotal = Number(reg.monto_total);
        const montoComision = Number(reg.monto_comision);
        const nombre = reg.peluqueros?.nombre || 'Sin asignar';
        const fechaFormateada = new Date(reg.fecha_cobro).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

        // Sumatorias para las tarjetas superiores (lógica original)
        facturacionTotal += montoTotal;
        if (!liquidacion[nombre]) liquidacion[nombre] = 0;
        liquidacion[nombre] += montoComision;

        // Construcción de la fila para la nueva tabla
        htmlTabla += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">${fechaFormateada}</td>
                <td style="padding: 10px; font-weight: bold; color: #2c3e50;">${nombre}</td>
                <td style="padding: 10px; color: #27ae60;">$${montoTotal.toLocaleString('es-AR')}</td>
                <td style="padding: 10px; color: #e67e22;">$${montoComision.toLocaleString('es-AR')}</td>
            </tr>
        `;
    });

    // Inyectar resultados visuales
    textoTotal.innerText = `$${facturacionTotal.toLocaleString('es-AR')}`;
    if (textoContador) textoContador.innerText = `Total de trabajos realizados: ${registros.length}`;
    if (tablaDetalle) tablaDetalle.innerHTML = htmlTabla;

    let htmlComisiones = '';
    for (const [nombre, monto] of Object.entries(liquidacion)) {
        htmlComisiones += `<div class="comision-mes-item"><strong>👤 ${nombre}</strong><span style="color:#e67e22; font-weight:bold;">$${monto.toLocaleString('es-AR')}</span></div>`;
    }
    contenedorComisiones.innerHTML = htmlComisiones;
}

async function generarReportePDF() {
    const peluqueroId = document.getElementById('select-peluquero-reporte').value;
    const fechaDesdeStr = document.getElementById('fecha-desde').value;
    const fechaHastaStr = document.getElementById('fecha-hasta').value;

    if (!peluqueroId || !fechaDesdeStr || !fechaHastaStr) return alert("Selecciona un profesional y las fechas.");

    const { data: peluqueroInfo } = await clienteDb.from('peluqueros').select('nombre, porcentaje_comision').eq('id', peluqueroId).single();
    const fechaInicio = new Date(fechaDesdeStr + 'T00:00:00').toISOString();
    const fechaFin = new Date(fechaHastaStr + 'T23:59:59').toISOString();

    const { data: registros, error } = await clienteDb
        .from('caja')
        .select('monto_total, monto_comision, fecha_cobro')
        .eq('peluqueria_id', peluqueriaIdActual) // <-- AGREGADO
        .eq('peluquero_id', peluqueroId)
        .gte('fecha_cobro', fechaInicio)
        .lte('fecha_cobro', fechaFin)
        .order('fecha_cobro', { ascending: true });

    if (error || !registros || registros.length === 0) return alert("No se encontraron cobros en estas fechas.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("VERONA Estilistas - Reporte de Liquidación", 14, 20);
    doc.setFontSize(12);
    doc.text(`Profesional: ${peluqueroInfo.nombre} (${peluqueroInfo.porcentaje_comision}% Comisión)`, 14, 28);
    doc.text(`Período: ${fechaDesdeStr} al ${fechaHastaStr}`, 14, 34);

    let cuerpoTabla = [];
    let acumuladoFacturado = 0;
    let acumuladoComision = 0;

    registros.forEach(reg => {
        const fechaObj = new Date(reg.fecha_cobro);
        const fechaFormateada = fechaObj.toLocaleDateString('es-AR') + ' ' + fechaObj.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'});
        const monto = Number(reg.monto_total);
        const comision = Number(reg.monto_comision);

        acumuladoFacturado += monto;
        acumuladoComision += comision;
        cuerpoTabla.push([fechaFormateada, 'Registrado en Caja', 'Servicio de Peluquería', `$${monto.toLocaleString('es-AR')}`, `$${comision.toLocaleString('es-AR')}`]);
    });

    doc.autoTable({ startY: 42, head: [['Fecha y Hora', 'Cliente', 'Detalle', 'Precio Cobrado', 'Comisión']], body: cuerpoTabla });
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.text(`Total Facturado: $${acumuladoFacturado.toLocaleString('es-AR')}`, 14, finalY);
    doc.text(`Total Comisión a Pagar: $${acumuladoComision.toLocaleString('es-AR')}`, 14, finalY + 7);
    doc.save(`Liquidacion_${peluqueroInfo.nombre.replace(/\s+/g, '_')}_${fechaDesdeStr}.pdf`);
}
// --- 7. MÓDULO DE INVENTARIO Y PRODUCTOS ---
async function cargarInventario() {
    if (!haySesionActiva()) return;

    const { data: insumos, error } = await clienteDb
        .from('insumos')
        .select('*')
        .eq('peluqueria_id', peluqueriaIdActual)
        .order('nombre', { ascending: true });
        
    if (!error) renderizarInventario(insumos);
}

function renderizarInventario(insumos) {
    const contenedor = document.getElementById('lista-insumos');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    
    if (insumos.length === 0) return contenedor.innerHTML = '<p>No hay productos en el pañol.</p>';

    insumos.forEach(insumo => {
        const unidad = insumo.unidad_medida || 'g'; 
        const umbralAlerta = (unidad === 'u') ? 10 : 100;
        
        const div = document.createElement('div');
        div.className = 'item-insumo';
        const claseStock = insumo.stock_gramos <= umbralAlerta ? 'stock-bajo' : '';
        div.innerHTML = `<span>${insumo.nombre}</span><span class="${claseStock}">${insumo.stock_gramos} ${unidad}</span>`;
        contenedor.appendChild(div);
    });
}

async function cargarProductosAdmin() {
    if (!haySesionActiva()) return;

    const contenedor = document.getElementById('lista-productos-admin');
    const panelTotal = document.getElementById('resumen-total-stock');
    const panelAlertas = document.getElementById('resumen-alertas-stock');
    
    if(!contenedor) return;
    
    const { data: insumos, error } = await clienteDb
        .from('insumos')
        .select('*')
        .eq('peluqueria_id', peluqueriaIdActual)
        .order('nombre', { ascending: true });
        
    if (error) return contenedor.innerHTML = '<p style="color:red;">Error al cargar el inventario.</p>';
    if (insumos.length === 0) return contenedor.innerHTML = '<p>No hay productos registrados en el pañol.</p>';

    let contadorTotal = insumos.length;
    let contadorAlertas = 0;

    let html = `
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead style="background: #2c3e50; color: white; text-align: left;">
                <tr>
                    <th style="padding: 15px; border-bottom: 2px solid #ddd;">Producto</th>
                    <th style="padding: 15px; border-bottom: 2px solid #ddd;">Stock Actual</th>
                    <th style="padding: 15px; border-bottom: 2px solid #ddd; text-align: center;">Ajuste Rápido</th>
                </tr>
            </thead>
            <tbody>
    `;

    insumos.forEach(insumo => {
        const unidad = insumo.unidad_medida || 'g'; 
        const umbralAlerta = (unidad === 'u') ? 10 : 100;
        const stockBajo = insumo.stock_gramos <= umbralAlerta;
        
        if (stockBajo) contadorAlertas++;
        
        const fondoFila = stockBajo ? '#fdedec' : 'transparent';
        const colorTexto = stockBajo ? '#c0392b' : '#2c3e50';
        const icono = stockBajo ? '⚠️ ' : '✅ ';

        html += `
            <tr style="background-color: ${fondoFila}; border-bottom: 1px solid #eee;">
                <td style="padding: 15px; font-weight: bold; color: ${colorTexto};">
                    ${icono} ${insumo.nombre}
                </td>
                <td style="padding: 15px; font-size: 16px; font-weight: bold; color: ${colorTexto};">
                    ${insumo.stock_gramos} ${unidad}
                </td>
                <td style="padding: 15px; text-align: center;">
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: #ecf0f1; padding: 6px; border-radius: 6px;">
                        <input type="number" id="input-stock-${insumo.id}" placeholder="Cant." min="1" style="width: 70px; padding: 6px; border: 1px solid #bdc3c7; border-radius: 4px; text-align: center;">
                        <button onclick="modificarStock(${insumo.id}, ${insumo.stock_gramos}, '${unidad}', 'sumar')" style="background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;" title="Agregar al stock">+</button>
                        <button onclick="modificarStock(${insumo.id}, ${insumo.stock_gramos}, '${unidad}', 'restar')" style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;" title="Descontar del stock">-</button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    contenedor.innerHTML = html;

    if (panelTotal) panelTotal.innerText = contadorTotal;
    if (panelAlertas) panelAlertas.innerText = contadorAlertas;
}

// Función que reemplaza a "sumarStock" para procesar sumas y restas validando unidades
async function modificarStock(insumoId, stockActual, unidad, accion) {
    if (!haySesionActiva()) return;

    const cantidadInput = document.getElementById(`input-stock-${insumoId}`).value;
    const cantidad = parseInt(cantidadInput);

    if (!cantidad || cantidad <= 0 || isNaN(cantidad)) {
        return alert("Por favor, ingresa una cantidad válida mayor a 0.");
    }

    let nuevoStock = stockActual;

    if (accion === 'sumar') {
        nuevoStock += cantidad;
    } else if (accion === 'restar') {
        if (cantidad > stockActual) {
            return alert(`Operación denegada: No puedes restar ${cantidad} ${unidad} porque solo quedan ${stockActual} ${unidad}.`);
        }
        nuevoStock -= cantidad;
    }

    const { error } = await clienteDb
        .from('insumos')
        .update({ stock_gramos: nuevoStock })
        .eq('id', insumoId);

    if (error) {
        console.error("Error actualizando stock:", error);
        alert("Ocurrió un error al actualizar el inventario.");
    } else {
        cargarProductosAdmin(); // Recarga la tabla
        cargarInventario(); // Recarga el widget de stock rápido (si aplica)
    }
}

// --- 8. MÓDULO RESERVA AVANZADA Y PRÓXIMOS TURNOS ---
async function cargarClientesDropdown() {
    if (!haySesionActiva()) return;

    const select = document.getElementById('select-cliente-avanzado');
    if(!select) return;
    const { data: clientes } = await clienteDb.from('clientes').select('*').eq('peluqueria_id', peluqueriaIdActual).order('nombre', { ascending: true });
    
    if (clientes && clientes.length > 0) {
        let html = '<option value="">-- Selecciona un cliente --</option>';
        clientes.forEach(c => html += `<option value="${c.id}">${c.nombre} ${c.apellido || ''}</option>`);
        select.innerHTML = html;
    } else {
        select.innerHTML = '<option value="">No hay clientes guardados</option>';
    }
}

async function cargarPeluquerosDropdown() {
    if (!haySesionActiva()) return;

    const { data: peluqueros } = await clienteDb.from('peluqueros').select('*').eq('peluqueria_id', peluqueriaIdActual).order('nombre', { ascending: true });
    if (!peluqueros) return;

    let html = '<option value="">-- Selecciona un profesional --</option>';
    peluqueros.forEach(p => html += `<option value="${p.id}">${p.nombre}</option>`);

    if(document.getElementById('select-peluquero-avanzado')) document.getElementById('select-peluquero-avanzado').innerHTML = html;
    if(document.getElementById('select-peluquero')) document.getElementById('select-peluquero').innerHTML = html;
    if(document.getElementById('select-peluquero-reporte')) document.getElementById('select-peluquero-reporte').innerHTML = html;
}

async function agendarTurnoAvanzado() {
    if (!haySesionActiva()) return;

    const clienteId = document.getElementById('select-cliente-avanzado').value;
    const peluqueroId = document.getElementById('select-peluquero-avanzado').value;
    const trabajo = document.getElementById('input-trabajo')?.value.trim() || 'Servicio de Salón';
    const duracionMinutos = parseInt(document.getElementById('select-duracion')?.value) || 60;
    const fechaHoraStr = document.getElementById('fecha-hora-turno').value;
    const mensaje = document.getElementById('mensaje-reserva');

    if (!clienteId || !peluqueroId || !fechaHoraStr) return alert("Completa todos los campos.");

    const fechaInicio = new Date(fechaHoraStr);
    const fechaFin = new Date(fechaInicio.getTime() + (duracionMinutos * 60 * 1000));

    const { error } = await clienteDb.from('turnos').insert([{
        peluqueria_id: peluqueriaIdActual, // <-- AGREGADO
        cliente_id: clienteId, peluquero_id: peluqueroId, descripcion_trabajo: trabajo,
        duracion_minutos: duracionMinutos, fecha_hora_inicio: fechaInicio.toISOString(),
        fecha_hora_fin: fechaFin.toISOString(), estado: 'programado'
    }]);

    if (!error) {
        if(mensaje) {
            mensaje.style.color = '#27ae60';
            mensaje.innerText = "¡Turno agendado!";
            setTimeout(() => mensaje.innerText = '', 3000);
        }
        document.getElementById('fecha-hora-turno').value = '';
        cargarTurnos();
    }
}

async function cargarProximosTurnos() {
    if (!haySesionActiva()) return;

    const contenedor = document.getElementById('lista-proximos-turnos');
    contenedor.innerHTML = '<p>Buscando la agenda...</p>';

    const hoy = new Date();
    const dentroDe7Dias = new Date();
    dentroDe7Dias.setDate(hoy.getDate() + 7);

    const { data: turnos, error } = await clienteDb
        .from('turnos')
        .select('*, clientes(nombre, apellido, telefono), peluqueros(nombre)')
        .eq('peluqueria_id', peluqueriaIdActual) // <-- NUEVO FILTRO
        .gte('fecha_hora_inicio', hoy.toISOString())
        .lte('fecha_hora_inicio', dentroDe7Dias.toISOString())
        .order('fecha_hora_inicio', { ascending: true });

    if (error) return contenedor.innerHTML = '<p style="color:red;">Error de conexión.</p>';
    if (turnos.length === 0) return contenedor.innerHTML = '<p>No hay turnos agendados para los próximos 7 días.</p>';

    let html = '';
    turnos.forEach(turno => {
        const fecha = new Date(turno.fecha_hora_inicio);
        const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' };
        const fechaFormateada = fecha.toLocaleDateString('es-AR', opcionesFecha);
        
        const cliente = turno.clientes;
        const peluquero = turno.peluqueros?.nombre || 'Sin asignar';
        
        // Lógica de WhatsApp restaurada
        let linkWhatsapp = '#';
        let textoBtn = 'Sin teléfono';
        let estiloBtn = 'background-color: #ccc; cursor: not-allowed;';

        if (cliente && cliente.telefono && cliente.telefono !== 'Sin asignar') {
            const numeroLimpio = cliente.telefono.replace(/\D/g, ''); 
            if (numeroLimpio.length > 5) { 
                const mensaje = `¡Hola ${cliente.nombre}! Te escribimos de la peluquería para recordarte tu turno del día ${fechaFormateada} con ${peluquero}. ¿Nos confirmas tu asistencia?`;
                linkWhatsapp = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
                textoBtn = '📱 Enviar WhatsApp';
                estiloBtn = ''; 
            }
        }

        html += `
            <div class="turno-proximo-card">
                <div class="turno-proximo-info">
                    <strong style="text-transform: capitalize; color:#2c3e50; font-size:16px;">📅 ${fechaFormateada}</strong>
                    <span>👤 Cliente: ${cliente ? cliente.nombre + ' ' + (cliente.apellido || '') : 'Desconocido'}</span>
                    <span>✂️ Profesional: ${peluquero}</span>
                    <span style="color:#7f8c8d; font-size:13px;">📌 Estado actual: ${turno.estado}</span>
                </div>
                <a href="${linkWhatsapp}" target="_blank" class="btn-whatsapp" style="${estiloBtn}">${textoBtn}</a>
            </div>
        `;
    });
    contenedor.innerHTML = html;
}

// --- 9. MÓDULO PROFESIONALES (ADMIN) ---
async function guardarPeluquero() {
    if (!haySesionActiva()) return;

    const nombre = document.getElementById('nuevo-peluquero-nombre').value.trim();
    const com = document.getElementById('nuevo-peluquero-comision').value.trim();
    const color = document.getElementById('nuevo-peluquero-color').value;
    
    if (!nombre || !com) return alert("Nombre y comisión obligatorios.");
    
    await clienteDb.from('peluqueros').insert([{peluqueria_id: peluqueriaIdActual, nombre: nombre, porcentaje_comision: parseFloat(com), color_calendario: color }]);
    
    document.getElementById('nuevo-peluquero-nombre').value = '';
    cargarPeluquerosAdmin();
    cargarPeluquerosDropdown();
}

async function cargarPeluquerosAdmin() {
    if (!haySesionActiva()) return;

    const contenedor = document.getElementById('lista-peluqueros-admin');
    if(!contenedor) return;
    
    const { data: peluqueros } = await clienteDb.from('peluqueros').select('*').eq('peluqueria_id', peluqueriaIdActual).order('nombre', { ascending: true });
    let html = '';
    peluqueros.forEach(p => {
        html += `<div style="border-left: 6px solid ${p.color_calendario}; padding: 10px; margin-bottom: 10px; background: #fff; display:flex; justify-content:space-between; align-items:center; border-radius:5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div>
                        <strong style="font-size:16px;">${p.nombre}</strong><br>
                        <span style="font-size:14px; color:#7f8c8d;">Comisión: ${p.porcentaje_comision}%</span>
                    </div>
                    <button onclick="borrarPeluquero('${p.id}')" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Borrar</button>
                 </div>`;
    });
    contenedor.innerHTML = html;
}

async function borrarPeluquero(id) {
    if(confirm("¿Borrar este profesional? No se pueden borrar si tienen turnos asignados.")) {
        await clienteDb.from('peluqueros').delete().eq('id', id);
        cargarPeluquerosAdmin();
        cargarPeluquerosDropdown();
    }
}

// --- 10. TIEMPO REAL (WEBSOCKETS) ---
clienteDb.channel('cambios-en-turnos').on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, () => { cargarTurnos(); if(calendarioGlobal) cargarCalendario(); cargarProximosTurnos(); }).subscribe();
clienteDb.channel('cambios-en-insumos').on('postgres_changes', { event: '*', schema: 'public', table: 'insumos' }, () => { cargarInventario(); }).subscribe();
clienteDb.channel('cambios-en-caja').on('postgres_changes', { event: '*', schema: 'public', table: 'caja' }, () => { cargarCaja(); cargarCajaMensual(); }).subscribe();



// --- 12. MÓDULO DE ALARMAS Y NOTIFICACIONES ---
let turnosNotificados = []; 

function solicitarPermisoNotificaciones() {
    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("Notificaciones de AppFlekiyo activadas.");
            }
        });
    }
}
// --- MÓDULO DE ALARMAS ---
let temporizadorAlarmas;

function activarAlarmas() {
    if (!("Notification" in window)) {
        alert("Tu navegador no soporta notificaciones.");
        return;
    }

    Notification.requestPermission().then(permission => {
        const textoEstado = document.getElementById('estado-alarma');
        
        if (permission === "granted") {
            textoEstado.innerText = "Alarmas ACTIVAS 🟢"; // Aquí cambiamos el texto
            textoEstado.style.color = "#27ae60";
            
            if (temporizadorAlarmas) clearInterval(temporizadorAlarmas);
            temporizadorAlarmas = setInterval(revisarTurnosProximos, 60000);
            alert("¡Notificaciones activadas con éxito!");
        } else {
            textoEstado.innerText = "Permiso Denegado 🔴";
            textoEstado.style.color = "red";
            alert("Debes dar permiso en tu navegador para usar las alarmas.");
        }
    });
}
async function monitorearTurnosProximos() {
    if (!haySesionActiva()) return;

    const hoyInicio = new Date();
    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    const { data: turnos, error } = await clienteDb
        .from('turnos')
        .select('id, fecha_hora_inicio, clientes(nombre, apellido), peluqueros(nombre)')
        .eq('peluqueria_id', peluqueriaIdActual) // <-- AGREGADO
        .gte('fecha_hora_inicio', hoyInicio.toISOString())
        .lte('fecha_hora_inicio', hoyFin.toISOString())
        .eq('estado', 'programado'); 

    if (error || !turnos) return;

    const ahora = new Date();

    turnos.forEach(turno => {
        const fechaTurno = new Date(turno.fecha_hora_inicio);
        const diferenciaMinutos = Math.floor((fechaTurno - ahora) / (1000 * 60));

        // Si faltan entre 1 y 15 minutos y no sonó antes
        if (diferenciaMinutos > 0 && diferenciaMinutos <= 15 && !turnosNotificados.includes(turno.id)) {
            lanzarAlarma(turno, diferenciaMinutos);
            turnosNotificados.push(turno.id);
        }
    });
}

function lanzarAlarma(turno, minutosRestantes) {
    const nombreCliente = turno.clientes?.nombre || 'Un cliente';
    const nombrePeluquero = turno.peluqueros?.nombre || 'el salón';
    const mensaje = `¡Atención! Turno en ${minutosRestantes} minutos: ${nombreCliente} con ${nombrePeluquero}.`;

    // Notificación visual
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("⏰ Alarma AppFlekiyo", {
            body: mensaje,
            icon: "https://cdn-icons-png.flaticon.com/512/3237/3237472.png",
            vibrate: [200, 100, 200] 
        });
    } else {
        alert(mensaje);
    }

    // Alarma por voz (Sintetizador del navegador)
    if ('speechSynthesis' in window) {
        const voz = new SpeechSynthesisUtterance(mensaje);
        voz.lang = 'es-AR'; 
        voz.rate = 1; 
        window.speechSynthesis.speak(voz);
    }
}
async function generarPDFCajaMensual() {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
    const mesActualNombre = hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    const { data: registros, error } = await clienteDb
        .from('caja')
        .select('monto_total, monto_comision, fecha_cobro, peluqueros(nombre)')
        .eq('peluqueria_id', peluqueriaIdActual)
        .gte('fecha_cobro', primerDiaMes)
        .order('fecha_cobro', { ascending: true });

    if (error || !registros || registros.length === 0) {
        alert("No hay trabajos registrados este mes para exportar.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Encabezado
    doc.setFontSize(18);
    doc.setTextColor(44, 62, 80);
    doc.text("AppFlekiyo - Reporte de Caja Mensual", 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(127, 140, 141);
    doc.text(`Período: ${mesActualNombre.toUpperCase()}`, 14, 28);
    doc.text(`Total de trabajos realizados: ${registros.length}`, 14, 34);

    let cuerpoTabla = [];
    let acumuladoTotal = 0;
    let acumuladoComisiones = 0;

    registros.forEach(reg => {
        const fechaFormateada = new Date(reg.fecha_cobro).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const profesional = reg.peluqueros?.nombre || 'Sin asignar';
        const cobrado = Number(reg.monto_total);
        const comision = Number(reg.monto_comision);

        acumuladoTotal += cobrado;
        acumuladoComisiones += comision;

        cuerpoTabla.push([
            fechaFormateada,
            profesional,
            `$${cobrado.toLocaleString('es-AR')}`,
            `$${comision.toLocaleString('es-AR')}`
        ]);
    });

    // Dibujar tabla
    doc.autoTable({
        startY: 42,
        head: [['Fecha', 'Profesional', 'Cobrado', 'Comisión']],
        body: cuerpoTabla,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80] },
        styles: { fontSize: 10, cellPadding: 5 }
    });

    // Totales Finales al pie de la tabla
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(44, 62, 80);
    doc.text(`Facturación Total del Mes: $${acumuladoTotal.toLocaleString('es-AR')}`, 14, finalY);
    doc.text(`Total Comisiones Generadas: $${acumuladoComisiones.toLocaleString('es-AR')}`, 14, finalY + 7);

    // Guardar archivo
    doc.save(`Reporte_Caja_${mesActualNombre.replace(/\s+/g, '_')}.pdf`);
}
// Inicializar las alarmas (Asegúrate de que esto quede al final del todo)
solicitarPermisoNotificaciones();
setInterval(() => {
    if (haySesionActiva()) {
        monitorearTurnosProximos();
    }
}, 60000); // Revisa cada 60 segundos


