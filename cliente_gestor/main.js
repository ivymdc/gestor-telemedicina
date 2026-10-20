// IVY

// rest.get(url, callback) --> leer datos
// rest.post(url, body, callback) --> crear datos
// rest.put(url, body, callback) --> modificar datos
// rest.delete(url, callback) --> borrar datos
// function callback(estado, respuesta) {...} --> se ejecuta cuando el servidor responde

// Variables globales
var idGestor = null;      // identifica al usuario logueado
var gestorInfo = null;    // datos del gestor que está usando la app
var recursos = [];        // array que viene del servidor en BuscarRecursos()
var recursoActual = null; // recurso que estamos usando
var token = null;         // P3: token JWT que nos da el servidor al hacer login


/* =====================================================================
   P3 - JWT: funciones auxiliares
   ===================================================================== */

// Añade el token a una URL:
// "/api/categorias"            → "/api/categorias?token=XXXX"
// "/api/recursos?categoria=2"  → "/api/recursos?categoria=2&token=XXXX"
function conToken(url) {
    var separador = url.indexOf("?") === -1 ? "?" : "&";
    return url + separador + "token=" + encodeURIComponent(token);
}

// Si el servidor responde 401 (sin token, token incorrecto o caducado),
// avisamos y volvemos al login. Devuelve true si ha pasado.
function sesionCaducada(estado, respuesta) {
    if (estado === 401) {
        alert("Tu sesión ha caducado o no es válida (" + respuesta + "). Vuelve a iniciar sesión.");
        Salir();
        return true;
    }
    return false;
}


/* LOGIN: tengo que entrar o registrarme */
function Entrar() {
    var usuario = document.getElementById("login_usuario").value;
    var password = document.getElementById("login_password").value;

    // El login es PÚBLICO: no lleva token (todavía no lo tenemos)
    rest.post("/api/gestores/login",
        {
            usuario: usuario,
            password: password
        },
        function(estado, response){

            if(estado === 200){
                // P3: ahora el servidor devuelve { token, id }
                token = response.token;
                idGestor = response.id;

                // Pedimos los datos del gestor (ya con token)
                rest.get(conToken("/api/gestores/" + idGestor), function(s, r){
                    if (sesionCaducada(s, r)) return;

                    if(s === 200){
                        gestorInfo = r;
                        document.getElementById("nombre_gestor").innerText =
                            gestorInfo.nombre + " " + gestorInfo.apellidos;

                        document.getElementById("login").style.display = "none";
                        document.getElementById("inicio").style.display = "block";

                        cargarRanking();   // P3: el ranking se ve nada más entrar
                    }
                });
            }
            else{
                alert(response);
            }
        }
    );
}

/* REGISTRO: cuando le doy a registrarse se me abre la página de registro */
function MostrarRegistro() {
    document.getElementById("login").style.display = "none";
    document.getElementById("registro").style.display = "block";
}

// Cuando le doy a cancelar, me vuelve a la página del login
function VolverLogin() {
    document.getElementById("registro").style.display = "none";
    document.getElementById("login").style.display = "block";
}

// Cuando le doy a guardar, se guarda el registro (o la edición)
function Registrar() {
    var nombre = document.getElementById("reg_nombre").value;
    var apellidos = document.getElementById("reg_apellidos").value;
    var usuario = document.getElementById("reg_usuario").value;
    var password = document.getElementById("reg_password").value;

    // ******* Si idGestor existe → estamos editando (PRIVADO: con token) *******
    if(idGestor !== null){

        rest.put(conToken("/api/gestores/" + idGestor),
            {nombre, apellidos, usuario, password},
            function(status, response){
                if (sesionCaducada(status, response)) return;

                if(status === 200){
                    alert("Datos actualizados correctamente");

                    document.getElementById("registro").style.display = "none";
                    document.getElementById("inicio").style.display = "block";

                    document.getElementById("nombre_gestor").innerText =
                        nombre + " " + apellidos;
                }
                else{
                    alert(response);
                }
            }
        );

    // ******* Registro normal (PÚBLICO: sin token) *******
    } else {

        rest.post("/api/gestores",
            {nombre, apellidos, usuario, password},
            function(status, response){

                if(status === 201){
                    alert("Usuario registrado correctamente");
                    VolverLogin();
                }
                else{
                    alert(response);
                }
            }
        );
    }
}


/* SALIR */
function Salir() {
    idGestor = null;
    gestorInfo = null;
    token = null;     // P3: al salir, el token deja de usarse

    // Ocultar cualquier vista y mostrar el login
    document.getElementById("inicio").style.display = "none";
    document.getElementById("registro").style.display = "none";
    document.getElementById("alta_recurso").style.display = "none";
    document.getElementById("login").style.display = "block";
}

