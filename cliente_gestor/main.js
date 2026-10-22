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

    var nombresEstado = ["Operativo", "De baja/Defectuoso", "En mantenimiento"];

    recursos.forEach(function(r){
        var fila = document.createElement("tr");

        fila.innerHTML = `
            <td>${r.numero_serie}</td>
            <td>${r.modelo.categoria.nombre}</td>
            <td>${r.modelo.nombre}</td>
            <td>${r.ubicacion}</td>
            <td><span class="estado estado-${r.estado}">${nombresEstado[r.estado] || "Desconocido"}</span></td>
            <td>
                <button class="btn-sm btn-secundario" onclick="AbrirFicha(${r.id})">Ficha</button>
                <button class="btn-sm btn-peligro" onclick="BorrarRecurso(${r.id})">Borrar</button>
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
                fila.className = "reserva-" + r.color;   // colores suaves definidos en el CSS

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
   ---------------------------------------------------------------------
   El Ministerio tiene un servicio REST EXTERNO (no es nuestro servidor):
       https://undefined.ua.es/telemedicina/api/datos

     · POST → cada grupo sube TODAS sus reservas en UN SOLO envío:
              { "id_area": 2, "fecha": "YYYY-MM-DD", "datos": [ reserva, reserva, ... ] }
     · GET  → devuelve TODOS los envíos de TODOS los grupos.

   Cada reserva que va dentro de "datos" tiene este formato (enunciado):
       {
         "nombre": "Carlos",            "apellidos": "Pérez",
         "categoría": "Termómetros",    "horas_estimadas": 2,
         "fec_pet": "YYYY-MM-DD HH:MM:SS",   ← fecha de petición (obligatoria)
         "fec_ini": "YYYY-MM-DD HH:MM:SS",   ← fecha de inicio (puede ser null)
         "fecha_fin": "YYYY-MM-DD HH:MM:SS"  ← fecha de fin   (puede ser null)
       }

   Esta parte hace tres cosas:
     (a) ENVIAR nuestras reservas al Ministerio (un solo POST).
     (b) VALIDAR los datos: no nos fiamos de lo que suben los otros grupos
         (ni de los nuestros): todo registro incorrecto se descarta.
     (c) RANKING: contar las reservas válidas de cada área médica y
         mostrarlas ordenadas de mayor a menor en la vista principal.
   ===================================================================== */

var URL_MINISTERIO = "https://undefined.ua.es/telemedicina/api/datos";  // servicio del Ministerio
var MI_ID_AREA = 2;                                                     // nuestra área: Anestesiología

// Códigos de área del enunciado (id_area → nombre).
// Sirve para dos cosas: poner el nombre en el ranking y comprobar que
// un id_area es válido (si no está en esta tabla, el área no existe).
var AREAS = {
    1: "Alergología", 2: "Anestesiología", 3: "Cardiología", 4: "Cirugía General",
    5: "Dermatología", 6: "Aparato Digestivo", 7: "Endocrinología", 8: "Ginecología",
    9: "Hematología", 10: "Medicina Interna", 11: "Neumología", 12: "Neurología",
    13: "Oftalmología", 14: "Oncología", 15: "Pediatría", 16: "Psiquiatría",
    17: "Traumatología", 18: "Urología"
};


/* ---------------------------------------------------------------------
   FUNCIONES AUXILIARES
   --------------------------------------------------------------------- */

// Pone un número con dos cifras: 5 → "05", 12 → "12"
function dos(n) { return String(n).padStart(2, "0"); }

// Fecha de hoy en formato "YYYY-MM-DD" (es el campo "fecha" del envío)
function fechaHoy() {
    var d = new Date();
    return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate());
    // getMonth() va de 0 a 11, por eso se suma 1
}

// Escribe un mensaje debajo del ranking (para que el usuario sepa qué está pasando)
function mensajeMinisterio(texto) {
    document.getElementById("ministerio_estado").innerText = texto;
}

// Convierte una fecha de nuestra base de datos (viene como "2026-03-02T08:00:00.000Z")
// al formato que pide el Ministerio: "YYYY-MM-DD HH:MM:SS".
// Si la reserva no tiene esa fecha (null) o la fecha es inválida → devuelve null.
function formatearFecha(f) {
    if (!f) return null;                     // sin fecha (p. ej. aún no ha empezado)
    var d = new Date(f);
    if (isNaN(d.getTime())) return null;     // fecha imposible de leer → null (no "NaN-NaN-NaN")
    return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()) + " " +
           dos(d.getHours()) + ":" + dos(d.getMinutes()) + ":" + dos(d.getSeconds());
}

// Nuestro GET de reservas devuelve el sanitario en UN solo texto ("Carlos Pérez García"),
// pero el Ministerio lo pide separado en "nombre" y "apellidos".
// Regla: lo que va antes del PRIMER espacio es el nombre; el resto, los apellidos.
//   "Carlos Pérez García" → { nombre: "Carlos", apellidos: "Pérez García" }
// Limitación: con nombres compuestos ("Juan Carlos Pérez") el nombre sería solo "Juan".
// (No se puede hacer mejor sin crear servicios o consultas nuevas.)
function separarNombre(texto) {
    var s = (texto || "").trim();            // si viene null/undefined → ""
    var espacio = s.indexOf(" ");            // posición del primer espacio (-1 si no hay)
    if (espacio === -1) return { nombre: s, apellidos: "" };
    return { nombre: s.substring(0, espacio), apellidos: s.substring(espacio + 1).trim() };
}


/* =====================================================================
   (a) ENVIAR NUESTRAS RESERVAS AL MINISTERIO
   ---------------------------------------------------------------------
   Solo se usan los GET que YA EXISTÍAN en nuestro servidor
   (no se crean servicios nuevos ni consultas nuevas a la base de datos):
     1. GET /api/recursos               → todos los recursos (cada uno con su categoría)
     2. GET /api/recursos/:id/reservas  → las reservas de cada recurso
   Se juntan todas las reservas en un array y se hace UN SOLO POST.

   ¿Por qué un contador ("respuestas")?
   Las peticiones del paso 2 son ASÍNCRONAS: se lanzan todas a la vez y
   responden en cualquier orden. No podemos hacer el POST justo después del
   forEach porque en ese momento aún no ha llegado ninguna respuesta.
   Por eso contamos las respuestas y, cuando han llegado TODAS
   (respuestas === lista.length), entonces hacemos el único POST.
   ===================================================================== */
function EnviarReservasMinisterio() {
    mensajeMinisterio("Obteniendo las reservas...");

    // 1. Pedimos todos los recursos (nuestro servidor: lleva token)
    rest.get(conToken("/api/recursos"), function(status, lista){
        if (sesionCaducada(status, lista)) return;           // 401 → vuelve al login

        // Comprobamos que la respuesta es correcta y que es un array
        if (status !== 200 || !Array.isArray(lista)) {
            mensajeMinisterio("No se pudieron obtener los recursos. No se ha enviado nada.");
            return;
        }
        // Sin recursos no hay reservas: no tiene sentido hacer un POST vacío
        if (lista.length === 0) {
            mensajeMinisterio("No hay recursos, así que no hay reservas que enviar.");
            return;
        }

        var datos = [];        // aquí se van juntando TODAS las reservas (formato Ministerio)
        var respuestas = 0;    // cuántos recursos han respondido ya
        var hayError = false;  // true si algún GET de reservas ha fallado
        var cortado = false;   // true si la sesión ha caducado (para avisar una sola vez)

        // 2. Para cada recurso pedimos sus reservas
        lista.forEach(function(recurso){
            rest.get(conToken("/api/recursos/" + recurso.id + "/reservas"), function(s, reservas){

                // Token caducado: avisamos UNA vez (si no, saldrían tantos avisos como recursos)
                if (s === 401) {
                    if (!cortado) { cortado = true; sesionCaducada(s, reservas); }
                    return;
                }

                respuestas++;   // ha respondido un recurso más

                if (s === 200 && Array.isArray(reservas)) {
                    // Transformamos cada reserva de NUESTRO formato al del MINISTERIO
                    reservas.forEach(function(r){
                        // >>> AQUÍ es donde se FILTRA si en el examen piden enviar solo algunas
                        //     reservas, p. ej. las de un sanitario:
                        //     if (r.sanitario !== "Carlos Pérez") return;
                        var persona = separarNombre(r.sanitario);
                        datos.push({
                            "nombre": persona.nombre,
                            "apellidos": persona.apellidos,
                            "categoría": recurso.modelo.categoria.nombre,   // la categoría sale del RECURSO
                            "horas_estimadas": Number(r.horas_estimadas),   // se envía como número
                            "fec_pet": formatearFecha(r.fecha_peticion),
                            "fec_ini": formatearFecha(r.fecha_inicio),
                            "fecha_fin": formatearFecha(r.fecha_fin)
                        });
                    });
                } else {
                    hayError = true;    // este recurso no ha devuelto sus reservas
                }

                // 3. ¿Han respondido ya TODOS los recursos? → revisamos y hacemos el ÚNICO POST
                if (respuestas === lista.length) {
                    if (cortado) return;    // la sesión caducó a mitad: no se envía nada
                    if (hayError) {
                        // Si falta algún recurso, enviaríamos datos incompletos: mejor no enviar
                        mensajeMinisterio("No se pudieron obtener todas las reservas. No se ha enviado nada.");
                        return;
                    }
                    revisarYEnviar(datos);
                }
            });
        });
    });
}

// Antes de enviar, pasamos a NUESTRAS reservas las MISMAS comprobaciones
// que hacemos a las de los demás grupos: así no subimos nada incorrecto.
// Las correctas se envían; las incorrectas se quedan fuera y se ven en la consola (F12).
function revisarYEnviar(datos) {
    var correctas = [];
    var malas = [];

    datos.forEach(function(d){
        var motivo = motivoReservaInvalida(d);           // null = correcta
        if (motivo === null) correctas.push(d);
        else malas.push({ reserva: d, motivo: motivo });
    });

    if (malas.length > 0) {
        console.warn("Reservas propias que NO se envían (y por qué):", malas);
    }
    if (correctas.length === 0) {
        mensajeMinisterio("No hay reservas correctas que enviar.");
        return;
    }
    enviarAlMinisterio(correctas, malas.length);
}

// Hace el ÚNICO POST al Ministerio con todas las reservas.
// Se usa fetch (y no rest.post) porque es un servidor EXTERNO:
// NO lleva nuestro token JWT (nuestro token solo vale para nuestro servidor).
function enviarAlMinisterio(datos, noEnviadas) {
    var envio = {
        "id_area": MI_ID_AREA,     // quiénes somos: área 2, Anestesiología
        "fecha": fechaHoy(),       // día del envío
        "datos": datos             // TODAS las reservas en un array
    };

    console.log("POST al Ministerio:", envio);    // para comprobar qué se envía exactamente
    mensajeMinisterio("Enviando " + datos.length + " reservas...");

    fetch(URL_MINISTERIO, {
        method: "POST",
        headers: { "Content-Type": "application/json" },   // le decimos que va un JSON
        body: JSON.stringify(envio)                        // objeto → texto JSON
    })
    .then(function(respuesta){
        // fetch solo da error si no hay conexión; un 400/500 hay que comprobarlo a mano
        if (!respuesta.ok) throw new Error("El Ministerio respondió " + respuesta.status);

        var texto = "Reservas enviadas correctamente al Ministerio (" + datos.length + ").";
        if (noEnviadas > 0) texto += " " + noEnviadas + " no se enviaron por tener datos incorrectos (ver consola).";
        mensajeMinisterio(texto);

        cargarRanking();    // recargamos el ranking para ver ya nuestros datos
    })
    .catch(function(error){
        mensajeMinisterio("Error al enviar: " + error.message);
    });
}


/* =====================================================================
   (b) VALIDAR LOS DATOS
   ---------------------------------------------------------------------
   El GET del Ministerio trae datos de TODOS los grupos y puede haber de todo:
   campos vacíos, fechas mal escritas, áreas que no existen, envíos repetidos...
   NO nos fiamos: cada envío y cada reserva se comprueba antes de contarla.

   Las funciones "motivo..." devuelven:
       null              → el dato es CORRECTO
       "texto del fallo" → el dato es INCORRECTO, y el texto dice POR QUÉ
   (así en la consola se ve el motivo de cada descarte)
   ===================================================================== */

// ¿Es un texto con algo escrito? ("" o "   " o un número → false)
function esTextoNoVacio(x) {
    return typeof x === "string" && x.trim() !== "";
}

// ¿Es un texto válido para un NOMBRE, APELLIDO o CATEGORÍA?
// Tiene que ser texto no vacío y contener al menos UNA LETRA.
//   "Carlos", "Pérez García", "Sillas de ruedas" → bien
//   "3", "  12 ", "-", "...", 3 (número)         → mal
// (\p{L} = cualquier letra, también con tilde o ñ; la "u" del final lo activa)
function esTextoConLetras(x) {
    return esTextoNoVacio(x) && /\p{L}/u.test(x);
}

// ¿Está vacía una fecha OPCIONAL? (fec_ini y fecha_fin pueden venir vacías)
function esFechaVacia(x) {
    return x === null || x === undefined || x === "";
}

// Lee una fecha en texto y la convierte en un objeto Date.
// Acepta: "2026-03-02", "2026-03-02 09:00:00", "2026-03-02T09:00:00.000Z"
// Devuelve null si NO es una fecha real:
//   "hola"        → null (no tiene forma de fecha)
//   "2026-02-31"  → null (el 31 de febrero no existe)
//   "2026-13-01"  → null (no hay mes 13)
//   "1900-01-01"  → null (fecha absurda para una reserva)
function leerFecha(texto) {
    if (!esTextoNoVacio(texto)) return null;

    // Expresión regular: AAAA-MM-DD y, opcionalmente, hora HH:MM(:SS), milisegundos y zona
    var m = texto.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/);
    if (!m) return null;                       // no tiene forma de fecha

    var anyo = +m[1], mes = +m[2], dia = +m[3];
    var h = m[4] ? +m[4] : 0, min = m[5] ? +m[5] : 0, seg = m[6] ? +m[6] : 0;
    if (mes < 1 || mes > 12 || h > 23 || min > 59 || seg > 59) return null;

    // Si el día no existe (31 de febrero), JavaScript lo "pasa" al mes siguiente
    // (3 de marzo). Por eso comprobamos que el mes y el día siguen siendo los mismos.
    var d = new Date(anyo, mes - 1, dia, h, min, seg);
    if (d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
    if (anyo < 2000) return null;
    return d;
}

var UN_DIA = 24 * 60 * 60 * 1000;   // un día en milisegundos (margen por zonas horarias)

// Comprueba UNA RESERVA. Devuelve null si es correcta o el motivo si no lo es.
function motivoReservaInvalida(d) {
    // Tiene que ser un objeto { ... } (no null, ni un número, ni un array)
    if (d === null || typeof d !== "object" || Array.isArray(d)) return "no es un objeto";

    // Nombre y apellidos: texto con algo escrito y con letras (un "3" no es un nombre)
    if (!esTextoNoVacio(d.nombre)) return "falta el nombre";
    if (!esTextoConLetras(d.nombre)) return "el nombre no tiene letras";
    if (!esTextoNoVacio(d.apellidos)) return "faltan los apellidos";
    if (!esTextoConLetras(d.apellidos)) return "los apellidos no tienen letras";

    // Categoría: el enunciado dice "categoría" (con tilde), pero muchos grupos
    // la envían sin tilde ("categoria"). Aceptamos las dos formas.
    var categoria = d["categoría"] !== undefined ? d["categoría"] : d.categoria;
    if (!esTextoNoVacio(categoria)) return "falta la categoría";
    if (!esTextoConLetras(categoria)) return "la categoría no tiene letras";

    // Horas estimadas: tiene que ser un número (o un texto con un número) MAYOR que 0.
    //   2, "4", 1.5 → bien   |   null, "", "abc", 0, -3, "Infinity" → mal
    var h = d.horas_estimadas;
    if (typeof h !== "number" && !(typeof h === "string" && h.trim() !== "")) return "horas_estimadas vacías";
    var horas = Number(h);
    if (!isFinite(horas)) return "horas_estimadas no es un número";
    if (horas <= 0) return "horas_estimadas debe ser mayor que 0";

    // Fecha de petición: OBLIGATORIA (toda reserva se ha pedido algún día),
    // tiene que ser una fecha real y no puede estar en el futuro.
    var pet = leerFecha(d.fec_pet);
    if (pet === null) return "fec_pet incorrecta o vacía";
    if (pet.getTime() > Date.now() + UN_DIA) return "fec_pet en el futuro";

    // Fecha de inicio: OPCIONAL (la reserva puede no haber empezado aún).
    // Si viene, tiene que ser real y no puede ser anterior a la petición.
    var ini = null;
    if (!esFechaVacia(d.fec_ini)) {
        ini = leerFecha(d.fec_ini);
        if (ini === null) return "fec_ini incorrecta";
        if (ini < pet) return "fec_ini anterior a la petición";
    }

    // Fecha de fin: OPCIONAL (la reserva puede seguir en curso).
    // Si viene, tiene que existir fec_ini (no se acaba algo que no ha empezado)
    // y tiene que ser posterior (o igual) al inicio.
    if (!esFechaVacia(d.fecha_fin)) {
        var fin = leerFecha(d.fecha_fin);
        if (fin === null) return "fecha_fin incorrecta";
        if (ini === null) return "tiene fecha_fin pero no fec_ini";
        if (fin < ini) return "fecha_fin anterior a fec_ini";
    }

    return null;    // ha pasado todas las comprobaciones → reserva CORRECTA
}

// Versión "sí/no" de la anterior (útil para filter o para un if rápido)
function esReservaValida(d) {
    return motivoReservaInvalida(d) === null;
}

// Comprueba UN ENVÍO (lo que ha subido un grupo). Null si es correcto o el motivo si no.
// Si el envío está mal, se descartan TODAS sus reservas (no sabemos de qué área son).
function motivoEnvioInvalido(e) {
    if (e === null || typeof e !== "object" || Array.isArray(e)) return "no es un objeto";

    // id_area: número entero (o texto con solo dígitos) entre 1 y 18.
    // Number(true) = 1 y Number([2]) = 2, por eso comprobamos antes el TIPO.
    var a = e.id_area;
    if (typeof a !== "number" && !(typeof a === "string" && /^\s*\d+\s*$/.test(a))) return "id_area no es un número";
    var area = Number(a);
    if (!Number.isInteger(area) || AREAS[area] === undefined) return "id_area fuera de 1-18";

    // "fecha" del envío: tiene que ser una fecha real y no estar en el futuro
    var fechaEnvio = leerFecha(e.fecha);
    if (fechaEnvio === null) return "fecha del envío incorrecta o vacía";
    if (fechaEnvio.getTime() > Date.now() + UN_DIA) return "fecha del envío en el futuro";

    // "datos" tiene que ser un array de reservas
    if (!Array.isArray(e.datos)) return "datos no es un array";

    return null;    // envío CORRECTO (sus reservas se comprueban una a una después)
}

// Versión "sí/no" de la anterior
function esEnvioValido(e) {
    return motivoEnvioInvalido(e) === null;
}

// Crea una "huella" de una reserva para detectar la MISMA reserva enviada varias veces.
// Si un grupo pulsa "Enviar" 3 veces, el Ministerio guarda sus reservas 3 veces;
// con esta clave las contamos solo UNA vez. Se ignoran mayúsculas y espacios, y las
// fechas se comparan como instante (así "2026-03-02" y "2026-03-02 00:00:00" son iguales).
function claveReserva(area, d) {
    function n(x) { return String(x === null || x === undefined ? "" : x).trim().toLowerCase(); }
    function f(x) { var t = leerFecha(x); return t ? t.getTime() : ""; }
    var categoria = d["categoría"] !== undefined ? d["categoría"] : d.categoria;
    return [area, n(d.nombre), n(d.apellidos), n(categoria), Number(d.horas_estimadas),
            f(d.fec_pet), f(d.fec_ini), f(d.fecha_fin)].join("|");
}


/* =====================================================================
   (c) RANKING DE RESERVAS POR ÁREA MÉDICA
   ---------------------------------------------------------------------
   1. GET al Ministerio → todos los envíos de todos los grupos.
   2. Por cada envío: si es incorrecto, se descarta entero.
   3. Por cada reserva del envío: si es incorrecta, se descarta;
      si ya la habíamos contado (repetida), no se suma otra vez;
      si es correcta y nueva, se suma 1 a su área.
   4. Se pasa a array, se ordena de mayor a menor y se pinta la tabla.
   ===================================================================== */
function cargarRanking() {
    mensajeMinisterio("Cargando el ranking...");

    fetch(URL_MINISTERIO)                       // GET (es el método por defecto de fetch)
        .then(function(respuesta){
            if (!respuesta.ok) throw new Error("El Ministerio respondió " + respuesta.status);
            return respuesta.json();            // texto JSON → objeto JavaScript
        })
        .then(function(contenido){
            console.log("Contenido del Ministerio:", contenido);   // para ver la forma real

            // No asumimos la forma: puede venir como array [ ... ] o como objeto { ... }
            var envios = [];
            if (Array.isArray(contenido)) {
                envios = contenido;
            } else if (contenido !== null && typeof contenido === "object") {
                envios = Object.values(contenido);
            }

            var totales = {};       // { 2: 111, 3: 80, ... } → nº de reservas válidas por área
            var vistas = {};        // huellas de las reservas ya contadas (para no duplicar)
            var validas = 0;        // total de reservas válidas
            var repetidas = 0;      // reservas idénticas que no se cuentan otra vez
            var descartes = {};     // { "motivo": cuántas } → para la tabla de la consola
            var nDescartados = 0;   // total de registros descartados

            function descartar(motivo) {
                descartes[motivo] = (descartes[motivo] || 0) + 1;
                nDescartados++;
            }

            envios.forEach(function(envio){
                // 2. Comprobar el ENVÍO completo
                var motivoEnvio = motivoEnvioInvalido(envio);
                if (motivoEnvio !== null) {
                    descartar("ENVÍO: " + motivoEnvio);
                    return;                         // envío incorrecto → no se mira nada de él
                }
                var area = Number(envio.id_area);   // "2" → 2

                // 3. Comprobar CADA RESERVA del envío
                envio.datos.forEach(function(d){
                    var motivo = motivoReservaInvalida(d);
                    if (motivo !== null) {
                        descartar("RESERVA: " + motivo);
                        return;                     // reserva incorrecta → no se cuenta
                    }

                    // >>> AQUÍ se FILTRA si en el examen piden contar solo algunas reservas
                    //     (de un sanitario, de una categoría, de unas fechas...):
                    //     if (d.nombre !== "Carlos") return;

                    var clave = claveReserva(area, d);
                    if (vistas[clave]) {            // ya contada → no se suma otra vez
                        repetidas++;
                        return;
                    }
                    vistas[clave] = true;

                    totales[area] = (totales[area] || 0) + 1;   // una reserva más para esa área
                    validas++;
                });
            });

            // Resumen en la consola (F12) para poder comprobarlo todo
            console.log("Envíos recibidos:", envios.length,
                        "| Reservas válidas:", validas,
                        "| Repetidas (no se cuentan):", repetidas,
                        "| Descartadas:", nDescartados);
            console.table(descartes);               // tabla: motivo → cuántas veces

            // 4. Pasar de objeto { 2: 111, 3: 80 } a array [{area:2,total:111}, ...] y ordenar
            //    de MAYOR a MENOR (si empatan, por número de área)
            var ranking = Object.keys(totales)
                .map(function(a){ return { area: Number(a), total: totales[a] }; })
                .sort(function(a, b){ return b.total - a.total || a.area - b.area; });

            pintarRanking(ranking);

            var texto = "Ranking actualizado: " + validas + " reservas válidas";
            if (repetidas > 0) texto += ", " + repetidas + " repetidas no contadas";
            if (nDescartados > 0) texto += ", " + nDescartados + " registros incorrectos descartados";
            mensajeMinisterio(texto + ".");
        })
        .catch(function(error){
            // Sin conexión, el Ministerio caído o un JSON que no se puede leer
            mensajeMinisterio("Error al cargar el ranking: " + error.message);
        });
}

// Pinta la tabla del ranking: posición (medallas para los 3 primeros), área y nº de reservas.
// Nuestra área sale en negrita con "(nosotros)".
function pintarRanking(ranking) {
    var medallas = ["🥇", "🥈", "🥉"];
    var html = "";

    if (ranking.length === 0) {
        html = "<tr><td colspan='3'>Todavía no hay datos</td></tr>";
    }

    ranking.forEach(function(fila, i){
        var posicion = i < 3 ? medallas[i] : (i + 1);
        var nombre = AREAS[fila.area];
        if (fila.area === MI_ID_AREA) nombre = "<b>" + nombre + " (nosotros)</b>";
        html += "<tr>" +
                    "<td>" + posicion + "</td>" +
                    "<td>" + nombre + "</td>" +
                    "<td>" + fila.total.toLocaleString("es-ES") + "</td>" +   // 1234 → "1.234"
                "</tr>";
    });

    document.getElementById("ranking_cuerpo").innerHTML = html;
}


function ContarArea() {

    var texto = document.getElementById("area_consulta").value.trim();
    var area = Number(texto);

    if (texto === "" || !Number.isInteger(area) || AREAS[area] === undefined) {
        alert("Escribe un id_area válido (del 1 al 18)");
        return;
    }

    fetch(URL_MINISTERIO)
        .then(function(respuesta){
            if (!respuesta.ok) throw new Error("El Ministerio respondió " + respuesta.status);
            return respuesta.json();
        })
        .then(function(contenido){
       
            var envios = Array.isArray(contenido) ? contenido : Object.values(contenido || {});

            var total = 0;
            envios.forEach(function(envio){
                if (!esEnvioValido(envio)) return;              
                if (Number(envio.id_area) !== area) return;     
                total++;                                        
            });

         
            alert("Existen " + total + " reservas del área de " + AREAS[area]);
        })
        .catch(function(error){
            alert("Error al consultar el Ministerio: " + error.message);
        });
}


var MI_ID_AREA=1; 

function PorcentajeReservasFinalizadas() {

     fetch(URL_MINISTERIO)
        .then(function(respuesta){
            if (!respuesta.ok) throw new Error("El Ministerio respondió " + respuesta.status);
            return respuesta.json();
        })
        .then(function(contenido){
   
            var envios = Array.isArray(contenido) ? contenido : Object.values(contenido || {});
            var totalFinalizados = 0;
            var totalTodos=0; 

            envios.forEach(function(envio){
                if (!esEnvioValido(envio)) return;                  
                if (Number(envio.id_area) !== MI_ID_AREA) return;   
     
           
                envio.datos.forEach(function(d){

                    if (esReservaValida(d)){
                        totalTodos++;
                        if (!esFechaVacia(d.fecha_fin)){
                            totalFinalizados++;             
                        } 
                    }                  
                                              
                });
            });

            var porcentaje = 0;

            if(totalTodos > 0){
                porcentaje = (totalFinalizadas / totalTodos) * 100;
            }
            var mensaje = "De las reservas de ese área, el " + porcentaje.toFixed(2) + " están finalizadas"
    
            alert(mensaje);
            mensajeMinisterio(mensaje);
        }); 
    
}

/*
function PorcentajeFinalizadas(){
    var idArea = 1;
    fetch(URL_MINISTERIO)
    .then(function(respuesta){
        return respuesta.json();
    })
    .then(function(envios){

        var total = 0;
        var finalizadas = 0;
        envios.forEach(function(envio){

            if(!esEnvioValido(envio)) return;

            if(Number(envio.id_area) !== idArea) return;

            envio.datos.forEach(function(reserva){

                if(esReservaValida(reserva)){

                    total++;
                    if(!esFechaVacia(reserva.fecha_fin)){
                        finalizadas++;
                    }

                }
            });

        });

        var porcentaje = 0;

        if(total > 0){
            porcentaje = (finalizadas / total) * 100;
        }
        var mensaje = "De las reservas de ese área, el " + porcentaje.toFixed(2) + " están finalizadas"
           
        alert(mensaje);
        mensajeMinisterio(mensaje);

    });

}
*/
