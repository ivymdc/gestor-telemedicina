// IVY - SERVIDOR REST (versión NUBE: PostgreSQL en Supabase + JWT)

var express = require("express");
var jwt = require("jwt-simple");
var app = express();

var conexion = require("./conexion_postgres.js");

// ===== CONFIGURACIÓN JWT =====
// En Render la clave viene de la variable de entorno CLAVE_JWT; en local se usa la de por defecto
var CLAVE_JWT = process.env.CLAVE_JWT || "miSecretoMasOscuro";
var DURACION_TOKEN = 60 * 60 * 1000;           // 1 hora en milisegundos

// ===== MIDDLEWARE GENERAL =====
app.use("/gestor", express.static("cliente_gestor"));
app.use(express.json());

function errorBD(res, err) {
    console.error("Error en la base de datos:", err);
    res.status(500).json("Error en la base de datos");
}


/* ================= SERVICIOS PÚBLICOS (no necesitan token) ================= */

/* LOGIN GESTOR: devuelve { token, id } */
app.post("/api/gestores/login", function(req, res){

    var sql = "SELECT id FROM gestores WHERE usuario = $1 AND password = $2";

    conexion.query(sql, [req.body.usuario, req.body.password], function(err, resultado){
        if(err) return errorBD(res, err);
        var filas = resultado.rows;

        if(filas.length == 0){
            res.status(403).json("Usuario o contraseña incorrecta");
            return;
        }

        var contenido = {
            usuario: filas[0].id,
            expira: Date.now() + DURACION_TOKEN
        };
        var token = jwt.encode(contenido, CLAVE_JWT);

        res.status(200).json({ token: token, id: filas[0].id });
    });
});

/* REGISTRO GESTOR */
app.post("/api/gestores", function(req, res){

    var sql = "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES ($1, $2, $3, $4) RETURNING id";
    var valores = [req.body.nombre, req.body.apellidos, req.body.usuario, req.body.password];

    conexion.query(sql, valores, function(err, resultado){
        if(err){
            if(err.code == "23505"){            // valor duplicado en una columna UNIQUE
                res.status(403).json("El usuario ya existe");
                return;
            }
            return errorBD(res, err);
        }

        res.status(201).json({
            id: resultado.rows[0].id,
            nombre: req.body.nombre,
            apellidos: req.body.apellidos
        });
    });
});


/* ================= COMPROBACIÓN DEL TOKEN (todo lo de debajo es privado) ================= */
app.use("/api", function(req, res, next){

    var token = req.query.token;

    if(!token){
        res.status(401).json("No se ha encontrado token");
        return;
    }

    var contenido;
    try {
        contenido = jwt.decode(token, CLAVE_JWT);
    } catch(error) {
        res.status(401).json("El token es incorrecto");
        return;
    }

    if(!contenido || !contenido.usuario || !contenido.expira){
        res.status(401).json("El formato del token no es adecuado");
        return;
    }

    if(contenido.expira < Date.now()){
        res.status(401).json("El token ha expirado");
        return;
    }

    req.idGestor = contenido.usuario;
    next();
});


/* ================= SERVICIOS PRIVADOS (necesitan token) ================= */

app.get("/api/ubicaciones", function(req, res){
    conexion.query("SELECT * FROM ubicaciones ORDER BY id", function(err, resultado){
        if(err) return errorBD(res, err);
        res.status(200).json(resultado.rows);
    });
});

app.get("/api/categorias", function(req, res){
    conexion.query("SELECT * FROM categorias ORDER BY id", function(err, resultado){
        if(err) return errorBD(res, err);
        res.status(200).json(resultado.rows);
    });
});

app.get("/api/modelos", function(req, res){
    conexion.query("SELECT * FROM modelos ORDER BY id", function(err, resultado){
        if(err) return errorBD(res, err);
        res.status(200).json(resultado.rows);
    });
});

/* PUT ACTUALIZAR GESTOR */
app.put("/api/gestores/:id", function(req, res){
    var sql = "UPDATE gestores SET nombre = $1, apellidos = $2, usuario = $3, password = $4 WHERE id = $5";
    var valores = [req.body.nombre, req.body.apellidos, req.body.usuario, req.body.password, req.params.id];

    conexion.query(sql, valores, function(err, resultado){
        if(err){
            if(err.code == "23505"){
                res.status(403).json("El usuario ya existe");
                return;
            }
            return errorBD(res, err);
        }
        if(resultado.rowCount == 0){
            res.status(404).json("Gestor no encontrado");
            return;
        }
        res.status(200).json("Gestor actualizado");
    });
});