/* EDITAR DATOS */
function EditarDatos() {

    rest.get(conToken("/api/gestores/" + idGestor), function(status, response){
        if (sesionCaducada(status, response)) return;

        if(status === 200){
            document.getElementById("reg_nombre").value = response.nombre;
            document.getElementById("reg_apellidos").value = response.apellidos;
            document.getElementById("reg_usuario").value = response.usuario;
            document.getElementById("reg_password").value = "";

            document.getElementById("inicio").style.display = "none";
            document.getElementById("registro").style.display = "block";

            document.querySelector("#registro button").innerText = "Actualizar";
        }
    });
}


/* Construye una URL con filtros opcionales y hace un GET para traer los recursos */
function BuscarRecursos() {
    var categoria = document.getElementById("f_categoria").value;
    var modelo = document.getElementById("f_modelo").value;
    var ubicacion = document.getElementById("f_ubicacion").value;
    var estado = document.getElementById("f_estado").value;

    var url = "/api/recursos?";
    var parametros = [];

    if(categoria !== "") parametros.push("categoria=" + categoria);
    if(modelo !== "") parametros.push("modelo=" + modelo);
    if(ubicacion !== "") parametros.push("ubicacion=" + ubicacion);
    if(estado !== "") parametros.push("estado=" + estado);

    if(parametros.length > 0){
        url += parametros.join("&");
    } else {
        url = "/api/recursos";
    }

    // P3: conToken añade "&token=..." o "?token=..." según haya filtros o no
    rest.get(conToken(url), function(status, response){
        if (sesionCaducada(status, response)) return;

        if(status === 200){
            recursos = response;
            MostrarRecursos();
        } else {
            alert("No se pudieron cargar los recursos");
        }
    });
}

function MostrarRecursos() {
    var tbody = document.getElementById("lista_recursos");
    tbody.innerHTML = "";

    recursos.forEach(function(r){
        var fila = document.createElement("tr");

        fila.innerHTML = `
            <td>${r.numero_serie}</td>
            <td>${r.modelo.categoria.nombre}</td>
            <td>${r.modelo.nombre}</td>
            <td>${r.ubicacion}</td>
            <td>${
                r.estado === 0 ? "Operativo" :
                r.estado === 1 ? "De baja/Defectuoso" :
                r.estado === 2 ? "En mantenimiento" : "Desconocido"
            }</td>
            <td>
                <button onclick="AbrirFicha(${r.id})">Ficha</button>
                <button onclick="BorrarRecurso(${r.id})">Borrar</button>
            </td>
        `;

        tbody.appendChild(fila);
    });

    document.getElementById("tabla_recursos").style.display = "table";
}

function AbrirFicha(id){
    rest.get(conToken("/api/recursos/" + id), function(status, response){
        if (sesionCaducada(status, response)) return;

        if(status === 200){
            recursoActual = response;

            document.getElementById("nueva_categoria").value = response.modelo.categoria.id;
            document.getElementById("nuevo_numero").value = response.numero_serie;
            document.getElementById("nuevo_modelo").value = response.modelo.id;
            document.getElementById("nuevo_ubicacion").value = response.ubicacion.id;
            document.getElementById("nuevo_estado").value = response.estado;

            document.getElementById("inicio").style.display = "none";
            document.getElementById("alta_recurso").style.display = "block";

            CargarReservas(id);
            CargarResenyas(id);

        } else {
            alert("No se pudo cargar el recurso");
        }
    });
}

function BorrarRecurso(id) {
    if(confirm("¿Seguro que desea borrar este recurso?")){
        rest.delete(conToken("/api/recursos/" + id), function(status, response){
            if (sesionCaducada(status, response)) return;

            if(status === 200){
                alert(response);
                BuscarRecursos();
            } else {
                alert(response);
            }
        });
    }
}

// Ir a la ficha de un recurso vacía (alta)
function MostrarAltaRecurso(){
    document.getElementById("inicio").style.display = "none";
    document.getElementById("alta_recurso").style.display = "block";
}

// Volver al listado de inicio
function CancelarAlta(){
    recursoActual = null;
    document.getElementById("nuevo_numero").value = "";

    document.getElementById("alta_recurso").style.display = "none";
    document.getElementById("inicio").style.display = "block";
}


