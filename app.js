document.addEventListener("DOMContentLoaded", function () {
    // -------------------------
    // VARIABLES GLOBALES
    // -------------------------
    const listaRuta = document.getElementById("clientesRuta");
    const listaRecorrido = document.getElementById("listaRecorrido");
    const distanciaTotalSpan = document.getElementById("distanciaTotal");
    const btnLimpiarRuta = document.getElementById("btnLimpiarRuta");
    const registroForm = document.getElementById("registroForm");
    const offlineWarning = document.getElementById("offlineWarning");
    const mapaDiv = document.getElementById("mapaRuta");

    // Variables del mapa
    let mapaRuta = null;
    let marcadoresMapa = [];
    let polyline = null;

    // Variables de datos
    let clientes = JSON.parse(localStorage.getItem('clientes')) || [];
    let rutaClientes = [];
    let clientesSeleccionados = new Set();

    // Variables PWA
    let deferredPrompt = null;
    let installBannerShown = false;

    // -------------------------
    // UTIL: Mostrar notificación simple
    // -------------------------
    function mostrarNotificacion(mensaje, tipo = "ok") {
        const notif = document.createElement('div');
        notif.className = 'app-notif';
        notif.style.cssText = `
            position: fixed;
            top: 18px;
            right: 18px;
            background: ${tipo === 'error' ? '#dc3545' : '#28a745'};
            color: white;
            padding: 10px 14px;
            border-radius: 8px;
            z-index: 10002;
            box-shadow: 0 6px 18px rgba(0,0,0,0.12);
            font-family: system-ui, Arial, sans-serif;
        `;
        notif.textContent = mensaje;
        document.body.appendChild(notif);
        setTimeout(() => {
            notif.style.opacity = '0';
            notif.style.transition = 'opacity 300ms';
            setTimeout(() => notif.remove(), 350);
        }, 3000);
    }

    // -------------------------
    // INICIALIZAR MAPA
    // -------------------------
    function inicializarMapa() {
        if (!mapaDiv) return; // no hay contenedor
        if (mapaRuta !== null) return; // ya inicializado

        if (!navigator.onLine) {
            mostrarMensajeMapaOffline();
            return;
        }

        try {
            mapaRuta = L.map("mapaRuta").setView([25.6866, -100.3161], 12);

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(mapaRuta);

            console.log('Mapa Leaflet inicializado correctamente');
        } catch (error) {
            console.error('Error al inicializar el mapa:', error);
            mapaRuta = null;
            mostrarMensajeMapaOffline();
        }
    }

    function mostrarMensajeMapaOffline() {
        if (!mapaDiv) return;
        // Evitar reemplazar si ya existe el mensaje
        if (mapaDiv.querySelector('.mapa-offline-mensaje')) return;

        mapaDiv.innerHTML = `
            <div class="mapa-offline-mensaje" style="
                padding: 40px 20px;
                text-align: center;
                color: #666;
                background: #f8f9fa;
                border-radius: 10px;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                border: 2px dashed #dee2e6;
            ">
                <div style="font-size: 48px; margin-bottom: 15px; color: #adb5bd;">🗺️</div>
                <h5 style="margin-bottom: 10px; color: #495057;">Mapa no disponible</h5>
                <p style="color: #6c757d; font-size: 14px; max-width: 300px;">
                    <i class="fas fa-wifi-slash me-1"></i>
                    Se requiere conexión a internet para cargar el mapa.
                </p>
                <div style="margin-top: 20px; padding: 10px; background: #e9ecef; border-radius: 6px; font-size: 12px; color: #6c757d;">
                    <i class="fas fa-info-circle me-1"></i>
                    Los datos de clientes y rutas siguen funcionando offline.
                </div>
            </div>
        `;
    }

    // -------------------------
    // DETECCIÓN DE CONEXIÓN
    // -------------------------
    function actualizarEstadoConexion() {
        const online = navigator.onLine;

        // Mostrar u ocultar banner offlineWarning si existe
        if (offlineWarning) {
            offlineWarning.style.display = online ? 'none' : 'block';
        }

        if (online) {
            // intentar inicializar mapa si no hay
            if (mapaDiv && mapaRuta === null) {
                // esperar un momento breve para asegurar que Leaflet esté listo
                setTimeout(inicializarMapa, 500);
            } else if (mapaRuta !== null) {
                // si ya hay ruta, actualizarla para dibujar marcadores/linea
                if (rutaClientes.length > 0) {
                    setTimeout(actualizarRuta, 400);
                }
            }
        } else {
            // si nos vamos offline y no hay mapa, mostrar placeholder
            if (mapaRuta === null) {
                mostrarMensajeMapaOffline();
            }
        }
    }

 
    // -------------------------
    // FUNCIÓN PARA FORMATEAR TELÉFONO
    // -------------------------
    function formatearTelefono(telefono) {
        if (!telefono) return "Sin teléfono";

        const numeros = telefono.toString().replace(/\D/g, '');

        if (numeros.length === 10) {
            return `(${numeros.substring(0,3)}) ${numeros.substring(3,6)}-${numeros.substring(6)}`;
        } else if (numeros.length === 8) {
            return `${numeros.substring(0,4)}-${numeros.substring(4)}`;
        }

        return numeros;
    }

    // -------------------------
    // FUNCIÓN PARA VALIDAR TELÉFONO
    // -------------------------
    function validarTelefono(telefono) {
        if (!telefono) return false;
        const numeros = telefono.toString().replace(/\D/g, '');
        return numeros.length >= 8 && numeros.length <= 15;
    }

    // -------------------------
    // FUNCIÓN PARA OBTENER CLASE DE ZONA
    // -------------------------
    function obtenerClaseZona(zona) {
        if (!zona) return "zona-badge zona-norte";

        const zonaLower = zona.toLowerCase();
        if (zonaLower.includes("norte")) return "zona-badge zona-norte";
        if (zonaLower.includes("centro")) return "zona-badge zona-centro";
        if (zonaLower.includes("oriente")) return "zona-badge zona-oriente";
        if (zonaLower.includes("sur")) return "zona-badge zona-norte";
        if (zonaLower.includes("poniente")) return "zona-badge zona-centro";
        return "zona-badge zona-norte";
    }

    // -------------------------
    // DATOS DE EJEMPLO (si no hay)
    // -------------------------
    if (clientes.length === 0) {
        clientes = [
            { id: 1, nombre: "Gerardo Villarreal", telefono: "8112345678", zona: "Zona Norte", lat: 25.7266, ing: -100.3461 },
            { id: 2, nombre: "Alejandra Gutiérrez", telefono: "8123456789", zona: "Zona Centro", lat: 25.6766, ing: -100.3161 },
            { id: 3, nombre: "Sonia Báez", telefono: "8134567890", zona: "Zona Oriente", lat: 25.6866, ing: -100.2561 }
        ];
        guardarClientes();
    }

    // -------------------------
    // FUNCIONES DE ALMACENAMIENTO
    // -------------------------
    function guardarClientes() {
        try {
            localStorage.setItem('clientes', JSON.stringify(clientes));
        } catch (err) {
            console.error('Error guardando en localStorage:', err);
        }
    }

    // -------------------------
    // MOSTRAR LISTA DE CLIENTES
    // -------------------------
    function cargarClientesRuta() {
        if (!listaRuta) return;
        listaRuta.innerHTML = "";

        if (!clientes || clientes.length === 0) {
            listaRuta.innerHTML = `
                <div class="alert alert-info text-center">
                    <i class="fas fa-info-circle me-2"></i>
                    No hay clientes registrados.
                </div>
            `;
            return;
        }

        clientes.forEach(c => {
            if (!c.id || !c.nombre) {
                console.warn("Cliente inválido:", c);
                return;
            }

            const li = document.createElement("li");
            li.className = `list-group-item cliente-item ${clientesSeleccionados.has(c.id) ? 'seleccionado' : ''}`;
            li.dataset.id = c.id;

            const zonaClass = obtenerClaseZona(c.zona);
            const zonaTexto = c.zona || "Sin zona";
            const telefonoFormateado = formatearTelefono(c.telefono);

            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <input type="checkbox" class="form-check-input me-2" ${clientesSeleccionados.has(c.id) ? 'checked' : ''}>
                            <h6 class="mb-0 fw-bold">${c.nombre}</h6>
                        </div>
                        <div class="telefono-info mb-1">
                            <i class="fas fa-phone-alt telefono-icon"></i>
                            ${telefonoFormateado}
                        </div>
                        <span class="${zonaClass}">${zonaTexto}</span>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-danger eliminar-cliente" data-id="${c.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;

            li.addEventListener("click", (e) => {
                if (!e.target.classList.contains('eliminar-cliente') &&
                    !e.target.closest('.eliminar-cliente')) {
                    toggleClienteRuta(c.id);
                }
            });

            const btnEliminar = li.querySelector('.eliminar-cliente');
            if (btnEliminar) {
                btnEliminar.addEventListener("click", (e) => {
                    e.stopPropagation();
                    eliminarCliente(c.id);
                });
            }

            listaRuta.appendChild(li);
        });
    }

    // -------------------------
    // TOGGLE CLIENTE EN RUTA
    // -------------------------
    function toggleClienteRuta(id) {
        const cliente = clientes.find(c => c.id === id);
        if (!cliente) return;

        if (clientesSeleccionados.has(id)) {
            clientesSeleccionados.delete(id);
            rutaClientes = rutaClientes.filter(c => c.id !== id);
        } else {
            clientesSeleccionados.add(id);
            rutaClientes.push(cliente);
        }

        cargarClientesRuta();
        actualizarRuta();
    }

    // -------------------------
    // ELIMINAR CLIENTE
    // -------------------------
    function eliminarCliente(id) {
        if (!confirm("¿Estás seguro de eliminar este cliente?")) return;

        clientes = clientes.filter(c => c.id !== id);
        clientesSeleccionados.delete(id);
        rutaClientes = rutaClientes.filter(c => c.id !== id);

        guardarClientes();
        cargarClientesRuta();
        actualizarRuta();

        mostrarNotificacion("Cliente eliminado correctamente");
    }

    // -------------------------
    // CALCULAR DISTANCIA
    // -------------------------
    function calcularDistancia(lat1, lon1, lat2, lon2) {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;

        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // -------------------------
    // OBTENER COLOR POR ZONA
    // -------------------------
    function obtenerColorZona(zona) {
        if (!zona) return "#1565c0";
        const zonaLower = zona.toLowerCase();
        if (zonaLower.includes("centro")) return "#7b1fa2";
        if (zonaLower.includes("oriente")) return "#2e7d32";
        return "#1565c0";
    }

    // -------------------------
    // ACTUALIZAR RUTA
    // -------------------------
    function actualizarRuta() {
        if (!listaRecorrido) return;
        listaRecorrido.innerHTML = "";

        // Limpiar mapa si existe
        if (mapaRuta !== null) {
            marcadoresMapa.forEach(marker => {
                try { mapaRuta.removeLayer(marker); } catch (e) { /* ignore */ }
            });
            marcadoresMapa = [];

            if (polyline) {
                try { mapaRuta.removeLayer(polyline); } catch (e) { /* ignore */ }
                polyline = null;
            }
        }

        if (!rutaClientes || rutaClientes.length === 0) {
            listaRecorrido.innerHTML = `
                <div class="alert alert-info text-center">
                    <i class="fas fa-route me-2"></i>
                    No hay clientes en la ruta.
                </div>
            `;
            distanciaTotalSpan.textContent = "0 km";
            return;
        }

        let puntos = [];
        let distanciaTotal = 0;
        let bounds = null;

        rutaClientes.forEach((cliente, index) => {
            if (!cliente || cliente.lat == null || cliente.ing == null) {
                console.warn("Cliente inválido:", cliente);
                return;
            }

            const div = document.createElement("div");
            div.className = "ruta-item";

            const zonaColor = obtenerColorZona(cliente.zona);
            const zonaTexto = cliente.zona || "Sin zona";
            const telefonoFormateado = formatearTelefono(cliente.telefono);

            div.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="orden-badge" style="background-color: ${zonaColor}">${index + 1}</div>
                    <div class="flex-grow-1">
                        <h6 class="mb-0 fw-bold">${cliente.nombre || "Cliente"}</h6>
                        <small class="text-muted d-block">${zonaTexto}</small>
                        <small class="telefono-info">
                            <i class="fas fa-phone-alt telefono-icon"></i>
                            ${telefonoFormateado}
                        </small>
                    </div>
                </div>
                <div class="eliminar-btn" style="cursor:pointer" data-id="${cliente.id}">
                    <i class="fas fa-times"></i>
                </div>
            `;

            // eliminar desde la UI
            const eliminarBtn = div.querySelector('.eliminar-btn');
            if (eliminarBtn) {
                eliminarBtn.addEventListener('click', () => {
                    removerDeRuta(cliente.id);
                });
            }

            listaRecorrido.appendChild(div);

            const punto = [cliente.lat, cliente.ing];
            puntos.push(punto);

            if (index > 0 && rutaClientes[index - 1]) {
                const prevCliente = rutaClientes[index - 1];
                const distancia = calcularDistancia(prevCliente.lat, prevCliente.ing, cliente.lat, cliente.ing);
                distanciaTotal += distancia;
            }

            if (mapaRuta !== null) {
                try {
                    const marcador = L.marker(punto)
                        .bindPopup(`<b>${index + 1}. ${cliente.nombre || "Cliente"}</b><br><i class="fas fa-phone"></i> ${telefonoFormateado}<br><small>${zonaTexto}</small>`)
                        .addTo(mapaRuta);

                    marcadoresMapa.push(marcador);

                    if (bounds === null) {
                        bounds = L.latLngBounds(punto, punto);
                    } else {
                        bounds.extend(punto);
                    }
                } catch (e) {
                    console.warn('Error agregando marcador:', e);
                }
            }
        });

        distanciaTotalSpan.textContent = distanciaTotal.toFixed(2) + " km";

        if (mapaRuta !== null && puntos.length > 1) {
            try {
                polyline = L.polyline(puntos, { color: '#667eea', weight: 4, opacity: 0.85 }).addTo(mapaRuta);
                if (bounds) mapaRuta.fitBounds(bounds.pad(0.1));
            } catch (e) {
                console.warn('Error dibujando polyline:', e);
            }
        }
    }

    // -------------------------
    // REMOVER DE RUTA (global)
    // -------------------------
    window.removerDeRuta = function (id) {
        clientesSeleccionados.delete(id);
        rutaClientes = rutaClientes.filter(c => c.id !== id);

        cargarClientesRuta();
        actualizarRuta();
    };

    // -------------------------
    // LIMPIAR RUTA
    // -------------------------
    if (btnLimpiarRuta) {
        btnLimpiarRuta.addEventListener("click", () => {
            if (!rutaClientes || rutaClientes.length === 0) {
                mostrarNotificacion("La ruta ya está vacía");
                return;
            }

            if (confirm("¿Estás seguro de limpiar toda la ruta?")) {
                clientesSeleccionados.clear();
                rutaClientes = [];

                cargarClientesRuta();
                actualizarRuta();

                mostrarNotificacion("Ruta limpiada correctamente");
            }
        });
    }

    // -------------------------
    // FORMULARIO
    // -------------------------
    if (registroForm) {
        registroForm.addEventListener("submit", function (e) {
            e.preventDefault();

            const nombre = (document.getElementById("nombre") || {}).value?.trim() || "";
            const telefono = (document.getElementById("telefono") || {}).value?.trim() || "";
            const zona = (document.getElementById("zona") || {}).value || "";
            const latInput = (document.getElementById("lat") || {}).value?.trim() || "";
            const ingInput = (document.getElementById("ing") || {}).value?.trim() || "";

            if (!nombre) {
                alert("El nombre es obligatorio");
                return;
            }

            if (!telefono || !validarTelefono(telefono)) {
                alert("Teléfono inválido (mínimo 8 dígitos)");
                return;
            }

            if (!zona) {
                alert("La zona es obligatoria");
                return;
            }

            const lat = parseFloat(latInput);
            const ing = parseFloat(ingInput);

            if (isNaN(lat) || isNaN(ing)) {
                alert("Coordenadas inválidas");
                return;
            }

            const nuevoCliente = {
                id: Date.now(),
                nombre,
                telefono: telefono.replace(/\D/g, ''),
                zona,
                lat,
                ing
            };

            clientes.push(nuevoCliente);
            guardarClientes();

            registroForm.reset();
            cargarClientesRuta();

            mostrarNotificacion(`Cliente "${nombre}" agregado correctamente`);
        });
    }

    // -------------------------
    // INICIALIZAR APLICACIÓN
    // -------------------------
    function inicializarApp() {
        // Eventos conexión
        window.addEventListener('online', actualizarEstadoConexion);
        window.addEventListener('offline', actualizarEstadoConexion);

        // Estado inicial
        setTimeout(actualizarEstadoConexion, 700);

        

        // Inicializar mapa solo si existe contenedor y hay conexión
        if (mapaDiv && navigator.onLine) {
            setTimeout(inicializarMapa, 400);
        } else if (mapaDiv && !navigator.onLine) {
            mostrarMensajeMapaOffline();
        }

        // Cargar UI
        cargarClientesRuta();
        actualizarRuta();

        console.log("Aplicación de Ruta de Clientes cargada");
        console.log(`Clientes: ${clientes.length}`);
    }

    // Iniciar
    inicializarApp();
});