/* GET GESTOR POR ID (sin contraseña) */
app.get("/api/gestores/:id", function(req, res){
    var sql = "SELECT id, nombre, apellidos, usuario FROM gestores WHERE id = $1";
    conexion.query(sql, [req.params.id], function(err, resultado){
        if(err) return errorBD(res, err);
        if(resultado.rows.length == 0){
            res.status(404).json("Gestor no encontrado");
            return;
        }
        res.status(200).json(resultado.rows[0]);
    });
});

/* GET SANITARIO POR ID (sin contraseña) */
app.get("/api/sanitarios/:id", function(req, res){
    var sql = "SELECT id, nombre, apellidos, usuario FROM sanitarios WHERE id = $1";
    conexion.query(sql, [req.params.id], function(err, resultado){
        if(err) return errorBD(res, err);
        if(resultado.rows.length == 0){
            res.status(404).json("Sanitario no encontrado");
            return;
        }
        res.status(200).json(resultado.rows[0]);
    });
});

/* GET RECURSOS con filtros opcionales */
app.get("/api/recursos", function(req, res){

    var sql = `SELECT r.id, r.numero_serie, r.estado,
                      u.nombre AS ubicacion_nombre,
                      m.id AS modelo_id, m.nombre AS modelo_nombre,
                      c.id AS categoria_id, c.nombre AS categoria_nombre
               FROM recursos r
               JOIN modelos m ON r.modelo = m.id
               JOIN categorias c ON m.categoria = c.id
               JOIN ubicaciones u ON r.ubicacion = u.id
               WHERE 1 = 1`;
    var valores = [];

    // En PostgreSQL los huecos se numeran ($1, $2...): el número es la posición en "valores"
    function hueco(valor){
        valores.push(valor);
        return "$" + valores.length;
    }

    if(req.query.categoria){ sql += " AND c.id = "     + hueco(req.query.categoria); }
    if(req.query.modelo){    sql += " AND m.id = "     + hueco(req.query.modelo); }
    if(req.query.ubicacion){ sql += " AND u.id = "     + hueco(req.query.ubicacion); }
    if(req.query.estado){    sql += " AND r.estado = " + hueco(req.query.estado); }

    sql += " ORDER BY r.id";

    conexion.query(sql, valores, function(err, resultado){
        if(err) return errorBD(res, err);

        var respuesta = resultado.rows.map(function(f){
            return {
                id: f.id,
                numero_serie: f.numero_serie,
                estado: f.estado,
                ubicacion: f.ubicacion_nombre,
                modelo: {
                    id: f.modelo_id,
                    nombre: f.modelo_nombre,
                    categoria: { id: f.categoria_id, nombre: f.categoria_nombre }
                }
            };
        });
        res.status(200).json(respuesta);
    });
});

/* GET RECURSO POR ID (ficha) */
app.get("/api/recursos/:id", function(req, res){

    var sql = `SELECT r.id, r.numero_serie, r.estado,
                      u.id AS ubicacion_id, u.nombre AS ubicacion_nombre,
                      m.id AS modelo_id, m.nombre AS modelo_nombre,
                      c.id AS categoria_id, c.nombre AS categoria_nombre
               FROM recursos r
               JOIN modelos m ON r.modelo = m.id
               JOIN categorias c ON m.categoria = c.id
               JOIN ubicaciones u ON r.ubicacion = u.id
               WHERE r.id = $1`;

    conexion.query(sql, [req.params.id], function(err, resultado){
        if(err) return errorBD(res, err);
        if(resultado.rows.length == 0){
            res.status(404).json("Recurso no encontrado");
            return;
        }
        var f = resultado.rows[0];
        res.status(200).json({
            id: f.id,
            numero_serie: f.numero_serie,
            estado: f.estado,
            modelo: {
                id: f.modelo_id,
                nombre: f.modelo_nombre,
                categoria: { id: f.categoria_id, nombre: f.categoria_nombre }
            },
            ubicacion: { id: f.ubicacion_id, nombre: f.ubicacion_nombre }
        });
    });
});

/* POST CREAR RECURSO */
app.post("/api/recursos", function(req, res){
    var sql = "INSERT INTO recursos (modelo, ubicacion, numero_serie, estado) VALUES ($1, $2, $3, $4) RETURNING id";
    var valores = [req.body.modelo, req.body.ubicacion, req.body.numero_serie, req.body.estado];

    conexion.query(sql, valores, function(err, resultado){
        if(err) return errorBD(res, err);
        res.status(201).json({
            id: resultado.rows[0].id,
            modelo: req.body.modelo,
            ubicacion: req.body.ubicacion,
            numero_serie: req.body.numero_serie,
            estado: req.body.estado
        });
    });
});