function GuardarRecurso(){

    var numero = document.getElementById("nuevo_numero").value;
    var modelo = document.getElementById("nuevo_modelo").value;
    var ubicacion = document.getElementById("nuevo_ubicacion").value;
    var estado = document.getElementById("nuevo_estado").value;

    // SI ES EDICIÓN
    if(recursoActual){

        rest.put(conToken("/api/recursos/" + recursoActual.id),
            {
                numero_serie: numero,
                modelo: modelo,
                ubicacion: ubicacion,
                estado: estado
            },
            function(status, response){
                if (sesionCaducada(status, response)) return;

                if(status === 200){
                    alert("Recurso actualizado correctamente");
                    CancelarAlta();
                    BuscarRecursos();
                } else {
                    alert(response);
                }
            }
        );

    } else {

        // SI ES NUEVO
        rest.post(conToken("/api/recursos"),
            {
                numero_serie: numero,
                modelo: modelo,
                ubicacion: ubicacion,
                estado: estado
            },
            function(status, response){
                if (sesionCaducada(status, response)) return;

                if(status === 201){
                    alert("Recurso creado correctamente");
                    CancelarAlta();
                    BuscarRecursos();
                } else {
                    alert("Error al crear recurso");
                }
            }
        );
    }
}

// Reservas de un recurso concreto
function CargarReservas(id){
    rest.get(conToken("/api/recursos/" + id + "/reservas"), function(status, response){
        if (sesionCaducada(status, response)) return;

        if(status === 200){
            var tabla = document.getElementById("tabla_reservas");
            var tbody = document.getElementById("lista_reservas");

            tbody.innerHTML = "";

            response.forEach(function(r){
                var fila = document.createElement("tr");
                fila.style.backgroundColor = r.color;

                fila.innerHTML = `
                    <td>${r.sanitario}</td>
                    <td>${r.horas_estimadas}</td>
                    <td>${r.fecha_peticion ? new Date(r.fecha_peticion).toLocaleString() : ""}</td>
                    <td>${r.fecha_inicio ? new Date(r.fecha_inicio).toLocaleString() : ""}</td>
                    <td>${r.fecha_fin ? new Date(r.fecha_fin).toLocaleString() : ""}</td>
                `;

                tbody.appendChild(fila);
            });

            tabla.style.display = "table";
        }
    });
}

// Reseñas de un recurso concreto
function CargarResenyas(id){

    rest.get(conToken("/api/recursos/" + id + "/resenyas"), function(status, response){
        if (sesionCaducada(status, response)) return;

        if(status === 200){
            var tabla = document.getElementById("tabla_resenyas");
            var tbody = document.getElementById("lista_resenyas");

            tbody.innerHTML = "";

            response.forEach(function(r){
                var fila = document.createElement("tr");

                fila.innerHTML = `
                    <td>${r.fecha ? new Date(r.fecha).toLocaleString() : ""}</td>
                    <td>${r.sanitario}</td>
                    <td>${r.valor}</td>
                    <td>${r.descripcion}</td>
                `;

                tbody.appendChild(fila);
            });

            tabla.style.display = "table";
        }
    });
}



/* =====================================================================
   P3 - PARTE 1: MINISTERIO DE SANIDAD
   Enviar nuestras reservas y mostrar el ranking de reservas por área
   ===================================================================== */

var URL_MINISTERIO = "https://undefined.ua.es/telemedicina/api/datos";  // ← cambiar por la URL real
var MI_ID_AREA = 2;                                                     // Anestesiología

// Códigos de área del enunciado
var AREAS = {
    1: "Alergología", 2: "Anestesiología", 3: "Cardiología", 4: "Cirugía General",
    5: "Dermatología", 6: "Aparato Digestivo", 7: "Endocrinología", 8: "Ginecología",
    9: "Hematología", 10: "Medicina Interna", 11: "Neumología", 12: "Neurología",
    13: "Oftalmología", 14: "Oncología", 15: "Pediatría", 16: "Psiquiatría",
    17: "Traumatología", 18: "Urología"
};

// Fecha de hoy en formato YYYY-MM-DD
function fechaHoy() {
    var d = new Date();
    return d.getFullYear() + "-" +
           String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0");
}

function mensajeMinisterio(texto) {
    document.getElementById("ministerio_estado").innerText = texto;
}


/* ---------- (a) ENVIAR NUESTRAS RESERVAS AL MINISTERIO ---------- */
function EnviarReservasMinisterio() {
    mensajeMinisterio("Obteniendo las reservas...");

    // 1. Pedir todas las reservas a NUESTRO servidor (con token)
    rest.get(conToken("/api/reservas"), function(status, reservas){
        if (sesionCaducada(status, reservas)) return;

        if (status !== 200) {
            mensajeMinisterio("No se pudieron obtener las reservas");
            return;
        }

        // 2. Darles el formato exacto que pide el Ministerio
        var datos = reservas.map(function(r){
            return {
                "nombre": r.nombre,
                "apellidos": r.apellidos,
                "categoría": r.categoria,
                "horas_estimadas": r.horas_estimadas,
                "fec_pet": r.fec_pet,
                "fec_ini": r.fec_ini,
                "fecha_fin": r.fecha_fin
            };
        });

        var envio = {
            "id_area": MI_ID_AREA,
            "fecha": fechaHoy(),
            "datos": datos
        };

        mensajeMinisterio("Enviando " + datos.length + " reservas...");

        // 3. Enviarlas al Ministerio (servidor EXTERNO: sin nuestro token)
        fetch(URL_MINISTERIO, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(envio)
        })
        .then(function(respuesta){
            if (!respuesta.ok) throw new Error("El Ministerio respondió " + respuesta.status);
            mensajeMinisterio("Reservas enviadas correctamente al Ministerio (" + datos.length + ").");
            cargarRanking();
        })
        .catch(function(error){
            mensajeMinisterio("Error al enviar: " + error.message);
        });
    });
}