/* PUT ACTUALIZAR RECURSO */
app.put("/api/recursos/:id", function(req, res){
    var sql = "UPDATE recursos SET modelo = $1, ubicacion = $2, numero_serie = $3, estado = $4 WHERE id = $5";
    var valores = [req.body.modelo, req.body.ubicacion, req.body.numero_serie, req.body.estado, req.params.id];

    conexion.query(sql, valores, function(err, resultado){
        if(err) return errorBD(res, err);
        if(resultado.rowCount == 0){
            res.status(404).json("Recurso no encontrado");
            return;
        }
        res.status(200).json("Recurso actualizado correctamente");
    });
});

/* DELETE RECURSO */
app.delete("/api/recursos/:id", function(req, res){
    conexion.query("DELETE FROM recursos WHERE id = $1", [req.params.id], function(err, resultado){
        if(err){
            if(err.code == "23503"){            // lo impide una clave ajena (tiene reservas o reseñas)
                res.status(403).json("No se puede borrar: el recurso tiene reservas o reseñas");
                return;
            }
            return errorBD(res, err);
        }
        if(resultado.rowCount == 0){
            res.status(404).json("Recurso no encontrado");
            return;
        }
        res.status(200).json("Recurso borrado");
    });
});

/* GET RESERVAS DE UN RECURSO (con color) */
app.get("/api/recursos/:id/reservas", function(req, res){

    var sql = `SELECT CONCAT(s.nombre, ' ', s.apellidos) AS sanitario,
                      r.horas_estimadas, r.fecha_peticion, r.fecha_inicio, r.fecha_fin,
                      CASE
                          WHEN r.fecha_fin IS NOT NULL THEN 'white'
                          WHEN r.fecha_inicio IS NOT NULL
                               AND EXTRACT(EPOCH FROM (NOW() - r.fecha_inicio)) > r.horas_estimadas * 3600 THEN 'red'
                          WHEN r.fecha_inicio IS NOT NULL THEN 'blue'
                          ELSE 'green'
                      END AS color
               FROM reservas r
               JOIN sanitarios s ON r.sanitario = s.id
               WHERE r.recurso = $1
               ORDER BY r.fecha_peticion`;

    conexion.query(sql, [req.params.id], function(err, resultado){
        if(err) return errorBD(res, err);
        res.status(200).json(resultado.rows);
    });
});

/* GET RESEÑAS DE UN RECURSO */
app.get("/api/recursos/:id/resenyas", function(req, res){

    var sql = `SELECT r.fecha, CONCAT(s.nombre, ' ', s.apellidos) AS sanitario,
                      r.valor, r.descripcion
               FROM resenyas r
               JOIN sanitarios s ON r.sanitario = s.id
               WHERE r.recurso = $1
               ORDER BY r.fecha`;

    conexion.query(sql, [req.params.id], function(err, resultado){
        if(err) return errorBD(res, err);
        res.status(200).json(resultado.rows);
    });
});

/* PRÁCTICA 3 - PARTE 1: TODAS LAS RESERVAS con el formato del Ministerio */
app.get("/api/reservas", function(req, res){

    var sql = `SELECT s.nombre, s.apellidos,
                      c.nombre AS categoria,
                      r.horas_estimadas,
                      TO_CHAR(r.fecha_peticion, 'YYYY-MM-DD HH24:MI:SS') AS fec_pet,
                      TO_CHAR(r.fecha_inicio,   'YYYY-MM-DD HH24:MI:SS') AS fec_ini,
                      TO_CHAR(r.fecha_fin,      'YYYY-MM-DD HH24:MI:SS') AS fecha_fin
               FROM reservas r
               JOIN sanitarios s ON r.sanitario = s.id
               JOIN recursos re  ON r.recurso = re.id
               JOIN modelos m    ON re.modelo = m.id
               JOIN categorias c ON m.categoria = c.id
               ORDER BY r.fecha_peticion`;

    conexion.query(sql, function(err, resultado){
        if(err) return errorBD(res, err);
        res.status(200).json(resultado.rows);
    });
});

/* EJERCICIO 2 (examen práctica 1) */
app.post("/api/area_salud", function(req, res){
    var sql = "INSERT INTO areas (codigo, nombre, gestor) VALUES ($1, $2, $3)";
    conexion.query(sql, [req.body.codigo, req.body.nombre, req.body.gestor], function(err){
        if(err) return errorBD(res, err);
        res.status(201).json({
            codigo: req.body.codigo,
            nombre: req.body.nombre,
            gestor: req.body.gestor
        });
    });
});


module.exports = app;