/* ---------- (b) VALIDAR LO QUE DEVUELVE EL MINISTERIO ---------- */
// No nos fiamos de lo que hayan subido los demás grupos: se comprueba cada dato.

function esTextoNoVacio(x) {
    return typeof x === "string" && x.trim() !== "";
}

// ¿Es un registro de reserva correcto?
function esReservaValida(d) {
    if (d === null || typeof d !== "object" || Array.isArray(d)) return false;
    if (!esTextoNoVacio(d.nombre)) return false;
    if (!esTextoNoVacio(d.apellidos)) return false;

    // El enunciado dice "categoría" (con tilde), pero muchos grupos la envían sin tilde:
    // aceptamos las dos formas
    var categoria = d["categoría"] !== undefined ? d["categoría"] : d.categoria;
    if (!esTextoNoVacio(categoria)) return false;

    var horas = Number(d.horas_estimadas);
    if (d.horas_estimadas === null || d.horas_estimadas === "" || isNaN(horas) || horas < 0) return false;

    if (!esTextoNoVacio(d.fec_pet)) return false;   // la petición siempre tiene fecha
    return true;                                    // fec_ini y fecha_fin pueden estar vacías
}

// ¿Es un envío (de un grupo) correcto?
function esEnvioValido(e) {
    if (e === null || typeof e !== "object" || Array.isArray(e)) return false;

    var area = Number(e.id_area);
    if (!Number.isInteger(area) || AREAS[area] === undefined) return false;   // área 1-18

    if (!Array.isArray(e.datos)) return false;      // "datos" tiene que ser un array
    return true;
}


/* ---------- (c) RANKING DE RESERVAS POR ÁREA ---------- */
function cargarRanking() {
    fetch(URL_MINISTERIO)
        .then(function(respuesta){
            if (!respuesta.ok) throw new Error("El Ministerio respondió " + respuesta.status);
            return respuesta.json();
        })
        .then(function(contenido){
            console.log("Contenido del Ministerio:", contenido);   // para ver su forma real

            // No asumimos la forma: puede venir como array o como objeto
            var envios = [];
            if (Array.isArray(contenido)) {
                envios = contenido;
            } else if (contenido !== null && typeof contenido === "object") {
                envios = Object.values(contenido);
            }

            // Sumar las reservas VÁLIDAS de cada área
            var totales = {};
            var descartados = 0;

            envios.forEach(function(envio){
                if (!esEnvioValido(envio)) {
                    descartados++;
                    return;                          // envío entero incorrecto: se descarta
                }
                var area = Number(envio.id_area);
                var validas = envio.datos.filter(esReservaValida);
                descartados += envio.datos.length - validas.length;

                totales[area] = (totales[area] || 0) + validas.length;
            });

            // De objeto a array, ordenado de mayor a menor
            var ranking = Object.keys(totales)
                .map(function(a){ return { area: Number(a), total: totales[a] }; })
                .filter(function(x){ return x.total > 0; })
                .sort(function(a, b){ return b.total - a.total; });

            pintarRanking(ranking);
            mensajeMinisterio(descartados > 0
                ? "Ranking actualizado (" + descartados + " registros incorrectos descartados)."
                : "Ranking actualizado.");
        })
        .catch(function(error){
            mensajeMinisterio("Error al cargar el ranking: " + error.message);
        });
}

function pintarRanking(ranking) {
    var medallas = ["🥇", "🥈", "🥉"];
    var html = "";

    if (ranking.length === 0) {
        html = "<tr><td colspan='3'>Todavía no hay datos</td></tr>";
    }

    ranking.forEach(function(fila, i){
        var posicion = i < 3 ? medallas[i] : (i + 1);
        html += "<tr>" +
                    "<td>" + posicion + "</td>" +
                    "<td>" + AREAS[fila.area] + "</td>" +
                    "<td>" + fila.total.toLocaleString("es-ES") + "</td>" +
                "</tr>";
    });

    document.getElementById("ranking_cuerpo").innerHTML = html;
}